import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { processEcommerceEvent } from '@/lib/whatsapp/automations'


function isValidSignature(rawBody: string, signature: string | null) {
  const secret = process.env.UPZERO_WEBHOOK_SECRET?.trim()
  if (!secret) return true
  if (!signature) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const normalized = signature.replace(/^sha256=/i, '')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-upzero-signature') ?? req.headers.get('x-binext-signature')
  if (!isValidSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody || '{}') as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const result = await processEcommerceEvent(body)
  return NextResponse.json(result)
}
