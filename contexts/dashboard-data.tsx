'use client'

import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { DateRange } from 'react-day-picker'
import { getB2BDashboardMetricsAction, type DashboardMetricsPayload } from '@/lib/actions/dashboard-metrics'
import type {
  DOrder, DCustomer, DProduct, DMonthlyRevenue, DGeoEntry, DRFMEntry, DCohortRow, DFunnelStage,
} from '@/lib/dashboard-mock-data'
import { setDashboardDataFromLive } from '@/lib/dashboard-mock-data'

// ── Context type ──────────────────────────────────────────────────────────────

type SeasonalityRow = DashboardMetricsPayload['seasonalityByCategory'][number]
type TotalsType = DashboardMetricsPayload['totals']
type AbcSummaryRow = DashboardMetricsPayload['abcSummary'][number]
type CategoryBreakdownRow = DashboardMetricsPayload['categoryBreakdown'][number]

const EMPTY_TOTALS: TotalsType = {
  totalRequested: 0, totalFulfilled: 0, fulfillmentRate: 0,
  retention30d: 0, avgItemsPerOrder: 0,
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
  paymentStatusBreakdown:    DashboardMetricsPayload['paymentStatusBreakdown']
  paymentMethodBreakdown:    DashboardMetricsPayload['paymentMethodBreakdown']
  seasonalityByCategory:     SeasonalityRow[]
  seasonalityOrdersByMonth:  { month: string; orders: number }[]
  abcSummary:                AbcSummaryRow[]
  categoryBreakdown:         CategoryBreakdownRow[]
  salesByColor:              DashboardMetricsPayload['salesByColor']
  salesBySize:               DashboardMetricsPayload['salesBySize']
  totals:                    TotalsType
  isLoading: boolean
  isHydratingRaw: boolean
  error:     string | null
}

const DashboardDataContext = createContext<DashboardDataContextValue | undefined>(undefined)

// ── Provider ──────────────────────────────────────────────────────────────────

interface DashboardDataProviderProps {
  children:   ReactNode
  dateRange:  DateRange | undefined
  initialMetricsData?: DashboardMetricsPayload | null
  initialError?: string | null
  initialRangeKey?: string | null
  initialOrders?: DOrder[]
  initialCustomers?: DCustomer[]
  initialProducts?: DProduct[]
  initialSalesBySeller?: { name: string; revenue: number }[]
}

function toDayKey(date?: Date): string {
  return date ? date.toISOString().slice(0, 10) : ''
}

function dateRangeKey(range: DateRange | undefined): string {
  return `${toDayKey(range?.from)}|${toDayKey(range?.to)}`
}

function getBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? 'http://localhost:8080').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  const parsed = new Date(String(value || ''))
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export function DashboardDataProvider({
  children,
  dateRange,
  initialMetricsData = null,
  initialError = null,
  initialRangeKey = null,
  initialOrders = [],
  initialCustomers = [],
  initialProducts = [],
}: DashboardDataProviderProps) {
  const hasInitialRawData = initialOrders.length > 0 || initialCustomers.length > 0 || initialProducts.length > 0
  const [metricsData, setMetricsData] = useState<DashboardMetricsPayload | null>(initialMetricsData)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(!initialMetricsData)
  const [error, setError] = useState<string | null>(initialError)
  const lastLoadedRangeKeyRef = useRef<string | null>(initialMetricsData ? (initialRangeKey ?? null) : null)
  const currentRangeKey = dateRangeKey(dateRange)
  const [orders, setOrders] = useState<DOrder[]>(initialOrders)
  const [customers, setCustomers] = useState<DCustomer[]>(initialCustomers)
  const [products, setProducts] = useState<DProduct[]>(initialProducts)
  const [isHydratingRaw, setIsHydratingRaw] = useState(false)

  useEffect(() => {
    if (lastLoadedRangeKeyRef.current === currentRangeKey) {
      setIsLoadingMetrics(false)
      return
    }

    const from = dateRange?.from
    const to = dateRange?.to

    setIsLoadingMetrics(true)
    getB2BDashboardMetricsAction({ from, to })
      .then(res => {
        if (res.success) {
          setMetricsData(res.data)
          lastLoadedRangeKeyRef.current = currentRangeKey
          setError(null)
          return
        }
        setMetricsData(null)
        setError(res.error)
      })
      .catch(err => {
        setMetricsData(null)
        setError(String(err))
      })
      .finally(() => setIsLoadingMetrics(false))
  }, [hasInitialRawData, currentRangeKey, dateRange?.from, dateRange?.to])

  useEffect(() => {
    if (hasInitialRawData) {
      return
    }

    let cancelled = false

    async function hydrateRawDashboardData() {
      setIsHydratingRaw(true)

      try {
        const from = dateRange?.from?.toISOString().slice(0, 10)
        const to = dateRange?.to?.toISOString().slice(0, 10)

        const params = new URLSearchParams()
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        params.set('customersPage', '1')
        params.set('productsPage', '1')
        params.set('customersLimit', '300')
        params.set('productsLimit', '300')

        const response = await fetch(`/api/internal/admin/dashboard-live-data?${params.toString()}`, { cache: 'no-store' })
        if (!response.ok) {
          if (!cancelled) {
            setError('Falha ao hidratar dados do dashboard')
          }
          return
        }

        const payload = await response.json() as {
          orders?: Array<Record<string, unknown>>
          customers?: Array<Record<string, unknown>>
          products?: Array<Record<string, unknown>>
        }

        const rawOrders = Array.isArray(payload.orders) ? payload.orders : []
        const rawCustomers = Array.isArray(payload.customers) ? payload.customers : []
        const rawProducts = Array.isArray(payload.products) ? payload.products : []

        const liveOrdersPayload = rawOrders.map((order) => ({
          id: String(order.id),
          customerId: String(order.customerId || ''),
          status: String(order.status || 'PENDING'),
          total: Number(order.total || 0),
          fulfilledTotal: Number(order.fulfilledTotal || 0),
          totalItems: Number(order.totalItems || 0),
          fulfilledItems: Number(order.fulfilledItems || 0),
          paymentMethod: String(order.paymentMethod || 'PIX'),
          createdAt: toDate(order.createdAt),
          items: [],
        }))

        const liveOrders: DOrder[] = rawOrders.map((order) => {
          const createdAt = toDate(order.createdAt)
          const customerId = String(order.customerId || '')

          return {
            id: String(order.id),
            customerId,
            customerName: String(order.customerName || `Cliente #${customerId}`),
            state: String(order.shippingState || '-'),
            city: String(order.shippingCity || '-'),
            status: String(order.status || 'PENDING') as DOrder['status'],
            total: Number(order.total || 0),
            fulfilledTotal: Number(order.fulfilledTotal || 0),
            items: Number(order.totalItems || 0),
            fulfilledItems: Number(order.fulfilledItems || 0),
            paymentMethod: String(order.paymentMethod || 'PIX'),
            date: createdAt,
            month: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(createdAt).replace('.', ''),
          }
        })

        const customerRowsMap = new Map<string, DCustomer & { assignedSellerName?: string | null }>()
        for (const customer of rawCustomers) {
          const customerId = String(customer.id)
          const customerOrders = liveOrders.filter((order) => String(order.customerId) === String(customer.id))
          const totalRevenue = customerOrders.reduce((sum, order) => sum + Number(order.fulfilledTotal || 0), 0)
          const totalRequested = customerOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
          const totalOrders = customerOrders.length
          const sortedOrders = [...customerOrders].sort((a, b) => a.date.getTime() - b.date.getTime())
          const firstPurchaseAt = sortedOrders[0]?.date ?? null
          const lastPurchaseAt = sortedOrders[sortedOrders.length - 1]?.date ?? null
          const registeredAt = toDate(customer.createdAt)

          customerRowsMap.set(customerId, {
            id: customerId,
            name: String(customer.name || customer.companyName || customer.tradeName || customer.contactName || `Cliente #${customerId}`),
            email: String(customer.email || ''),
            state: String(customer.state || '-'),
            city: String(customer.city || '-'),
            segment: String(customer.segment || 'Sem segmento'),
            status: String(customer.status || 'PENDING') === 'APPROVED' ? 'active' : String(customer.status || 'PENDING') === 'REJECTED' ? 'inactive' : 'at_risk',
            rfmSegment: 'Lost',
            registeredAt,
            firstPurchaseAt,
            lastPurchaseAt,
            totalOrders,
            totalRevenue,
            totalRequested,
            avgTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            frequency: totalOrders,
            daysToPurchase: firstPurchaseAt ? Math.max(0, Math.round((firstPurchaseAt.getTime() - registeredAt.getTime()) / 86400000)) : null,
            assignedSellerName: customer.assignedSellerName ? String(customer.assignedSellerName) : null,
          })
        }

        const customerRows = Array.from(customerRowsMap.values())

        const productRows: DProduct[] = rawProducts.map((product) => {
          const variants = Array.isArray(product.variants) ? product.variants : []
          const categoryIds = Array.isArray((product as { categoryIds?: unknown[] }).categoryIds)
            ? ((product as { categoryIds?: unknown[] }).categoryIds as unknown[])
            : []
          const stock = variants.reduce((sum, variant) => sum + Number((variant as { stock?: number }).stock || 0), 0)
          const unitsRequested = Number((product as { unitsRequested?: number }).unitsRequested || 0)
          const unitsFulfilled = Number((product as { unitsFulfilled?: number }).unitsFulfilled || 0)
          const revenueRequested = Number((product as { revenueRequested?: number }).revenueRequested || 0)
          const revenueFulfilled = Number((product as { revenueFulfilled?: number }).revenueFulfilled || 0)
          const dailySales = Math.max(0, Math.round((unitsRequested / 30) * 10) / 10)
          const daysLeft = dailySales > 0 ? Math.max(0, Math.round(stock / dailySales)) : (stock > 0 ? 999 : 0)

          return {
            id: String(product.id),
            name: String(product.name || `Produto #${product.id}`),
            sku: String(product.sku || ''),
            category: String((product as { categoryName?: string }).categoryName || categoryIds[0] || 'Sem categoria'),
            imageUrl: String((product as { imageUrl?: string }).imageUrl || '') || null,
            basePrice: Number(product.basePrice || 0),
            revenueRequested,
            revenueFulfilled,
            unitsRequested,
            unitsFulfilled,
            stock,
            dailySales,
            daysLeft,
            curve: 'C',
            sizes: [],
            colors: [],
            monthlyRevenue: [],
          }
        })

        setDashboardDataFromLive({
          orders: liveOrdersPayload,
          customers: rawCustomers.map((customer) => ({
            id: customer.id,
            companyName: customer.companyName,
            tradeName: customer.tradeName,
            contactName: customer.contactName,
            email: customer.email,
            state: customer.state,
            city: customer.city,
            segment: customer.segment,
            status: customer.status,
            createdAt: customer.createdAt,
          })) as never,
          products: rawProducts.map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            categoryId: product.categoryId,
            categoryIds: product.categoryIds,
            basePrice: product.basePrice,
            imageUrl: (product as { imageUrl?: string }).imageUrl,
            primaryImageUrl: (product as { primaryImageUrl?: string }).primaryImageUrl,
            coverImageUrl: (product as { coverImageUrl?: string }).coverImageUrl,
            variants: Array.isArray(product.variants)
              ? product.variants.map((variant) => ({
                  size: (variant as { size?: string }).size,
                  color: (variant as { color?: string }).color,
                  stock: (variant as { stock?: number }).stock,
                }))
              : [],
          })) as never,
        })

        if (cancelled) return

        setOrders(liveOrders)
        setCustomers(customerRows as DCustomer[])
        setProducts(productRows)
      } catch {
        if (!cancelled) {
          setError('Falha ao hidratar dados do dashboard')
        }
      } finally {
        if (!cancelled) {
          setIsHydratingRaw(false)
        }
      }
    }

    void hydrateRawDashboardData()

    return () => {
      cancelled = true
    }
  }, [currentRangeKey, dateRange?.from, dateRange?.to])

  const value = useMemo<DashboardDataContextValue>(() => {
    const start = dateRange?.from ?? new Date(0)
    const end   = dateRange?.to   ?? new Date()

    const periodOrders = orders.filter(o => o.date >= start && o.date <= end)

    return {
      orders,
      customers,
      products,
      periodOrders,
      periodStart: start,
      periodEnd:   end,
      monthlyRevenue:           metricsData?.monthlyRevenue ?? [],
      weeklyRevenue:            metricsData?.weeklyRevenue ?? [],
      geoData:                  metricsData?.geoData ?? [],
      rfmData:                  metricsData?.rfmData ?? [],
      cohortData:               metricsData?.cohortData ?? [],
      funnelData:               metricsData?.funnelData ?? [],
      paymentStatusBreakdown:   metricsData?.paymentStatusBreakdown ?? [],
      paymentMethodBreakdown:   metricsData?.paymentMethodBreakdown ?? [],
      seasonalityByCategory:    metricsData?.seasonalityByCategory ?? [],
      seasonalityOrdersByMonth: metricsData?.seasonalityOrdersByMonth ?? [],
      abcSummary:               metricsData?.abcSummary ?? [],
      categoryBreakdown:        metricsData?.categoryBreakdown ?? [],
      salesByColor:             metricsData?.salesByColor ?? [],
      salesBySize:              metricsData?.salesBySize ?? [],
      totals:                   { ...EMPTY_TOTALS, ...(metricsData?.totals ?? {}) },
      isLoading: isLoadingMetrics,
      isHydratingRaw,
      error,
    }
  }, [metricsData, dateRange, isLoadingMetrics, isHydratingRaw, error, orders, customers, products])

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
