import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHmac } from 'node:crypto'
import { verifyEvent } from '../lib/push/auth'
import { audienceMembers, audienceSize } from '../lib/push/audience'
import { applyEvent, materialize, quietNow, skipReason, type PushEvent } from '../lib/push/engine'
import { initialState, emptyFilters, filtersSchema, type PushState, type Member } from '../lib/push/types'
import { mutateState, readState } from '../lib/push/repository'
import { processStore } from '../lib/push/worker'
import { localDateTimeToIso } from '../lib/push/dates'

const now = new Date('2026-10-06T15:00:00Z')
function member(state: PushState, id = 'c1', platform: 'ANDROID' | 'IOS' = 'ANDROID', kind: Member['kind'] = 'CUSTOMER') {
  state.members.push({ id, name: id === 'c1' ? 'Loja Teste' : id, document: '12.345.678/0001-90', status: 'APPROVED', kind, downloadedAt: '2026-10-01T12:00:00Z' })
  state.devices.push({ id: `device-${id}`, memberId: id, platform, token: `token-registered-${id}`, permission: 'GRANTED', active: true, seenAt: now.toISOString() })
}
function activeState() { const state = initialState(); state.settings.enabled = true; for (const a of state.automations) { a.enabled = true; a.configured = true; a.delayMinutes = a.kind === 'ABANDONED_CART' ? 60 : 0 } return state }
function event(value: Record<string, unknown>): PushEvent { return { id: `event-${Math.random()}`, storeId: 1043, occurredAt: now.toISOString(), ...value } as PushEvent }

test('saved criteria automatically include newly registered members and remove members who stop matching', () => {
  const state = initialState(), filters = { ...emptyFilters, hasOrdered: 'NO' as const }
  member(state); assert.equal(audienceSize(filters, state, now).memberCount, 1)
  member(state, 'c2', 'IOS'); assert.equal(audienceSize(filters, state, now).memberCount, 2)
  state.orders.push({ id: 'o1', memberId: 'c1', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: now.toISOString() })
  assert.deepEqual(audienceMembers(filters, state, now).map(m => m.id), ['c2'])
})
test('name, formatted CNPJ, status and platform are combined', () => {
  const state = initialState(); member(state); member(state, 'c2', 'IOS')
  assert.equal(audienceSize({ ...emptyFilters, name: 'loja', document: '12345678', status: 'APPROVED', platform: 'ANDROID' }, state, now).memberCount, 1)
  state.members[0].status = 'REJECTED'
  assert.equal(audienceSize({ ...emptyFilters, status: 'APPROVED', platform: 'ANDROID' }, state, now).memberCount, 0)
})
test('purchase filters use the selected period; canceled orders do not count', () => {
  const state = initialState(); member(state)
  state.orders = [
    { id: 'old', memberId: 'c1', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: '2026-08-01T12:00:00Z' },
    { id: 'new', memberId: 'c1', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: '2026-10-03T12:00:00Z' },
    { id: 'canceled', memberId: 'c1', status: 'CANCELED', paymentStatus: 'PAID', createdAt: '2026-10-04T12:00:00Z' },
  ]
  assert.equal(audienceMembers({ ...emptyFilters, minPurchases: 2, orderLastDays: 30 }, state, now).length, 0)
  assert.equal(audienceMembers({ ...emptyFilters, minPurchases: 1, maxPurchases: 1, orderLastDays: 30, hasOrdered: 'YES' }, state, now).length, 1)
  assert.equal(audienceMembers({ ...emptyFilters, hasOrdered: 'NO', orderFrom: '2026-10-05', orderTo: '2026-10-06' }, state, now).length, 1)
})
test('calendar period boundaries use the configured store timezone', () => {
  const state = initialState(); member(state)
  state.orders.push({ id: 'o1', memberId: 'c1', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: '2026-10-06T02:30:00Z' })
  assert.equal(audienceMembers({ ...emptyFilters, orderFrom: '2026-10-05', orderTo: '2026-10-05', hasOrdered: 'YES' }, state, now).length, 1)
  assert.equal(audienceMembers({ ...emptyFilters, orderFrom: '2026-10-06', hasOrdered: 'YES' }, state, now).length, 0)
})
test('denied permissions and inactive devices are excluded from dispatch counts; admin devices are excluded', () => {
  const state = initialState(); member(state); member(state, 'c2'); member(state, 'admin:a', 'IOS', 'ADMIN')
  state.devices[0].permission = 'DENIED'; state.devices[1].active = false
  assert.equal(audienceSize(emptyFilters, state, now).deviceCount, 0)
  assert.equal(audienceSize(emptyFilters, state, now).memberCount, 2)
})
test('minimum, maximum and date ranges are validated', () => {
  assert.equal(filtersSchema.safeParse({ minPurchases: 4, maxPurchases: 2 }).success, false)
  assert.equal(filtersSchema.safeParse({ orderFrom: '2026-10-06', orderTo: '2026-10-01' }).success, false)
})
test('late registration preserves newer profiles and cannot take a token back from its current owner', () => {
  const state = initialState()
  const first = { id: 'c1', name: 'Antigo', document: '', status: 'APPROVED', kind: 'CUSTOMER' }
  applyEvent(state, event({ type: 'member.updated', member: { ...first, name: 'Atualizado' } }), now)
  const device = { id: 'd1', token: 'shared-device-token', platform: 'ANDROID', permission: 'GRANTED', active: true }
  applyEvent(state, event({ type: 'device.registered', occurredAt: '2026-10-06T14:00:00Z', member: first, device }), now)
  assert.equal(state.members[0].name, 'Atualizado')
  assert.equal(state.members[0].downloadedAt, '2026-10-06T14:00:00Z')
  applyEvent(state, event({ type: 'device.registered', member: { ...first, id: 'c2' }, device: { ...device, id: 'd2' } }), now)
  applyEvent(state, event({ type: 'device.registered', occurredAt: '2026-10-06T14:30:00Z', member: first, device }), now)
  assert.equal(state.devices.find(d => d.id === 'd1')?.active, false)
  assert.equal(state.devices.find(d => d.id === 'd2')?.active, true)
})
test('scheduled campaign uses the live audience at materialization and materializes once', () => {
  const state = activeState(); member(state)
  state.audiences.push({ id: 'a1', name: 'Todos', filters: emptyFilters, createdAt: now.toISOString(), updatedAt: now.toISOString(), archived: false })
  state.campaigns.push({ id: 'c1', name: 'Campanha', audienceId: 'a1', message: { title: 'Olá {{nome}}', body: 'Veja o app', image: '', destination: 'home', destinationId: '' }, status: 'SCHEDULED', scheduledAt: now.toISOString(), createdAt: now.toISOString(), createdBy: 'admin', materializedAt: null })
  member(state, 'c2', 'IOS'); materialize(state, now); materialize(state, now)
  assert.equal(state.jobs.length, 2); assert.equal(state.jobs[0].message.title, 'Olá Loja Teste')
})
test('cart conversion cancels the pending reminder and repeated processing cannot create another', () => {
  const state = activeState(); member(state)
  applyEvent(state, event({ type: 'cart.updated', cart: { id: 'cart1', memberId: 'c1', updatedAt: '2026-10-06T12:00:00Z', converted: false } }), now)
  materialize(state, now); assert.equal(state.jobs.length, 1)
  applyEvent(state, event({ type: 'order.updated', order: { id: 'o1', memberId: 'c1', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: now.toISOString(), cartId: 'cart1' } }), now)
  assert.equal(state.jobs[0].status, 'SKIPPED'); materialize(state, now); assert.equal(state.jobs.length, 1)
})
test('resuming the cart cancels its old reminder', () => {
  const state = activeState(); member(state)
  state.carts.push({ id: 'cart', memberId: 'c1', updatedAt: '2026-10-06T12:00:00Z', converted: false }); materialize(state, now)
  applyEvent(state, event({ type: 'cart.updated', cart: { id: 'cart', memberId: 'c1', updatedAt: now.toISOString(), converted: false } }), now)
  assert.equal(state.jobs[0].status, 'SKIPPED')
})
test('stock automation respects the exact variation and deduplicates the subscription', () => {
  const state = activeState(); member(state)
  applyEvent(state, event({ type: 'stock.requested', subscription: { id: 's1', memberId: 'c1', variantId: 'blue-M' } }), now)
  applyEvent(state, event({ type: 'stock.updated', variantId: 'blue-S', productId: 'p1', productName: 'Camisa', available: 5 }), now); assert.equal(state.jobs.length, 0)
  const update = event({ type: 'stock.updated', variantId: 'blue-M', productId: 'p1', productName: 'Camisa', available: 5 })
  applyEvent(state, update, now); applyEvent(state, update, now)
  assert.equal(state.jobs.length, 1); assert.equal(state.subscriptions[0].notified, true)
})
test('post-sale waits for the configured status and skips a canceled order', () => {
  const state = activeState(); member(state)
  applyEvent(state, event({ type: 'order.updated', order: { id: 'o1', memberId: 'c1', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: now.toISOString() } }), now); assert.equal(state.jobs.length, 0)
  applyEvent(state, event({ type: 'order.updated', order: { id: 'o1', memberId: 'c1', status: 'DELIVERED', paymentStatus: 'PAID', createdAt: now.toISOString() } }), now); assert.equal(state.jobs.length, 1)
  applyEvent(state, event({ type: 'order.updated', order: { id: 'o1', memberId: 'c1', status: 'CANCELED', paymentStatus: 'REFUNDED', createdAt: now.toISOString() } }), now)
  assert.equal(skipReason(state, state.jobs[0]), 'Pedido cancelado ou estornado.')
})
test('B2B2C reassignment targets only the current reseller and older events cannot restore the former recipient', () => {
  const state = activeState(); member(state, 'r1', 'ANDROID', 'RESELLER'); member(state, 'r2', 'IOS', 'RESELLER')
  applyEvent(state, event({ type: 'b2b2c.assigned', occurredAt: '2026-10-06T14:00:00Z', assignment: { orderId: 'o1', memberId: 'r1', assignmentId: 'a1' } }), now)
  applyEvent(state, event({ type: 'b2b2c.assigned', assignment: { orderId: 'o1', memberId: 'r2', assignmentId: 'a2' } }), now)
  assert.equal(state.jobs[0].status, 'SKIPPED'); assert.equal(state.jobs[1].memberId, 'r2')
  applyEvent(state, event({ type: 'b2b2c.assigned', occurredAt: '2026-10-06T14:30:00Z', assignment: { orderId: 'o1', memberId: 'r1', assignmentId: 'a1' } }), now)
  assert.equal(state.assignments[0].memberId, 'r2'); assert.equal(state.jobs.length, 2)
})
test('quiet hours cover midnight while equal start and end disable quiet hours', () => {
  const state = initialState()
  assert.equal(quietNow(state, new Date('2026-10-06T02:00:00Z')), true)
  assert.equal(quietNow(state, now), false)
  state.settings.quietStart = state.settings.quietEnd
  assert.equal(quietNow(state, new Date('2026-10-06T02:00:00Z')), false)
})
test('scheduled datetime is interpreted in the store timezone', () => {
  assert.equal(localDateTimeToIso('2026-10-06T10:00', 'America/Sao_Paulo'), '2026-10-06T13:00:00.000Z')
  assert.equal(localDateTimeToIso('2026-10-06T10:00', 'America/Manaus'), '2026-10-06T14:00:00.000Z')
})
test('event signatures are bound to the tenant and reject expired requests', () => {
  const previous = process.env.PUSH_EVENT_SECRETS
  process.env.PUSH_EVENT_SECRETS = '{"1043":"test-secret-a","1044":"test-secret-b"}'
  try {
    const timestamp = String(Math.floor(now.getTime() / 1000)), body = '{"storeId":1043}'
    const signature = createHmac('sha256', 'test-secret-a').update(`${timestamp}.${body}`).digest('hex')
    assert.equal(verifyEvent(1043, body, timestamp, signature, now.getTime()), true)
    assert.equal(verifyEvent(1044, body, timestamp, signature, now.getTime()), false)
    assert.equal(verifyEvent(1043, body, timestamp, signature, now.getTime() + 301000), false)
    assert.equal(verifyEvent(1043, '{"storeId":1044}', timestamp, signature, now.getTime()), false)
  } finally { if (previous === undefined) delete process.env.PUSH_EVENT_SECRETS; else process.env.PUSH_EVENT_SECRETS = previous }
})
test('persistence isolates tenants, serializes concurrent mutations and the worker records real adapter outcomes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'push-test-')), previous = process.env.PUSH_DATA_DIR
  process.env.PUSH_DATA_DIR = directory
  try {
    await Promise.all(Array.from({ length: 6 }, (_, index) => mutateState(1043, state => { state.eventIds.push(`e-${index}`) })))
    assert.equal((await readState(1043)).eventIds.length, 6); assert.equal((await readState(1044)).eventIds.length, 0)
    await mutateState(1043, state => {
      state.settings.enabled = true; state.settings.quietStart = state.settings.quietEnd
      member(state, 'r1', 'ANDROID', 'RESELLER')
      state.jobs.push({ id: 'job1', memberId: 'r1', deviceId: 'device-r1', dueAt: '2026-01-01T00:00:00Z', status: 'PENDING', message: { title: 'Pedido', body: 'Abra o app', image: '', destination: 'home', destinationId: '' } })
    })
    let calls = 0
    const send = async () => { calls++; return { accepted: true, invalid: false, reason: undefined } }
    await processStore(1043, send, () => true); await processStore(1043, send, () => true)
    assert.equal(calls, 1); assert.equal((await readState(1043)).jobs[0].status, 'ACCEPTED')
  } finally { if (previous === undefined) delete process.env.PUSH_DATA_DIR; else process.env.PUSH_DATA_DIR = previous; await rm(directory, { recursive: true, force: true }) }
})
