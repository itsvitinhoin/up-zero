'use client'

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import type { DateRange } from 'react-day-picker'
import { getDashboardDataAction } from '@/lib/actions/dashboard'
import {
  computeMonthlyRevenue, computeWeeklyRevenue, computeGeoData,
  computeRFMData, computeCohortData, computeFunnelData,
  computeSeasonalityByCategory, computeSeasonalityOrdersByMonth, computeTotals,
  computeTrafficSourcesFromMetrics, computeTopVisitedProductsFromMetrics,
  type DashboardRawData,
} from '@/lib/dashboard-compute'
import type {
  DOrder, DCustomer, DProduct, DMonthlyRevenue, DGeoEntry, DRFMEntry, DCohortRow, DFunnelStage,
  DTrafficSource, DTopVisitedProduct,
} from '@/lib/dashboard-mock-data'

// ── Context type ──────────────────────────────────────────────────────────────

type SeasonalityRow = ReturnType<typeof computeSeasonalityByCategory>[number]
type TotalsType     = ReturnType<typeof computeTotals>

const EMPTY_TOTALS: TotalsType = {
  totalRequested: 0, totalFulfilled: 0, fulfillmentRate: 0,
  totalOrders: 0, activeOrders: 0, deliveredOrders: 0, pendingOrders: 0,
  approvedCustomers: 0, purchasedCustomers: 0, activeCustomers: 0,
  newCustomers: 0, returningCustomers: 0, conversionRate: 0,
  avgTicket: 0, avgDaysToFirstPurchase: 0, repeatRate: 0,
}

interface DashboardDataContextValue {
  orders:    DOrder[]
  customers: DCustomer[]
  products:  DProduct[]
  periodOrders: DOrder[]
  periodStart: Date
  periodEnd:   Date
  monthlyRevenue:            DMonthlyRevenue[]
  weeklyRevenue:             { week: string; requested: number; fulfilled: number }[]
  geoData:                   DGeoEntry[]
  rfmData:                   DRFMEntry[]
  cohortData:                DCohortRow[]
  funnelData:                DFunnelStage[]
  seasonalityByCategory:     SeasonalityRow[]
  seasonalityOrdersByMonth:  { month: string; orders: number }[]
  totals:                    TotalsType
  trafficSources:            DTrafficSource[]
  topVisitedProducts:        DTopVisitedProduct[]
  isLoading: boolean
  error:     string | null
}

const DashboardDataContext = createContext<DashboardDataContextValue | undefined>(undefined)

// ── Provider ──────────────────────────────────────────────────────────────────

interface DashboardDataProviderProps {
  children:   ReactNode
  dateRange:  DateRange | undefined
}

export function DashboardDataProvider({ children, dateRange }: DashboardDataProviderProps) {
  const [rawData,   setRawData]   = useState<DashboardRawData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    getDashboardDataAction()
      .then(res => {
        if (res.success) setRawData(res.data)
        else setError(res.error)
      })
      .catch(err => setError(String(err)))
      .finally(() => setIsLoading(false))
  }, [])

  const value = useMemo<DashboardDataContextValue>(() => {
    const orders    = rawData?.orders    ?? []
    const customers = rawData?.customers ?? []
    const products  = rawData?.products  ?? []

    const start = dateRange?.from ?? new Date(0)
    const end   = dateRange?.to   ?? new Date()

    const periodOrders = orders.filter(o => o.date >= start && o.date <= end)
    const periodAnalyticsMetrics = (rawData?.analyticsMetrics ?? []).filter(metric => {
      const metricDate = new Date(metric.period_start)
      return metricDate >= start && metricDate <= end
    })

    return {
      orders,
      customers,
      products,
      periodOrders,
      periodStart: start,
      periodEnd:   end,
      monthlyRevenue:           computeMonthlyRevenue(orders),
      weeklyRevenue:            computeWeeklyRevenue(orders),
      geoData:                  computeGeoData(orders),
      rfmData:                  computeRFMData(customers),
      cohortData:               computeCohortData(customers, orders),
      funnelData:               computeFunnelData(customers, orders),
      seasonalityByCategory:    computeSeasonalityByCategory(products),
      seasonalityOrdersByMonth: computeSeasonalityOrdersByMonth(orders),
      totals:                   rawData ? computeTotals(orders, customers, start, end) : EMPTY_TOTALS,
      trafficSources:           computeTrafficSourcesFromMetrics(periodAnalyticsMetrics),
      topVisitedProducts:       computeTopVisitedProductsFromMetrics(periodAnalyticsMetrics, products),
      isLoading,
      error,
    }
  }, [rawData, dateRange, isLoading, error])

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboardData(): DashboardDataContextValue {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) throw new Error('useDashboardData must be used within DashboardDataProvider')
  return ctx
}
