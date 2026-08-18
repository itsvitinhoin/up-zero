import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import {
  inspectEcommerceEvent,
  processEcommerceEvent,
  UnsupportedEcommerceEventError,
} from '@/lib/whatsapp/automations'


function safeTextEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function isValidSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const normalized = signature.replace(/^sha256=/i, '')
  return /^[a-f\d]{64}$/i.test(normalized) && safeTextEqual(expected, normalized)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const secret = process.env.UPZERO_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { accepted: false, error: 'UPZERO_WEBHOOK_SECRET is not configured.' },
      { status: 503 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody || '{}') as Record<string, unknown>
  } catch {
    return NextResponse.json({ accepted: false, error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const signature = req.headers.get('x-upzero-signature') ?? req.headers.get('x-binext-signature')
  const queryToken = req.nextUrl.searchParams.get('token')
  const headerToken = req.headers.get('x-upzero-webhook-token')
  const authorization = req.headers.get('authorization')
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null
  const bodyToken = typeof body.token === 'string' ? body.token : null
  const tokenCandidates = [queryToken, headerToken, bearerToken, bodyToken].filter((value): value is string => Boolean(value))
  const authenticated = isValidSignature(rawBody, signature, secret)
    || tokenCandidates.some((token) => safeTextEqual(token, secret))

  if (!authenticated) {
    return NextResponse.json({ accepted: false, error: 'Invalid webhook authentication.' }, { status: 401 })
  }

  const { token: _redactedToken, ...bodyWithoutToken } = body
  const queryType = req.nextUrl.searchParams.get('type')?.trim()
  const queryPhone = req.nextUrl.searchParams.get('phone')?.trim()
  const queryEventId = req.nextUrl.searchParams.get('event_id')?.trim()
  const hasBodyEventType = ['event', 'type', 'event_type', 'eventType', 'name']
    .some((key) => typeof bodyWithoutToken[key] === 'string' && String(bodyWithoutToken[key]).trim())
  const hasBodyPhone = ['phone', 'customer_phone']
    .some((key) => typeof bodyWithoutToken[key] === 'string' && String(bodyWithoutToken[key]).trim())
  const eventBody: Record<string, unknown> = {
    ...bodyWithoutToken,
    ...(!hasBodyEventType && queryType ? { type: queryType } : {}),
    ...(!hasBodyPhone && queryPhone ? { phone: queryPhone } : {}),
    ...(queryEventId && typeof bodyWithoutToken.event_id !== 'string' ? { event_id: queryEventId } : {}),
  }
  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1'
    || req.headers.get('x-upzero-dry-run') === '1'

  try {
    const result = dryRun
      ? await inspectEcommerceEvent(eventBody)
      : await processEcommerceEvent(eventBody)
    console.info('[mensageria:ecommerce] processed', {
      dryRun,
      eventType: result.event.type,
      eventStatus: 'status' in result.event ? result.event.status : undefined,
      duplicate: 'duplicate' in result ? result.duplicate : undefined,
      queuedJobs: 'queuedJobs' in result ? result.queuedJobs.length : undefined,
      processing: 'processing' in result ? result.processing : undefined,
      matchedAutomations: 'matchedAutomations' in result ? result.matchedAutomations.length : undefined,
    })
    return NextResponse.json(result, { status: dryRun ? 200 : 202 })
  } catch (error) {
    if (error instanceof UnsupportedEcommerceEventError) {
      return NextResponse.json({
        accepted: false,
        error: 'Unsupported e-commerce event.',
        receivedType: error.receivedType,
      }, { status: 422 })
    }
    console.error('[mensageria:ecommerce] failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { accepted: false, error: 'E-commerce event could not be processed.' },
      { status: 500 },
    )
  }
}
