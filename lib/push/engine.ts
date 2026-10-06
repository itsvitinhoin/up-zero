import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { audienceMembers, eligibleDevices } from './audience'
import { type AutomationKind, type PushMessage, type PushState, type Job, PushError } from './types'

const id = z.string().trim().min(1).max(180), time = z.string().datetime({ offset: true })
const base = { id, storeId: z.number().int().positive(), occurredAt: time }
const profile = z.object({ id, name: z.string().max(160), document: z.string().max(30).default(''), status: z.enum(['PENDING', 'APPROVED', 'REJECTED']), kind: z.enum(['CUSTOMER', 'RESELLER', 'ADMIN']).default('CUSTOMER') })
export const eventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('member.updated'), member: profile }),
  z.object({ ...base, type: z.literal('device.registered'), member: profile, device: z.object({ id, token: z.string().min(10).max(4096), platform: z.enum(['ANDROID', 'IOS']), permission: z.enum(['GRANTED', 'DENIED', 'UNKNOWN']), active: z.boolean().default(true) }) }),
  z.object({ ...base, type: z.literal('device.removed'), deviceId: id }),
  z.object({ ...base, type: z.literal('order.updated'), order: z.object({ id, memberId: id, status: z.enum(['RESERVED', 'CONFIRMED', 'PROCESSING', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELED', 'REFUNDED']), paymentStatus: z.enum(['PENDING', 'PAID', 'REFUNDED']).default('PENDING'), createdAt: time, cartId: id.optional(), code: z.string().max(100).optional() }) }),
  z.object({ ...base, type: z.literal('cart.updated'), cart: z.object({ id, memberId: id, updatedAt: time, converted: z.boolean() }) }),
  z.object({ ...base, type: z.literal('stock.requested'), subscription: z.object({ id, memberId: id, variantId: id }) }),
  z.object({ ...base, type: z.literal('stock.updated'), variantId: id, productId: id, productName: z.string().max(160), available: z.number().min(0) }),
  z.object({ ...base, type: z.literal('b2b2c.assigned'), assignment: z.object({ orderId: id, memberId: id, assignmentId: id, code: z.string().max(100).optional() }) }),
])
export type PushEvent = z.infer<typeof eventSchema>
function upsert<T>(values: T[], value: T, match: (v: T) => boolean) { const index = values.findIndex(match); if (index >= 0) values[index] = value; else values.push(value) }
function render(message: PushMessage, variables: Record<string, string>): PushMessage {
  const replace = (value: string) => value.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => variables[key] ?? '')
  return { ...message, title: replace(message.title), body: replace(message.body), destinationId: replace(message.destinationId) }
}
export function queueAutomation(state: PushState, kind: AutomationKind, memberId: string, reference: string, variables: Record<string, string>, now: Date, eventId?: string) {
  const rule = state.automations.find(a => a.kind === kind), member = state.members.find(m => m.id === memberId)
  if (!state.settings.enabled || !rule?.enabled || !rule.configured || !member) return false
  if (kind === 'B2B2C_ORDER' && member.kind !== 'RESELLER') return false
  if (state.jobs.some(j => j.kind === kind && j.reference === reference && j.memberId === memberId)) return false
  const message = render(rule.message, { nome: member.name, ...variables }), devices = eligibleDevices(memberId, state.devices)
  if (message.destination !== 'home' && !message.destinationId) return false
  const dueAt = new Date(now.getTime() + (kind === 'B2B2C_ORDER' || kind === 'ABANDONED_CART' ? 0 : rule.delayMinutes * 60000)).toISOString()
  for (const d of devices) state.jobs.push({ id: randomUUID(), memberId, deviceId: d.id, dueAt, status: 'PENDING', kind, reference, eventId, message })
  return devices.length > 0
}
export function applyEvent(state: PushState, event: PushEvent, now = new Date()) {
  if (state.eventIds.includes(event.id)) return { duplicate: true }
  if (Date.parse(event.occurredAt) > now.getTime() + 300000) throw new PushError(400, 'Evento com data futura inválida.')
  if (event.type === 'member.updated' || event.type === 'device.registered') {
    const existing = state.members.find(m => m.id === event.member.id)
    if (!existing?.updatedAt || existing.updatedAt <= event.occurredAt) upsert(state.members, { ...event.member, downloadedAt: existing?.downloadedAt ?? (event.type === 'device.registered' ? event.occurredAt : null), updatedAt: event.occurredAt }, m => m.id === event.member.id)
    if (event.type === 'device.registered') {
      if (existing && (!existing.downloadedAt || existing.downloadedAt > event.occurredAt)) existing.downloadedAt = event.occurredAt
      // A token belongs to one signed-in account; reassignment must stop the former account receiving notifications.
      const old = state.devices.find(d => d.id === event.device.id)
      const newerOwner = state.devices.some(d => d.token === event.device.token && d.id !== event.device.id && d.seenAt > event.occurredAt)
      if ((!old || old.seenAt <= event.occurredAt) && !newerOwner) {
        for (const d of state.devices) if (d.token === event.device.token && d.id !== event.device.id) d.active = false
        upsert(state.devices, { ...event.device, memberId: event.member.id, seenAt: event.occurredAt }, d => d.id === event.device.id)
      }
    }
  } else if (event.type === 'device.removed') {
    const d = state.devices.find(d => d.id === event.deviceId); if (d && d.seenAt <= event.occurredAt) { d.active = false; d.seenAt = event.occurredAt }
  } else if (event.type === 'order.updated') {
    const old = state.orders.find(o => o.id === event.order.id)
    if (old?.updatedAt && old.updatedAt > event.occurredAt) { state.eventIds.push(event.id); return { duplicate: false } }
    upsert(state.orders, { ...event.order, updatedAt: event.occurredAt }, o => o.id === event.order.id)
    if (event.order.cartId) {
      const cart = state.carts.find(c => c.id === event.order.cartId); if (cart) cart.converted = true
      for (const j of state.jobs) if (j.kind === 'ABANDONED_CART' && j.reference?.startsWith(`${event.order.cartId}:`) && j.status === 'PENDING') { j.status = 'SKIPPED'; j.reason = 'Carrinho convertido em pedido.' }
    }
    const rule = state.automations.find(a => a.kind === 'POST_SALE')
    if (rule && event.order.status === rule.orderStatus && old?.status !== event.order.status) queueAutomation(state, 'POST_SALE', event.order.memberId, `${event.order.id}:${event.order.status}`, { pedido: event.order.code || event.order.id, pedido_id: event.order.id }, now, event.id)
  } else if (event.type === 'cart.updated') {
    const old = state.carts.find(c => c.id === event.cart.id)
    if (!old || old.updatedAt <= event.cart.updatedAt) {
      upsert(state.carts, event.cart, c => c.id === event.cart.id)
      for (const j of state.jobs) if (j.kind === 'ABANDONED_CART' && j.reference?.startsWith(`${event.cart.id}:`) && j.status === 'PENDING') { j.status = 'SKIPPED'; j.reason = 'Carrinho retomado ou atualizado.' }
    }
  } else if (event.type === 'stock.requested') {
    upsert(state.subscriptions, { ...event.subscription, notified: false }, s => s.id === event.subscription.id)
  } else if (event.type === 'stock.updated') {
    state.stockTimes ??= {}
    if (state.stockTimes[event.variantId] && state.stockTimes[event.variantId] > event.occurredAt) { state.eventIds.push(event.id); return { duplicate: false } }
    const previous = state.stocks[event.variantId] ?? 0
    state.stocks[event.variantId] = event.available
    state.stockTimes[event.variantId] = event.occurredAt
    if (previous <= 0 && event.available > 0) for (const s of state.subscriptions) {
      if (!s.notified && s.variantId === event.variantId && queueAutomation(state, 'BACK_IN_STOCK', s.memberId, s.id, { produto: event.productName, produto_id: event.productId }, now, event.id)) s.notified = true
    }
  } else if (event.type === 'b2b2c.assigned') {
    const previous = state.assignments.find(a => a.orderId === event.assignment.orderId)
    if (previous?.updatedAt && previous.updatedAt > event.occurredAt) { state.eventIds.push(event.id); return { duplicate: false } }
    upsert(state.assignments, { ...event.assignment, updatedAt: event.occurredAt }, a => a.orderId === event.assignment.orderId)
    for (const j of state.jobs) if (j.kind === 'B2B2C_ORDER' && j.reference?.startsWith(`${event.assignment.orderId}:`) && j.memberId !== event.assignment.memberId && j.status === 'PENDING') { j.status = 'SKIPPED'; j.reason = 'Pedido redirecionado a outro revendedor.' }
    queueAutomation(state, 'B2B2C_ORDER', event.assignment.memberId, `${event.assignment.orderId}:${event.assignment.assignmentId}`, { pedido: event.assignment.code || event.assignment.orderId, pedido_id: event.assignment.orderId }, now, event.id)
  }
  state.eventIds.push(event.id)
  return { duplicate: false }
}
export function materialize(state: PushState, now = new Date()) {
  if (!state.settings.enabled) return
  for (const c of state.campaigns) {
    if (!['QUEUED', 'SCHEDULED'].includes(c.status) || c.materializedAt || (c.scheduledAt && Date.parse(c.scheduledAt) > now.getTime())) continue
    const list = state.audiences.find(a => a.id === c.audienceId && !a.archived)
    if (!list) { c.status = 'FAILED'; continue }
    for (const m of audienceMembers(list.filters, state, now)) for (const d of eligibleDevices(m.id, state.devices, list.filters.platform)) {
      state.jobs.push({ id: randomUUID(), memberId: m.id, deviceId: d.id, dueAt: now.toISOString(), status: 'PENDING', campaignId: c.id, message: render(c.message, { nome: m.name }) })
    }
    c.materializedAt = now.toISOString(); c.status = state.jobs.some(j => j.campaignId === c.id) ? 'SENDING' : 'COMPLETED'
  }
  const rule = state.automations.find(a => a.kind === 'ABANDONED_CART')
  if (rule?.enabled) for (const cart of state.carts) {
    if (!cart.converted && now.getTime() - Date.parse(cart.updatedAt) >= rule.delayMinutes * 60000) queueAutomation(state, 'ABANDONED_CART', cart.memberId, `${cart.id}:${cart.updatedAt}`, { carrinho_id: cart.id }, now)
  }
}
export function skipReason(state: PushState, job: Job): string | null {
  const device = state.devices.find(d => d.id === job.deviceId)
  if (!device || device.memberId !== job.memberId || !eligibleDevices(job.memberId, [device]).length) return 'Dispositivo indisponível ou sem permissão.'
  if (job.campaignId) {
    const campaign = state.campaigns.find(c => c.id === job.campaignId)
    const audience = state.audiences.find(a => a.id === campaign?.audienceId && !a.archived)
    if (!campaign || campaign.status === 'CANCELED' || !audience || !audienceMembers(audience.filters, state).some(m => m.id === job.memberId) || (audience.filters.platform !== 'ALL' && device.platform !== audience.filters.platform)) return 'Destinatário deixou de corresponder ao público.'
  }
  if (job.kind && !state.automations.find(a => a.kind === job.kind)?.enabled) return 'Automação pausada.'
  if (job.kind === 'ABANDONED_CART') {
    const cart = state.carts.find(c => `${c.id}:${c.updatedAt}` === job.reference)
    if (!cart || cart.converted) return 'Carrinho retomado ou convertido.'
  }
  if (job.kind === 'B2B2C_ORDER' && !state.assignments.some(a => `${a.orderId}:${a.assignmentId}` === job.reference && a.memberId === job.memberId)) return 'Pedido redirecionado.'
  if (job.kind === 'POST_SALE') {
    const order = state.orders.find(o => job.reference?.startsWith(`${o.id}:`))
    if (!order || ['CANCELED', 'REFUNDED'].includes(order.status)) return 'Pedido cancelado ou estornado.'
  }
  if (job.kind === 'BACK_IN_STOCK') {
    const subscription = state.subscriptions.find(s => s.id === job.reference)
    if (!subscription || (state.stocks[subscription.variantId] ?? 0) <= 0) return 'Produto novamente indisponível.'
  }
  return null
}
export function quietNow(state: PushState, now: Date) {
  const current = new Intl.DateTimeFormat('en-GB', { timeZone: state.settings.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)
  const { quietStart: start, quietEnd: end } = state.settings
  return start === end ? false : start < end ? current >= start && current < end : current >= start || current < end
}
export function finishCampaigns(state: PushState) {
  for (const c of state.campaigns.filter(c => c.status === 'SENDING')) {
    const jobs = state.jobs.filter(j => j.campaignId === c.id)
    if (jobs.some(j => ['PENDING', 'SENDING'].includes(j.status))) continue
    const accepted = jobs.filter(j => j.status === 'ACCEPTED').length, failed = jobs.filter(j => j.status === 'FAILED').length
    c.status = failed ? accepted ? 'PARTIAL' : 'FAILED' : 'COMPLETED'
  }
}
