import { normalizePhone, renderTemplate } from './engine'
import { ECOMMERCE_EVENT_DEFINITIONS } from './ecommerce-events'
import { sendTemplateMessage } from './provider'
import {
  addAutomationRunLog,
  addInboxMessage,
  addLog,
  createId,
  getState,
  maskId,
  maskPhone,
  nowIso,
  saveAutomation,
  selectedTemplate,
  updateIntegration,
} from './store'
import type {
  AutomationRule,
  AutomationRunStatus,
  Contact,
  ECommerceEventType,
} from './types'

type IncomingEvent = {
  event?: string
  type?: string
  data?: Record<string, unknown>
  payload?: Record<string, unknown>
}

function valueAt(source: Record<string, unknown> | undefined, path: string): unknown {
  if (!source) return undefined
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, source)
}

function textValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return String(value)
}

function normalizeOrderStatus(value?: string): string | undefined {
  if (!value) return undefined
  const upper = value.toUpperCase()
  if (upper === 'CANCELED') return 'CANCELLED'
  return upper
}

export function normalizeEcommerceEvent(raw: IncomingEvent): { eventType: ECommerceEventType; payload: Record<string, unknown> } {
  const payload = (raw.payload ?? raw.data ?? raw) as Record<string, unknown>
  const rawType = String(raw.event ?? raw.type ?? payload.event ?? payload.type ?? '')
  const orderStatus = normalizeOrderStatus(textValue(valueAt(payload, 'order.order_status') ?? valueAt(payload, 'order.status') ?? valueAt(payload, 'status')))

  const calculated =
    rawType === 'order.updated' && orderStatus === 'RESERVED' ? 'order.reserved'
    : rawType === 'order.updated' && orderStatus === 'PROCESSING' ? 'order.processing'
    : rawType === 'order.updated' && orderStatus === 'INVOICED' ? 'order.invoiced'
    : rawType === 'order.updated' && orderStatus === 'CANCELLED' ? 'order.cancelled'
    : rawType === 'order.cancelled' || rawType === 'order.canceled' ? 'order.cancelled'
    : rawType

  if (ECOMMERCE_EVENT_DEFINITIONS.some((definition) => definition.type === calculated)) {
    return { eventType: calculated as ECommerceEventType, payload }
  }

  return { eventType: 'order.updated', payload }
}

export function contactFromPayload(payload: Record<string, unknown>): Partial<Contact> {
  const customer = (valueAt(payload, 'customer') ?? valueAt(payload, 'order.customer') ?? payload) as Record<string, unknown>
  const address = (valueAt(payload, 'shipping_address') ?? valueAt(payload, 'order.shipping_address') ?? valueAt(customer, 'address')) as Record<string, unknown> | undefined
  const phone = normalizePhone(textValue(customer.phone) ?? '', '55') ?? ''
  const document = textValue(customer.cpf_cnpj ?? customer.cpf ?? customer.cnpj)
  const state = textValue(customer.address_state ?? address?.state)
  const city = textValue(customer.address_city ?? address?.city)

  return {
    externalId: textValue(customer.id),
    name: textValue(customer.name) ?? 'Cliente',
    email: textValue(customer.email),
    phone,
    countryCode: phone.slice(0, 2) || '55',
    document,
    customerType: customer.customer_type === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
    state,
    city,
    status: phone && document && state ? 'active' : 'incomplete',
    optInWhatsapp: Boolean(customer.optInWhatsapp ?? customer.opt_in_whatsapp ?? customer.whatsapp_opt_in),
    source: 'upzero_ecommerce',
  }
}

function conditionsMatch(automation: AutomationRule, contact: Partial<Contact>, payload: Record<string, unknown>): boolean {
  const orderStatus = normalizeOrderStatus(textValue(valueAt(payload, 'order.order_status') ?? valueAt(payload, 'order.status') ?? valueAt(payload, 'status')))
  const paymentStatus = textValue(valueAt(payload, 'order.payment_status') ?? valueAt(payload, 'payment_status'))
  const total = Number(valueAt(payload, 'order.total') ?? valueAt(payload, 'total') ?? 0)

  if (automation.conditions.onlyWithOptIn && !contact.optInWhatsapp) return false
  if (automation.conditions.state && automation.conditions.state !== contact.state) return false
  if (automation.conditions.customerType && automation.conditions.customerType !== contact.customerType) return false
  if (automation.conditions.orderStatus && automation.conditions.orderStatus !== orderStatus) return false
  if (automation.conditions.paymentStatus && automation.conditions.paymentStatus !== paymentStatus) return false
  if (automation.conditions.minOrderTotal && total < automation.conditions.minOrderTotal) return false

  return true
}

function valuesForTemplate(automation: AutomationRule, payload: Record<string, unknown>, contact: Partial<Contact>) {
  const orderId = textValue(valueAt(payload, 'order.id') ?? valueAt(payload, 'id')) ?? ''
  const total = textValue(valueAt(payload, 'order.total') ?? valueAt(payload, 'total')) ?? ''
  const trackingCode = textValue(valueAt(payload, 'label.tracking_code') ?? valueAt(payload, 'order.label.tracking_code')) ?? ''
  const defaults: Record<string, string> = {
    nome: contact.name ?? '',
    cliente: contact.name ?? '',
    pedido: orderId,
    total,
    rastreio: trackingCode,
  }

  return Object.fromEntries(
    Object.entries(automation.variableMapping).map(([variable, path]) => [variable, textValue(valueAt(payload, path)) ?? defaults[variable] ?? '']),
  )
}

async function runAutomation(automation: AutomationRule, eventType: ECommerceEventType, payload: Record<string, unknown>): Promise<AutomationRunStatus> {
  const state = getState()
  const contact = contactFromPayload(payload)
  const template = state.templates.find((item) => item.id === automation.templateId)
  const phone = normalizePhone(contact.phone ?? '', contact.countryCode ?? '55') ?? ''
  const orderId = textValue(valueAt(payload, 'order.id') ?? valueAt(payload, 'id'))

  if (!conditionsMatch(automation, contact, payload)) {
    addAutomationRunLog({
      automationId: automation.id,
      eventType,
      status: 'ignored',
      customerId: contact.externalId,
      customerName: contact.name,
      maskedPhone: maskPhone(phone),
      orderId,
      templateId: automation.templateId,
      description: 'Evento recebido, mas ignorado porque nao atende as condicoes da automacao.',
      safePayload: { eventType, orderId },
      recommendedAction: 'Revise as condicoes da automacao se este cliente deveria receber mensagem.',
    })
    return 'ignored'
  }

  if (!state.integration.phoneNumberId) return blockAutomation(automation, eventType, contact, phone, orderId, 'Nenhum numero WhatsApp conectado.', 'Conecte um numero WhatsApp na WABA antes de ativar automacoes.')
  if (!template || template.status !== 'APPROVED') return blockAutomation(automation, eventType, contact, phone, orderId, 'Template aprovado ausente.', 'Selecione um template APPROVED para esta automacao.')
  if (!phone) return blockAutomation(automation, eventType, contact, phone, orderId, 'Cliente sem telefone WhatsApp valido.', 'Atualize o cadastro do cliente com telefone e DDI.')
  if (!contact.optInWhatsapp) return blockAutomation(automation, eventType, contact, phone, orderId, 'Cliente sem opt-in WhatsApp.', 'Confirme opt-in antes de enviar mensagens automaticas.')

  const values = valuesForTemplate(automation, payload, contact)
  const result = await sendTemplateMessage({ phoneNumberId: state.integration.phoneNumberId, to: phone, template, values })

  if (!result.ok) {
    addAutomationRunLog({
      automationId: automation.id,
      eventType,
      status: 'failed',
      customerId: contact.externalId,
      customerName: contact.name,
      maskedPhone: maskPhone(phone),
      orderId,
      templateId: template.id,
      description: 'Meta nao aceitou o envio automatico.',
      safePayload: { eventType, orderId, template: template.name },
      error: result.error,
      recommendedAction: result.error?.action ?? 'Verifique token, numero, template aprovado, permissao e opt-in.',
    })
    return 'failed'
  }

  const messageId = result.data?.messages?.[0]?.id ?? createId('wamid')
  const preview = renderTemplate(template.body, values)
  updateIntegration({ lastTestMessageId: messageId })
  addInboxMessage({
    id: createId('msg'),
    metaMessageId: messageId,
    conversationId: `conv-${phone}`,
    direction: 'outbound',
    from: state.integration.phoneNumberId,
    to: phone,
    text: preview,
    status: 'sent',
    timestamp: nowIso(),
    templateId: template.id,
  })
  addAutomationRunLog({
    automationId: automation.id,
    eventType,
    status: 'sent',
    customerId: contact.externalId,
    customerName: contact.name,
    maskedPhone: maskPhone(phone),
    orderId,
    templateId: template.id,
    messageId: maskId(messageId),
    description: 'Mensagem automatica enviada via WhatsApp Cloud API.',
    safePayload: { eventType, orderId, template: template.name },
    recommendedAction: 'Acompanhe status de entrega pelos webhooks da Meta na Inbox e nos logs.',
  })
  return 'sent'
}

function blockAutomation(automation: AutomationRule, eventType: ECommerceEventType, contact: Partial<Contact>, phone: string, orderId: string | undefined, description: string, recommendedAction: string): AutomationRunStatus {
  addAutomationRunLog({
    automationId: automation.id,
    eventType,
    status: 'blocked',
    customerId: contact.externalId,
    customerName: contact.name,
    maskedPhone: maskPhone(phone),
    orderId,
    templateId: automation.templateId,
    description,
    recommendedAction,
  })
  return 'blocked'
}

export async function processEcommerceEvent(input: IncomingEvent) {
  const { eventType, payload } = normalizeEcommerceEvent(input)
  const state = getState()
  const automations = state.automations.filter((automation) => automation.status === 'Active' && automation.eventType === eventType)

  addLog({
    type: 'ecommerce_event_received',
    status: 'info',
    description: `Evento e-commerce recebido: ${eventType}.`,
    safePayload: { eventType, automations: automations.length },
    recommendedAction: automations.length > 0 ? 'Acompanhe os logs de automacao para ver envio, bloqueio ou falha.' : 'Crie uma automacao ativa para este evento se desejar enviar WhatsApp.',
  })

  const results = await Promise.all(automations.map(async (automation) => {
    const status = await runAutomation(automation, eventType, payload)
    const now = nowIso()
    saveAutomation({
      ...automation,
      lastTriggeredAt: now,
      totalRuns: automation.totalRuns + 1,
      successfulRuns: automation.successfulRuns + (status === 'sent' ? 1 : 0),
      failedRuns: automation.failedRuns + (status === 'failed' || status === 'blocked' ? 1 : 0),
      updatedAt: now,
    })
    return { automationId: automation.id, status }
  }))

  if (results.some((item) => item.status === 'sent')) {
    addLog({
      type: 'automation_triggered',
      status: 'success',
      description: 'Automacao disparou mensagem WhatsApp para evento e-commerce.',
      safePayload: { eventType, sent: results.filter((item) => item.status === 'sent').length },
      recommendedAction: 'Verifique entrega e respostas nos logs e na Inbox.',
    })
  }

  return { eventType, matchedAutomations: automations.length, results }
}

export function currentApprovedTemplate() {
  return selectedTemplate(getState())
}
