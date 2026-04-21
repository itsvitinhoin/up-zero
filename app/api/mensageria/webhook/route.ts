import { NextRequest, NextResponse } from 'next/server'
import { getConnections } from '@/lib/whatsapp/store'

// GET — Meta webhook verification challenge
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !token) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Check against all configured connections
  const connections = getConnections()
  const matched = connections.find((c) => c.webhookVerifyToken && c.webhookVerifyToken === token)

  if (!matched) {
    console.warn('[WA Webhook] Verification failed — token not matched:', token)
    return new NextResponse('Forbidden', { status: 403 })
  }

  console.log('[WA Webhook] Verified for connection:', matched.name)
  return new NextResponse(challenge, { status: 200 })
}

// POST — incoming messages from Meta (read receipts, incoming messages, status updates)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      object?: string
      entry?: {
        id: string
        changes: {
          value: {
            messaging_product: string
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
          console.log(`[WA Webhook] Status update: msg ${status.id} → ${status.status} for ${status.recipient_id}`)
        }

        // Incoming messages
        for (const msg of val.messages ?? []) {
          console.log(`[WA Webhook] Incoming message from ${msg.from}: ${msg.text?.body ?? `[${msg.type}]`}`)
        }
      }
    }
  } catch (e) {
    console.error('[WA Webhook] Error processing payload:', e)
  }

  // Always return 200 to Meta, otherwise they will retry
  return NextResponse.json({ ok: true })
}
