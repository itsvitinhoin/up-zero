import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone, renderTemplate } from '@/lib/whatsapp/engine'
import { sendTemplateMessage } from '@/lib/whatsapp/provider'
import { addInboxMessage, addLog, createId, getState, maskId, maskPhone, updateIntegration } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


function recommendedSendAction(error?: { message?: string; action?: string } | string): string {
  const message = typeof error === 'string' ? error : error?.message ?? ''
  if (/133010|account not registered/i.test(message)) {
    return 'Register the selected WhatsApp phone number for Cloud API with POST /{phone_number_id}/register, then click Atualizar Meta, reselect the phone number and try again.'
  }

  if (/131030|recipient|allowed|phone number list|not.*valid|not.*whatsapp/i.test(message)) {
    return 'If you are using the Meta test sender number, add and verify this recipient in Meta Developers > WhatsApp > API Setup > Manage phone number list. For unrestricted real recipients, use a registered real WhatsApp Business phone number, approved template and opt-in.'
  }

  return typeof error === 'object' && error?.action
    ? error.action
    : 'Check phone number, template status, opt-in and Meta permissions.'
}

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.send').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para enviar mensagens' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    recipientPhone?: string
    templateId?: string
    values?: Record<string, string>
    optInConfirmed?: boolean
  }

  const state = await getState()
  const phoneNumber = state.phoneNumbers.find((item) => item.id === state.integration.phoneNumberId)
  const template = state.templates.find((item) => item.id === (body.templateId ?? state.integration.selectedTemplateId))
  const recipient = normalizePhone(body.recipientPhone ?? '')

  if (!state.integration.phoneNumberId || !phoneNumber) {
    const error = 'No WhatsApp phone number is selected.'
    await addLog({ type: 'message_sent', status: 'failed', description: `Failed: ${error}`, recommendedAction: 'Select a connected WhatsApp phone number.' })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  if (!template || template.status !== 'APPROVED') {
    const error = 'An APPROVED template is required to initiate a WhatsApp conversation.'
    await addLog({ type: 'message_sent', status: 'failed', description: `Failed: ${error}`, recommendedAction: 'Select an approved template.' })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  if (!recipient) {
    const error = 'Recipient WhatsApp number is invalid.'
    await addLog({ type: 'message_sent', status: 'failed', description: `Failed: ${error}`, recommendedAction: 'Use country code + area code + phone number.' })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  if (!body.optInConfirmed) {
    const error = 'WhatsApp opt-in confirmation is required before sending.'
    await addLog({ type: 'message_sent', status: 'failed', description: `Failed: ${error}`, safePayload: { recipient: maskPhone(recipient) }, recommendedAction: 'Confirm the recipient opted in to WhatsApp messages.' })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  const values = body.values ?? {}
  const preview = renderTemplate(template.body, values)
  const result = await sendTemplateMessage({
    phoneNumberId: state.integration.phoneNumberId,
    to: recipient,
    template,
    values,
  })

  if (!result.ok) {
    const action = recommendedSendAction(result.error)
    await addLog({
      type: 'message_sent',
      status: 'failed',
      description: 'Failed: Meta did not accept the test WhatsApp message.',
      safePayload: { recipient: maskPhone(recipient), template: template.name },
      error: result.error,
      recommendedAction: action,
    })
    return NextResponse.json({ ok: false, error: { ...result.error, action }, preview }, { status: 200 })
  }

  const messageId = result.data?.messages?.[0]?.id ?? createId('wamid')
  await updateIntegration({ lastTestMessageId: messageId })
  await addInboxMessage({
    id: createId('msg'),
    metaMessageId: messageId,
    conversationId: `conv-${recipient}`,
    direction: 'outbound',
    from: state.integration.phoneNumberId,
    to: recipient,
    text: preview,
    status: 'sent',
    timestamp: new Date().toISOString(),
    templateId: template.id,
  })
  await addLog({
    type: 'message_sent',
    status: 'success',
    description: 'WhatsApp template message sent through Meta.',
    safePayload: { messageId: maskId(messageId), recipient: maskPhone(recipient), template: template.name },
    recommendedAction: 'Open WhatsApp, confirm delivery, reply, then check Inbox/webhook.',
  })

  return NextResponse.json({ ok: true, messageId, preview })
}
