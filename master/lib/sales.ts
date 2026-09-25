import { z } from 'zod'

export const salesChannels = ['B2B', 'B2C', 'OFFLINE'] as const
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const salesCustomerSchema = z.object({
  id: z.string().min(1), storeId: z.number().int().positive(), name: z.string(),
  email: z.string(), city: z.string(), state: z.string(), registeredAt: z.iso.datetime(),
})
export const salesOrderSchema = z.object({
  id: z.string().min(1), storeId: z.number().int().positive(), customerId: z.string().min(1),
  channel: z.enum(salesChannels), createdAt: z.iso.datetime(),
  status: z.enum(['pending', 'confirmed', 'partial', 'fulfilled', 'cancelled']),
  requested: cents, fulfilled: cents, requestedItems: z.number().int().nonnegative(),
  fulfilledItems: z.number().int().nonnegative(),
}).refine(order => order.fulfilled <= order.requested && order.fulfilledItems <= order.requestedItems,
  'Atendido não pode superar solicitado neste contrato.')
export const salesSchema = z.object({
  customers: z.array(salesCustomerSchema), orders: z.array(salesOrderSchema),
  coverageFrom: z.iso.date(), coverageThrough: z.iso.date(), updatedAt: z.iso.datetime(),
}).superRefine((data, context) => {
  const customers = new Map<string, SalesCustomer>(), orders = new Set<string>()
  if (data.coverageFrom > data.coverageThrough) context.addIssue({ code: 'custom', message: 'Cobertura de datas inválida.' })
  for (const customer of data.customers) {
    const key = entityKey(customer.storeId, customer.id)
    if (customers.has(key)) context.addIssue({ code: 'custom', message: 'Cadastro duplicado dentro da marca.' })
    customers.set(key, customer)
  }
  for (const order of data.orders) {
    const key = entityKey(order.storeId, order.id), customer = customers.get(entityKey(order.storeId, order.customerId))
    if (orders.has(key) || !customer || (customer && Date.parse(order.createdAt) < Date.parse(customer.registeredAt)))
      context.addIssue({ code: 'custom', message: 'Pedido duplicado ou vínculo de cliente inválido.' })
    orders.add(key)
    const day = businessDate(order.createdAt)
    if (day < data.coverageFrom || day > data.coverageThrough) context.addIssue({ code: 'custom', message: 'Pedido fora da cobertura declarada.' })
  }
})
export type SalesCustomer = z.infer<typeof salesCustomerSchema>
export type SalesOrder = z.infer<typeof salesOrderSchema>
export type SalesData = z.infer<typeof salesSchema>
export type SalesFilters = { from: string; through: string; storeId: string; channel: string }
export const entityKey = (storeId: number, id: string) => JSON.stringify([storeId, id])
const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export const businessDate = (value: string) => dateFormatter.format(new Date(value))
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}
export function summarize(orders: SalesOrder[]) {
  const valid = orders.filter(order => order.status !== 'cancelled')
  const requested = valid.reduce((sum, order) => sum + order.requested, 0)
  const fulfilled = valid.reduce((sum, order) => sum + order.fulfilled, 0)
  const requestedItems = valid.reduce((sum, order) => sum + order.requestedItems, 0)
  const fulfilledItems = valid.reduce((sum, order) => sum + order.fulfilledItems, 0)
  return {
    requested, fulfilled, orders: valid.length, cancelled: orders.length - valid.length,
    requestedItems, fulfilledItems, gap: requested - fulfilled,
    ticket: valid.length ? fulfilled / valid.length : null,
    fulfillmentRate: requested ? fulfilled / requested * 100 : null,
    itemsPerOrder: valid.length ? requestedItems / valid.length : null,
    lastOrder: valid.map(order => order.createdAt).sort().at(-1) ?? null,
  }
}
export type SalesSummary = ReturnType<typeof summarize>
export type CustomerMetrics = SalesCustomer & SalesSummary
export function aggregateSales(data: SalesData, storeIds: number[], filters: SalesFilters) {
  const inScope = new Set(storeIds.filter(id => filters.storeId === 'all' || String(id) === filters.storeId))
  const customers = data.customers.filter(customer => inScope.has(customer.storeId) && businessDate(customer.registeredAt) <= filters.through)
  const orders = data.orders.filter(order => {
    const day = businessDate(order.createdAt)
    return inScope.has(order.storeId) && day >= filters.from && day <= filters.through && (filters.channel === 'all' || order.channel === filters.channel)
  })
  const byCustomer = new Map<string, SalesOrder[]>(), byBrand = new Map<number, SalesOrder[]>(), byDay = new Map<string, SalesOrder[]>()
  for (const order of orders) {
    const key = entityKey(order.storeId, order.customerId), day = businessDate(order.createdAt)
    if (!byCustomer.has(key)) byCustomer.set(key, [])
    if (!byBrand.has(order.storeId)) byBrand.set(order.storeId, [])
    if (!byDay.has(day)) byDay.set(day, [])
    byCustomer.get(key)!.push(order)
    byBrand.get(order.storeId)!.push(order)
    byDay.get(day)!.push(order)
  }
  const customerRows: CustomerMetrics[] = customers.map(customer => ({ ...customer, ...summarize(byCustomer.get(entityKey(customer.storeId, customer.id)) ?? []) }))
  const buyers = customerRows.filter(customer => customer.orders > 0).length
  const repeatBuyers = customerRows.filter(customer => customer.orders >= 2).length
  const days = []
  // Coverage is bounded by the source, so missing days within it are genuine zero activity.
  for (let day = filters.from; day <= filters.through; day = shiftDate(day, 1)) {
    days.push({ day, ...summarize(byDay.get(day) ?? []) })
  }
  const brandRows = [...inScope].map(storeId => ({
    storeId, ...summarize(byBrand.get(storeId) ?? []),
    buyers: customerRows.filter(customer => customer.storeId === storeId && customer.orders > 0).length,
    customers: customerRows.filter(customer => customer.storeId === storeId).length,
  }))
  return {
    ...summarize(orders), customers: customerRows, brands: brandRows, days, sourceOrders: orders,
    buyers, registered: customers.length, repeatBuyers,
    repeatRate: buyers ? repeatBuyers / buyers * 100 : null,
    activeBrands: brandRows.filter(brand => brand.orders > 0).length,
    channels: salesChannels.map(channel => ({ channel, ...summarize(orders.filter(order => order.channel === channel)) })),
  }
}
export function rangeError(data: SalesData, filters: SalesFilters) {
  if (!z.iso.date().safeParse(filters.from).success || !z.iso.date().safeParse(filters.through).success || filters.from > filters.through)
    return 'Informe um período válido, com a data inicial anterior ou igual à final.'
  if (filters.from < data.coverageFrom || filters.through > data.coverageThrough)
    return 'Este período não está totalmente coberto pelos dados disponíveis. Ajuste as datas para consultar totais completos.'
  if ((Date.parse(filters.through) - Date.parse(filters.from)) / 86400000 > 366)
    return 'Selecione até 367 dias por consulta.'
  return null
}
