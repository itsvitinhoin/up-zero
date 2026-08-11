'use server'

import { cookies } from 'next/headers'
import { checkUserPermission } from '@/lib/actions/permissions'

export interface DashboardMetricsTotals {
  totalRequested: number
  totalFulfilled: number
  fulfillmentRate: number
  retention30d: number
  avgItemsPerOrder: number
  totalOrders: number
  activeOrders: number
  deliveredOrders: number
  pendingOrders: number
  approvedCustomers: number
  purchasedCustomers: number
  activeCustomers: number
  newCustomers: number
  returningCustomers: number
  conversionRate: number
  avgTicket: number
  avgDaysToFirstPurchase: number
  repeatRate: number
}

export interface DashboardMetricsMonthlyRevenue {
  month: string
  requested: number
  fulfilled: number
  orders: number
  newCustomers: number
  returningCustomers: number
}

export interface DashboardMetricsWeeklyRevenue {
  week: string
  requested: number
  fulfilled: number
}

export interface DashboardMetricsSeasonalityOrdersByMonth {
  month: string
  orders: number
}

export interface DashboardMetricsSeasonalityByCategory {
  category: string
  jan: number
  fev: number
  mar: number
  abr: number
  mai: number
  jun: number
  jul: number
  ago: number
  set: number
  out: number
  nov: number
  dez: number
}

export interface DashboardMetricsGeoCity {
  city: string
  customers: number
  revenue: number
}

export interface DashboardMetricsGeoState {
  state: string
  stateCode: string
  customers: number
  orders: number
  requested: number
  fulfilled: number
  cities: DashboardMetricsGeoCity[]
}

export interface DashboardMetricsRfm {
  segment: 'Champions' | 'Loyal' | 'Promising' | 'At Risk' | 'Lost'
  count: number
  color: string
  bgColor: string
  pct: number
  avgRevenue: number
  description: string
}

export interface DashboardMetricsCohort {
  cohort: string
  months: Array<number | null>
}

export interface DashboardMetricsFunnel {
  label: string
  value: number
  pct: number
  color: string
}

export interface DashboardMetricsPaymentStatusBreakdown {
  status: string
  count: number
  pct: number
  value: number
}

export interface DashboardMetricsPaymentMethodBreakdown {
  method: string
  count: number
  pct: number
  value: number
}

export interface DashboardMetricsAbcSummary {
  curve: 'A' | 'B' | 'C'
  count: number
  revenue: number
}

export interface DashboardMetricsCategoryBreakdown {
  name: string
  requested: number
  fulfilled: number
  fulfillRate: number
}

export interface DashboardMetricsSalesByColor {
  color: string
  hex: string
  units: number
  pct: number
}

export interface DashboardMetricsSalesBySize {
  size: string
  units: number
  pct: number
}

export interface DashboardMetricsPayload {
  totals: DashboardMetricsTotals
  monthlyRevenue: DashboardMetricsMonthlyRevenue[]
  weeklyRevenue: DashboardMetricsWeeklyRevenue[]
  abcSummary: DashboardMetricsAbcSummary[]
  categoryBreakdown: DashboardMetricsCategoryBreakdown[]
  geoData: DashboardMetricsGeoState[]
  rfmData: DashboardMetricsRfm[]
  cohortData: DashboardMetricsCohort[]
  funnelData: DashboardMetricsFunnel[]
  paymentStatusBreakdown: DashboardMetricsPaymentStatusBreakdown[]
  paymentMethodBreakdown: DashboardMetricsPaymentMethodBreakdown[]
  seasonalityOrdersByMonth: DashboardMetricsSeasonalityOrdersByMonth[]
  seasonalityByCategory: DashboardMetricsSeasonalityByCategory[]
  salesByColor: DashboardMetricsSalesByColor[]
  salesBySize: DashboardMetricsSalesBySize[]
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function resolveBackendBaseUrl(): string {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) throw new Error('NEXT_PUBLIC_RUST_URL não configurado')
  return base.replace(/\/$/, '')
}

async function canViewReports(): Promise<boolean> {
  try {
    const result = await checkUserPermission('reports.view')
    return result?.has_permission === true
  } catch {
    return false
  }
}

export async function getB2BDashboardMetricsAction(input?: {
  from?: Date
  to?: Date
}): Promise<{ success: true; data: DashboardMetricsPayload } | { success: false; error: string }> {
  try {
    if (!(await canViewReports())) {
      return { success: false, error: 'Você não tem permissão para visualizar relatórios' }
    }

    const base = resolveBackendBaseUrl()
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    if (!adminToken) {
      return { success: false, error: 'Admin não autenticado para métricas do dashboard' }
    }

    const url = new URL('/dashboard/b2b-metrics', base)
    if (input?.from) {
      url.searchParams.set('from', toDateOnly(input.from))
    }
    if (input?.to) {
      url.searchParams.set('to', toDateOnly(input.to))
    }

    const response = await fetch(url.toString(), {
      headers: {
        cookie: `adminAuthToken=${adminToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { success: false, error: body || `Erro ao buscar métricas (${response.status})` }
    }

    const payload = (await response.json()) as DashboardMetricsPayload
    return { success: true, data: payload }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao carregar métricas do dashboard',
    }
  }
}
