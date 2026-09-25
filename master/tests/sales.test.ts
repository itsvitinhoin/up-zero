import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aggregateSales, businessDate, rangeError, salesSchema, summarize, type SalesData, type SalesFilters, type SalesOrder } from '../lib/sales'
import { createDemo, deleteDemo, demoWorkspace } from '../lib/demo'

const filters: SalesFilters = { from: '2026-09-01', through: '2026-09-30', storeId: 'all', channel: 'all' }
const order = (id: string, storeId: number, values: Partial<SalesOrder> = {}): SalesOrder => ({
  id, storeId, customerId: '1', channel: 'B2B', createdAt: '2026-09-10T15:00:00Z', status: 'partial',
  requested: 20000, fulfilled: 10000, requestedItems: 20, fulfilledItems: 10, ...values,
})
function fixture(): SalesData {
  return salesSchema.parse({
    customers: [1, 2].map(storeId => ({ id: '1', storeId, name: 'Mesmo nome', email: 'mesmo@example.test', city: 'São Paulo', state: 'SP', registeredAt: '2026-08-01T03:00:00Z' })),
    orders: [order('1', 1, { requested: 10000, fulfilled: 5000 }), order('1', 2), order('2', 2, { channel: 'B2C' }), order('3', 2, { status: 'cancelled', requested: 900000, fulfilled: 0 })],
    coverageFrom: '2026-09-01', coverageThrough: '2026-09-30', updatedAt: '2026-09-30T20:00:00Z',
  })
}

test('consolidated KPIs reconcile with customers, brands, channels and daily series', () => {
  const result = aggregateSales(fixture(), [1, 2], filters)
  assert.equal(result.requested, 50000); assert.equal(result.fulfilled, 25000)
  assert.equal(result.orders, 3); assert.equal(result.cancelled, 1)
  assert.equal(result.ticket, 25000 / 3); assert.equal(result.fulfillmentRate, 50)
  for (const rows of [result.customers, result.brands, result.channels, result.days]) {
    assert.equal(rows.reduce((sum, row) => sum + row.requested, 0), result.requested)
    assert.equal(rows.reduce((sum, row) => sum + row.fulfilled, 0), result.fulfilled)
    assert.equal(rows.reduce((sum, row) => sum + row.orders, 0), result.orders)
  }
  assert.notEqual(result.ticket, result.brands.reduce((sum, brand) => sum + (brand.ticket ?? 0), 0) / 2)
})
test('customer identity is scoped by brand; equal IDs, names and emails do not merge', () => {
  const result = aggregateSales(fixture(), [1, 2], filters)
  assert.equal(result.customers.length, 2); assert.equal(result.buyers, 2)
  assert.equal(result.repeatBuyers, 1); assert.equal(result.repeatRate, 50)
  assert.deepEqual(result.customers.map(customer => customer.orders), [1, 2])
})
test('brand and channel filters intersect and do not count other stores', () => {
  const result = aggregateSales(fixture(), [1, 2], { ...filters, storeId: '2', channel: 'B2C' })
  assert.equal(result.orders, 1); assert.equal(result.fulfilled, 10000)
  assert.equal(result.customers.length, 1); assert.equal(result.ticket, 10000)
  assert.equal(result.channels.find(channel => channel.channel === 'B2B')?.orders, 0)
  assert.equal(aggregateSales(fixture(), [1], filters).orders, 1)
})
test('Brazil day boundaries include the whole selected day and exclude next-day orders', () => {
  const data = fixture()
  data.orders = [order('1', 1, { createdAt: '2026-09-02T02:59:59Z' }), order('2', 1, { createdAt: '2026-09-02T03:00:00Z' })]
  assert.equal(businessDate(data.orders[0].createdAt), '2026-09-01')
  const result = aggregateSales(data, [1, 2], { ...filters, from: '2026-09-01', through: '2026-09-01' })
  assert.equal(result.orders, 1); assert.equal(result.days.length, 1)
})
test('empty periods retain customers but show undefined rates and ticket, not false ratios', () => {
  const result = aggregateSales(fixture(), [1, 2], { ...filters, from: '2026-09-01', through: '2026-09-02' })
  assert.equal(result.registered, 2); assert.equal(result.buyers, 0)
  assert.equal(result.ticket, null); assert.equal(result.fulfillmentRate, null); assert.equal(result.repeatRate, null)
  assert.equal(result.days.length, 2); assert.ok(result.days.every(day => day.orders === 0))
  assert.equal(summarize([order('cancelled', 1, { status: 'cancelled' })]).requested, 0)
})
test('invalid or uncovered date ranges cannot be presented as complete totals', () => {
  const data = fixture()
  assert.equal(rangeError(data, filters), null)
  assert.ok(rangeError(data, { ...filters, from: '2026-08-01' }))
  assert.ok(rangeError(data, { ...filters, from: '2026-10-01' }))
  assert.ok(rangeError(data, { ...filters, from: '' }))
  assert.ok(rangeError(data, { ...filters, through: '2026-02-31' }))
})
test('sales contract rejects duplicate orders, unknown customers, over-fulfillment and uncovered rows', () => {
  const data = fixture()
  assert.equal(salesSchema.safeParse({ ...data, orders: [...data.orders, data.orders[0]] }).success, false)
  assert.equal(salesSchema.safeParse({ ...data, orders: [order('x', 999)] }).success, false)
  assert.equal(salesSchema.safeParse({ ...data, orders: [order('x', 1, { fulfilled: 30000 })] }).success, false)
  assert.equal(salesSchema.safeParse({ ...data, orders: [order('x', 1, { createdAt: '2026-08-30T15:00:00Z' })] }).success, false)
})
test('demo owner gets sales data and viewer receives no customer or order payload', async () => {
  const owner = await createDemo('owner'), viewer = await createDemo('viewer')
  try {
    const workspace = await demoWorkspace(owner.token)
    assert.ok(workspace.sales && workspace.sales.customers.length === 120)
    assert.ok(workspace.sales.orders.length > 0)
    assert.equal((await demoWorkspace(viewer.token)).sales, null)
  } finally { await deleteDemo(owner.token); await deleteDemo(viewer.token) }
})
