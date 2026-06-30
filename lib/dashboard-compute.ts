// Transform API responses → dashboard types; compute all derived datasets.

import type {
  DOrder, DOrderStatus, DCustomer, DCustomerStatus, DProduct, DRFMSegment,
  DMonthlyRevenue, DGeoEntry, DRFMEntry, DCohortRow, DFunnelStage,
  DTrafficSource, DTopVisitedProduct,
} from '@/lib/dashboard-mock-data'
import type {
  ApiOrder, ApiOrderItem, ApiCustomer, ApiProduct, ApiInventoryItem, ApiAnalyticsFactItem,
} from '@/lib/upzero-api'

// ── Shared helpers ────────────────────────────────────────────────────────────

function parseMoney(s: string | null | undefined): number {
  if (!s) return 0
  const n = parseFloat(String(s).replace(/[^\d.]/g, ''))
  return isNaN(n) ? 0 : n
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`

  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) return trimmed

  try {
    return new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, base).toString()
  } catch {
    return trimmed
  }
}

type ImageCandidate = string | {
  image_url?: string | null
  imageUrl?: string | null
  url?: string | null
  src?: string | null
  storage_path?: string | null
  storagePath?: string | null
  is_primary?: boolean
  isPrimary?: boolean
} | null | undefined

function imageCandidateUrl(image: ImageCandidate): string | null {
  if (typeof image === 'string') return normalizeImageUrl(image)
  if (!image || typeof image !== 'object') return null
  return normalizeImageUrl(image.image_url ?? image.imageUrl ?? image.url ?? image.src ?? image.storage_path ?? image.storagePath)
}

function firstImageFromCandidates(images: ImageCandidate[] | undefined | null): string | null {
  if (!Array.isArray(images)) return null

  const primary = images.find((image) =>
    typeof image === 'object' && image && Boolean(image.is_primary ?? image.isPrimary)
  )
  const primaryUrl = imageCandidateUrl(primary)
  if (primaryUrl) return primaryUrl

  for (const image of images) {
    const url = imageCandidateUrl(image)
    if (url) return url
  }

  return null
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function monthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`
}

function mapOrderStatus(s: string): DOrderStatus {
  const map: Record<string, DOrderStatus> = {
    RESERVED: 'PENDING', CONFIRMED: 'CONFIRMED', PROCESSING: 'PROCESSING',
    INVOICED: 'INVOICED', SHIPPED: 'SHIPPED', CANCELED: 'CANCELLED',
  }
  return map[s] ?? 'PENDING'
}

function computeFulfilledFromItems(items: ApiOrderItem[], total: number, status: DOrderStatus): number {
  // Try item-level statuses first
  if (items && items.length > 0) {
    const fulfilledStatuses = new Set(['fulfilled', 'invoiced', 'shipped', 'delivered', 'completed'])
    const fulfilled = items.filter(item => fulfilledStatuses.has((item.status ?? '').toLowerCase()))
    if (fulfilled.length > 0) {
      return fulfilled.reduce((s, item) => s + parseMoney(item.unit_price) * item.qty, 0)
    }
  }
  // Fall back to order-level approximation
  switch (status) {
    case 'INVOICED': return total
    case 'SHIPPED':  return Math.round(total * 0.95)
    case 'PROCESSING': return 0
    default: return 0
  }
}

// ── API → DOrder ──────────────────────────────────────────────────────────────

function mapApiOrderToDOrder(order: ApiOrder): DOrder {
  const total  = parseMoney(order.total)
  const status = mapOrderStatus(order.order_status)
  const fulfilledTotal = computeFulfilledFromItems(order.items ?? [], total, status)
  const date   = new Date(order.created_at)

  const shippingAddr = order.shipping_address ?? {}
  const state = shippingAddr.state
    ?? order.customer?.wholesale_profile?.address_state
    ?? order.customer?.retail_profile?.address_state
    ?? ''
  const city = shippingAddr.city
    ?? order.customer?.wholesale_profile?.address_city
    ?? order.customer?.retail_profile?.address_city
    ?? ''

  const ps = (order.payment_status ?? '').toUpperCase()
  const paymentMethod = ps.includes('PIX')    ? 'PIX'
    : ps.includes('BOLETO')  ? 'BOLETO'
    : ps.includes('CARTAO') || ps.includes('CARD') ? 'CARTÃO'
    : 'PIX'

  const items = order.items_count ?? order.total_items_qty ?? order.items?.length ?? 0
  const fulfilledItems = status === 'INVOICED' || status === 'SHIPPED' ? items : 0

  return {
    id: order.id,
    customerId: order.customer?.id ?? '',
    customerName: order.customer?.name ?? '',
    state,
    city,
    status,
    total,
    fulfilledTotal,
    items,
    fulfilledItems,
    paymentMethod,
    date,
    month: monthLabel(date),
  }
}

// ── API → DCustomer ───────────────────────────────────────────────────────────

function inferRFMSegment(orders: DOrder[], today: Date): DRFMSegment {
  if (orders.length === 0) return 'Lost'

  const lastOrder = orders.reduce((latest, o) => o.date > latest.date ? o : latest, orders[0])
  const daysSinceLast = Math.floor((today.getTime() - lastOrder.date.getTime()) / 86_400_000)
  const count = orders.length
  const totalRevenue = orders.reduce((s, o) => s + o.fulfilledTotal, 0)
  const avgValue = count > 0 ? totalRevenue / count : 0

  const R = daysSinceLast <= 30 ? 5 : daysSinceLast <= 60 ? 4 : daysSinceLast <= 90 ? 3 : daysSinceLast <= 180 ? 2 : 1
  const F = count >= 5 ? 5 : count === 4 ? 4 : count === 3 ? 3 : count === 2 ? 2 : 1
  const M = avgValue >= 5000 ? 5 : avgValue >= 3500 ? 4 : avgValue >= 2500 ? 3 : avgValue >= 1500 ? 2 : 1

  if (R >= 4 && F >= 4 && M >= 4) return 'Champions'
  if (F >= 3 && R >= 3)           return 'Loyal'
  if (R >= 3 && F <= 2)           return 'Promising'
  if (R <= 2 && F >= 3)           return 'At Risk'
  return 'Lost'
}

function mapApiCustomerToDCustomer(c: ApiCustomer, customerOrders: DOrder[], today: Date): DCustomer {
  const wsp = c.wholesale_profile
  const rp  = c.retail_profile
  const state   = wsp?.address_state ?? rp?.address_state ?? ''
  const city    = wsp?.address_city  ?? rp?.address_city  ?? ''
  const segment = wsp?.segment ?? ''

  const active = customerOrders.filter(o => o.status !== 'CANCELLED')
  const totalOrders   = active.length
  const totalRevenue  = active.reduce((s, o) => s + o.fulfilledTotal, 0)
  const totalRequested = active.reduce((s, o) => s + o.total, 0)
  const avgTicket     = totalOrders > 0 ? totalRevenue / totalOrders : 0

  const sorted = [...active].sort((a, b) => a.date.getTime() - b.date.getTime())
  const firstPurchaseAt = sorted[0]?.date ?? null
  const lastPurchaseAt  = sorted[sorted.length - 1]?.date ?? null

  const registeredAt = c.created_at ? new Date(c.created_at) : (sorted[0]?.date ?? new Date())
  const daysToPurchase = firstPurchaseAt
    ? Math.floor((firstPurchaseAt.getTime() - registeredAt.getTime()) / 86_400_000)
    : null

  let frequency = 0
  if (sorted.length >= 2) {
    const gaps = sorted.slice(1).map((o, i) =>
      (o.date.getTime() - sorted[i].date.getTime()) / 86_400_000
    )
    frequency = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)
  }

  const rfmSegment = inferRFMSegment(active, today)
  const daysSinceLast = lastPurchaseAt
    ? Math.floor((today.getTime() - lastPurchaseAt.getTime()) / 86_400_000)
    : Infinity

  const status: DCustomerStatus =
    lastPurchaseAt && daysSinceLast <= 90  ? 'active'
    : lastPurchaseAt && daysSinceLast <= 180 ? 'at_risk'
    : 'inactive'

  return {
    id: c.id,
    name: (wsp?.company_name || wsp?.trade_name) ? (wsp.company_name ?? wsp.trade_name ?? c.name) : c.name ?? '',
    email: c.email ?? '',
    state,
    city,
    segment,
    status,
    rfmSegment,
    registeredAt,
    firstPurchaseAt,
    lastPurchaseAt,
    totalOrders,
    totalRevenue,
    totalRequested,
    avgTicket,
    frequency,
    daysToPurchase,
  }
}

// ── API → DProduct ────────────────────────────────────────────────────────────

type ProductOrderEntry = {
  variantId: string
  qty: number
  total: number
  fulfilledTotal: number
  date: Date
  imageUrl?: string | null
}

function firstProductImage(p: ApiProduct, imageUrlFromEndpoint?: string | null): string | null {
  const endpointImage = normalizeImageUrl(imageUrlFromEndpoint)
  if (endpointImage) return endpointImage

  const direct = p.image_url ?? p.imageUrl ?? p.primary_image_url ?? p.primaryImageUrl ?? p.cover_image_url ?? p.coverImageUrl
  const directImage = normalizeImageUrl(direct)
  if (directImage) return directImage

  const productImages = firstImageFromCandidates(p.images)
  if (productImages) return productImages

  if (Array.isArray(p.image_groups)) {
    for (const group of p.image_groups) {
      const groupImage = firstImageFromCandidates(group?.images)
      if (groupImage) return groupImage
    }
  }

  for (const variant of p.variants ?? []) {
    const variantImage = firstImageFromCandidates(variant.images)
    if (variantImage) return variantImage
  }

  return null
}

function firstProductOrderImage(productOrders: ProductOrderEntry[]): string | null {
  for (const entry of productOrders) {
    const imageUrl = normalizeImageUrl(entry.imageUrl)
    if (imageUrl) return imageUrl
  }

  return null
}

function mapApiProductToDProduct(
  p: ApiProduct,
  productOrders: ProductOrderEntry[],
  inventoryMap: Map<string, number>,
  today: Date,
  imageUrl?: string,
): DProduct {
  const totalStock = p.variants.reduce((s, v) => s + (inventoryMap.get(v.id) ?? 0), 0)
  const revenueRequested = productOrders.reduce((s, o) => s + o.total, 0)
  const revenueFulfilled = productOrders.reduce((s, o) => s + o.fulfilledTotal, 0)
  const unitsRequested = productOrders.reduce((s, o) => s + o.qty, 0)
  const unitsFulfilled = productOrders.reduce((s, o) => s + (o.fulfilledTotal > 0 ? o.qty : 0), 0)

  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentUnits = productOrders.filter(o => o.date >= thirtyDaysAgo).reduce((s, o) => s + o.qty, 0)
  const dailySales  = Math.round((recentUnits / 30) * 10) / 10
  const daysLeft    = dailySales > 0 ? Math.round(totalStock / dailySales) : 999

  const curve: 'A' | 'B' | 'C' = revenueRequested >= 50000 ? 'A' : revenueRequested >= 20000 ? 'B' : 'C'

  // Sizes from variant attributes
  const sizeKeys = new Set(['size', 'tamanho', 'talla'])
  const sizeMap = new Map<string, number>()
  p.variants.forEach(v => {
    const sizeAttr = (v.attributes ?? []).find(a => sizeKeys.has((a.attribute?.code ?? '').toLowerCase()))
    if (sizeAttr) {
      const label = sizeAttr.term?.name ?? sizeAttr.term?.code ?? ''
      if (label) sizeMap.set(label, (sizeMap.get(label) ?? 0) + (inventoryMap.get(v.id) ?? 0))
    }
  })
  const sizes = Array.from(sizeMap.entries()).map(([size, units]) => ({ size, units }))

  // Colors from variant attributes
  const colorKeys = new Set(['color', 'cor', 'colour'])
  const colorMap = new Map<string, number>()
  p.variants.forEach(v => {
    const colorAttr = (v.attributes ?? []).find(a => colorKeys.has((a.attribute?.code ?? '').toLowerCase()))
    if (colorAttr) {
      const label = colorAttr.term?.name ?? colorAttr.term?.code ?? ''
      if (label) colorMap.set(label, (colorMap.get(label) ?? 0) + 1)
    }
  })
  const colors = Array.from(colorMap.entries())
    .slice(0, 6)
    .map(([color, units]) => ({ color, hex: '#888888', units }))

  // Monthly revenue sparkline
  const monthMap = new Map<string, number>()
  productOrders.forEach(o => {
    const label = monthLabel(o.date)
    monthMap.set(label, (monthMap.get(label) ?? 0) + o.total)
  })
  const monthlyRevenue = Array.from(monthMap.entries()).map(([month, value]) => ({ month, value }))

  return {
    id:   p.id,
    name: p.name,
    sku:  p.code ?? p.variants[0]?.sku ?? '',
    category: p.product_category_names?.[0] ?? p.category_names?.[0] ?? p.categories?.[0]?.name ?? 'Geral',
    imageUrl: firstProductImage(p, imageUrl) ?? firstProductOrderImage(productOrders),
    basePrice: parseMoney(p.variants[0]?.price),
    revenueRequested,
    revenueFulfilled,
    unitsRequested,
    unitsFulfilled,
    stock: totalStock,
    dailySales,
    daysLeft,
    curve,
    sizes,
    colors,
    monthlyRevenue,
  }
}

// ── Master transform ──────────────────────────────────────────────────────────

export interface DashboardRawData {
  orders:    DOrder[]
  customers: DCustomer[]
  products:  DProduct[]
  analyticsFacts: ApiAnalyticsFactItem[]
  trafficSources: DTrafficSource[]
  topVisitedProducts: DTopVisitedProduct[]
}

function trafficSourceLabel(fact: ApiAnalyticsFactItem): string {
  const raw =
    fact.source ||
    fact.channel ||
    fact.utm_source ||
    fact.utm_medium ||
    fact.referrer_host ||
    'Direto'

  const normalized = String(raw).trim()
  if (!normalized) return 'Direto'

  const lower = normalized.toLowerCase()
  if (lower === 'direct' || lower === '(direct)' || lower === 'none') return 'Direto'
  if (lower === 'organic') return 'Orgânico'
  if (lower === 'paid') return 'Pago'
  if (lower === 'social') return 'Social'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function stableFactIdentity(fact: ApiAnalyticsFactItem): string {
  return fact.session_id || fact.visitor_id || fact.anonymous_id || fact.event_id || String(fact.id)
}

export function computeTrafficSourcesFromFacts(facts: ApiAnalyticsFactItem[]): DTrafficSource[] {
  const map = new Map<string, DTrafficSource & { sessionKeys: Set<string>; createdKeys: Set<string>; approvedKeys: Set<string> }>()

  facts.forEach((fact) => {
    if (!['page_view', 'order_created', 'order_approved'].includes(fact.event_name)) return

    const source = trafficSourceLabel(fact)
    const row = map.get(source) ?? {
      source,
      sessions: 0,
      solicitados: 0,
      aprovados: 0,
      sessionKeys: new Set<string>(),
      createdKeys: new Set<string>(),
      approvedKeys: new Set<string>(),
    }

    if (fact.event_name === 'page_view') {
      row.sessionKeys.add(stableFactIdentity(fact))
      row.sessions = row.sessionKeys.size
    } else if (fact.event_name === 'order_created') {
      row.createdKeys.add(fact.order_id ? `order:${fact.order_id}` : fact.event_id)
      row.solicitados = row.createdKeys.size
    } else if (fact.event_name === 'order_approved') {
      row.approvedKeys.add(fact.order_id ? `order:${fact.order_id}` : fact.event_id)
      row.aprovados = row.approvedKeys.size
    }

    map.set(source, row)
  })

  return Array.from(map.values())
    .map(({ sessionKeys, createdKeys, approvedKeys, ...row }) => row)
    .filter((row) => row.sessions > 0 || row.solicitados > 0 || row.aprovados > 0)
    .sort((a, b) => b.sessions - a.sessions)
}

export function computeTopVisitedProductsFromFacts(
  facts: ApiAnalyticsFactItem[],
  products: DProduct[],
): DTopVisitedProduct[] {
  const productById = new Map(products.map((product) => [String(product.id), product]))
  const map = new Map<string, DTopVisitedProduct>()
  const sessionKeysByProduct = new Map<string, Set<string>>()
  const userKeysByProduct = new Map<string, Set<string>>()

  facts
    .filter((fact) => fact.event_name === 'product_view' && fact.product_id)
    .forEach((fact) => {
      const id = String(fact.product_id)
      const product = productById.get(id)
      const row = map.get(id) ?? {
        id,
        name: product?.name ?? `Produto ${id}`,
        sku: product?.sku ?? '',
        imageUrl: product?.imageUrl ?? null,
        visits: 0,
        uniqueSessions: 0,
        uniqueUsers: 0,
      }

      const sessionKeys = sessionKeysByProduct.get(id) ?? new Set<string>()
      const userKeys = userKeysByProduct.get(id) ?? new Set<string>()

      row.visits += 1
      sessionKeys.add(stableFactIdentity(fact))
      if (fact.user_id) {
        userKeys.add(`user:${fact.user_id}`)
      } else if (fact.visitor_id || fact.anonymous_id) {
        userKeys.add(fact.visitor_id || fact.anonymous_id || '')
      }

      row.uniqueSessions = sessionKeys.size
      row.uniqueUsers = userKeys.size
      if (!row.imageUrl && product?.imageUrl) row.imageUrl = product.imageUrl

      sessionKeysByProduct.set(id, sessionKeys)
      userKeysByProduct.set(id, userKeys)
      map.set(id, row)
    })

  return Array.from(map.values())
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8)
}

export function transformRawData(
  apiOrders:    ApiOrder[],
  apiCustomers: ApiCustomer[],
  apiProducts:  ApiProduct[],
  inventory:    ApiInventoryItem[],
  analyticsFacts: ApiAnalyticsFactItem[] = [],
  productImages: Record<string, string> = {},
): DashboardRawData {
  const inventoryMap = new Map<string, number>(
    inventory.map(i => [i.variant_id, i.qty_available])
  )

  const orders = apiOrders.map(mapApiOrderToDOrder)

  const ordersByCustomer = new Map<string, DOrder[]>()
  orders.forEach(o => {
    const list = ordersByCustomer.get(o.customerId) ?? []
    list.push(o)
    ordersByCustomer.set(o.customerId, list)
  })

  const now = new Date()
  const customers = apiCustomers.map(c =>
    mapApiCustomerToDCustomer(c, ordersByCustomer.get(c.id) ?? [], now)
  )

  const variantToProductId = new Map<string, string>()
  apiProducts.forEach(p => p.variants.forEach(v => variantToProductId.set(v.id, p.id)))

  const productOrderData = new Map<string, ProductOrderEntry[]>()
  const resolvedProductImages: Record<string, string> = { ...productImages }
  apiOrders.forEach((apiOrder, idx) => {
    const dOrder = orders[idx]
    if (!dOrder || dOrder.status === 'CANCELLED') return
    const fulfillmentRatio = dOrder.total > 0 ? Math.min(1, Math.max(0, dOrder.fulfilledTotal / dOrder.total)) : 0
    ;(apiOrder.items ?? []).forEach(item => {
      const productIdFromItem = item.product_id != null ? String(item.product_id) : ''
      const pid = variantToProductId.get(item.variant_id) ?? productIdFromItem
      if (!pid) return
      const itemImageUrl = normalizeImageUrl(item.image_url ?? item.imageUrl ?? item.asset_image_url)
      if (itemImageUrl && !resolvedProductImages[pid]) resolvedProductImages[pid] = itemImageUrl
      const list = productOrderData.get(pid) ?? []
      const total = parseMoney(item.unit_price) * item.qty
      list.push({
        variantId: item.variant_id,
        qty: item.qty,
        total,
        fulfilledTotal: Math.round(total * fulfillmentRatio),
        date: dOrder.date,
        imageUrl: itemImageUrl,
      })
      productOrderData.set(pid, list)
    })
  })

  const products = apiProducts
    .filter(p => p.status !== 'archived')
    .map(p => mapApiProductToDProduct(p, productOrderData.get(p.id) ?? [], inventoryMap, now, resolvedProductImages[p.id]))

  return {
    orders,
    customers,
    products,
    analyticsFacts,
    trafficSources: computeTrafficSourcesFromFacts(analyticsFacts),
    topVisitedProducts: computeTopVisitedProductsFromFacts(analyticsFacts, products),
  }
}

// ── Compute functions ─────────────────────────────────────────────────────────

export function computeMonthlyRevenue(orders: DOrder[]): DMonthlyRevenue[] {
  const now = new Date()
  const map = new Map<string, DMonthlyRevenue>()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = monthLabel(d)
    map.set(label, { month: label, requested: 0, fulfilled: 0, orders: 0, newCustomers: 0, returningCustomers: 0 })
  }

  // Determine first-order month per customer
  const firstOrderMonth = new Map<string, string>()
  ;[...orders]
    .filter(o => o.status !== 'CANCELLED')
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach(o => {
      if (!firstOrderMonth.has(o.customerId)) firstOrderMonth.set(o.customerId, o.month)
    })

  orders.forEach(o => {
    if (o.status === 'CANCELLED') return
    const m = map.get(o.month)
    if (!m) return
    m.requested += o.total
    m.fulfilled += o.fulfilledTotal
    m.orders++
    if (firstOrderMonth.get(o.customerId) === o.month) {
      m.newCustomers++
    } else {
      m.returningCustomers++
    }
  })

  return Array.from(map.values())
}

export function computeWeeklyRevenue(orders: DOrder[]): { week: string; requested: number; fulfilled: number }[] {
  const now = new Date()
  return Array.from({ length: 8 }, (_, w) => {
    const endDate = new Date(now); endDate.setDate(endDate.getDate() - w * 7)
    const startDate = new Date(endDate); startDate.setDate(startDate.getDate() - 6)
    const label = `S${8 - w} ${MONTH_NAMES[endDate.getMonth()]}`
    const week = orders.filter(o => o.status !== 'CANCELLED' && o.date >= startDate && o.date <= endDate)
    return {
      week: label,
      requested: week.reduce((s, o) => s + o.total, 0),
      fulfilled: week.reduce((s, o) => s + o.fulfilledTotal, 0),
    }
  }).reverse()
}

const STATE_NAMES: Record<string, string> = {
  SP: 'São Paulo', RJ: 'Rio de Janeiro', MG: 'Minas Gerais', RS: 'Rio Grande do Sul',
  PR: 'Paraná', SC: 'Santa Catarina', BA: 'Bahia', GO: 'Goiás', PE: 'Pernambuco',
  DF: 'Brasília', CE: 'Ceará', ES: 'Espírito Santo', MA: 'Maranhão', PA: 'Pará',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', PB: 'Paraíba', RN: 'Rio Grande do Norte',
  AL: 'Alagoas', PI: 'Piauí', SE: 'Sergipe', RO: 'Rondônia', TO: 'Tocantins',
  AC: 'Acre', AM: 'Amazonas', RR: 'Roraima', AP: 'Amapá',
}

export function computeGeoData(orders: DOrder[]): DGeoEntry[] {
  const stateOrders    = new Map<string, DOrder[]>()
  const stateCustomers = new Map<string, Set<string>>()

  orders.filter(o => o.status !== 'CANCELLED' && o.state).forEach(o => {
    const list = stateOrders.get(o.state) ?? []
    list.push(o)
    stateOrders.set(o.state, list)
    const custs = stateCustomers.get(o.state) ?? new Set<string>()
    custs.add(o.customerId)
    stateCustomers.set(o.state, custs)
  })

  const result: DGeoEntry[] = []
  stateOrders.forEach((stateOrderList, stateCode) => {
    const cityRevenue   = new Map<string, number>()
    const cityCustomers = new Map<string, Set<string>>()

    stateOrderList.forEach(o => {
      if (!o.city) return
      cityRevenue.set(o.city, (cityRevenue.get(o.city) ?? 0) + o.fulfilledTotal)
      const custs = cityCustomers.get(o.city) ?? new Set<string>()
      custs.add(o.customerId)
      cityCustomers.set(o.city, custs)
    })

    result.push({
      state:     STATE_NAMES[stateCode] ?? stateCode,
      stateCode,
      customers: stateCustomers.get(stateCode)?.size ?? 0,
      orders:    stateOrderList.length,
      requested: stateOrderList.reduce((s, o) => s + o.total, 0),
      fulfilled: stateOrderList.reduce((s, o) => s + o.fulfilledTotal, 0),
      cities: Array.from(cityRevenue.entries())
        .map(([city, revenue]) => ({ city, customers: cityCustomers.get(city)?.size ?? 0, revenue }))
        .sort((a, b) => b.revenue - a.revenue),
    })
  })

  return result.sort((a, b) => b.requested - a.requested)
}

const RFM_META: Omit<DRFMEntry, 'count' | 'pct' | 'avgRevenue'>[] = [
  { segment: 'Champions', color: '#10b981', bgColor: '#d1fae5', description: 'Compram muito, com frequência e recentemente.' },
  { segment: 'Loyal',     color: '#6366f1', bgColor: '#ede9fe', description: 'Compram com frequência e gastam bem.' },
  { segment: 'Promising', color: '#f59e0b', bgColor: '#fef3c7', description: 'Clientes recentes com bom potencial.' },
  { segment: 'At Risk',   color: '#f97316', bgColor: '#ffedd5', description: 'Compraram bem mas estão sumindo.' },
  { segment: 'Lost',      color: '#ef4444', bgColor: '#fee2e2', description: 'Sem atividade por muito tempo.' },
]

export function computeRFMData(customers: DCustomer[]): DRFMEntry[] {
  const total = customers.length || 1
  const counts   = new Map<DRFMSegment, number>()
  const revenues = new Map<DRFMSegment, number>()

  customers.forEach(c => {
    counts.set(c.rfmSegment,   (counts.get(c.rfmSegment)   ?? 0) + 1)
    revenues.set(c.rfmSegment, (revenues.get(c.rfmSegment) ?? 0) + c.totalRevenue)
  })

  return RFM_META.map(template => {
    const count = counts.get(template.segment) ?? 0
    return {
      ...template,
      count,
      pct: Math.round((count / total) * 100),
      avgRevenue: count > 0 ? Math.round((revenues.get(template.segment) ?? 0) / count) : 0,
    }
  })
}

export function computeCohortData(customers: DCustomer[], orders: DOrder[]): DCohortRow[] {
  const now = new Date()

  const orderMonthsByCustomer = new Map<string, Set<string>>()
  orders.filter(o => o.status !== 'CANCELLED').forEach(o => {
    const set = orderMonthsByCustomer.get(o.customerId) ?? new Set<string>()
    set.add(o.month)
    orderMonthsByCustomer.set(o.customerId, set)
  })

  const cohortCustomers = new Map<string, string[]>()
  customers.forEach(c => {
    const label = monthLabel(c.registeredAt)
    const list  = cohortCustomers.get(label) ?? []
    list.push(c.id)
    cohortCustomers.set(label, list)
  })

  const rows: DCohortRow[] = []
  for (let i = 11; i >= 0; i--) {
    const cohortDate  = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const cohortLabel = monthLabel(cohortDate)
    const ids = cohortCustomers.get(cohortLabel)
    if (!ids || ids.length === 0) continue

    const size   = ids.length
    const months: (number | null)[] = [100]

    for (let m = 1; m <= 7; m++) {
      const targetDate = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + m, 1)
      if (targetDate > now) { months.push(null); continue }
      const targetLabel = monthLabel(targetDate)
      const retained = ids.filter(id => orderMonthsByCustomer.get(id)?.has(targetLabel)).length
      months.push(Math.round((retained / size) * 100))
    }

    rows.push({ cohort: cohortLabel, months })
  }

  return rows
}

export function computeFunnelData(customers: DCustomer[], orders: DOrder[]): DFunnelStage[] {
  const total = customers.length
  const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe']

  const zero = (label: string, i: number): DFunnelStage =>
    ({ label, value: 0, pct: 0, color: COLORS[i] })

  if (total === 0) return [
    { label: 'Cadastros Aprovados',  value: 0, pct: 100, color: COLORS[0] },
    zero('Realizaram 1º Pedido', 1),
    zero('Pedido Atendido', 2),
    zero('Compraram 2x ou mais', 3),
    zero('Compraram 3x ou mais', 4),
  ]

  const withPurchase  = customers.filter(c => c.firstPurchaseAt !== null).length
  const fulfilledSet  = new Set(orders.filter(o => o.status === 'INVOICED' || o.status === 'SHIPPED').map(o => o.customerId))
  const withFulfilled = customers.filter(c => fulfilledSet.has(c.id)).length
  const with2x = customers.filter(c => c.totalOrders >= 2).length
  const with3x = customers.filter(c => c.totalOrders >= 3).length

  const pct = (v: number) => Math.round((v / total) * 100)
  return [
    { label: 'Cadastros Aprovados',  value: total,        pct: 100,            color: COLORS[0] },
    { label: 'Realizaram 1º Pedido', value: withPurchase,  pct: pct(withPurchase),  color: COLORS[1] },
    { label: 'Pedido Atendido',      value: withFulfilled, pct: pct(withFulfilled), color: COLORS[2] },
    { label: 'Compraram 2x ou mais', value: with2x,        pct: pct(with2x),        color: COLORS[3] },
    { label: 'Compraram 3x ou mais', value: with3x,        pct: pct(with3x),        color: COLORS[4] },
  ]
}

const MONTH_ABBR_TO_IDX: Record<string, number> = {
  Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5,
  Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11,
}

export function computeSeasonalityByCategory(products: DProduct[]) {
  const catMap = new Map<string, number[]>()

  products.forEach(p => {
    const cat = p.category ?? 'Outros'
    const vals = catMap.get(cat) ?? Array<number>(12).fill(0)
    p.monthlyRevenue.forEach(({ month, value }) => {
      const abbr = month.split('/')[0]
      const idx  = MONTH_ABBR_TO_IDX[abbr]
      if (idx !== undefined) vals[idx] += value
    })
    catMap.set(cat, vals)
  })

  const allValues = Array.from(catMap.values()).flat()
  const maxVal = Math.max(...allValues, 1)
  const normalize = (v: number) => Math.max(1, Math.round((v / maxVal) * 50))

  return Array.from(catMap.entries()).map(([category, vals]) => ({
    category,
    jan: normalize(vals[0]),  fev: normalize(vals[1]),  mar: normalize(vals[2]),
    abr: normalize(vals[3]),  mai: normalize(vals[4]),  jun: normalize(vals[5]),
    jul: normalize(vals[6]),  ago: normalize(vals[7]),  set: normalize(vals[8]),
    out: normalize(vals[9]),  nov: normalize(vals[10]), dez: normalize(vals[11]),
  }))
}

export function computeSeasonalityOrdersByMonth(orders: DOrder[]): { month: string; orders: number }[] {
  const counts = Array<number>(12).fill(0)
  orders.filter(o => o.status !== 'CANCELLED').forEach(o => { counts[o.date.getMonth()]++ })
  return MONTH_NAMES.map((month, i) => ({ month: month.slice(0, 3), orders: counts[i] }))
}

export function computeTotals(orders: DOrder[], customers: DCustomer[], periodStart?: Date, periodEnd?: Date) {
  const filtered = periodStart && periodEnd
    ? orders.filter(o => o.date >= periodStart && o.date <= periodEnd)
    : orders

  const active  = filtered.filter(o => o.status !== 'CANCELLED')
  const now     = new Date()
  const refStart = periodStart ?? new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const totalRequested = active.reduce((s, o) => s + o.total, 0)
  const totalFulfilled = active.reduce((s, o) => s + o.fulfilledTotal, 0)
  const fulfillmentRate = totalRequested > 0 ? (totalFulfilled / totalRequested) * 100 : 0

  const approvedCustomers  = customers.length
  const purchasedCustomers = customers.filter(c => c.firstPurchaseAt !== null).length
  const activeCustomers    = customers.filter(c => c.status === 'active').length
  const newCustomers       = customers.filter(c => c.registeredAt >= refStart).length
  const returningCustomers = customers.filter(c => c.totalOrders >= 2).length

  const conversionRate = approvedCustomers > 0 ? (purchasedCustomers / approvedCustomers) * 100 : 0
  const avgTicket      = active.length > 0 ? totalFulfilled / active.length : 0

  const dtfp = customers.filter(c => c.daysToPurchase !== null).map(c => c.daysToPurchase as number)
  const avgDaysToFirstPurchase = dtfp.length > 0 ? dtfp.reduce((s, v) => s + v, 0) / dtfp.length : 0

  const repeatRate = purchasedCustomers > 0 ? (returningCustomers / purchasedCustomers) * 100 : 0

  return {
    totalRequested,
    totalFulfilled,
    fulfillmentRate,
    totalOrders:      filtered.length,
    activeOrders:     active.length,
    deliveredOrders:  filtered.filter(o => o.status === 'SHIPPED').length,
    pendingOrders:    filtered.filter(o => o.status === 'PENDING').length,
    approvedCustomers,
    purchasedCustomers,
    activeCustomers,
    newCustomers,
    returningCustomers,
    conversionRate,
    avgTicket,
    avgDaysToFirstPurchase,
    repeatRate,
  }
}
