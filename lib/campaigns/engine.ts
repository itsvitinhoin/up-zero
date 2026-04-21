import type { Customer, Order } from '@/lib/types'
import type { FilterField, FilterGroup, FilterOperator, FilterRule, SmartList } from './types'

// ─── Customer + orders snapshot used by the engine ────────────────────────────

export interface CustomerSnapshot {
  customer: Customer
  orders: Order[]
  totalSpend: number
  orderCount: number
  lastOrderDate: Date | null
  firstOrderDate: Date | null
  avgTicket: number
  daysSinceLastOrder: number | null
  purchasedCategories: string[]
  purchasedProducts: string[]
}

function buildSnapshot(customer: Customer, orders: Order[]): CustomerSnapshot {
  const active = orders.filter((o) => o.status !== 'CANCELLED')
  const totalSpend = active.reduce((sum, o) => sum + (o.total ?? 0), 0)
  const sorted = [...active].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const lastOrderDate = sorted[0] ? new Date(sorted[0].createdAt) : null
  const firstOrderDate = sorted.length > 0 ? new Date(sorted[sorted.length - 1].createdAt) : null
  const daysSinceLastOrder = lastOrderDate
    ? Math.floor((Date.now() - lastOrderDate.getTime()) / 86_400_000)
    : null

  return {
    customer,
    orders: active,
    totalSpend,
    orderCount: active.length,
    lastOrderDate,
    firstOrderDate,
    avgTicket: active.length > 0 ? totalSpend / active.length : 0,
    daysSinceLastOrder,
    // Item-level data not available at this layer — populated by callers that pass enriched orders
    purchasedCategories: [],
    purchasedProducts: [],
  }
}

// ─── Single rule evaluation ────────────────────────────────────────────────────

function evalRule(snap: CustomerSnapshot, rule: FilterRule): boolean {
  const { field, operator, value } = rule
  const c = snap.customer

  const applyOp = (actual: unknown, op: FilterOperator, target: unknown): boolean => {
    if (op === 'exists') return actual !== null && actual !== undefined && actual !== ''
    if (op === 'not_exists') return actual === null || actual === undefined || actual === ''
    if (op === 'is_true') return actual === true || actual === 1 || actual === 'true'
    if (op === 'is_false') return actual === false || actual === 0 || actual === 'false'

    const a = typeof actual === 'string' ? actual.toLowerCase() : actual
    const t = typeof target === 'string' ? target.toLowerCase() : target

    switch (op) {
      case 'equals': return a == t
      case 'not_equals': return a != t
      case 'contains':
        return typeof a === 'string' && typeof t === 'string' && a.includes(t)
      case 'not_contains':
        return typeof a === 'string' && typeof t === 'string' && !a.includes(t)
      case 'greater_than': return Number(actual) > Number(target)
      case 'less_than': return Number(actual) < Number(target)
      case 'between': {
        if (!Array.isArray(target) || target.length < 2) return false
        const n = Number(actual)
        return n >= Number(target[0]) && n <= Number(target[1])
      }
      case 'in_last_x_days': {
        const days = Number(target)
        if (!snap.lastOrderDate) return false
        return snap.daysSinceLastOrder !== null && snap.daysSinceLastOrder <= days
      }
      case 'more_than_x_days_ago': {
        const days = Number(target)
        if (snap.daysSinceLastOrder === null) return false
        return snap.daysSinceLastOrder > days
      }
      case 'in_list':
        return Array.isArray(target) && target.includes(actual)
      case 'not_in_list':
        return Array.isArray(target) && !target.includes(actual)
      default:
        return false
    }
  }

  switch (field) {
    // ── Customer profile ──
    case 'customer.name': return applyOp(c.contactName, operator, value)
    case 'customer.email': return applyOp(c.email, operator, value)
    case 'customer.phone': return applyOp(c.phone, operator, value)
    case 'customer.document': return applyOp(c.cnpj, operator, value)
    case 'customer.status': return applyOp(c.status, operator, value)
    case 'customer.seller': return applyOp(c.assignedSellerId, operator, value)
    case 'customer.createdAt': {
      const createdDaysAgo = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86_400_000)
      return applyOp(createdDaysAgo, operator, value)
    }
    // ── Location ──
    case 'customer.city': return applyOp(c.city, operator, value)
    case 'customer.state': return applyOp(c.state, operator, value)
    case 'customer.zipCode': return applyOp(c.zipCode, operator, value)
    // ── Purchase behavior ──
    case 'orders.hasPurchased': return applyOp(snap.orderCount > 0, operator, value)
    case 'orders.neverPurchased': return applyOp(snap.orderCount === 0, operator, value)
    case 'orders.count': return applyOp(snap.orderCount, operator, value)
    case 'orders.totalSpend': return applyOp(snap.totalSpend, operator, value)
    case 'orders.avgTicket': return applyOp(snap.avgTicket, operator, value)
    case 'orders.lastPurchaseDaysAgo':
      if (snap.daysSinceLastOrder === null) return false
      return applyOp(snap.daysSinceLastOrder, operator, value)
    case 'orders.firstPurchaseDaysAgo': {
      if (!snap.firstOrderDate) return false
      const days = Math.floor((Date.now() - snap.firstOrderDate.getTime()) / 86_400_000)
      return applyOp(days, operator, value)
    }
    // ── Product / category ──
    case 'orders.boughtCategory':
      return snap.purchasedCategories.some((cat) =>
        applyOp(cat, operator === 'equals' ? 'equals' : operator, value),
      )
    case 'orders.notBoughtCategory':
      return !snap.purchasedCategories.some((cat) => applyOp(cat, 'equals', value))
    case 'orders.boughtProduct':
      return snap.purchasedProducts.some((p) => applyOp(p, 'equals', value))
    // ── CRM ──
    case 'crm.inactiveDays':
      if (snap.daysSinceLastOrder === null) return false
      return applyOp(snap.daysSinceLastOrder, operator, value)
    case 'crm.purchasedOnce': return applyOp(snap.orderCount === 1, operator, value)
    case 'crm.approvedNoPurchase':
      return c.status === 'APPROVED' && snap.orderCount === 0
    case 'crm.totalSpendAbove': return applyOp(snap.totalSpend, 'greater_than', value)
    case 'crm.isVip':
      return snap.totalSpend > 5000 || snap.orderCount > 20
    default:
      return false
  }
}

// ─── Group evaluation ─────────────────────────────────────────────────────────

function evalGroup(snap: CustomerSnapshot, group: FilterGroup): boolean {
  const ruleResults = group.rules.map((rule) => evalRule(snap, rule))
  const groupResults = (group.groups ?? []).map((g) => evalGroup(snap, g))
  const all = [...ruleResults, ...groupResults]
  if (all.length === 0) return true
  return group.logic === 'ALL' ? all.every(Boolean) : all.some(Boolean)
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface FilterResult {
  matched: Customer[]
  total: number
  excluded: number
  metrics: {
    totalRevenue: number
    avgTicket: number
    avgOrderCount: number
  }
}

export function applySmartListFilter(
  list: SmartList,
  customers: Customer[],
  ordersByCustomer: Record<string, Order[]>,
): FilterResult {
  const snapshots = customers.map((c) => buildSnapshot(c, ordersByCustomer[c.id] ?? []))

  const excluded = snapshots.filter((snap) => {
    if (list.exclusions.length === 0) return false
    return list.exclusions.some((rule) => evalRule(snap, rule))
  })
  const excludedIds = new Set(excluded.map((s) => s.customer.id))

  const matched = snapshots.filter((snap) => {
    if (excludedIds.has(snap.customer.id)) return false
    return evalGroup(snap, list.rules)
  })

  const totalRevenue = matched.reduce((sum, s) => sum + s.totalSpend, 0)
  const avgTicket =
    matched.reduce((sum, s) => sum + s.avgTicket, 0) / Math.max(matched.length, 1)
  const avgOrderCount =
    matched.reduce((sum, s) => sum + s.orderCount, 0) / Math.max(matched.length, 1)

  return {
    matched: matched.map((s) => s.customer),
    total: matched.length,
    excluded: excluded.length,
    metrics: { totalRevenue, avgTicket, avgOrderCount },
  }
}

// ─── Preview (for API endpoint) ───────────────────────────────────────────────

export function previewSmartList(
  list: SmartList,
  customers: Customer[],
  ordersByCustomer: Record<string, Order[]>,
): { count: number; sample: Customer[]; metrics: FilterResult['metrics'] } {
  const result = applySmartListFilter(list, customers, ordersByCustomer)
  return {
    count: result.total,
    sample: result.matched.slice(0, 5),
    metrics: result.metrics,
  }
}
