import { NextRequest, NextResponse } from 'next/server'
import { addIntegrationLog, addLog, getMetaReviewState } from '@/lib/whatsapp/store'
import { getMetaAccessToken, maskPhone, metaGraphPost, safeMetaError } from '@/lib/whatsapp/meta'

export const dynamic = 'force-dynamic'

interface SendTemplateRequest {
  recipient?: string
  templateName?: string
  language?: string
  variables?: string[]
}

interface SendTemplateResponse {
  messaging_product?: string
  contacts?: { input?: string; wa_id?: string }[]
  messages?: { id: string }[]
}

function normalizeInternationalPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as SendTemplateRequest
  const selection = getMetaReviewState().selection
  const phoneNumberId = selection?.phoneNumberId
  const templateName = body.templateName ?? selection?.templateName
  const language = body.language ?? selection?.templateLanguage
  const recipient = normalizeInternationalPhone(body.recipient ?? '')

  if (!phoneNumberId) {
    return NextResponse.json({ ok: false, error: 'Select a WhatsApp phone number before sending.' }, { status: 400 })
  }
  if (!templateName || !language) {
    return NextResponse.json({ ok: false, error: 'Select an approved message template before sending.' }, { status: 400 })
  }
  if (!recipient) {
    return NextResponse.json({ ok: false, error: 'Recipient WhatsApp number must include country code and digits only.' }, { status: 400 })
  }

  const auth = getMetaAccessToken()
  if (!auth) {
    return NextResponse.json({ ok: false, error: 'Meta OAuth or FACEBOOK_SYSTEM_USER_TOKEN is required.' }, { status: 400 })
  }

  const variables = (body.variables ?? []).map((v) => v.trim()).filter(Boolean)
  const template: {
    name: string
    language: { code: string }
    components?: { type: 'body'; parameters: { type: 'text'; text: string }[] }[]
  } = {
    name: templateName,
    language: { code: language },
  }

  if (variables.length > 0) {
    template.components = [{
      type: 'body',
      parameters: variables.map((text) => ({ type: 'text', text })),
    }]
  }

  const result = await metaGraphPost<SendTemplateResponse>(`/${phoneNumberId}/messages`, auth.token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template,
  })

  if (!result.ok) {
    const error = safeMetaError(result.error)
    addIntegrationLog({
      type: 'ERROR',
      label: 'Message send failed',
      status: 'ERROR',
      detail: error,
    })
    addLog({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ruleId: 'meta-review',
      ruleName: 'Meta Review Template Test',
      connectionId: 'meta-review',
      templateId: templateName,
      eventType: 'CUSTOMER_REGISTERED',
      recipientPhone: maskPhone(recipient),
      recipientName: 'Meta Review Recipient',
      message: `Template: ${templateName} (${language})`,
      status: 'FAILED',
      errorMessage: error,
      sentAt: new Date(),
    })
    return NextResponse.json({ ok: false, error }, { status: result.status })
  }

  const messageId = result.data.messages?.[0]?.id
  addIntegrationLog({
    type: 'MESSAGE_SENT',
    label: 'Message sent',
    status: 'SENT',
    detail: messageId
      ? `Template message sent with Message ID ${messageId}.`
      : 'Template message sent.',
  })
  addLog({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ruleId: 'meta-review',
    ruleName: 'Meta Review Template Test',
    connectionId: 'meta-review',
    templateId: templateName,
    eventType: 'CUSTOMER_REGISTERED',
    recipientPhone: maskPhone(recipient),
    recipientName: 'Meta Review Recipient',
    message: `Template: ${templateName} (${language})`,
    status: 'SENT',
    sentAt: new Date(),
  })

  return NextResponse.json({ ok: true, messageId })
}
