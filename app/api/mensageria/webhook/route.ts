import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { addIntegrationLog, addWebhookEvent, getConnections } from '@/lib/whatsapp/store'
import { maskPhone } from '@/lib/whatsapp/meta'

// GET — Meta webhook verification challenge
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !token) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Check against all configured connections and optional shared env token.
  const connections = getConnections()
  const envVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  const matched = connections.find((c) => c.webhookVerifyToken && c.webhookVerifyToken === token)
  const matchedEnv = envVerifyToken && envVerifyToken === token

  if (!matched && !matchedEnv) {
    console.warn('[WA Webhook] Verification failed — verify token did not match any configured value.')
    return new NextResponse('Forbidden', { status: 403 })
  }

  console.info('[WA Webhook] Verified callback URL.')
  return new NextResponse(challenge, { status: 200 })
}

function isValidSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appSecret) return true
  if (!signature?.startsWith('sha256=')) return false

  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

// POST — incoming messages from Meta (read receipts, incoming messages, status updates)
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    if (!isValidSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
      console.warn('[WA Webhook] Rejected payload with invalid signature.')
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const body = JSON.parse(rawBody) as {
      object?: string
      entry?: {
        id: string
        changes: {
          value: {
            messaging_product: string
            metadata?: { display_phone_number?: string; phone_number_id?: string }
            statuses?: { id: string; status: string; timestamp: string; recipient_id: string }[]
            messages?: { from: string; id: string; timestamp: string; text?: { body: string }; type: string }[]
          }
          field: string
        }[]
      }[]
    }

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true })
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const val = change.value

        // Status updates (sent, delivered, read, failed)
        for (const status of val.statuses ?? []) {
          addWebhookEvent({
            id: `wh-status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            eventType: 'status',
            receivedAt: new Date(),
            from: status.recipient_id,
            messageId: status.id,
            phoneNumberId: val.metadata?.phone_number_id,
            displayPhoneNumber: val.metadata?.display_phone_number,
            status: status.status,
            rawSummary: `Message status ${status.status}`,
          })
          addIntegrationLog({
            type: 'WEBHOOK_RECEIVED',
            label: 'Webhook received',
            status: 'RECEIVED',
            detail: `Delivery status ${status.status} received for ${maskPhone(status.recipient_id)}.`,
          })
        }

        // Incoming messages
        for (const msg of val.messages ?? []) {
          addWebhookEvent({
            id: `wh-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            eventType: 'message',
            receivedAt: new Date(Number(msg.timestamp) * 1000 || Date.now()),
            from: msg.from,
            messageId: msg.id,
            phoneNumberId: val.metadata?.phone_number_id,
            displayPhoneNumber: val.metadata?.display_phone_number,
            messageType: msg.type,
            textBody: msg.type === 'text' ? msg.text?.body : undefined,
            rawSummary: msg.type === 'text' ? 'Incoming text message' : `Incoming ${msg.type} message`,
          })
          addIntegrationLog({
            type: 'WEBHOOK_RECEIVED',
            label: 'Webhook received',
            status: 'RECEIVED',
            detail: `Customer reply received from ${maskPhone(msg.from)}.`,
          })
        }
      }
    }
  } catch (e) {
    console.error('[WA Webhook] Error processing payload:', e)
  }

  // Always return 200 to Meta, otherwise they will retry
  return NextResponse.json({ ok: true })
}
