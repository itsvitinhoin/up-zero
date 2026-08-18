import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { addInboxMessage, addLog, createId, maskId, maskPhone, updateAutomationRunStatus, updateInboxMessageStatus, updateIntegration } from '@/lib/whatsapp/store'
import type { InboxMessage, MessageMediaType, MessageStatus } from '@/lib/whatsapp/types'

interface MetaMediaObject {
  id?: string
  mime_type?: string
  sha256?: string
  caption?: string
  filename?: string
  voice?: boolean
}

interface MetaIncomingMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body?: string }
  image?: MetaMediaObject
  video?: MetaMediaObject
  audio?: MetaMediaObject
  document?: MetaMediaObject
  sticker?: MetaMediaObject
}

interface MetaWebhookPayload {
  object?: string
  entry?: Array<{
    id?: string
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string }
        statuses?: Array<{ id: string; status: string; timestamp?: string; recipient_id?: string; errors?: unknown[] }>
        messages?: MetaIncomingMessage[]
      }
    }>
  }>
}

function verifyMetaWebhookSignature(rawBody: string, signature: string | null, appSecret: string) {
  if (!signature?.startsWith('sha256=') || !appSecret) return false

  const receivedHex = signature.slice('sha256='.length)
  if (!/^[a-f\d]{64}$/i.test(receivedHex)) return false

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest()
  const received = Buffer.from(receivedHex, 'hex')

  return received.length === expected.length && timingSafeEqual(received, expected)
}

function normalizeMetaStatus(status: string): MessageStatus {
  if (status === 'sent' || status === 'delivered' || status === 'read' || status === 'failed') return status
  return 'queued'
}

function mediaFromMessage(message: MetaIncomingMessage): InboxMessage['media'] {
  const type = ['image', 'video', 'audio', 'document', 'sticker'].includes(message.type)
    ? message.type as MessageMediaType
    : undefined
  if (!type) return undefined
  const media = message[type]
  if (!media?.id) return undefined
  return {
    type,
    metaMediaId: media.id,
    mimeType: media.mime_type,
    filename: media.filename,
    caption: media.caption,
    sha256: media.sha256,
    voice: media.voice,
  }
}

function displayText(message: MetaIncomingMessage, media: InboxMessage['media']): string {
  if (message.text?.body) return message.text.body
  if (media?.caption) return media.caption
  if (media?.filename) return media.filename
  return `[${message.type}]`
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
    await addLog({
      type: 'webhook_received',
      status: 'failed',
      description: 'Failed: webhook verification token did not match.',
      recommendedAction: 'Set WHATSAPP_WEBHOOK_VERIFY_TOKEN on the server and configure the same value in Meta.',
    })
    return new NextResponse('Forbidden', { status: 403 })
  }

  await updateIntegration({ webhookVerifiedAt: new Date().toISOString() })
  await addLog({
    type: 'webhook_received',
    status: 'success',
    description: 'Meta webhook verification completed.',
    safePayload: { mode },
  })
  return new NextResponse(challenge, { status: 200 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim() || ''

  if (!appSecret) {
    await addLog({
      type: 'webhook_received',
      status: 'failed',
      description: 'Failed: webhook signature validation is not configured.',
      recommendedAction: 'Set FACEBOOK_APP_SECRET on the server before enabling the Meta webhook.',
    })
    return NextResponse.json({ ok: false, error: 'Webhook signature validation is not configured.' }, { status: 503 })
  }

  if (!verifyMetaWebhookSignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret)) {
    await addLog({
      type: 'webhook_received',
      status: 'failed',
      description: 'Rejected: webhook signature did not match the configured Meta App Secret.',
      recommendedAction: 'Confirm the Meta App Secret and inspect the webhook configuration in Meta Developers.',
    })
    return NextResponse.json({ ok: false, error: 'Invalid webhook signature.' }, { status: 401 })
  }

  try {
    const body = JSON.parse(rawBody) as MetaWebhookPayload

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
          const normalizedStatus = normalizeMetaStatus(status.status)
          const statusError = status.errors?.[0]
          await updateInboxMessageStatus(status.id, normalizedStatus, statusError)
          if (normalizedStatus === 'sent' || normalizedStatus === 'delivered' || normalizedStatus === 'read' || normalizedStatus === 'failed') {
            await updateAutomationRunStatus(status.id, normalizedStatus, statusError)
          }
          await addLog({
            type: 'webhook_received',
            status: status.status === 'failed' ? 'failed' : 'info',
            description: `Webhook message status received: ${status.status}.`,
            safePayload: {
              messageId: maskId(status.id),
              recipient: maskPhone(status.recipient_id),
              status: status.status,
            },
            error: statusError,
          })
        }

        for (const message of value?.messages ?? []) {
          inboundCount += 1
          const timestamp = message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString()

          const media = mediaFromMessage(message)
          await addInboxMessage({
            id: createId('msg'),
            metaMessageId: message.id,
            conversationId: `conv-${phoneNumberId}-${message.from}`,
            direction: 'inbound',
            from: message.from,
            to: phoneNumberId,
            text: displayText(message, media),
            status: 'received',
            timestamp,
            media,
          })
        }
      }
    }

    if (inboundCount > 0) {
      await addLog({
        type: 'inbox_updated',
        status: 'success',
        description: 'Inbox updated with inbound WhatsApp webhook messages.',
        safePayload: { inboundCount },
        recommendedAction: 'Open Inbox to review and reply within the 24h customer service window.',
      })
    }

    if (inboundCount === 0 && statusCount === 0) {
      await addLog({ type: 'webhook_received', status: 'info', description: 'Webhook received with no message or status events.' })
    }
  } catch (error) {
    await addLog({
      type: 'webhook_received',
      status: 'failed',
      description: 'Failed: webhook payload could not be processed.',
      error,
      recommendedAction: 'Validate Meta webhook payload shape and server logs.',
    })
    return NextResponse.json({ ok: false, error: 'Invalid webhook payload.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
