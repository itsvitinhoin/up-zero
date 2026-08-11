import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/whatsapp/engine'
import { sendTextMessage } from '@/lib/whatsapp/provider'
import { addInboxMessage, addLog, createId, getState, maskId, maskPhone } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function GET() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  return NextResponse.json(getState().conversations)
}

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.send').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para enviar mensagens' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { conversationId?: string; to?: string; text?: string }
  const state = getState()
  const conversation = state.conversations.find((item) => item.id === body.conversationId)
  const phoneNumber = state.phoneNumbers.find((item) => item.id === state.integration.phoneNumberId)

  if (!conversation && !body.to) {
    return NextResponse.json({ error: 'conversationId or to is required.' }, { status: 400 })
  }

  if (!state.integration.phoneNumberId || !phoneNumber) {
    const error = 'No WhatsApp phone number is selected.'
    addLog({
      type: 'inbox_updated',
      status: 'failed',
      description: `Failed: ${error}`,
      recommendedAction: 'Select a connected WhatsApp phone number before replying from Inbox.',
    })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  const recipient = normalizePhone(body.to ?? conversation?.phone ?? '')
  if (!recipient) {
    const error = 'Recipient WhatsApp number is invalid.'
    addLog({
      type: 'inbox_updated',
      status: 'failed',
      description: `Failed: ${error}`,
      recommendedAction: 'Use country code + area code + phone number.',
    })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  if (!body.text?.trim()) return NextResponse.json({ error: 'Reply text is required.' }, { status: 400 })

  const windowOpen = Boolean(conversation?.windowExpiresAt && new Date(conversation.windowExpiresAt) > new Date())
  if (!windowOpen) {
    const error = 'Free-form WhatsApp replies require an open 24h customer service window.'
    addLog({
      type: 'inbox_updated',
      status: 'needs_attention',
      description: `Needs attention: ${error}`,
      safePayload: { recipient: maskPhone(recipient) },
      recommendedAction: 'Ask the customer to reply first, or send an approved template from Envio de Teste/Campanhas.',
    })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  const result = await sendTextMessage({
    phoneNumberId: state.integration.phoneNumberId,
    to: recipient,
    text: body.text.trim(),
  })

  if (!result.ok) {
    addLog({
      type: 'inbox_updated',
      status: 'failed',
      description: 'Failed: Meta did not accept the Inbox reply.',
      safePayload: { recipient: maskPhone(recipient) },
      error: result.error,
      recommendedAction: 'Confirm the 24h window is open, the phone number is registered and whatsapp_business_messaging is granted.',
    })
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
  }

  const messageId = result.data?.messages?.[0]?.id ?? createId('wamid')

  addInboxMessage({
    id: createId('msg'),
    metaMessageId: messageId,
    conversationId: conversation?.id ?? `conv-${recipient}`,
    direction: 'outbound',
    from: state.integration.phoneNumberId ?? 'not-selected',
    to: recipient,
    text: body.text.trim(),
    status: 'sent',
    timestamp: new Date().toISOString(),
  })

  addLog({
    type: 'inbox_updated',
    status: 'success',
    description: 'Inbox reply sent through Meta Cloud API.',
    safePayload: { messageId: maskId(messageId), recipient: maskPhone(recipient) },
    recommendedAction: 'Delivery/read status will appear when Meta sends status webhooks.',
  })

  return NextResponse.json({ ok: true, messageId, conversations: getState().conversations })
}
