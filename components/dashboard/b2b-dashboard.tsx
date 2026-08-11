'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
  RadarChart, Radar, PolarAngleAxis, PolarGrid,
  RadialBarChart, RadialBar, PolarRadiusAxis, Label,
} from 'recharts'
import {
  Download, BarChart3, TrendingUp, Users, Package,
  ShoppingCart, RefreshCcw, Filter, X, DollarSign,
  ArrowUpRight, Layers, MapPin, CalendarIcon, Clock,
  ChevronUp, ChevronDown, AlertCircle, Info,
} from 'lucide-react'
import { useDashboardData } from '@/contexts/dashboard-data'
import type { DRFMSegment, DCurve, DOrder, DCustomer, DProduct } from '@/lib/dashboard-mock-data'
import {
  AdminPage, AdminStatGrid, AdminStatCard,
  AdminPanel as BaseAdminPanel, AdminToolbar,
} from '@/components/admin/admin-mobile-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const DASHBOARD_TABS = [
  { value: 'vendas', label: 'Vendas', icon: ShoppingCart },
  { value: 'produtos', label: 'Produtos', icon: Package },
  { value: 'clientes', label: 'Clientes', icon: Users },
  { value: 'retencao', label: 'Retenção', icon: RefreshCcw },
  { value: 'trafego', label: 'Tráfego', icon: TrendingUp },
  { value: 'geografia', label: 'Geografia', icon: MapPin },
] as const

const BrazilMap = dynamic(() => import('./brazil-map'), { ssr: false })

// ── Formatters ─────────────────────────────────────────────────────────────────
const toSafeNumber = (v: number | null | undefined) => Number(v ?? 0)

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(toSafeNumber(v))
const num = (v: number | null | undefined) => new Intl.NumberFormat('pt-BR').format(toSafeNumber(v))
const pct = (v: number | null | undefined) => `${Number(v ?? 0).toFixed(1)}%`

function normalizePaymentStatusLabel(value: string): string {
  const normalized = value.trim().toUpperCase()
  const labels: Record<string, string> = {
    PENDING: 'Aguardando',
    PAID: 'Pago',
    PARTIAL: 'Parcial',
    REFUNDED: 'Reembolsado',
    CANCELLED: 'Cancelado',
    CANCELED: 'Cancelado',
    UNKNOWN: 'Aguardando',
  }
  return labels[normalized] ?? 'Aguardando'
}

function normalizePaymentMethodLabel(value: string): string {
  const normalized = value.trim().toUpperCase()
  const labels: Record<string, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    FATURADO: 'Faturado',
    CARTAO_EXTERNO: 'Cartão',
    CREDIT_CARD: 'Cartão',
    DEBIT_CARD: 'Cartão',
    CARD: 'Cartão',
    MANUAL_CUSTOM: 'Pagamento manual',
    UNKNOWN: 'Não informado',
  }
  if (normalized.startsWith('MANUAL_CUSTOM')) return 'Pagamento manual'
  return labels[normalized] ?? value
}

function paymentStatusColor(code: string): string {
  const normalized = code.trim().toUpperCase()
  const map: Record<string, string> = {
    PENDING: '#f59e0b',
    PAID: '#10b981',
    PARTIAL: '#3b82f6',
    REFUNDED: '#8b5cf6',
    CANCELLED: '#ef4444',
    CANCELED: '#ef4444',
  }
  return map[normalized] ?? '#64748b'
}

function paymentMethodColor(code: string): string {
  const normalized = code.trim().toUpperCase()
  if (normalized.startsWith('MANUAL_CUSTOM')) return '#64748b'
  const map: Record<string, string> = {
    PIX: '#06b6d4',
    BOLETO: '#f59e0b',
    FATURADO: '#8b5cf6',
    CARTAO_EXTERNO: '#3b82f6',
    CREDIT_CARD: '#3b82f6',
    DEBIT_CARD: '#3b82f6',
    CARD: '#3b82f6',
    UNKNOWN: '#94a3b8',
  }
  return map[normalized] ?? '#64748b'
}

function PaymentMetricChips({ count, percentage, value, accentColor }: { count: number; percentage: number; value: number; accentColor: string }) {
  const countStyle = {
    borderColor: `${accentColor}55`,
    backgroundColor: `${accentColor}14`,
    color: accentColor,
  }
  const percentageStyle = {
    borderColor: `${accentColor}66`,
    backgroundColor: `${accentColor}1F`,
    color: accentColor,
  }
  const valueStyle = {
    borderColor: `${accentColor}80`,
    backgroundColor: `${accentColor}2A`,
    color: accentColor,
  }

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-end gap-1">
      <span
        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px]"
        style={countStyle}
      >
        {num(count)} qtd
      </span>
      <span
        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px]"
        style={percentageStyle}
      >
        {pct(percentage)}
      </span>
      <span
        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px]"
        style={valueStyle}
      >
        {brl(value)}
      </span>
    </div>
  )
}

// ── CSV download ───────────────────────────────────────────────────────────────
const TODAY_STR = new Date().toISOString().slice(0, 10)
function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = '﻿' + rows
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = filename
  a.click()
}

// ── Constants ──────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10
const DASHBOARD_PANEL_HEADER_CLASS = 'pt-0 px-4 pb-4 sm:pt-0 sm:px-5'
const DASHBOARD_TOOLBAR_CLASS = 'py-0 px-4 sm:py-0 sm:px-5'

function AdminPanel(props: Parameters<typeof BaseAdminPanel>[0]) {
  return <BaseAdminPanel headerClassName={DASHBOARD_PANEL_HEADER_CLASS} {...props} />
}

const RFM_BADGE: Record<DRFMSegment, 'emerald' | 'blue' | 'sky' | 'amber' | 'rose'> = {
  Champions: 'emerald', Loyal: 'blue', Promising: 'sky', 'At Risk': 'amber', Lost: 'rose',
}

const CURVE_BADGE: Record<DCurve, 'emerald' | 'blue' | 'amber'> = {
  A: 'emerald', B: 'blue', C: 'amber',
}

const TRAFFIC_SOURCES = [
  { source: 'Instagram',  sessions: 1240, solicitados: 87,  aprovados: 74 },
  { source: 'Google Ads', sessions: 980,  solicitados: 64,  aprovados: 52 },
  { source: 'WhatsApp',   sessions: 760,  solicitados: 91,  aprovados: 83 },
  { source: 'E-mail',     sessions: 540,  solicitados: 53,  aprovados: 44 },
  { source: 'Facebook',   sessions: 430,  solicitados: 28,  aprovados: 21 },
  { source: 'Orgânico',   sessions: 380,  solicitados: 19,  aprovados: 14 },
  { source: 'Referral',   sessions: 210,  solicitados: 12,  aprovados: 10 },
]
const TRAFFIC_TOTAL_SESSIONS = TRAFFIC_SOURCES.reduce((s, t) => s + t.sessions, 0)
const TRAFFIC_TOTAL_SOL      = TRAFFIC_SOURCES.reduce((s, t) => s + t.solicitados, 0)
const TRAFFIC_TOTAL_APR      = TRAFFIC_SOURCES.reduce((s, t) => s + t.aprovados, 0)

// ── Cohort cell classes ────────────────────────────────────────────────────────
function cohortCellClass(v: number | null, col: number): string {
  if (col === 0) return 'bg-primary/10 text-primary font-medium'
  if (v === null) return ''
  if (v >= 70) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (v >= 40) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
}

// ── Brand color (single source of truth) ──────────────────────────────────────
const BRAND = '#3156FF'

// ── Sort helpers ───────────────────────────────────────────────────────────────
type SortDir = 'asc' | 'desc'

function SortHead({ label, active, dir, onSort, className }: {
  label: string; active: boolean; dir: SortDir; onSort: () => void; className?: string
}) {
  return (
    <button
      onClick={onSort}
      className={cn(
        'inline-flex items-center gap-0.5 transition-colors whitespace-nowrap',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {label}
      <span className="flex flex-col ml-0.5">
        <ChevronUp   className={cn('h-3 w-3 -mb-0.5', active && dir === 'asc'  ? 'opacity-100' : 'opacity-25')} />
        <ChevronDown className={cn('h-3 w-3',          active && dir === 'desc' ? 'opacity-100' : 'opacity-25')} />
      </span>
    </button>
  )
}

function ProductRankingList({
  products,
  metricLabel,
  emptyLabel,
}: {
  products: Array<{
    id: string
    name: string
    sku: string
    primaryValue: string
    secondaryValue: string
  }>
  metricLabel: string
  emptyLabel: string
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 p-5 text-center">
        <Package className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border/20">
      {products.map((product, index) => (
        <div key={product.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className="w-5 shrink-0 text-xs font-mono text-muted-foreground">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-5">{product.name}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{product.sku || 'Sem SKU'}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{product.primaryValue}</p>
            <p className="text-[11px] text-muted-foreground">{metricLabel}</p>
            <p className="text-[11px] text-muted-foreground">{product.secondaryValue}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Chart configs ──────────────────────────────────────────────────────────────
const revenueConfig: ChartConfig = {
  requested: { label: 'Solicitado', color: BRAND },
  fulfilled:  { label: 'Atendido',  color: `${BRAND}66` },
}
const recomprasConfig: ChartConfig = {
  recompras: { label: 'Recompras', color: BRAND },
  novos:     { label: 'Novos',     color: `${BRAND}66` },
}
const SELLER_LINK_EVENT_COLUMNS = [
  { key: 'page_view', label: 'Visitas' },
  { key: 'product_view', label: 'Produtos' },
  { key: 'add_to_cart', label: 'Carrinho' },
  { key: 'checkout_started', label: 'Checkout' },
  { key: 'purchase', label: 'Compra' },
  { key: 'register_submitted', label: 'Cadastro' },
] as const

const abcChartConfig = {
  revenue: { label: 'Receita Solicitada', color: BRAND },
  label:   { color: 'var(--background)' },
} satisfies ChartConfig

const categoryChartConfig = {
  requested: { label: 'Solicitado', color: BRAND },
  fulfilled:  { label: 'Atendido',  color: `${BRAND}66` },
  label:      { color: 'var(--background)' },
} satisfies ChartConfig

const colorChartConfig = {
  pct:   { label: 'Participação', color: BRAND },
  label: { color: 'var(--background)' },
} satisfies ChartConfig

const geoChartConfig = {
  customers: { label: 'Clientes', color: BRAND },
  label:     { color: 'var(--background)' },
} satisfies ChartConfig

const sizeChartConfig = {
  pct: { label: 'Participação (%)', color: BRAND },
} satisfies ChartConfig

const fulfillmentConfig = {
  rate: { label: 'Taxa de Atendimento', color: BRAND },
} satisfies ChartConfig

function BarNameBelowLabel(props: {
  x?: number | string
  y?: number | string
  height?: number | string
  value?: string | number
}) {
  const x = typeof props.x === 'number' ? props.x : Number(props.x)
  const y = typeof props.y === 'number' ? props.y : Number(props.y)
  const height = typeof props.height === 'number' ? props.height : Number(props.height)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(height)) return null

  return (
    <text x={x} y={y + height + 13} className="fill-foreground" fontSize={11} fontWeight={500}>
      {props.value}
    </text>
  )
}

function ColorBarNameLabel(props: {
  x?: number | string
  y?: number | string
  height?: number | string
  value?: string | number
}) {
  return <BarNameBelowLabel {...props} />
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim()
  if (!raw.startsWith('#')) return null
  const value = raw.slice(1)
  if (value.length === 3) {
    return {
      r: parseInt(value[0] + value[0], 16),
      g: parseInt(value[1] + value[1], 16),
      b: parseInt(value[2] + value[2], 16),
    }
  }
  if (value.length >= 6) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    }
  }
  return null
}

function colorBarNeedsBorder(colorName: string, hex: string): boolean {
  const normalizedName = colorName.trim().toLowerCase()
  if (
    normalizedName.includes('branco')
    || normalizedName.includes('white')
    || normalizedName.includes('off white')
    || normalizedName.includes('creme')
    || normalizedName.includes('cream')
  ) {
    return true
  }

  const rgb = parseHexRgb(hex)
  if (!rgb) return false

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance >= 0.88
}

// ── Main component ─────────────────────────────────────────────────────────────
type SellerLinkFunnelStage = {
  key: string
  label: string
  value: number
  pct: number
}

type SellerLinkFunnel = {
  sellerId: string
  sellerName: string
  sellerSlug: string
  stages: SellerLinkFunnelStage[]
}

function mapSellerLinkFunnels(raw: Array<Record<string, unknown>>): SellerLinkFunnel[] {
  return raw.map((item) => {
    const stagesRaw = Array.isArray(item.stages) ? item.stages : []
    return {
      sellerId: String(item.sellerId || item.seller_id || ''),
      sellerName: String(item.sellerName || item.seller_name || 'Vendedora'),
      sellerSlug: String(item.sellerSlug || item.seller_slug || ''),
      stages: stagesRaw.map((stage) => {
        const row = stage as Record<string, unknown>
        return {
          key: String(row.key || ''),
          label: String(row.label || ''),
          value: Number(row.value || 0),
          pct: Number(row.pct || 0),
        }
      }),
    }
  })
}

export default function B2BDashboard({
  dateRange, setDateRange, initialOrders = [], initialCustomers = [], initialProducts = [],
  initialCustomerTotal,
  initialCustomerTotalPages,
  initialProductTotal,
  initialProductTotalPages,
  initialTopVisitedProducts = [],
  initialTopSoldProducts = [],
  initialSellerLinkFunnels = [],
  canExportReports = true,
}: {
  dateRange:    DateRange | undefined
  setDateRange: (r: DateRange | undefined) => void
  initialSalesBySeller?: { name: string; revenue: number }[]
  initialOrders?: DOrder[]
  initialCustomers?: DCustomer[]
  initialProducts?: DProduct[]
  initialCustomerTotal?: number
  initialCustomerTotalPages?: number
  initialProductTotal?: number
  initialProductTotalPages?: number
  initialTopVisitedProducts?: Array<Record<string, unknown>>
  initialTopSoldProducts?: Array<Record<string, unknown>>
  initialSellerLinkFunnels?: Array<Record<string, unknown>>
  canExportReports?: boolean
}) {
  const {
    orders: dashboardOrders, customers: dashboardCustomers, products: dashboardProducts, periodOrders, monthlyRevenue,
    abcSummary: metricsAbcSummary,
    categoryBreakdown: metricsCategoryBreakdown,
    rfmData, cohortData, funnelData, geoData, totals,
    paymentStatusBreakdown, paymentMethodBreakdown,
    salesByColor, salesBySize,
    isLoading, isHydratingRaw,
    periodStart, periodEnd,
  } = useDashboardData()

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [sellerFilter, setSellerFilter]   = useState('all')
  const [stateFilter,  setStateFilter]    = useState('all')
  const [customerSearch, setCustomerSearch] = useState('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // ── Pagination ────────────────────────────────────────────────────────────────
  const [productPage,  setProductPage]  = useState(1)
  const [customerPage, setCustomerPage] = useState(1)
  const [pageCustomers, setPageCustomers] = useState<DCustomer[]>(initialCustomers)
  const [pageProducts, setPageProducts] = useState<DProduct[]>(initialProducts)
  const [customerTotal, setCustomerTotal] = useState(initialCustomerTotal ?? initialCustomers.length)
  const [customerTotalPages, setCustomerTotalPages] = useState(initialCustomerTotalPages ?? 1)
  const [productTotal, setProductTotal] = useState(initialProductTotal ?? initialProducts.length)
  const [productTotalPages, setProductTotalPages] = useState(initialProductTotalPages ?? 1)
  const skipInitialPageFetchRef = useRef(true)
  const [analyticsTopVisitedProducts, setAnalyticsTopVisitedProducts] = useState<Array<{
    id: string
    name: string
    sku: string
    visits: number
    uniqueSessions: number
    uniqueUsers: number
  }>>(
    initialTopVisitedProducts.map((item) => ({
      id: String(item.id || ''),
      name: String(item.name || 'Produto'),
      sku: String(item.sku || ''),
      visits: Number(item.visits || 0),
      uniqueSessions: Number(item.uniqueSessions || 0),
      uniqueUsers: Number(item.uniqueUsers || 0),
    }))
  )
  const [analyticsTopSoldProducts, setAnalyticsTopSoldProducts] = useState<Array<{
    id: string
    name: string
    sku: string
    unitsSold: number
    revenue: number
  }>>(
    initialTopSoldProducts.map((item) => ({
      id: String(item.id || ''),
      name: String(item.name || 'Produto'),
      sku: String(item.sku || ''),
      unitsSold: Number(item.unitsSold || 0),
      revenue: Number(item.revenue || 0),
    }))
  )
  const [sellerLinkFunnels, setSellerLinkFunnels] = useState<SellerLinkFunnel[]>(
    () => mapSellerLinkFunnels(initialSellerLinkFunnels),
  )

  const orders = initialOrders.length > 0 ? initialOrders : dashboardOrders
  const customers = dashboardCustomers
  const products = pageProducts.length > 0 ? pageProducts : initialProducts
  const analyticsProducts = dashboardProducts.length > 0 ? dashboardProducts : products

  useEffect(() => {
    const hasInitialPageData = initialCustomers.length > 0 || initialProducts.length > 0
    const hasDefaultRequestParams =
      customerPage === 1
      && productPage === 1
      && sellerFilter === 'all'
      && stateFilter === 'all'
      && !customerSearch.trim()

    if (skipInitialPageFetchRef.current && hasInitialPageData && hasDefaultRequestParams) {
      skipInitialPageFetchRef.current = false
      return
    }
    skipInitialPageFetchRef.current = false

    let cancelled = false

    async function loadPageData() {
      try {
        const from = dateRange?.from?.toISOString().slice(0, 10)
        const to = dateRange?.to?.toISOString().slice(0, 10)
        const params = new URLSearchParams()
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        params.set('customersPage', String(customerPage))
        params.set('productsPage', String(productPage))
        params.set('customersLimit', String(PAGE_SIZE))
        params.set('productsLimit', String(PAGE_SIZE))
        if (sellerFilter !== 'all') params.set('seller', sellerFilter)
        if (stateFilter !== 'all') params.set('state', stateFilter)
        if (customerSearch.trim()) params.set('q', customerSearch.trim())

        const response = await fetch(`/api/internal/admin/dashboard-live-data?${params.toString()}`, { cache: 'no-store' })

        if (!response.ok) return

        const payload = await response.json() as {
          products: Array<Record<string, unknown>>
          customers: Array<Record<string, unknown>>
          topVisitedProducts?: Array<Record<string, unknown>>
          topSoldProducts?: Array<Record<string, unknown>>
          sellerLinkFunnels?: Array<Record<string, unknown>>
          customerPagination?: { total?: number; totalPages?: number }
          productPagination?: { total?: number; totalPages?: number }
        }

        const rawProducts = payload.products ?? []
        const rawCustomers = payload.customers ?? []
        const rawTopVisited = payload.topVisitedProducts ?? []
        const rawTopSold = payload.topSoldProducts ?? []
        const rawSellerLinkFunnels = payload.sellerLinkFunnels ?? []

        const customers: DCustomer[] = rawCustomers.map((customer) => {
          const id = String(customer.id)
          const customerOrders = orders.filter((order) => String(order.customerId) === id)
          const sortedOrders = [...customerOrders].sort((a, b) => a.date.getTime() - b.date.getTime())
          const firstPurchaseAt = sortedOrders[0]?.date ?? null
          const lastPurchaseAt = sortedOrders[sortedOrders.length - 1]?.date ?? null
          const totalOrders = customerOrders.length
          const totalRevenue = customerOrders.reduce((sum, order) => sum + Number(order.fulfilledTotal || 0), 0)
          const totalRequested = customerOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
          const registeredAt = new Date(String(customer.createdAt || new Date().toISOString()))

          return {
            id,
            name: String(customer.name || `Cliente #${id}`),
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
            assignedSellerName: (customer as { assignedSellerName?: string | null }).assignedSellerName ?? null,
          }
        })

        const products: DProduct[] = rawProducts.map((product) => {
          const variants = Array.isArray((product as { variants?: unknown[] }).variants)
            ? ((product as { variants?: unknown[] }).variants as unknown[])
            : []
          const categoryIds = Array.isArray((product as { categoryIds?: unknown[] }).categoryIds)
            ? ((product as { categoryIds?: unknown[] }).categoryIds as unknown[])
            : []
          const stock = variants.reduce<number>((sum, variant) => sum + Number((variant as { stock?: number }).stock || 0), 0)
          return {
            id: String(product.id),
            name: String(product.name || `Produto #${product.id}`),
            sku: String(product.sku || ''),
            category: String(categoryIds[0] || product.categoryId || 'Sem categoria'),
            basePrice: Number(product.basePrice || 0),
            revenueRequested: 0,
            revenueFulfilled: 0,
            unitsRequested: 0,
            unitsFulfilled: 0,
            stock,
            dailySales: 0,
            daysLeft: stock > 0 ? 999 : 0,
            curve: 'C' as const,
            sizes: [],
            colors: [],
            monthlyRevenue: [],
          }
        })

        if (!cancelled) {
          setPageCustomers(customers)
          setPageProducts(products)
          setAnalyticsTopVisitedProducts(
            rawTopVisited.map((item) => ({
              id: String(item.id || ''),
              name: String(item.name || 'Produto'),
              sku: String(item.sku || ''),
              visits: Number(item.visits || 0),
              uniqueSessions: Number(item.uniqueSessions || 0),
              uniqueUsers: Number(item.uniqueUsers || 0),
            }))
          )
          setAnalyticsTopSoldProducts(
            rawTopSold.map((item) => ({
              id: String(item.id || ''),
              name: String(item.name || 'Produto'),
              sku: String(item.sku || ''),
              unitsSold: Number(item.unitsSold || 0),
              revenue: Number(item.revenue || 0),
            }))
          )
          setSellerLinkFunnels(mapSellerLinkFunnels(rawSellerLinkFunnels))
          setCustomerTotal(Number(payload.customerPagination?.total ?? customers.length))
          setCustomerTotalPages(Number(payload.customerPagination?.totalPages ?? 1))
          setProductTotal(Number(payload.productPagination?.total ?? products.length))
          setProductTotalPages(Number(payload.productPagination?.totalPages ?? 1))
        }
      } catch {
        // keep fallback state
      }
    }

    void loadPageData()
    return () => {
      cancelled = true
    }
  }, [dateRange?.from, dateRange?.to, sellerFilter, stateFilter, customerSearch, customerPage, productPage])

  // ── Sort state ────────────────────────────────────────────────────────────────
  type ProductSortKey  = 'curve' | 'revenueRequested' | 'revenueFulfilled' | 'unitsRequested' | 'stock' | 'daysLeft'
  type CustomerSortKey = 'state' | 'rfmSegment' | 'totalOrders' | 'totalRevenue' | 'avgTicket' | 'lastPurchaseAt'

  const [productSort,  setProductSort]  = useState<{ key: ProductSortKey;  dir: SortDir } | null>(null)
  const [customerSort, setCustomerSort] = useState<{ key: CustomerSortKey; dir: SortDir } | null>(null)

  function toggleProductSort(key: ProductSortKey) {
    setProductSort(prev => prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
    setProductPage(1)
  }
  function toggleCustomerSort(key: CustomerSortKey) {
    setCustomerSort(prev => prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
    setCustomerPage(1)
  }

  // ── Alert dismiss state ───────────────────────────────────────────────────────
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])

  // ── Derived filter options ────────────────────────────────────────────────────
  const sellers = useMemo(() =>
    [...new Set(
      customers
        .map(c => (c as typeof c & { assignedSellerName?: string }).assignedSellerName)
        .filter((s): s is string => Boolean(s))
    )].sort(),
    [customers]
  )
  const states = useMemo(() =>
    [...new Set(customers.map(c => c.state).filter(Boolean))].sort(),
    [customers]
  )

  // ── Filtered customers ────────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase()
    return customers.filter(c => {
      const cs = c as typeof c & { assignedSellerName?: string }
      return (
        (sellerFilter === 'all' || cs.assignedSellerName === sellerFilter) &&
        (stateFilter  === 'all' || c.state === stateFilter) &&
        (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      )
    })
  }, [customers, sellerFilter, stateFilter, customerSearch])

  const hasActiveFilter = sellerFilter !== 'all' || stateFilter !== 'all' || customerSearch !== ''
  const topSalesByColor = useMemo(() => salesByColor.slice(0, 10), [salesByColor])

  function clearFilters() {
    setSellerFilter('all')
    setStateFilter('all')
    setCustomerSearch('')
  }

  // ── Sorted customers ──────────────────────────────────────────────────────────
  const sortedCustomers = useMemo(() => {
    if (!customerSort) return filteredCustomers
    const { key, dir } = customerSort
    const RFM_ORDER: Record<DRFMSegment, number> = { Champions: 0, Loyal: 1, Promising: 2, 'At Risk': 3, Lost: 4 }
    return [...filteredCustomers].sort((a, b) => {
      let va: string | number, vb: string | number
      if (key === 'rfmSegment') {
        va = RFM_ORDER[a.rfmSegment]; vb = RFM_ORDER[b.rfmSegment]
      } else if (key === 'lastPurchaseAt') {
        va = a.lastPurchaseAt?.getTime() ?? 0; vb = b.lastPurchaseAt?.getTime() ?? 0
      } else if (key === 'state') {
        va = a.state; vb = b.state
      } else {
        va = a[key] as number; vb = b[key] as number
      }
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredCustomers, customerSort])

  // ── Smart alerts ──────────────────────────────────────────────────────────────
  const alertItems = useMemo(() => {
    const pendingOrders = orders.filter(o => o.status === 'PENDING')
    const pendingRegs   = customers.filter(c => c.firstPurchaseAt === null)
    const result: { id: string; type: 'warning' | 'danger'; Icon: typeof ShoppingCart; title: string; message: string; href: string }[] = []
    if (pendingOrders.length > 0)
      result.push({
        id: 'pending-orders', type: 'warning', Icon: ShoppingCart, href: '/orders?status=PENDING',
        title: `${pendingOrders.length} pedido${pendingOrders.length !== 1 ? 's' : ''} pendente${pendingOrders.length !== 1 ? 's' : ''}`,
        message: 'Aguardando processamento · Toque para ver',
      })
    if (pendingRegs.length > 0)
      result.push({
        id: 'pending-regs', type: 'danger', Icon: AlertCircle, href: '/customers?status=PENDING',
        title: `${pendingRegs.length} cadastro${pendingRegs.length !== 1 ? 's' : ''} pendente${pendingRegs.length !== 1 ? 's' : ''}`,
        message: 'Clientes sem compra registrada · Toque para ver',
      })
    return result
  }, [orders, customers])

  const visibleAlerts = alertItems.filter(a => !dismissedAlerts.includes(a.id))

  // ── Period months ─────────────────────────────────────────────────────────────
  const periodMonths = useMemo(() => {
    const diffDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000)
    const n = diffDays <= 7 ? 1 : diffDays <= 30 ? 2 : diffDays <= 90 ? 4 : 12
    return monthlyRevenue.slice(-n)
  }, [monthlyRevenue, periodStart, periodEnd])

  // ── KPI helpers from backend totals ──────────────────────────────────────────
  const retention30d = totals.retention30d
  const avgItems = totals.avgItemsPerOrder
  const totalCustomersHint = Math.max(totals.approvedCustomers, totals.purchasedCustomers, totals.activeCustomers)

  // ── Monthly recompras (last 6) ────────────────────────────────────────────────
  const monthlyRecompras = useMemo(() =>
    monthlyRevenue
      .map(m => ({ month: m.month, recompras: m.returningCustomers, novos: m.newCustomers }))
      .slice(-6),
    [monthlyRevenue]
  )

  const paymentStatusRows = useMemo(
    () => paymentStatusBreakdown.map((row) => ({
      code: row.status,
      label: normalizePaymentStatusLabel(row.status),
      count: row.count,
      pct: row.pct,
      value: row.value,
    })),
    [paymentStatusBreakdown],
  )

  const paymentMethodRows = useMemo(
    () => paymentMethodBreakdown.map((row) => ({
      code: row.method,
      label: normalizePaymentMethodLabel(row.method),
      count: row.count,
      pct: row.pct,
      value: row.value,
    })),
    [paymentMethodBreakdown],
  )

  // ── Category breakdown ────────────────────────────────────────────────────────
  const byCategory = useMemo(() =>
    metricsCategoryBreakdown
      .map((c) => ({
        name: c.name,
        requested: c.requested,
        fulfilled: c.fulfilled,
        fulfillRate: c.fulfillRate,
      }))
      .sort((a, b) => b.requested - a.requested),
    [metricsCategoryBreakdown]
  )

  // ── ABC sorted products ───────────────────────────────────────────────────────
  const abcProducts = useMemo(() =>
    [...analyticsProducts].sort((a, b) => {
      const order: Record<DCurve, number> = { A: 0, B: 1, C: 2 }
      const diff = order[a.curve] - order[b.curve]
      return diff !== 0 ? diff : b.revenueRequested - a.revenueRequested
    }),
    [analyticsProducts]
  )

  const topSoldProductRows = useMemo(() =>
    analyticsTopSoldProducts
      .filter((product) => product.id && product.unitsSold > 0)
      .sort((a, b) => {
        if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold
        return b.revenue - a.revenue
      })
      .slice(0, 10)
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        primaryValue: num(product.unitsSold),
        secondaryValue: brl(product.revenue),
      })),
    [analyticsTopSoldProducts]
  )

  const topVisitedProductRows = useMemo(() =>
    analyticsTopVisitedProducts
      .filter((product) => product.id && product.visits > 0)
      .sort((a, b) => {
        if (b.visits !== a.visits) return b.visits - a.visits
        if (b.uniqueSessions !== a.uniqueSessions) return b.uniqueSessions - a.uniqueSessions
        return b.uniqueUsers - a.uniqueUsers
      })
      .slice(0, 10)
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        primaryValue: num(product.visits),
        secondaryValue: `${num(product.uniqueSessions)} sessões`,
      })),
    [analyticsTopVisitedProducts]
  )

  // ── ABC summary ───────────────────────────────────────────────────────────────
  const abcSummary = useMemo(() =>
    (['A', 'B', 'C'] as DCurve[]).map(curve => {
      const row = metricsAbcSummary.find(r => r.curve === curve)
      return {
        curve,
        count: row?.count ?? 0,
        revenue: row?.revenue ?? 0,
      }
    }),
    [metricsAbcSummary]
  )

  // ── Sorted products ───────────────────────────────────────────────────────────
  const sortedProducts = useMemo(() => {
    if (!productSort) return abcProducts
    const { key, dir } = productSort
    const CURVE_ORDER: Record<DCurve, number> = { A: 0, B: 1, C: 2 }
    return [...abcProducts].sort((a, b) => {
      const va = key === 'curve' ? CURVE_ORDER[a.curve] : (a[key] as number)
      const vb = key === 'curve' ? CURVE_ORDER[b.curve] : (b[key] as number)
      return dir === 'asc' ? va - vb : vb - va
    })
  }, [abcProducts, productSort])

  // ── Cohort M1 average ─────────────────────────────────────────────────────────
  const avgM1 = useMemo(() => {
    const vals = cohortData.map(r => r.months[1]).filter((v): v is number => v !== null)
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  }, [cohortData])

  // ── RFM 5×5 grid ──────────────────────────────────────────────────────────────
  const rfmGrid = useMemo(() => {
    const grid: Record<string, { seg: DRFMSegment; count: number }> = {}
    for (let r = 5; r >= 1; r--) {
      for (let f = 1; f <= 5; f++) {
        const seg: DRFMSegment =
          r >= 4 && f >= 4 ? 'Champions'
          : f >= 3 && r >= 3 ? 'Loyal'
          : r >= 3 && f <= 2 ? 'Promising'
          : r <= 2 && f >= 3 ? 'At Risk'
          : 'Lost'
        grid[`${r}-${f}`] = { seg, count: 0 }
      }
    }
    filteredCustomers.forEach(c => {
      const days = c.lastPurchaseAt
        ? Math.floor((Date.now() - c.lastPurchaseAt.getTime()) / 86400000)
        : 999
      const R = days <= 30 ? 5 : days <= 60 ? 4 : days <= 90 ? 3 : days <= 180 ? 2 : 1
      const F = c.totalOrders >= 5 ? 5 : c.totalOrders === 4 ? 4 : c.totalOrders === 3 ? 3 : c.totalOrders === 2 ? 2 : 1
      const key = `${R}-${F}`
      if (grid[key]) grid[key].count++
    })
    return grid
  }, [filteredCustomers])

  // ── Revenue mini KPIs ─────────────────────────────────────────────────────────
  const revenueKpis = useMemo(() => [
    { label: 'Maior mês',    val: brl(periodMonths.length > 0 ? Math.max(...periodMonths.map(m => m.requested)) : 0) },
    { label: 'Média mensal', val: brl(periodMonths.length > 0 ? periodMonths.reduce((s, m) => s + m.requested, 0) / periodMonths.length : 0) },
    { label: 'Pedidos',      val: num(periodMonths.reduce((s, m) => s + m.orders, 0)) },
    { label: 'Novos cli.',   val: num(periodMonths.reduce((s, m) => s + m.newCustomers, 0)) },
  ], [periodMonths])

  // ── Geo: top cities across all states ────────────────────────────────────────
  const topCities = useMemo(() =>
    geoData
      .flatMap(s => s.cities.map(c => ({ ...c, state: s.stateCode })))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
    [geoData]
  )

  const maxGeoCustomers = useMemo(() =>
    Math.max(1, ...geoData.map(s => s.customers)),
    [geoData]
  )

  // ── Chart data ────────────────────────────────────────────────────────────────
  const abcChartData = useMemo(() =>
    abcSummary.map(s => ({ name: `Curva ${s.curve}`, revenue: s.revenue, count: s.count })),
    [abcSummary]
  )

  const categoryChartData = useMemo(() =>
    byCategory.map(c => ({ name: c.name, requested: c.requested, fulfilled: c.fulfilled })),
    [byCategory]
  )

  // ── Approval rates ────────────────────────────────────────────────────────────
  const approvalRates = [
    { label: 'Sessões → Solicitados',   val: TRAFFIC_TOTAL_SESSIONS > 0 ? TRAFFIC_TOTAL_SOL / TRAFFIC_TOTAL_SESSIONS * 100 : 0 },
    { label: 'Solicitados → Aprovados', val: TRAFFIC_TOTAL_SOL > 0 ? TRAFFIC_TOTAL_APR / TRAFFIC_TOTAL_SOL * 100 : 0 },
    { label: 'Sessões → Aprovados',     val: TRAFFIC_TOTAL_SESSIONS > 0 ? TRAFFIC_TOTAL_APR / TRAFFIC_TOTAL_SESSIONS * 100 : 0 },
  ]

  // ── CSV exports ───────────────────────────────────────────────────────────────
  function exportKpis() {
    if (!canExportReports) return
    downloadCSV([
      ['Métrica', 'Valor'],
      ['Receita Solicitada', totals.totalRequested],
      ['Receita Atendida',   totals.totalFulfilled],
      ['Pedidos',            totals.totalOrders],
      ['Ticket Médio',       totals.avgTicket],
      ['Clientes Ativos',    totals.activeCustomers],
      ['Retenção 30d %',     retention30d.toFixed(1)],
      ['Itens/Pedido',       avgItems.toFixed(1)],
    ], `dashboard_kpis_${TODAY_STR}.csv`)
  }
  function exportProducts() {
    if (!canExportReports) return
    downloadCSV([
      ['Nome', 'SKU', 'Categoria', 'Curva', 'Solicitado', 'Atendido', 'Unidades', 'Estoque', 'Dias Estoque'],
      ...abcProducts.map(p => [p.name, p.sku, p.category, p.curve, p.revenueRequested, p.revenueFulfilled, p.unitsRequested, p.stock, p.daysLeft]),
    ], `dashboard_produtos_${TODAY_STR}.csv`)
  }
  function exportCustomers() {
    if (!canExportReports) return
    downloadCSV([
      ['Nome', 'Email', 'Estado', 'Segmento RFM', 'Pedidos', 'LTV', 'Ticket Médio', 'Último Pedido'],
      ...filteredCustomers.map(c => [
        c.name, c.email, c.state, c.rfmSegment,
        c.totalOrders, c.totalRevenue, c.avgTicket,
        c.lastPurchaseAt ? c.lastPurchaseAt.toLocaleDateString('pt-BR') : '',
      ]),
    ], `dashboard_clientes_${TODAY_STR}.csv`)
  }
  function exportRetention() {
    if (!canExportReports) return
    downloadCSV([
      ['Cohort', 'M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'],
      ...cohortData.map(r => [r.cohort, ...r.months.map(v => v ?? '')]),
    ], `dashboard_retencao_${TODAY_STR}.csv`)
  }
  function exportTraffic() {
    if (!canExportReports) return
    downloadCSV([
      ['Fonte', 'Sessões', 'Solicitados', 'Aprovados', 'Conv. Sol.%', 'Conv. Apr.%'],
      ...TRAFFIC_SOURCES.map(t => [
        t.source, t.sessions, t.solicitados, t.aprovados,
        `${(t.solicitados / t.sessions * 100).toFixed(1)}%`,
        `${(t.aprovados / t.sessions * 100).toFixed(1)}%`,
      ]),
    ], `dashboard_trafego_${TODAY_STR}.csv`)
  }
  function exportAll() {
    if (!canExportReports) return
    exportKpis(); exportProducts(); exportCustomers(); exportRetention(); exportTraffic()
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AdminPage>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <BarChart3 className="h-6 w-6 text-primary" />
              Visão geral
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {`${num(totals.totalOrders)} pedidos • ${brl(totals.totalRequested)} em solicitações`}
            </p>
          </div>

          <div className="shrink-0">
            <div className="flex items-center gap-2">
              {canExportReports ? (
                <Button variant="outline" onClick={exportAll} className="h-10 rounded-full gap-2 px-5">
                  Exportar tudo
                  <Download className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMobileFiltersOpen(true)}
                className="h-10 w-10 rounded-full md:hidden"
                title="Abrir filtros"
                aria-label="Abrir filtros"
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTROS ────────────────────────────────────────────────────────── */}
      <AdminToolbar className="hidden md:block" contentClassName={DASHBOARD_TOOLBAR_CLASS}>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="min-h-12 rounded-2xl gap-2 justify-start shrink-0 min-w-55 font-normal"
              >
                <CalendarIcon className="h-4 w-4 shrink-0" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'dd/MM/yy', { locale: ptBR })}
                      {' – '}
                      {format(dateRange.to, 'dd/MM/yy', { locale: ptBR })}
                    </>
                  ) : (
                    format(dateRange.from, 'dd/MM/yy', { locale: ptBR })
                  )
                ) : (
                  <span className="text-muted-foreground">Selecionar período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
              />
            </PopoverContent>
          </Popover>

          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="min-h-12 rounded-2xl w-42.5 shrink-0">
              <SelectValue placeholder="Vendedora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas vendedoras</SelectItem>
              {sellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="min-h-12 rounded-2xl w-37.5 shrink-0">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estados</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-50">
            <Input
              placeholder="Buscar cliente..."
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              className="min-h-12 rounded-2xl pr-9"
            />
            {customerSearch && (
              <button
                type="button"
                onClick={() => setCustomerSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={clearFilters}
            className={cn('min-h-12 min-w-12 rounded-2xl shrink-0 relative')}
            title="Limpar filtros"
          >
            <Filter className="h-4 w-4" />
            {hasActiveFilter && (
              <span className="pointer-events-none absolute inset-0">
                <span className="absolute left-1.5 right-1.5 top-1/2 h-0.5 -translate-y-1/2 -rotate-45 bg-foreground" />
              </span>
            )}
          </Button>
        </div>
      </AdminToolbar>

      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="right">
        <DrawerContent className="max-w-none flex flex-col data-[vaul-drawer-direction=right]:w-[80vw] sm:data-[vaul-drawer-direction=right]:w-[80vw]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine a visão geral no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-12 w-full justify-start gap-2 rounded-2xl px-4 text-left font-normal"
                >
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'dd/MM/yy', { locale: ptBR })}
                        {' – '}
                        {format(dateRange.to, 'dd/MM/yy', { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, 'dd/MM/yy', { locale: ptBR })
                    )
                  ) : (
                    <span className="text-muted-foreground">Selecionar período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-h-[70dvh] overflow-y-auto overscroll-contain p-0" align="start">
                <Calendar
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                />
              </PopoverContent>
            </Popover>

            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-full rounded-2xl">
                <SelectValue placeholder="Vendedora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas vendedoras</SelectItem>
                {sellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-full rounded-2xl">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos estados</SelectItem>
                {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="relative">
              <Input
                placeholder="Buscar cliente..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="min-h-12 rounded-2xl pr-9"
              />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <DrawerFooter>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-2xl"
                onClick={clearFilters}
              >
                Limpar filtros
              </Button>
              <DrawerClose asChild>
                <Button type="button" className="flex-1 rounded-2xl bg-black text-white hover:bg-black/90">
                  Fechar
                </Button>
              </DrawerClose>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {isLoading && (
        <p className="text-center text-sm text-muted-foreground py-4">Carregando dados…</p>
      )}
      {isHydratingRaw && (
        <p className="text-center text-xs text-muted-foreground -mt-2 pb-4">Atualizando tabelas detalhadas em background…</p>
      )}

      {/* ── KPI BAR ────────────────────────────────────────────────────────── */}
      <AdminStatGrid>
        <AdminStatCard icon={DollarSign}    label="Rec. Solicitada"       value={brl(totals.totalRequested)}                       hint={`${num(totals.totalOrders)} pedidos`} />
        <AdminStatCard icon={TrendingUp}    label="Rec. Atendida"         value={brl(totals.totalFulfilled)}                       hint={pct(totals.fulfillmentRate) + ' atend.'} tone="success" />
        <AdminStatCard icon={ShoppingCart}  label="Pedidos"               value={num(totals.totalOrders)}                          hint={`${totals.pendingOrders} pendentes`} tone="warning" />
        <AdminStatCard icon={ArrowUpRight}  label="Ticket Médio"          value={brl(totals.avgTicket)}                            hint="por pedido" />
        <AdminStatCard icon={Users}         label="Clientes Ativos"       value={num(totals.activeCustomers)}                      hint={`de ${num(totalCustomersHint)} total`} tone="info" />
        <AdminStatCard icon={RefreshCcw}    label="Retenção 30d"          value={pct(retention30d)}                                hint="c/ recompra" tone="success" />
        <AdminStatCard icon={Layers}        label="Itens / Pedido"        value={avgItems.toFixed(1)}                              hint="média do período" />
        <AdminStatCard icon={Clock}         label="Dias médios p/ Compra" value={`${totals.avgDaysToFirstPurchase.toFixed(0)} dias`} hint="cadastro → 1ª compra" />
      </AdminStatGrid>

      {/* ── ALERTAS INTELIGENTES ───────────────────────────────────────────── */}
      {visibleAlerts.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          {visibleAlerts.map(alert => (
            <div
              key={alert.id}
              className={cn(
                'flex items-stretch rounded-2xl border flex-1 overflow-hidden',
                alert.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40'
                  : 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800/40',
              )}
            >
              <Link
                href={alert.href}
                className="flex items-start gap-3 px-4 py-3.5 flex-1 min-w-0 active:opacity-70 transition-opacity"
              >
                <alert.Icon className={cn('h-5 w-5 mt-0.5 shrink-0',
                  alert.type === 'warning' ? 'text-amber-600' : 'text-rose-600')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold leading-snug',
                    alert.type === 'warning' ? 'text-amber-900 dark:text-amber-100' : 'text-rose-900 dark:text-rose-100')}>
                    {alert.title}
                  </p>
                  <p className={cn('text-xs mt-0.5',
                    alert.type === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400')}>
                    {alert.message}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => setDismissedAlerts(d => [...d, alert.id])}
                className={cn(
                  'shrink-0 px-3 border-l transition-colors',
                  alert.type === 'warning'
                    ? 'border-amber-200 text-amber-500 hover:bg-amber-100 dark:border-amber-800/40 dark:hover:bg-amber-900/40'
                    : 'border-rose-200 text-rose-500 hover:bg-rose-100 dark:border-rose-800/40 dark:hover:bg-rose-900/40',
                )}
                aria-label="Fechar alerta"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── TABS: gráficos por domínio ───────────────────────────────────── */}
      <Tabs defaultValue="vendas" className="space-y-4 lg:space-y-5">
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide lg:mx-0 lg:px-0">
          <TabsList className="inline-flex h-11 w-max min-w-full gap-1 bg-primary/10 p-1 lg:grid lg:w-full lg:grid-cols-6">
            {DASHBOARD_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="h-9 gap-1.5 px-3 cursor-pointer">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="vendas" className="space-y-4 lg:space-y-5">
      {/* ── FUNIL (1/3) | RECEITA (2/3) ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminPanel title="Funil de Aquisição">
          <div className="flex flex-col gap-4">
            {funnelData.map((stage, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">{stage.label}</span>
                  <span className="text-sm font-medium tabular-nums">{num(stage.value)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stage.pct}%`, background: stage.color }}
                    className="h-full rounded-full"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/70 text-right mt-0.5">{stage.pct}%</p>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Receita por Mês" className="md:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {revenueKpis.map(k => (
              <div key={k.label} className="rounded-xl bg-muted/50 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">{k.label}</p>
                <p className="text-sm font-semibold tabular-nums">{k.val}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: BRAND }} />
              Solicitado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: `${BRAND}66` }} />
              Atendido
            </span>
          </div>
          <ChartContainer config={revenueConfig} className="h-40 w-full">
            <AreaChart data={periodMonths} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-requested)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-requested)" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gFul" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-fulfilled)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-fulfilled)" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => brl(v as number)} />
              <Area type="monotone" dataKey="requested" name="Solicitado" stroke="var(--color-requested)" fill="url(#gReq)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="fulfilled"  name="Atendido"  stroke="var(--color-fulfilled)"  fill="url(#gFul)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartContainer>
        </AdminPanel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <AdminPanel title="Status de Pagamento" className="h-full">
          {paymentStatusRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de pagamento no período selecionado.</p>
          ) : (
            <div className="space-y-2.5">
              {paymentStatusRows.map((row) => (
                <div key={`${row.code}-${row.label}`}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 truncate text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: paymentStatusColor(row.code) }} />
                      {row.label}
                    </span>
                    <PaymentMetricChips
                      count={row.count}
                      percentage={row.pct}
                      value={row.value}
                      accentColor={paymentStatusColor(row.code)}
                    />
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, row.pct))}%`,
                        backgroundColor: paymentStatusColor(row.code),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>

        <AdminPanel title="Métodos de Pagamento" className="h-full">
          {paymentMethodRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de pagamento no período selecionado.</p>
          ) : (
            <div className="space-y-2.5">
              {paymentMethodRows.map((row) => (
                <div key={`${row.code}-${row.label}`}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 truncate text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: paymentMethodColor(row.code) }} />
                      {row.label}
                    </span>
                    <PaymentMetricChips
                      count={row.count}
                      percentage={row.pct}
                      value={row.value}
                      accentColor={paymentMethodColor(row.code)}
                    />
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, row.pct))}%`,
                        backgroundColor: paymentMethodColor(row.code),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
        </TabsContent>

        <TabsContent value="produtos" className="space-y-4 lg:space-y-5">
      {/* ── PRODUTOS LINHA 1: ABC | CATEGORIA | TAXA ATEND. ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminPanel title="Curva ABC" description="Receita por classificação de produto">
          <ChartContainer config={abcChartConfig} className="w-full" style={{ height: `${abcChartData.length * 36 + 20}px` }}>
            <BarChart layout="vertical" data={abcChartData} barCategoryGap="35%" margin={{ right: 72, left: 4, top: 4, bottom: 18 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} hide />
              <XAxis dataKey="revenue" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(v) => brl(v as number)} />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={3} barSize={10} maxBarSize={10}>
                <LabelList dataKey="name" content={BarNameBelowLabel} />
                <LabelList dataKey="revenue" position="right" offset={8} className="fill-foreground" fontSize={11}
                  formatter={(v: unknown) => brl(v as number)} />
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="flex gap-2 mt-3 flex-wrap">
            {abcSummary.map(s => (
              <div key={s.curve} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant={CURVE_BADGE[s.curve]}>{s.curve}</Badge>
                <span>{s.count} produtos</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Por Categoria" description="Solicitado vs. atendido por categoria">
          <ChartContainer config={categoryChartConfig} className="w-full" style={{ height: `${categoryChartData.length * 36 + 20}px` }}>
            <BarChart layout="vertical" data={categoryChartData} barCategoryGap="35%" margin={{ right: 8, left: 4, top: 4, bottom: 18 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} hide />
              <XAxis dataKey="requested" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(v) => brl(v as number)} />} />
              <Bar dataKey="requested" name="Solicitado" fill="var(--color-requested)" radius={3} barSize={10} maxBarSize={10}>
                <LabelList dataKey="name" content={BarNameBelowLabel} />
              </Bar>
              <Bar dataKey="fulfilled" name="Atendido" fill="var(--color-fulfilled)" radius={3} barSize={10} maxBarSize={10} />
            </BarChart>
          </ChartContainer>
        </AdminPanel>

        <AdminPanel title="Taxa de Atendimento" description="Geral do período">
          <ChartContainer config={fulfillmentConfig} className="mx-auto aspect-square max-h-62.5">
            <RadialBarChart
              data={[{ rate: totals.fulfillmentRate, fill: 'var(--color-rate)' }]}
              startAngle={90}
              endAngle={90 - (totals.fulfillmentRate / 100) * 360}
              outerRadius={90}
              innerRadius={70}
            >
              <PolarGrid
                gridType="circle"
                radialLines={false}
                stroke="none"
                className="first:fill-muted last:fill-background"
                polarRadius={[90, 70]}
              />
              <RadialBar dataKey="rate" background cornerRadius={10} />
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-4xl font-bold">
                            {totals.fulfillmentRate.toFixed(0)}%
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-sm">
                            atendido
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </PolarRadiusAxis>
            </RadialBarChart>
          </ChartContainer>
        </AdminPanel>
      </div>

      {/* ── PRODUTOS LINHA 2: CORES | TAMANHOS ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminPanel title="Vendas por Cor" description="Top 10 cores por participação no período">
          {topSalesByColor.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de cor no período selecionado.</p>
          ) : (
            <ChartContainer config={colorChartConfig} className="w-full" style={{ height: `${topSalesByColor.length * 40 + 12}px` }}>
              <BarChart
                layout="vertical"
                data={topSalesByColor}
                barCategoryGap="30%"
                margin={{ right: 52, left: 4, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} />
                <YAxis dataKey="color" type="category" tickLine={false} axisLine={false} hide />
                <XAxis dataKey="pct" type="number" hide />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(v) => `${v}%`} />} />
                <Bar dataKey="pct" radius={3} barSize={12} maxBarSize={12}>
                  {topSalesByColor.map((entry) => {
                    const needsBorder = colorBarNeedsBorder(entry.color, entry.hex)
                    return (
                      <Cell
                        key={entry.color}
                        fill={entry.hex}
                        fillOpacity={0.9}
                        stroke={needsBorder ? '#94a3b8' : undefined}
                        strokeWidth={needsBorder ? 1 : 0}
                      />
                    )
                  })}
                  <LabelList dataKey="color" content={ColorBarNameLabel} />
                  <LabelList dataKey="pct" position="right" offset={8} className="fill-foreground" fontSize={11}
                    formatter={(v: unknown) => `${v}%`} />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </AdminPanel>

        <AdminPanel title="Vendas por Tamanho" description="Participação por grade no período">
          {salesBySize.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de tamanho no período selecionado.</p>
          ) : (
            <div className="flex min-h-80 items-center justify-center">
              <ChartContainer config={sizeChartConfig} className="mx-auto aspect-square w-full max-w-80">
                <RadarChart data={salesBySize} cx="50%" cy="50%" outerRadius="80%">
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                  <PolarAngleAxis dataKey="size" tick={{ fontSize: 12 }} />
                  <PolarGrid />
                  <Radar
                    dataKey="pct"
                    fill="var(--color-pct)"
                    fillOpacity={0.6}
                    stroke="var(--color-pct)"
                    dot={{ r: 4, fillOpacity: 1 }}
                  />
                </RadarChart>
              </ChartContainer>
            </div>
          )}
        </AdminPanel>
      </div>

      {/* ── PRODUTOS LINHA 3: MAIS VISITADOS | MAIS VENDIDOS ────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminPanel title="Produtos mais visitados" description="Ranking por analytics_event_metrics (event_name=product_view)">
          <ProductRankingList
            products={topVisitedProductRows}
            metricLabel="visitas"
            emptyLabel="Sem dados de visita no período."
          />
        </AdminPanel>

        <AdminPanel title="Produtos mais vendidos" description="Ranking por analytics_event_metrics (event_name=purchase)">
          <ProductRankingList
            products={topSoldProductRows}
            metricLabel="unidades"
            emptyLabel="Sem produtos vendidos no período."
          />
        </AdminPanel>
      </div>

      {/* ── PRODUTOS LINHA 4: TABELA COMPLETA ────────────────────────────── */}
      <AdminPanel
        title="Todos os Produtos (Curva ABC)"
        action={canExportReports ? (
          <Button variant="outline" size="sm" onClick={exportProducts} className="gap-1.5 h-8">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        ) : null}
      >
        <div className="-mx-4 sm:-mx-5 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>
                  <SortHead label="Curva" active={productSort?.key === 'curve'} dir={productSort?.dir ?? 'asc'} onSort={() => toggleProductSort('curve')} />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead label="Solicitado" active={productSort?.key === 'revenueRequested'} dir={productSort?.dir ?? 'asc'} onSort={() => toggleProductSort('revenueRequested')} className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead label="Atendido" active={productSort?.key === 'revenueFulfilled'} dir={productSort?.dir ?? 'asc'} onSort={() => toggleProductSort('revenueFulfilled')} className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead label="Unidades" active={productSort?.key === 'unitsRequested'} dir={productSort?.dir ?? 'asc'} onSort={() => toggleProductSort('unitsRequested')} className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead label="Estoque" active={productSort?.key === 'stock'} dir={productSort?.dir ?? 'asc'} onSort={() => toggleProductSort('stock')} className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead label="Dias Est." active={productSort?.key === 'daysLeft'} dir={productSort?.dir ?? 'asc'} onSort={() => toggleProductSort('daysLeft')} className="ml-auto" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageProducts.length === 0 && isHydratingRaw ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    Carregando produtos detalhados...
                  </TableCell>
                </TableRow>
              ) : (
                pageProducts.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-45 truncate">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{p.sku}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell><Badge variant={CURVE_BADGE[p.curve]}>{p.curve}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{brl(p.revenueRequested)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(p.revenueFulfilled)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(p.unitsRequested)}</TableCell>
                    <TableCell className="text-right">
                      {p.stock === 0 ? (
                        <Badge variant="rose">Zerado</Badge>
                      ) : (
                        <span className={cn('tabular-nums text-sm', p.stock < 20 ? 'text-amber-600' : 'text-emerald-600')}>
                          {p.stock}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={cn('text-right tabular-nums', p.daysLeft <= 7 ? 'text-rose-600' : p.daysLeft <= 14 ? 'text-amber-600' : 'text-muted-foreground')}>
                      {p.daysLeft}d
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
          <AdminPaginationControls
            currentPage={productPage}
            totalPages={productTotalPages}
            onPageChange={setProductPage}
            showing={{
              start: productTotal === 0 ? 0 : ((productPage - 1) * PAGE_SIZE) + 1,
              end: Math.min(productTotal, productPage * PAGE_SIZE),
              total: productTotal,
            }}
          />
        </div>
      </AdminPanel>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4 lg:space-y-5">
      {/* ── CLIENTES LINHA 1: RFM | LTV ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminPanel
          title="Segmentação RFM"
          action={
            <Popover>
              <PopoverTrigger asChild>
                <button className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors" aria-label="O que é RFM?">
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="left" align="start" className="w-80 text-sm">
                <p className="font-semibold mb-2">O que é RFM?</p>
                <p className="text-muted-foreground text-xs mb-3 leading-relaxed">
                  RFM classifica clientes com base em três comportamentos de compra:
                </p>
                <div className="flex flex-col gap-2 mb-3">
                  {[
                    { key: 'R — Recência',    desc: 'Dias desde a última compra. Score 5 = comprou há ≤ 30 dias.' },
                    { key: 'F — Frequência',  desc: 'Total de pedidos. Score 5 = 5 ou mais pedidos.' },
                    { key: 'M — Monetário',   desc: 'Receita total gerada. Quanto maior o LTV, maior o score.' },
                  ].map(item => (
                    <div key={item.key} className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="font-medium text-xs">{item.key}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border/30 pt-3">
                  <p className="font-medium text-xs mb-1.5">Exemplo prático</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Uma cliente que comprou há 5 dias, fez 6 pedidos no total e tem alto LTV →{' '}
                    <span className="font-semibold text-emerald-600">Champions</span> (R=5, F=5, M=alto).
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">
                    Outra que não compra há 4 meses, mas tinha frequência regular →{' '}
                    <span className="font-semibold text-amber-600">At Risk</span> (R=2, F=3).
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          }
        >
          <div className="flex flex-col gap-3 mb-5">
            {rfmData.map(r => (
              <div key={r.segment}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />
                    {r.segment}
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {r.count}
                    <span className="text-muted-foreground text-xs ml-1">({r.pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    style={{ width: `${r.pct}%`, background: r.color }}
                    className="h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border/20 pt-4">
            <p className="text-xs text-muted-foreground mb-3">Mapa R×F — Recência × Frequência</p>
            <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(5, 1fr)' }}>
              <div />
              {[1, 2, 3, 4, 5].map(f => (
                <div key={f} className="text-center text-[10px] text-muted-foreground pb-1 font-mono">F={f}</div>
              ))}
              {[5, 4, 3, 2, 1].flatMap(r => [
                <div key={`rl-${r}`} className="text-[10px] text-muted-foreground flex items-center pr-1 font-mono">R={r}</div>,
                ...[1, 2, 3, 4, 5].map(f => {
                  const cell = rfmGrid[`${r}-${f}`]
                  const seg  = cell?.seg
                  const cnt  = cell?.count ?? 0
                  const rfmEntry = rfmData.find(rd => rd.segment === seg)
                  return (
                    <div
                      key={`${r}-${f}`}
                      className="rounded border border-border/20 flex flex-col items-center justify-center gap-0.5 min-h-10 text-center"
                      style={{ background: rfmEntry ? `${rfmEntry.bgColor}80` : undefined }}
                    >
                      <span className="text-[9px] leading-none" style={{ color: rfmEntry?.color }}>
                        {seg?.split(' ')[0] ?? ''}
                      </span>
                      {cnt > 0 && (
                        <span className="text-sm font-semibold leading-none" style={{ color: rfmEntry?.color }}>
                          {cnt}
                        </span>
                      )}
                    </div>
                  )
                }),
              ])}
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          title="Links Vendedora"
          description="Matriz vendedora × eventos do link /v/{slug}"
        >
          {sellerLinkFunnels.length > 0 ? (
            <div className="-mx-4 sm:-mx-5 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-40 bg-background">Vendedora</TableHead>
                    {SELLER_LINK_EVENT_COLUMNS.map((column) => (
                      <TableHead key={column.key} className="text-right whitespace-nowrap">
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellerLinkFunnels.map((seller) => {
                    const valuesByKey = Object.fromEntries(
                      seller.stages.map((stage) => [stage.key, stage.value]),
                    ) as Record<string, number>
                    const maxValue = Math.max(
                      1,
                      ...SELLER_LINK_EVENT_COLUMNS.map((column) => valuesByKey[column.key] ?? 0),
                    )

                    return (
                      <TableRow key={seller.sellerId || seller.sellerName}>
                        <TableCell className="sticky left-0 z-10 bg-background">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{seller.sellerName}</p>
                            {seller.sellerSlug ? (
                              <p className="truncate text-[11px] text-muted-foreground">/v/{seller.sellerSlug}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        {SELLER_LINK_EVENT_COLUMNS.map((column) => {
                          const value = valuesByKey[column.key] ?? 0
                          const intensity = value <= 0 ? 0 : Math.max(0.08, Math.min(0.42, value / maxValue))
                          return (
                            <TableCell key={column.key} className="text-right tabular-nums">
                              <span
                                className="inline-flex min-w-14 justify-end rounded-md px-2 py-1 text-sm font-medium"
                                style={{
                                  backgroundColor: value > 0 ? `rgba(99, 102, 241, ${intensity})` : undefined,
                                  color: value > 0 ? undefined : 'var(--muted-foreground)',
                                }}
                              >
                                {num(value)}
                              </span>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum tráfego de link de vendedora no período.
            </p>
          )}
        </AdminPanel>
      </div>

      {/* ── CLIENTES LINHA 2: TABELA ──────────────────────────────────────── */}
      <AdminPanel
        title="Todos os Clientes"
        action={canExportReports ? (
          <Button variant="outline" size="sm" onClick={exportCustomers} className="gap-1.5 h-8">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        ) : null}
      >
        <div className="-mx-4 sm:-mx-5 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>
                  <SortHead label="Estado" active={customerSort?.key === 'state'} dir={customerSort?.dir ?? 'asc'} onSort={() => toggleCustomerSort('state')} />
                </TableHead>
                <TableHead>
                  <SortHead label="Segmento" active={customerSort?.key === 'rfmSegment'} dir={customerSort?.dir ?? 'asc'} onSort={() => toggleCustomerSort('rfmSegment')} />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead label="Pedidos" active={customerSort?.key === 'totalOrders'} dir={customerSort?.dir ?? 'asc'} onSort={() => toggleCustomerSort('totalOrders')} className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead label="LTV" active={customerSort?.key === 'totalRevenue'} dir={customerSort?.dir ?? 'asc'} onSort={() => toggleCustomerSort('totalRevenue')} className="ml-auto" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead label="Ticket Médio" active={customerSort?.key === 'avgTicket'} dir={customerSort?.dir ?? 'asc'} onSort={() => toggleCustomerSort('avgTicket')} className="ml-auto" />
                </TableHead>
                <TableHead>
                  <SortHead label="Último Pedido" active={customerSort?.key === 'lastPurchaseAt'} dir={customerSort?.dir ?? 'asc'} onSort={() => toggleCustomerSort('lastPurchaseAt')} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageCustomers.length === 0 && isHydratingRaw ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Carregando clientes detalhados...
                  </TableCell>
                </TableRow>
              ) : (
                pageCustomers.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium leading-none">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{c.email}</p>
                    </TableCell>
                    <TableCell>{c.state}</TableCell>
                    <TableCell>
                      <Badge variant={RFM_BADGE[c.rfmSegment]}>{c.rfmSegment}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.totalOrders}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.totalRevenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.avgTicket)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {c.lastPurchaseAt
                        ? c.lastPurchaseAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
          <AdminPaginationControls
            currentPage={customerPage}
            totalPages={customerTotalPages}
            onPageChange={setCustomerPage}
            showing={{
              start: customerTotal === 0 ? 0 : ((customerPage - 1) * PAGE_SIZE) + 1,
              end: Math.min(customerTotal, customerPage * PAGE_SIZE),
              total: customerTotal,
            }}
          />
        </div>
      </AdminPanel>
        </TabsContent>

        <TabsContent value="retencao" className="space-y-4 lg:space-y-5">
      {/* ── RETENÇÃO: 4 KPIs numa linha ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard icon={RefreshCcw}  label="Taxa Recompra"   value={pct(totals.repeatRate * 100)} hint="2+ pedidos"    tone="success" />
        <AdminStatCard icon={Users}       label="Retenção 30d"    value={pct(retention30d)}            hint="compra recente" tone="info"   />
        <AdminStatCard icon={TrendingUp}  label="Cohort M1 Médio" value={pct(avgM1)}                  hint="retenção média"              />
        <AdminStatCard icon={Package}     label="Clientes Ativos" value={num(totals.activeCustomers)}  hint="status ativo"  tone="success" />
      </div>

      {/* ── RECOMPRAS | COHORT numa linha ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <AdminPanel title="Recompras por Mês" className="h-full">
          <ChartContainer config={recomprasConfig} className="h-48 w-full">
            <BarChart data={monthlyRecompras} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="recompras" name="Recompras" fill="var(--color-recompras)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="novos"     name="Novos"     fill="var(--color-novos)"     radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </AdminPanel>

        <AdminPanel
          title="Heatmap de Cohorts"
          className="h-full"
          action={canExportReports ? (
            <Button variant="outline" size="sm" onClick={exportRetention} className="gap-1.5 h-8">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          ) : null}
        >
          <div className="-mx-4 sm:-mx-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Cohort</TableHead>
                  {['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'].map(m => (
                    <TableHead key={m} className="text-center w-12">{m}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortData.map(row => (
                  <TableRow key={row.cohort}>
                    <TableCell className="text-xs font-medium">{row.cohort}</TableCell>
                    {Array.from({ length: 8 }).map((_, ci) => {
                      const v = row.months[ci] ?? null
                      return (
                        <TableCell key={ci} className="text-center p-1">
                          {v !== null && (
                            <span className={cn(
                              'inline-flex items-center justify-center w-10 h-6 rounded text-xs font-mono',
                              cohortCellClass(v, ci)
                            )}>
                              {v}%
                            </span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/20">
            {[
              { label: '≥ 70%',  cls: 'bg-emerald-100 text-emerald-700' },
              { label: '40–69%', cls: 'bg-amber-100 text-amber-700'     },
              { label: '< 40%',  cls: 'bg-rose-100 text-rose-700'       },
              { label: 'M0',     cls: 'bg-primary/10 text-primary'       },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={cn('h-4 w-6 rounded text-[10px] inline-flex items-center justify-center', item.cls)}>
                  {item.label === 'M0' ? 'M0' : ''}
                </span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>
        </TabsContent>

        <TabsContent value="trafego" className="space-y-4 lg:space-y-5">
      {/* ── TRÁFEGO (2/3) | APROVAÇÃO (1/3) ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminPanel
          title="Origens de Tráfego"
          description="Dados de exemplo — conecte GA4 ou UTM backend"
          className="md:col-span-2"
          action={canExportReports ? (
            <Button variant="outline" size="sm" onClick={exportTraffic} className="gap-1.5 h-8">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          ) : null}
        >
          <div className="-mx-4 sm:-mx-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="text-right">Sessões</TableHead>
                  <TableHead className="text-right">Solicitados</TableHead>
                  <TableHead className="text-right">Aprovados</TableHead>
                  <TableHead className="text-right">Conv. Sol.%</TableHead>
                  <TableHead className="text-right">Conv. Apr.%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TRAFFIC_SOURCES.map(t => (
                  <TableRow key={t.source}>
                    <TableCell className="font-medium">{t.source}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(t.sessions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.solicitados}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{t.aprovados}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">
                      {(t.solicitados / t.sessions * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {(t.aprovados / t.sessions * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AdminPanel>

        <AdminPanel title="Taxa de Aprovação">
          <div className="flex flex-col gap-5">
            {approvalRates.map((item, i) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground leading-tight">{item.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{item.val.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(item.val, 100)}%`, background: BRAND, opacity: i === 0 ? 0.5 : i === 1 ? 0.75 : 1 }}
                  />
                </div>
              </div>
            ))}

            <div className="rounded-xl bg-muted/50 p-4 mt-1">
              <p className="text-[11px] text-muted-foreground mb-1">Total de Sessões</p>
              <p className="text-2xl font-semibold tabular-nums">{num(TRAFFIC_TOTAL_SESSIONS)}</p>
            </div>
          </div>
        </AdminPanel>
      </div>
        </TabsContent>

        <TabsContent value="geografia" className="space-y-4 lg:space-y-5">
      {/* ── GEOGRAFIA ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminPanel title="Mapa de Clientes" description="Distribuição geográfica por estado" className="md:col-span-2">
          <BrazilMap geoData={geoData} maxCustomers={maxGeoCustomers} />
        </AdminPanel>

        <div className="flex flex-col gap-4">
          <AdminPanel title="Por Estado">
            <ChartContainer config={geoChartConfig} className="w-full" style={{ height: `${Math.min(geoData.length, 8) * 44 + 16}px` }}>
              <BarChart layout="vertical" data={geoData.slice(0, 8)} margin={{ right: 40, left: 0, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} />
                <YAxis dataKey="stateCode" type="category" tickLine={false} axisLine={false} hide />
                <XAxis dataKey="customers" type="number" hide />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Bar dataKey="customers" name="Clientes" fill="var(--color-customers)" radius={4}>
                  <LabelList dataKey="stateCode" position="insideLeft" offset={8} className="fill-(--color-label)" fontSize={11} fontWeight={600} />
                  <LabelList dataKey="customers" position="right" offset={6} className="fill-foreground" fontSize={11} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </AdminPanel>

          <AdminPanel title="Top Cidades">
            <div className="flex flex-col divide-y divide-border/20">
              {topCities.map((c, i) => (
                <div key={`${c.city}-${c.state}`} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none truncate">{c.city}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.state} · {c.customers} cliente{c.customers !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground shrink-0">{brl(c.revenue)}</span>
                </div>
              ))}
            </div>
          </AdminPanel>
        </div>
      </div>
        </TabsContent>
      </Tabs>

    </AdminPage>
  )
}
