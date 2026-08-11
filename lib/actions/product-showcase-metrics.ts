'use server'

import { cookies } from 'next/headers'

export type ShowcaseMetricPeriodDays = 7 | 14 | 30

export type ShowcaseMetricReason =
  | 'grade_constrained'
  | 'stock_low'
  | 'weak_listing'
  | 'promo_candidate'
  | 'pdp_weak'
  | 'poor_placement'
  | 'trending_up'
  | 'trending_down'
  | 'stable'
  | 'no_data'

export type ShowcasePeriodMetrics = {
  impressions: number
  clicks: number
  views: number
  addToCarts: number
  removes: number
  unitsSold: number
  revenue: number
  ctr: number
  atcRate: number
  removeRate: number
  conversionRate: number
}

export type ShowcaseSizeInsight = {
  size: string
  unitsSold: number
  stockQty: number
  salesShare: number
  constrained: boolean
}

export type ProductShowcaseMetricItem = {
  productId: string
  impressions: number
  clicks: number
  views: number
  addToCarts: number
  removes: number
  unitsSold: number
  revenue: number
  ctr: number
  atcRate: number
  removeRate: number
  conversionRate: number
  trend: 'up' | 'flat' | 'down' | 'no_data'
  reason: ShowcaseMetricReason
  gradeConstrained: boolean
  constrainedSalesShare: number
  stockTotal: number
  variantsTotal: number
  variantsInStock: number
  stockHealth: 'ok' | 'low' | 'out' | 'unknown'
  stockMode: 'fantasy' | 'binary' | 'infinito' | 'real' | 'wms' | 'unknown'
  sizes: ShowcaseSizeInsight[]
  previous: ShowcasePeriodMetrics
}

export type ProductShowcaseMetricsResult = {
  success: boolean
  error?: string
  days: ShowcaseMetricPeriodDays
  categoryId: number | null
  items: ProductShowcaseMetricItem[]
}

function resolveBackendBase(): string | null {
  return process.env.NEXT_PUBLIC_RUST_URL || null
}

function normalizeTrend(value: unknown): ProductShowcaseMetricItem['trend'] {
  if (value === 'up' || value === 'flat' || value === 'down' || value === 'no_data') {
    return value
  }
  return 'no_data'
}

function normalizeReason(value: unknown): ShowcaseMetricReason {
  const allowed: ShowcaseMetricReason[] = [
    'grade_constrained',
    'stock_low',
    'weak_listing',
    'promo_candidate',
    'pdp_weak',
    'poor_placement',
    'trending_up',
    'trending_down',
    'stable',
    'no_data',
  ]
  if (typeof value === 'string' && (allowed as string[]).includes(value)) {
    return value as ShowcaseMetricReason
  }
  return 'no_data'
}

function normalizeStockHealth(value: unknown): ProductShowcaseMetricItem['stockHealth'] {
  if (value === 'ok' || value === 'low' || value === 'out' || value === 'unknown') {
    return value
  }
  return 'unknown'
}

function normalizeStockMode(value: unknown): ProductShowcaseMetricItem['stockMode'] {
  if (
    value === 'fantasy'
    || value === 'binary'
    || value === 'infinito'
    || value === 'real'
    || value === 'wms'
  ) {
    return value
  }
  return 'unknown'
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizePeriod(raw: unknown): ShowcasePeriodMetrics {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    views: toNumber(row.views),
    addToCarts: toNumber(row.addToCarts),
    removes: toNumber(row.removes),
    unitsSold: toNumber(row.unitsSold),
    revenue: toNumber(row.revenue),
    ctr: toNumber(row.ctr),
    atcRate: toNumber(row.atcRate),
    removeRate: toNumber(row.removeRate),
    conversionRate: toNumber(row.conversionRate),
  }
}

function normalizeSizes(raw: unknown): ShowcaseSizeInsight[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const row = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
    return {
      size: String(row.size ?? ''),
      unitsSold: toNumber(row.unitsSold),
      stockQty: toNumber(row.stockQty),
      salesShare: toNumber(row.salesShare),
      constrained: Boolean(row.constrained),
    }
  })
}

export async function getProductShowcaseMetricsAction(input: {
  days: ShowcaseMetricPeriodDays
  productIds: string[]
  categoryId?: number | null
}): Promise<ProductShowcaseMetricsResult> {
  const days = input.days === 7 || input.days === 30 ? input.days : 14
  const productIds = Array.from(
    new Set(
      input.productIds
        .map((id) => String(id || '').trim())
        .filter((id) => /^\d+$/.test(id)),
    ),
  )

  if (productIds.length === 0) {
    return {
      success: true,
      days,
      categoryId: input.categoryId ?? null,
      items: [],
    }
  }

  try {
    const base = resolveBackendBase()
    if (!base) {
      return {
        success: false,
        error: 'NEXT_PUBLIC_RUST_URL não configurado',
        days,
        categoryId: input.categoryId ?? null,
        items: [],
      }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const url = new URL('/internal/admin/product-showcase-metrics', base)
    url.searchParams.set('days', String(days))
    url.searchParams.set('product_ids', productIds.join(','))
    if (input.categoryId && Number.isInteger(input.categoryId) && input.categoryId > 0) {
      url.searchParams.set('category_id', String(input.categoryId))
    }

    const res = await fetch(url, {
      headers: {
        ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      return {
        success: false,
        error: errorText || `Erro ao buscar métricas (status ${res.status})`,
        days,
        categoryId: input.categoryId ?? null,
        items: [],
      }
    }

    const payload = (await res.json()) as {
      days?: number
      categoryId?: number | null
      items?: Array<Record<string, unknown>>
    }

    const items: ProductShowcaseMetricItem[] = (payload.items || []).map((row) => ({
      productId: String(row.productId ?? ''),
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      views: toNumber(row.views),
      addToCarts: toNumber(row.addToCarts),
      removes: toNumber(row.removes),
      unitsSold: toNumber(row.unitsSold),
      revenue: toNumber(row.revenue),
      ctr: toNumber(row.ctr),
      atcRate: toNumber(row.atcRate),
      removeRate: toNumber(row.removeRate),
      conversionRate: toNumber(row.conversionRate),
      trend: normalizeTrend(row.trend),
      reason: normalizeReason(row.reason),
      gradeConstrained: Boolean(row.gradeConstrained),
      constrainedSalesShare: toNumber(row.constrainedSalesShare),
      stockTotal: toNumber(row.stockTotal),
      variantsTotal: toNumber(row.variantsTotal),
      variantsInStock: toNumber(row.variantsInStock),
      stockHealth: normalizeStockHealth(row.stockHealth),
      stockMode: normalizeStockMode(row.stockMode),
      sizes: normalizeSizes(row.sizes),
      previous: normalizePeriod(row.previous),
    }))

    return {
      success: true,
      days: payload.days === 7 || payload.days === 30 ? payload.days : days,
      categoryId:
        typeof payload.categoryId === 'number' && Number.isFinite(payload.categoryId)
          ? payload.categoryId
          : input.categoryId ?? null,
      items,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar métricas da vitrine',
      days,
      categoryId: input.categoryId ?? null,
      items: [],
    }
  }
}
