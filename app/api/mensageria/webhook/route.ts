import { NextRequest, NextResponse } from 'next/server'
import { addInboxMessage, addLog, createId, maskId, maskPhone, updateInboxMessageStatus, updateIntegration } from '@/lib/whatsapp/store'
import type { MessageStatus } from '@/lib/whatsapp/types'


function normalizeMetaStatus(status: string): MessageStatus {
  if (status === 'sent' || status === 'delivered' || status === 'read' || status === 'failed') return status
  return 'queued'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()

  if (mode !== 'subscribe' || !challenge) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  if (!expected || token !== expected) {
    addLog({
      type: 'webhook_received',
      status: 'failed',
      description: 'Failed: webhook verification token did not match.',
      recommendedAction: 'Set WHATSAPP_WEBHOOK_VERIFY_TOKEN on the server and configure the same value in Meta.',
    })
    return new NextResponse('Forbidden', { status: 403 })
  }

  updateIntegration({ webhookVerifiedAt: new Date().toISOString() })
  addLog({
    type: 'webhook_received',
    status: 'success',
    description: 'Meta webhook verification completed.',
    safePayload: { mode },
  })
  return new NextResponse(challenge, { status: 200 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      object?: string
      entry?: Array<{
        id?: string
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string; display_phone_number?: string }
            statuses?: Array<{ id: string; status: string; timestamp?: string; recipient_id?: string; errors?: unknown[] }>
            messages?: Array<{ from: string; id: string; timestamp: string; type: string; text?: { body?: string } }>
          }
        }>
      }>
    }

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true })
    }

    let inboundCount = 0
    let statusCount = 0

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value
        const phoneNumberId = value?.metadata?.phone_number_id ?? ''

        for (const status of value?.statuses ?? []) {
          statusCount += 1
          updateInboxMessageStatus(status.id, normalizeMetaStatus(status.status), status.errors?.[0])
          addLog({
            type: 'webhook_received',
            status: status.status === 'failed' ? 'failed' : 'info',
            description: `Webhook message status received: ${status.status}.`,
            safePayload: {
              messageId: maskId(status.id),
              recipient: maskPhone(status.recipient_id),
              status: status.status,
            },
            error: status.errors?.[0],
          })
        }

        for (const message of value?.messages ?? []) {
          inboundCount += 1
          const timestamp = message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString()

          addInboxMessage({
            id: createId('msg'),
            metaMessageId: message.id,
            conversationId: `conv-${message.from}`,
            direction: 'inbound',
            from: message.from,
            to: phoneNumberId,
            text: message.text?.body ?? `[${message.type}]`,
            status: 'received',
            timestamp,
          })
        }
      }
    }

    if (inboundCount > 0) {
      addLog({
        type: 'inbox_updated',
        status: 'success',
        description: 'Inbox updated with inbound WhatsApp webhook messages.',
        safePayload: { inboundCount },
        recommendedAction: 'Open Inbox to review and reply within the 24h customer service window.',
      })
    }

    if (inboundCount === 0 && statusCount === 0) {
      addLog({ type: 'webhook_received', status: 'info', description: 'Webhook received with no message or status events.' })
    }
  } catch (error) {
    addLog({
      type: 'webhook_received',
      status: 'failed',
      description: 'Failed: webhook payload could not be processed.',
      error,
      recommendedAction: 'Validate Meta webhook payload shape and server logs.',
    })
  }

  return NextResponse.json({ ok: true })
}
