// Dashboard data source used by existing dashboard layout/components.
// The UI imports these bindings directly; values are updated at runtime
// through setDashboardDataFromLive without changing component layout.

export type DOrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'INVOICED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
export type DCurve = 'A' | 'B' | 'C'
export type DRFMSegment = 'Champions' | 'Loyal' | 'Promising' | 'At Risk' | 'Lost'
export type DCustomerStatus = 'active' | 'inactive' | 'at_risk'

export interface DOrder {
  id: string
  customerId: string
  customerName: string
  state: string
  city: string
  status: DOrderStatus
  total: number
  fulfilledTotal: number
  items: number
  fulfilledItems: number
  paymentMethod: string
  date: Date
  month: string
}

export interface DCustomer {
  id: string
  name: string
  email: string
  state: string
  city: string
  segment: string
  status: DCustomerStatus
  rfmSegment: DRFMSegment
  registeredAt: Date
  firstPurchaseAt: Date | null
  lastPurchaseAt: Date | null
  totalOrders: number
  totalRevenue: number
  totalRequested: number
  avgTicket: number
  frequency: number
  daysToPurchase: number | null
  assignedSellerName?: string | null
}

export interface DProduct {
  id: string
  name: string
  sku: string
  category: string
  imageUrl?: string | null
  basePrice: number
  revenueRequested: number
  revenueFulfilled: number
  unitsRequested: number
  unitsFulfilled: number
  stock: number
  dailySales: number
  daysLeft: number
  curve: DCurve
  sizes: { size: string; units: number }[]
  colors: { color: string; hex: string; units: number }[]
  monthlyRevenue: { month: string; value: number }[]
}

export interface DMonthlyRevenue {
  month: string
  requested: number
  fulfilled: number
  orders: number
  newCustomers: number
  returningCustomers: number
}

export interface DGeoEntry {
  state: string
  stateCode: string
  customers: number
  orders: number
  requested: number
  fulfilled: number
  cities: { city: string; customers: number; revenue: number }[]
}

export interface DRFMEntry {
  segment: DRFMSegment
  count: number
  color: string
  bgColor: string
  pct: number
  avgRevenue: number
  description: string
}

export interface DCohortRow {
  cohort: string
  months: (number | null)[]
}

export interface DFunnelStage {
  label: string
  value: number
  pct: number
  color: string
}

type LiveOrder = {
  id: string
  customerId: string
  status: string
  total: number
  fulfilledTotal?: number
  totalItems?: number
  fulfilledItems?: number
  paymentMethod?: string | null
  createdAt: Date | string
  items?: Array<{ qty?: number; fulfilled?: boolean; total?: number }>
}

type LiveCustomer = {
  id: string
  companyName?: string
  tradeName?: string
  contactName?: string
  email?: string
  state?: string
  city?: string
  segment?: string | null
  status?: string
  createdAt?: Date | string
}

type LiveProduct = {
  id: string
  name?: string
  sku?: string
  categoryId?: string
  categoryIds?: string[]
  basePrice?: number
  imageUrl?: string | null
  primaryImageUrl?: string | null
  coverImageUrl?: string | null
  variants?: Array<{ size?: string; color?: string; stock?: number; variantSku?: string }>
}

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
const monthKeyFmt = new Intl.DateTimeFormat('en-CA', { month: '2-digit', year: 'numeric' })

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  const parsed = new Date(String(value || ''))
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function titleFromCustomer(customer: LiveCustomer): string {
  const primary = String(customer.companyName || customer.tradeName || customer.contactName || '').trim()
  return primary || `Cliente #${customer.id}`
}

function normalizeOrderStatus(status: string): DOrderStatus {
  const upper = String(status || '').toUpperCase()
  return ['PENDING', 'CONFIRMED', 'PROCESSING', 'INVOICED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(upper)
    ? (upper as DOrderStatus)
    : 'PENDING'
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime())
  return Math.max(0, Math.round(ms / 86400000))
}

function statusToCustomerStatus(raw: string | undefined, recencyDays: number | null): DCustomerStatus {
  const status = String(raw || '').toUpperCase()
  if (status === 'REJECTED') return 'inactive'
  if (status === 'PENDING') return 'inactive'
  if (recencyDays !== null && recencyDays > 120) return 'at_risk'
  return 'active'
}

function classifyRfm(recencyDays: number | null, frequency: number, totalRevenue: number): DRFMSegment {
  if (recencyDays === null) return 'Lost'
  if (recencyDays <= 30 && frequency >= 3 && totalRevenue >= 8000) return 'Champions'
  if (recencyDays <= 60 && frequency >= 2) return 'Loyal'
  if (recencyDays <= 90 && frequency >= 1) return 'Promising'
  if (recencyDays <= 180) return 'At Risk'
  return 'Lost'
}

function colorHex(name: string): string {
  const base = String(name || '').trim().toLowerCase()
  if (base.includes('preto')) return '#1c1c1c'
  if (base.includes('branco')) return '#f9f7f3'
  if (base.includes('azul')) return '#4b6587'
  if (base.includes('verde')) return '#7cb9c5'
  if (base.includes('rosa')) return '#e8a9a9'
  if (base.includes('bege') || base.includes('areia')) return '#d8c3ab'
  return '#9ca3af'
}

function emptyTotals() {
  return {
    totalRequested: 0,
    totalFulfilled: 0,
    fulfillmentRate: 0,
    totalOrders: 0,
    activeOrders: 0,
    deliveredOrders: 0,
    pendingOrders: 0,
    approvedCustomers: 0,
    purchasedCustomers: 0,
    activeCustomers: 0,
    newCustomers: 0,
    returningCustomers: 0,
    conversionRate: 0,
    avgTicket: 0,
    avgDaysToFirstPurchase: 0,
    repeatRate: 0,
  }
}

export let MONTHLY_REVENUE: DMonthlyRevenue[] = []
export let WEEKLY_REVENUE: Array<{ week: string; requested: number; fulfilled: number }> = []
export let DASHBOARD_ORDERS: DOrder[] = []
export let DASHBOARD_CUSTOMERS: DCustomer[] = []
export let DASHBOARD_PRODUCTS: DProduct[] = []
export let GEO_DATA: DGeoEntry[] = []
export let RFM_DATA: DRFMEntry[] = []
export let COHORT_DATA: DCohortRow[] = []
export let FUNNEL_DATA: DFunnelStage[] = []
export let SEASONALITY_BY_CATEGORY: Array<Record<string, number | string>> = []
export let SEASONALITY_ORDERS_BY_MONTH: Array<{ month: string; orders: number }> = []
export let TOTALS = emptyTotals()

export function fmt(v: number, compact = false) {
  if (compact && v >= 1000) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, notation: 'compact' }).format(v)
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

export function fmtN(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v)
}

export function fmtPct(v: number) {
  return `${v.toFixed(1)}%`
}

export const STATUS_LABELS: Record<DOrderStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Processando',
  INVOICED: 'Faturado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

export const CURVE_COLORS: Record<DCurve, { bg: string; text: string }> = {
  A: { bg: '#d1fae5', text: '#065f46' },
  B: { bg: '#fef3c7', text: '#92400e' },
  C: { bg: '#f3f4f6', text: '#374151' },
}

export function setDashboardDataFromLive(payload: {
  orders: LiveOrder[]
  customers: LiveCustomer[]
  products: LiveProduct[]
}) {
  const customersById = new Map(payload.customers.map((c) => [String(c.id), c]))

  const dOrders: DOrder[] = payload.orders.map((order) => {
    const customer = customersById.get(String(order.customerId))
    const createdAt = toDate(order.createdAt)
    const orderItems = Array.isArray(order.items) ? order.items : []
    const totalItems = Number(order.totalItems ?? orderItems.reduce((sum, item) => sum + Number(item.qty || 0), 0))
    const fulfilledItems = Number(
      order.fulfilledItems
      ?? orderItems.reduce((sum, item) => sum + (item.fulfilled ? Number(item.qty || 0) : 0), 0)
      ?? 0,
    )

    return {
      id: String(order.id),
      customerId: String(order.customerId),
      customerName: customer ? titleFromCustomer(customer) : `Cliente #${order.customerId}`,
      state: String(customer?.state || '-'),
      city: String(customer?.city || '-'),
      status: normalizeOrderStatus(order.status),
      total: Number(order.total || 0),
      fulfilledTotal: Number(order.fulfilledTotal ?? order.total ?? 0),
      items: totalItems,
      fulfilledItems,
      paymentMethod: String(order.paymentMethod || '-'),
      date: createdAt,
      month: monthFmt.format(createdAt).replace('.', ''),
    }
  })

  const customerOrderMap = new Map<string, DOrder[]>()
  for (const order of dOrders) {
    const list = customerOrderMap.get(order.customerId) || []
    list.push(order)
    customerOrderMap.set(order.customerId, list)
  }

  const dCustomers: DCustomer[] = payload.customers.map((customer) => {
    const id = String(customer.id)
    const orders = (customerOrderMap.get(id) || []).sort((a, b) => a.date.getTime() - b.date.getTime())
    const registeredAt = toDate(customer.createdAt)
    const firstPurchaseAt = orders.length > 0 ? orders[0].date : null
    const lastPurchaseAt = orders.length > 0 ? orders[orders.length - 1].date : null
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.fulfilledTotal || 0), 0)
    const totalRequested = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0
    const recencyDays = lastPurchaseAt ? daysBetween(new Date(), lastPurchaseAt) : null
    const daysToPurchase = firstPurchaseAt ? daysBetween(registeredAt, firstPurchaseAt) : null
    const frequency = orders.length <= 1 || !firstPurchaseAt || !lastPurchaseAt
      ? 0
      : Math.max(1, Math.round(daysBetween(firstPurchaseAt, lastPurchaseAt) / (orders.length - 1)))
    const status = statusToCustomerStatus(customer.status, recencyDays)
    const rfmSegment = classifyRfm(recencyDays, orders.length, totalRevenue)

    return {
      id,
      name: titleFromCustomer(customer),
      email: String(customer.email || ''),
      state: String(customer.state || '-'),
      city: String(customer.city || '-'),
      segment: String(customer.segment || 'Sem segmento'),
      status,
      rfmSegment,
      registeredAt,
      firstPurchaseAt,
      lastPurchaseAt,
      totalOrders: orders.length,
      totalRevenue,
      totalRequested,
      avgTicket,
      frequency,
      daysToPurchase,
    }
  })

  const orderItemsByProduct = new Map<string, { unitsRequested: number; unitsFulfilled: number; revenueRequested: number; revenueFulfilled: number; monthly: Map<string, number> }>()
  for (const order of payload.orders) {
    const createdAt = toDate(order.createdAt)
    const monthKey = monthKeyFmt.format(createdAt)
    for (const item of order.items || []) {
      const productId = String((item as unknown as { productId?: string }).productId || '')
      if (!productId) continue
      const current = orderItemsByProduct.get(productId) || {
        unitsRequested: 0,
        unitsFulfilled: 0,
        revenueRequested: 0,
        revenueFulfilled: 0,
        monthly: new Map<string, number>(),
      }
      const qty = Number(item.qty || 0)
      const total = Number(item.total || 0)
      current.unitsRequested += qty
      current.revenueRequested += total
      if (item.fulfilled) {
        current.unitsFulfilled += qty
        current.revenueFulfilled += total
      }
      current.monthly.set(monthKey, (current.monthly.get(monthKey) || 0) + total)
      orderItemsByProduct.set(productId, current)
    }
  }

  const productRows = payload.products.map((product) => {
    const agg = orderItemsByProduct.get(String(product.id)) || {
      unitsRequested: 0,
      unitsFulfilled: 0,
      revenueRequested: 0,
      revenueFulfilled: 0,
      monthly: new Map<string, number>(),
    }

    const sizesMap = new Map<string, number>()
    const colorsMap = new Map<string, number>()
    let stock = 0
    for (const variant of product.variants || []) {
      const size = String(variant.size || '').trim() || '-'
      const color = String(variant.color || '').trim() || '-'
      sizesMap.set(size, (sizesMap.get(size) || 0) + 1)
      colorsMap.set(color, (colorsMap.get(color) || 0) + 1)
      stock += Math.max(0, Number(variant.stock || 0))
    }

    const dailySales = Math.max(0, Math.round(agg.unitsRequested / 30))
    const daysLeft = dailySales > 0 ? Math.max(0, Math.round(stock / dailySales)) : 999
    const monthlyRevenue = Array.from(agg.monthly.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-4)
      .map(([key, value]) => {
        const [year, month] = key.split('-')
        const labelDate = new Date(Number(year), Number(month) - 1, 1)
        return { month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(labelDate).replace('.', ''), value }
      })

    return {
      id: String(product.id),
      name: String(product.name || `Produto #${product.id}`),
      sku: String(product.sku || ''),
      category: String(product.categoryId || product.categoryIds?.[0] || 'Sem categoria'),
      imageUrl: String(product.imageUrl || product.primaryImageUrl || product.coverImageUrl || '') || null,
      basePrice: Number(product.basePrice || 0),
      revenueRequested: agg.revenueRequested,
      revenueFulfilled: agg.revenueFulfilled,
      unitsRequested: agg.unitsRequested,
      unitsFulfilled: agg.unitsFulfilled,
      stock,
      dailySales,
      daysLeft,
      curve: 'C' as DCurve,
      sizes: Array.from(sizesMap.entries()).map(([size, units]) => ({ size, units })),
      colors: Array.from(colorsMap.entries()).map(([color, units]) => ({ color, hex: colorHex(color), units })),
      monthlyRevenue,
    }
  })

  const sortedByRevenue = [...productRows].sort((a, b) => b.revenueRequested - a.revenueRequested)
  const aCut = Math.ceil(sortedByRevenue.length * 0.2)
  const bCut = Math.ceil(sortedByRevenue.length * 0.6)
  const dProducts: DProduct[] = sortedByRevenue.map((product, index) => ({
    ...product,
    curve: index < aCut ? 'A' : index < bCut ? 'B' : 'C',
  }))

  const monthlyBuckets = new Map<string, DMonthlyRevenue>()
  for (const order of dOrders) {
    const key = monthKeyFmt.format(order.date)
    const row = monthlyBuckets.get(key) || {
      month: monthFmt.format(order.date).replace('.', ''),
      requested: 0,
      fulfilled: 0,
      orders: 0,
      newCustomers: 0,
      returningCustomers: 0,
    }
    row.requested += order.total
    row.fulfilled += order.fulfilledTotal
    row.orders += 1
    monthlyBuckets.set(key, row)
  }

  const firstOrderMonth = new Map<string, string>()
  for (const order of [...dOrders].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (!firstOrderMonth.has(order.customerId)) {
      firstOrderMonth.set(order.customerId, monthKeyFmt.format(order.date))
    }
  }

  for (const [customerId, monthKey] of firstOrderMonth.entries()) {
    const customerOrderCount = (customerOrderMap.get(customerId) || []).length
    const row = monthlyBuckets.get(monthKey)
    if (!row) continue
    if (customerOrderCount > 1) row.returningCustomers += 1
    else row.newCustomers += 1
  }

  const monthlyRevenue = Array.from(monthlyBuckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([, value]) => value)

  const weekly = new Map<string, { requested: number; fulfilled: number }>()
  for (const order of dOrders) {
    const weekStart = new Date(order.date)
    weekStart.setDate(order.date.getDate() - ((order.date.getDay() + 6) % 7))
    const key = weekStart.toISOString().slice(0, 10)
    const row = weekly.get(key) || { requested: 0, fulfilled: 0 }
    row.requested += order.total
    row.fulfilled += order.fulfilledTotal
    weekly.set(key, row)
  }
  const weeklyRevenue = Array.from(weekly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([key, row], index) => ({ week: `S${index + 1}`, requested: row.requested, fulfilled: row.fulfilled }))

  const geoMap = new Map<string, DGeoEntry>()
  for (const customer of dCustomers) {
    const stateCode = String(customer.state || '-').slice(0, 2).toUpperCase()
    const current = geoMap.get(customer.state) || {
      state: customer.state,
      stateCode,
      customers: 0,
      orders: 0,
      requested: 0,
      fulfilled: 0,
      cities: [],
    }
    current.customers += 1
    const customerOrders = customerOrderMap.get(customer.id) || []
    current.orders += customerOrders.length
    current.requested += customerOrders.reduce((sum, order) => sum + order.total, 0)
    current.fulfilled += customerOrders.reduce((sum, order) => sum + order.fulfilledTotal, 0)
    current.cities.push({ city: customer.city, customers: 1, revenue: customer.totalRevenue })
    geoMap.set(customer.state, current)
  }
  const geoData = Array.from(geoMap.values())
    .map((entry) => ({
      ...entry,
      cities: Object.values(entry.cities.reduce<Record<string, { city: string; customers: number; revenue: number }>>((acc, city) => {
        const existing = acc[city.city] || { city: city.city, customers: 0, revenue: 0 }
        existing.customers += city.customers
        existing.revenue += city.revenue
        acc[city.city] = existing
        return acc
      }, {})),
    }))
    .sort((a, b) => b.requested - a.requested)

  const rfmSegments: DRFMSegment[] = ['Champions', 'Loyal', 'Promising', 'At Risk', 'Lost']
  const rfmStyle: Record<DRFMSegment, { color: string; bgColor: string; description: string }> = {
    Champions: { color: '#10b981', bgColor: '#d1fae5', description: 'Alta frequência e alto valor.' },
    Loyal: { color: '#3b82f6', bgColor: '#dbeafe', description: 'Base recorrente de receita.' },
    Promising: { color: '#a855f7', bgColor: '#f3e8ff', description: 'Clientes novos com potencial.' },
    'At Risk': { color: '#f59e0b', bgColor: '#fef3c7', description: 'Queda de recorrência.' },
    Lost: { color: '#ef4444', bgColor: '#fee2e2', description: 'Sem atividade recente.' },
  }

  const rfmData: DRFMEntry[] = rfmSegments.map((segment) => {
    const group = dCustomers.filter((customer) => customer.rfmSegment === segment)
    const count = group.length
    const pct = dCustomers.length > 0 ? (count / dCustomers.length) * 100 : 0
    const avgRevenue = count > 0 ? group.reduce((sum, customer) => sum + customer.totalRevenue, 0) / count : 0
    return {
      segment,
      count,
      pct,
      avgRevenue,
      ...rfmStyle[segment],
    }
  })

  const cohorts = new Map<string, DCustomer[]>()
  for (const customer of dCustomers) {
    const key = monthKeyFmt.format(customer.registeredAt)
    const list = cohorts.get(key) || []
    list.push(customer)
    cohorts.set(key, list)
  }
  const sortedCohorts = Array.from(cohorts.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-10)
  const cohortData: DCohortRow[] = sortedCohorts.map(([cohortKey, members]) => {
    const [year, month] = cohortKey.split('-')
    const baseDate = new Date(Number(year), Number(month) - 1, 1)
    const label = monthFmt.format(baseDate).replace('.', '')
    const months = Array.from({ length: 8 }, (_, monthOffset) => {
      if (monthOffset === 0) return 100
      const retained = members.filter((customer) => {
        if (!customer.lastPurchaseAt) return false
        const monthsDiff = (customer.lastPurchaseAt.getFullYear() - customer.registeredAt.getFullYear()) * 12
          + (customer.lastPurchaseAt.getMonth() - customer.registeredAt.getMonth())
        return monthsDiff >= monthOffset
      }).length
      return members.length > 0 ? clampPct((retained / members.length) * 100) : null
    })
    return { cohort: label, months }
  })

  const approvedCustomers = dCustomers.filter((customer) => customer.status !== 'inactive').length
  const firstOrderCustomers = dCustomers.filter((customer) => customer.firstPurchaseAt).length
  const fulfilledCustomers = dCustomers.filter((customer) => customer.totalRevenue > 0).length
  const repeatCustomers = dCustomers.filter((customer) => customer.totalOrders >= 2).length
  const threePlusCustomers = dCustomers.filter((customer) => customer.totalOrders >= 3).length
  const funnelData: DFunnelStage[] = [
    { label: 'Cadastros Aprovados', value: approvedCustomers, pct: 100, color: '#6366f1' },
    { label: 'Realizaram 1º Pedido', value: firstOrderCustomers, pct: approvedCustomers > 0 ? clampPct(firstOrderCustomers / approvedCustomers * 100) : 0, color: '#8b5cf6' },
    { label: 'Pedido Atendido', value: fulfilledCustomers, pct: approvedCustomers > 0 ? clampPct(fulfilledCustomers / approvedCustomers * 100) : 0, color: '#a855f7' },
    { label: 'Compraram 2x ou mais', value: repeatCustomers, pct: approvedCustomers > 0 ? clampPct(repeatCustomers / approvedCustomers * 100) : 0, color: '#c084fc' },
    { label: 'Compraram 3x ou mais', value: threePlusCustomers, pct: approvedCustomers > 0 ? clampPct(threePlusCustomers / approvedCustomers * 100) : 0, color: '#d8b4fe' },
  ]

  const ordersByMonth = new Map<string, number>()
  for (const order of dOrders) {
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(order.date).replace('.', '')
    ordersByMonth.set(label, (ordersByMonth.get(label) || 0) + 1)
  }
  const monthSequence = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const seasonalityOrders = monthSequence.map((monthLabel) => ({
    month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    orders: ordersByMonth.get(monthLabel) || 0,
  }))

  const categoryMap = new Map<string, Record<string, number | string>>()
  for (const product of dProducts) {
    const key = product.category || 'Sem categoria'
    const row = categoryMap.get(key) || {
      category: key,
      jan: 0, fev: 0, mar: 0, abr: 0, mai: 0, jun: 0,
      jul: 0, ago: 0, set: 0, out: 0, nov: 0, dez: 0,
    }
    for (const revenue of product.monthlyRevenue) {
      const monthKey = String(revenue.month || '').trim().toLowerCase().slice(0, 3)
      if (Object.prototype.hasOwnProperty.call(row, monthKey)) {
        row[monthKey] = Number(row[monthKey] || 0) + Number(revenue.value || 0) / 1000
      }
    }
    categoryMap.set(key, row)
  }

  const activeOrders = dOrders.filter((order) => order.status !== 'CANCELLED')
  const deliveredOrders = dOrders.filter((order) => order.status === 'DELIVERED')
  const totalRequested = activeOrders.reduce((sum, order) => sum + order.total, 0)
  const totalFulfilled = activeOrders.reduce((sum, order) => sum + order.fulfilledTotal, 0)
  const purchasedCustomers = dCustomers.filter((customer) => customer.firstPurchaseAt !== null).length
  const returningCustomers = dCustomers.filter((customer) => customer.totalOrders >= 2).length
  const avgDaysToFirstPurchaseSource = dCustomers.filter((customer) => customer.daysToPurchase !== null)
  const avgDaysToFirstPurchase = avgDaysToFirstPurchaseSource.length > 0
    ? avgDaysToFirstPurchaseSource.reduce((sum, customer) => sum + Number(customer.daysToPurchase || 0), 0) / avgDaysToFirstPurchaseSource.length
    : 0

  MONTHLY_REVENUE = monthlyRevenue
  WEEKLY_REVENUE = weeklyRevenue
  DASHBOARD_ORDERS = dOrders
  DASHBOARD_CUSTOMERS = dCustomers
  DASHBOARD_PRODUCTS = dProducts
  GEO_DATA = geoData
  RFM_DATA = rfmData
  COHORT_DATA = cohortData
  FUNNEL_DATA = funnelData
  SEASONALITY_BY_CATEGORY = Array.from(categoryMap.values())
  SEASONALITY_ORDERS_BY_MONTH = seasonalityOrders
  TOTALS = {
    totalRequested,
    totalFulfilled,
    fulfillmentRate: totalRequested > 0 ? (totalFulfilled / totalRequested) * 100 : 0,
    totalOrders: dOrders.length,
    activeOrders: activeOrders.length,
    deliveredOrders: deliveredOrders.length,
    pendingOrders: dOrders.filter((order) => order.status === 'PENDING').length,
    approvedCustomers,
    purchasedCustomers,
    activeCustomers: dCustomers.filter((customer) => customer.status === 'active').length,
    newCustomers: dCustomers.filter((customer) => daysBetween(new Date(), customer.registeredAt) <= 60).length,
    returningCustomers,
    conversionRate: approvedCustomers > 0 ? (purchasedCustomers / approvedCustomers) * 100 : 0,
    avgTicket: activeOrders.length > 0 ? totalFulfilled / activeOrders.length : 0,
    avgDaysToFirstPurchase,
    repeatRate: purchasedCustomers > 0 ? (returningCustomers / purchasedCustomers) * 100 : 0,
  }
}