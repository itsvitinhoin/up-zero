import { createHash } from 'node:crypto'
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
  selectedTemplate,
  updateIntegration,
  updateState,
} from './store'
import type {
  AutomationJob,
  AutomationRule,
  AutomationRunStatus,
  Contact,
  ECommerceEventType,
  ECommerceWebhookEvent,
  WhatsAppTemplate,
} from './types'

type IncomingEvent = {
  event?: string
  type?: string
  event_type?: string
  eventType?: string
  event_id?: string
  eventId?: string
  timestamp?: string
  occurred_at?: string
  data?: Record<string, unknown>
  payload?: Record<string, unknown>
  [key: string]: unknown
}

type NormalizedEcommerceEvent = {
  eventType: ECommerceEventType
  eventId: string
  explicitEventId: boolean
  payloadHash: string
  payload: Record<string, unknown>
  occurredAt: string
  externalCustomerId?: string
  externalOrderId?: string
  externalCartId?: string
}

const EVENT_ALIASES: Record<string, ECommerceEventType> = {
  'payment.confirmed': 'order.payment_confirmed',
  payment_confirmed: 'order.payment_confirmed',
  'order.payment.confirmed': 'order.payment_confirmed',
  'order-payment-confirmed': 'order.payment_confirmed',
  'cart.created': 'cart_created',
  'cart-created': 'cart_created',
  created_cart: 'cart_created',
  'cart.abandoned': 'cart_abandoned',
  'cart-abandoned': 'cart_abandoned',
  abandoned_cart: 'cart_abandoned',
  'checkout.abandoned': 'cart_abandoned',
  checkout_abandoned: 'cart_abandoned',
  'checkout-abandoned': 'cart_abandoned',
  'cart.converted': 'cart_converted',
  'cart-converted': 'cart_converted',
  converted_cart: 'cart_converted',
  'checkout.completed': 'cart_converted',
  checkout_completed: 'cart_converted',
}

export class UnsupportedEcommerceEventError extends Error {
  constructor(public readonly receivedType: string) {
    super(`Unsupported e-commerce event: ${receivedType || '(empty)'}`)
    this.name = 'UnsupportedEcommerceEventError'
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function valueAt(source: Record<string, unknown> | undefined, path: string): unknown {
  if (!source) return undefined
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, source)
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function textValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return String(value)
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  )
}

function payloadHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex')
}

function eventFingerprint(eventType: ECommerceEventType, payload: Record<string, unknown>): string {
  const businessPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => ![
      'event',
      'type',
      'event_type',
      'eventType',
      'event_id',
      'eventId',
      'timestamp',
      'occurred_at',
    ].includes(key)),
  )
  return payloadHash({ eventType, payload: businessPayload })
}

function parseDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function normalizeOrderStatus(value?: string): string | undefined {
  if (!value) return undefined
  const upper = value.toUpperCase()
  return upper === 'CANCELED' ? 'CANCELLED' : upper
}

function canonicalEventType(value: string, payload: Record<string, unknown>): ECommerceEventType {
  const normalized = value.trim()
    .replace(/^Customer\./, 'customer.')
    .replace(/^Order\./, 'order.')
    .replace(/^cart\./, 'cart_')
  const aliased: string = EVENT_ALIASES[normalized.toLowerCase()] ?? normalized
  const orderStatus = normalizeOrderStatus(firstText(
    valueAt(payload, 'order.order_status'),
    valueAt(payload, 'order.status'),
    payload.order_status,
    payload.status,
  ))

  const calculated =
    aliased === 'order.updated' && orderStatus === 'RESERVED' ? 'order.reserved'
      : aliased === 'order.updated' && orderStatus === 'PROCESSING' ? 'order.processing'
        : aliased === 'order.updated' && orderStatus === 'INVOICED' ? 'order.invoiced'
          : aliased === 'order.updated' && orderStatus === 'CANCELLED' ? 'order.cancelled'
            : aliased === 'order.canceled' ? 'order.cancelled'
              : aliased

  if (ECOMMERCE_EVENT_DEFINITIONS.some((definition) => definition.type === calculated)) {
    return calculated as ECommerceEventType
  }
  throw new UnsupportedEcommerceEventError(value)
}

export function normalizeEcommerceEvent(raw: IncomingEvent): NormalizedEcommerceEvent {
  const envelope = asRecord(raw) ?? {}
  const data = asRecord(envelope.data) ?? {}
  const explicitPayload = asRecord(envelope.payload)
  const payload = {
    ...data,
    ...(explicitPayload ?? {}),
    ...Object.fromEntries(
      Object.entries(envelope).filter(([key]) => !['data', 'payload'].includes(key)),
    ),
  }
  const incomingType = firstText(
    envelope.event_type,
    envelope.eventType,
    envelope.type,
    envelope.event,
    envelope.name,
    payload.event_type,
    payload.eventType,
    payload.type,
    payload.event,
    payload.name,
  ) ?? ''
  const eventType = canonicalEventType(incomingType, payload)
  const customer = asRecord(payload.customer) ?? asRecord(payload.user) ?? asRecord(payload.lead) ?? {}
  const order = asRecord(payload.order) ?? {}
  const cart = asRecord(payload.cart) ?? {}
  const metadata = asRecord(payload.metadata) ?? asRecord(payload.meta) ?? {}
  const explicitId = firstText(
    envelope.event_id,
    envelope.eventId,
    metadata.event_id,
    data.event_id,
    data.eventId,
  )
  const hash = payloadHash(raw)
  const fingerprint = eventFingerprint(eventType, payload)
  const externalCustomerId = firstText(
    payload.customer_id,
    payload.customerId,
    payload.user_id,
    payload.userId,
    customer.id,
    customer.external_id,
    eventType.startsWith('customer.') ? payload.id : undefined,
  )
  const externalOrderId = firstText(
    payload.order_number,
    payload.order_id,
    payload.orderId,
    order.id,
    order.external_id,
    order.code,
    order.number,
    eventType.startsWith('order.') ? payload.id : undefined,
  )
  const externalCartId = eventType.startsWith('cart_')
    ? firstText(payload.cart_id, payload.cartId, cart.id, cart.external_id, data.id)
    : undefined

  return {
    eventType,
    eventId: explicitId ?? `generated:${fingerprint}`,
    explicitEventId: Boolean(explicitId),
    payloadHash: hash,
    payload,
    occurredAt: parseDate(envelope.timestamp)
      ?? parseDate(envelope.occurred_at)
      ?? parseDate(payload.occurred_at)
      ?? parseDate(payload.created_at)
      ?? nowIso(),
    externalCustomerId,
    externalOrderId,
    externalCartId,
  }
}

export function contactFromPayload(payload: Record<string, unknown>): Partial<Contact> {
  const customer = (valueAt(payload, 'customer') ?? valueAt(payload, 'order.customer') ?? payload) as Record<string, unknown>
  const address = (valueAt(payload, 'shipping_address') ?? valueAt(payload, 'order.shipping_address') ?? valueAt(customer, 'address')) as Record<string, unknown> | undefined
  const rawPhone = textValue(customer.phone ?? payload.customer_phone ?? payload.phone) ?? ''
  const explicitCountryCode = firstText(
    customer.country_code,
    customer.countryCode,
    customer.ddi,
    payload.customer_country_code,
    payload.country_code,
  )?.replace(/\D/g, '')
  const phone = normalizePhone(rawPhone, explicitCountryCode || '55') ?? ''
  const countryCode = explicitCountryCode
    || (/^(?:\+|00)1(?:\D|$)/.test(rawPhone.trim()) ? '1' : undefined)
    || (phone.startsWith('55') ? '55' : undefined)
    || '55'
  const document = textValue(customer.cpf_cnpj ?? customer.cpf ?? customer.cnpj)
  const state = textValue(customer.address_state ?? address?.state)
  const city = textValue(customer.address_city ?? address?.city)

  return {
    externalId: textValue(customer.id),
    name: textValue(customer.name ?? payload.customer_name ?? payload.contact_name) ?? 'Cliente',
    email: textValue(customer.email ?? payload.customer_email),
    phone,
    countryCode,
    document,
    customerType: customer.customer_type === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
    state,
    city,
    status: phone && document && state ? 'active' : 'incomplete',
    source: 'upzero_ecommerce',
  }
}

function conditionsMatch(automation: AutomationRule, contact: Partial<Contact>, payload: Record<string, unknown>): boolean {
  const orderStatus = normalizeOrderStatus(firstText(valueAt(payload, 'order.order_status'), valueAt(payload, 'order.status'), payload.status))
  const paymentStatus = firstText(valueAt(payload, 'order.payment_status'), payload.payment_status)
  const total = Number(valueAt(payload, 'order.total') ?? payload.total ?? 0)

  if (automation.conditions.state && automation.conditions.state !== contact.state) return false
  if (automation.conditions.customerType && automation.conditions.customerType !== contact.customerType) return false
  if (automation.conditions.orderStatus && automation.conditions.orderStatus !== orderStatus) return false
  if (automation.conditions.paymentStatus && automation.conditions.paymentStatus !== paymentStatus) return false
  if (automation.conditions.minOrderTotal && total < automation.conditions.minOrderTotal) return false
  return true
}

function valuesForTemplate(
  automation: AutomationRule,
  template: WhatsAppTemplate,
  payload: Record<string, unknown>,
  contact: Partial<Contact>,
) {
  const orderId = firstText(valueAt(payload, 'order.id'), payload.order_id, payload.id) ?? ''
  const total = firstText(valueAt(payload, 'order.total'), payload.total) ?? ''
  const trackingCode = firstText(valueAt(payload, 'label.tracking_code'), valueAt(payload, 'order.label.tracking_code')) ?? ''
  const defaults: Record<string, string> = {
    nome: contact.name ?? '',
    nome_cliente: contact.name ?? '',
    cliente: contact.name ?? '',
    pedido: orderId,
    numero_pedido: orderId,
    total,
    valor_pedido: total,
    rastreio: trackingCode,
  }
  const sequentialFallbackPaths = ['customer.name', 'order.id', 'order.total', 'customer.phone', 'label.tracking_code']
  const mapping = { ...automation.variableMapping, ...(template.variableMapping ?? {}) }

  return Object.fromEntries(template.variables.map((variable, index) => {
    const path = mapping[variable] ?? mapping[`{{${variable}}}`] ?? sequentialFallbackPaths[index]
    const value = path ? firstText(valueAt(payload, path)) : undefined
    return [variable, value ?? defaults[variable] ?? (index === 0 ? contact.name ?? '' : '')]
  }))
}

async function blockAutomation(
  automation: AutomationRule,
  eventType: ECommerceEventType,
  contact: Partial<Contact>,
  phone: string,
  orderId: string | undefined,
  description: string,
  recommendedAction: string,
): Promise<AutomationRunStatus> {
  await addAutomationRunLog({
    automationId: automation.id,
    eventType,
    status: 'blocked',
    customerId: contact.externalId,
    customerName: contact.name,
    maskedPhone: maskPhone(phone),
    orderId,
    templateId: automation.templateId,
    phoneNumberId: automation.phoneNumberId,
    wabaId: automation.wabaId,
    description,
    recommendedAction,
  })
  return 'blocked'
}

async function runAutomation(
  automation: AutomationRule,
  eventType: ECommerceEventType,
  payload: Record<string, unknown>,
): Promise<AutomationRunStatus> {
  const state = await getState()
  const contact = contactFromPayload(payload)
  const template = state.templates.find((item) => item.id === automation.templateId)
  const phone = normalizePhone(contact.phone ?? '', contact.countryCode ?? '55') ?? ''
  const orderId = firstText(valueAt(payload, 'order.id'), payload.order_id, payload.id)
  const sellerPhone = normalizePhone(firstText(
    payload.seller_phone,
    payload.assigned_seller_phone,
    valueAt(payload, 'seller.phone'),
    valueAt(payload, 'customer.seller_phone'),
    valueAt(payload, 'order.seller_phone'),
  ) ?? '')
  const sellerConnection = sellerPhone
    ? state.phoneNumbers.find((item) => normalizePhone(item.displayPhoneNumber) === sellerPhone)
    : undefined
  const configuredConnection = automation.phoneNumberId
    ? state.phoneNumbers.find((item) => item.id === automation.phoneNumberId)
    : undefined
  const fallbackPhoneNumberId = state.integration.fallbackPhoneNumberId
    ?? state.integration.phoneNumberId
    ?? automation.fallbackPhoneNumberId

  if (!conditionsMatch(automation, contact, payload)) {
    await addAutomationRunLog({
      automationId: automation.id,
      eventType,
      status: 'ignored',
      customerId: contact.externalId,
      customerName: contact.name,
      maskedPhone: maskPhone(phone),
      orderId,
      templateId: automation.templateId,
      description: 'Evento recebido, mas ignorado porque não atende às condições da automação.',
      safePayload: { eventType, orderId },
      recommendedAction: 'Revise as condições da automação se este cliente deveria receber mensagem.',
    })
    return 'ignored'
  }

  const usesFixedPhone = automation.senderStrategy === 'fixed_phone' || Boolean(automation.phoneNumberId)
  const senderPhoneNumberId = usesFixedPhone
    ? configuredConnection?.id
    : automation.senderStrategy === 'fallback_only'
      ? fallbackPhoneNumberId
      : sellerConnection?.id ?? fallbackPhoneNumberId
  const senderConnection = state.phoneNumbers.find((item) => item.id === senderPhoneNumberId)
  const usedFallbackBecauseSellerUnavailable = !usesFixedPhone && automation.senderStrategy !== 'fallback_only'
    && Boolean(sellerPhone)
    && !sellerConnection

  if (automation.phoneNumberId && !configuredConnection) return blockAutomation(automation, eventType, contact, phone, orderId, 'O número definido nesta automação não está mais conectado.', 'Edite a automação e selecione uma conexão ativa.')
  if (!senderPhoneNumberId || !senderConnection) return blockAutomation(automation, eventType, contact, phone, orderId, 'Nenhum número WhatsApp emissor está configurado.', 'Conecte o WhatsApp da vendedora ou selecione um número nesta automação.')
  if (!template || template.status !== 'APPROVED') return blockAutomation(automation, eventType, contact, phone, orderId, 'Template aprovado ausente.', 'Selecione um template APPROVED para esta automação.')
  if (template.wabaId && senderConnection.wabaId && template.wabaId !== senderConnection.wabaId) {
    return blockAutomation(automation, eventType, contact, phone, orderId, 'O template pertence a outra WABA.', 'Escolha um template sincronizado pelo mesmo número definido na automação.')
  }
  if (!phone) return blockAutomation(automation, eventType, contact, phone, orderId, 'Cliente sem telefone WhatsApp válido.', 'Atualize o cadastro do cliente com telefone e DDI.')
  const values = valuesForTemplate(automation, template, payload, contact)
  const result = await sendTemplateMessage({ phoneNumberId: senderPhoneNumberId, to: phone, template, values })

  if (!result.ok) {
    await addAutomationRunLog({
      automationId: automation.id,
      eventType,
      status: 'failed',
      customerId: contact.externalId,
      customerName: contact.name,
      maskedPhone: maskPhone(phone),
      orderId,
      templateId: template.id,
      phoneNumberId: senderConnection.id,
      wabaId: senderConnection.wabaId,
      description: 'A Meta não aceitou o envio automático.',
      safePayload: {
        eventType,
        orderId,
        template: template.name,
        usedFallbackBecauseSellerUnavailable,
      },
      error: result.error,
      recommendedAction: result.error?.action ?? 'Verifique token, número, template aprovado e permissões da integração.',
    })
    return 'failed'
  }

  const messageId = result.data?.messages?.[0]?.id ?? createId('wamid')
  const preview = renderTemplate(template.body, values)
  await updateIntegration({ lastTestMessageId: messageId })
  await addInboxMessage({
    id: createId('msg'),
    metaMessageId: messageId,
    conversationId: `conv-${senderPhoneNumberId}-${phone}`,
    direction: 'outbound',
    from: senderPhoneNumberId,
    to: phone,
    text: preview,
    status: 'sent',
    timestamp: nowIso(),
    templateId: template.id,
  })
  await addAutomationRunLog({
    automationId: automation.id,
    eventType,
    status: 'sent',
    customerId: contact.externalId,
    customerName: contact.name,
    maskedPhone: maskPhone(phone),
    orderId,
    templateId: template.id,
    phoneNumberId: senderConnection.id,
    wabaId: senderConnection.wabaId,
    messageId: maskId(messageId),
    description: 'Mensagem automática enviada via WhatsApp Cloud API.',
    safePayload: {
      eventType,
      orderId,
      template: template.name,
      sender: maskId(senderPhoneNumberId),
      usedSellerPhone: Boolean(sellerConnection),
      usedFallbackBecauseSellerUnavailable,
    },
    recommendedAction: 'Acompanhe status de entrega pelos webhooks da Meta na Inbox e nos logs.',
  })
  return 'sent'
}

function jobStatusForRun(status: AutomationRunStatus): AutomationJob['status'] {
  if (status === 'sent') return 'sent'
  if (status === 'blocked') return 'blocked'
  if (status === 'ignored') return 'ignored'
  return 'failed'
}

async function claimJob(jobId: string): Promise<boolean> {
  let claimed = false
  await updateState((state) => {
    claimed = false
    const job = state.automationJobs.find((item) => item.id === jobId)
    if (!job || job.status !== 'scheduled' || new Date(job.scheduledAt) > new Date()) return
    job.status = 'processing'
    job.updatedAt = nowIso()
    claimed = true
  })
  return claimed
}

export async function processDueAutomationJobs(limit = 25) {
  const state = await getState()
  const dueJobs = state.automationJobs
    .filter((job) => job.status === 'scheduled' && new Date(job.scheduledAt) <= new Date())
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
    .slice(0, limit)
  const results: Array<{ jobId: string; automationId: string; status: AutomationJob['status'] }> = []

  for (const dueJob of dueJobs) {
    if (!await claimJob(dueJob.id)) continue
    const current = await getState()
    const job = current.automationJobs.find((item) => item.id === dueJob.id)
    const automation = current.automations.find((item) => item.id === dueJob.automationId)
    let runStatus: AutomationRunStatus = 'blocked'

    if (!job || !automation || automation.status !== 'Active') {
      if (automation) {
        await addAutomationRunLog({
          automationId: automation.id,
          eventType: dueJob.eventType,
          status: 'blocked',
          description: 'Job bloqueado porque a automação não está mais ativa.',
          recommendedAction: 'Reative a automação apenas se o evento ainda deve ser enviado.',
        })
      }
    } else {
      runStatus = await runAutomation(automation, job.eventType, job.sourcePayload)
    }

    const finishedAt = nowIso()
    await updateState((next) => {
      const nextJob = next.automationJobs.find((item) => item.id === dueJob.id)
      if (nextJob) {
        nextJob.status = jobStatusForRun(runStatus)
        nextJob.processedAt = finishedAt
        nextJob.updatedAt = finishedAt
      }
      const nextAutomation = next.automations.find((item) => item.id === dueJob.automationId)
      if (nextAutomation) {
        nextAutomation.lastTriggeredAt = finishedAt
        nextAutomation.totalRuns += 1
        nextAutomation.successfulRuns += runStatus === 'sent' ? 1 : 0
        nextAutomation.failedRuns += runStatus === 'failed' || runStatus === 'blocked' ? 1 : 0
        nextAutomation.updatedAt = finishedAt
      }
    })
    results.push({ jobId: dueJob.id, automationId: dueJob.automationId, status: jobStatusForRun(runStatus) })
  }

  return { processed: results.length, results }
}

export async function inspectEcommerceEvent(input: IncomingEvent) {
  const normalized = normalizeEcommerceEvent(input)
  const state = await getState()
  const automations = state.automations.filter((automation) => automation.status === 'Active' && automation.eventType === normalized.eventType)
  return {
    accepted: true,
    dryRun: true,
    event: {
      id: normalized.eventId,
      type: normalized.eventType,
      explicitId: normalized.explicitEventId,
      occurredAt: normalized.occurredAt,
      externalCustomerId: normalized.externalCustomerId,
      externalOrderId: normalized.externalOrderId,
      externalCartId: normalized.externalCartId,
    },
    matchedAutomations: automations.map((automation) => ({
      id: automation.id,
      name: automation.name,
      delayMinutes: automation.delayMinutes,
      templateConfigured: Boolean(automation.templateId),
      conditionsMatch: conditionsMatch(automation, contactFromPayload(normalized.payload), normalized.payload),
    })),
  }
}

export async function processEcommerceEvent(input: IncomingEvent) {
  const normalized = normalizeEcommerceEvent(input)
  const receivedAt = nowIso()
  let duplicate = false
  let queuedJobs: AutomationJob[] = []
  let cancelledJobs = 0

  await updateState((state) => {
    duplicate = state.ecommerceEvents.some((event) => event.eventId === normalized.eventId)
    queuedJobs = []
    cancelledJobs = 0

    if (!duplicate) {
      const storedEvent: ECommerceWebhookEvent = {
        id: createId('ecommerce-event'),
        eventId: normalized.eventId,
        eventType: normalized.eventType,
        payloadHash: normalized.payloadHash,
        externalCustomerId: normalized.externalCustomerId,
        externalOrderId: normalized.externalOrderId,
        externalCartId: normalized.externalCartId,
        occurredAt: normalized.occurredAt,
        receivedAt,
      }
      state.ecommerceEvents.unshift(storedEvent)
      state.ecommerceEvents = state.ecommerceEvents.slice(0, 2000)

      if (normalized.eventType === 'cart_converted' && normalized.externalCartId) {
        for (const job of state.automationJobs) {
          if (job.status === 'scheduled' && job.externalCartId === normalized.externalCartId && ['cart_created', 'cart_abandoned'].includes(job.eventType)) {
            job.status = 'cancelled'
            job.cancelReason = 'cancelled_by_cart_converted'
            job.updatedAt = receivedAt
            cancelledJobs += 1
          }
        }
      }
    }

    const matching = state.automations.filter((automation) =>
      automation.status === 'Active' && automation.eventType === normalized.eventType,
    )
    for (const automation of matching) {
      const alreadyQueued = state.automationJobs.some((job) =>
        job.automationId === automation.id && job.eventId === normalized.eventId,
      )
      if (alreadyQueued) continue
      const job: AutomationJob = {
        id: createId('automation-job'),
        automationId: automation.id,
        eventId: normalized.eventId,
        eventType: normalized.eventType,
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + Math.max(0, automation.delayMinutes) * 60_000).toISOString(),
        createdAt: receivedAt,
        updatedAt: receivedAt,
        sourcePayload: normalized.payload,
        externalCartId: normalized.externalCartId,
      }
      state.automationJobs.unshift(job)
      queuedJobs.push(job)
    }
    state.automationJobs = state.automationJobs.slice(0, 2000)
  })

  await addLog({
    type: 'ecommerce_event_received',
    status: duplicate && queuedJobs.length === 0 ? 'info' : 'success',
    description: duplicate
      ? queuedJobs.length > 0
        ? `Evento e-commerce repetido aproveitado por uma automação ainda não executada: ${normalized.eventType}.`
        : `Evento e-commerce duplicado sem novas automações: ${normalized.eventType}.`
      : `Evento e-commerce recebido: ${normalized.eventType}.`,
    safePayload: {
      eventType: normalized.eventType,
      eventId: maskId(normalized.eventId),
      explicitEventId: normalized.explicitEventId,
      duplicate,
      queuedJobs: queuedJobs.length,
      cancelledJobs,
    },
    recommendedAction: duplicate && queuedJobs.length === 0
      ? 'Use um event_id único por evento de negócio. Uma mesma automação nunca executa duas vezes o mesmo evento.'
      : queuedJobs.length > 0 ? 'Acompanhe os jobs e logs da automação.' : 'Crie uma automação ativa para este evento se desejar enviar WhatsApp.',
  })

  if (duplicate && queuedJobs.length === 0) {
    return {
      accepted: true,
      duplicate: true,
      event: { id: normalized.eventId, type: normalized.eventType, status: 'duplicate' },
      queuedJobs: [],
      cancelledJobs: 0,
      processing: { processed: 0, results: [] },
    }
  }

  const processing = await processDueAutomationJobs(Math.max(25, queuedJobs.length))
  if (processing.results.some((item) => item.status === 'sent')) {
    await addLog({
      type: 'automation_triggered',
      status: 'success',
      description: 'Automação disparou mensagem WhatsApp para evento e-commerce.',
      safePayload: { eventType: normalized.eventType, sent: processing.results.filter((item) => item.status === 'sent').length },
      recommendedAction: 'Verifique entrega e respostas nos logs e na Inbox.',
    })
  }

  return {
    accepted: true,
    duplicate,
    event: { id: normalized.eventId, type: normalized.eventType, status: duplicate ? 'duplicate_reprocessed' : 'received' },
    queuedJobs: queuedJobs.map((job) => ({ id: job.id, automationId: job.automationId, scheduledAt: job.scheduledAt })),
    cancelledJobs,
    processing,
  }
}

export async function currentApprovedTemplate() {
  return selectedTemplate(await getState())
}
