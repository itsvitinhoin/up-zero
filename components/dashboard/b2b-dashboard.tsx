'use client'

import { useMemo, useState } from 'react'
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
import type { DRFMSegment, DCurve } from '@/lib/dashboard-mock-data'
import {
  AdminPage, AdminHero, AdminStatGrid, AdminStatCard,
  AdminPanel, AdminToolbar,
} from '@/components/admin/admin-mobile-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import { usePaginatedList } from '@/hooks/use-paginated-list'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const BrazilMap = dynamic(() => import('./brazil-map'), { ssr: false })

// ── Formatters ─────────────────────────────────────────────────────────────────
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)
const num = (v: number) => new Intl.NumberFormat('pt-BR').format(v)
const pct = (v: number) => `${v.toFixed(1)}%`

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

// ── Chart configs ──────────────────────────────────────────────────────────────
const revenueConfig: ChartConfig = {
  requested: { label: 'Solicitado', color: BRAND },
  fulfilled:  { label: 'Atendido',  color: `${BRAND}66` },
}
const recomprasConfig: ChartConfig = {
  recompras: { label: 'Recompras', color: BRAND },
  novos:     { label: 'Novos',     color: `${BRAND}66` },
}
const sellerChartConfig = {
  revenue: { label: 'Receita', color: BRAND },
  label:   { color: 'var(--background)' },
} satisfies ChartConfig

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

const SIZE_DATA = [
  { size: 'PP', pct: 8  },
  { size: 'P',  pct: 22 },
  { size: 'M',  pct: 35 },
  { size: 'G',  pct: 24 },
  { size: 'GG', pct: 11 },
]

const COLOR_SALES_DATA = [
  { color: 'Preto',  hex: '#1c1c1c', pct: 32 },
  { color: 'Branco', hex: '#d4d4d4', pct: 21 },
  { color: 'Rosa',   hex: '#f472b6', pct: 18 },
  { color: 'Azul',   hex: '#60a5fa', pct: 14 },
  { color: 'Verde',  hex: '#4ade80', pct: 10 },
  { color: 'Outros', hex: '#94a3b8', pct: 5  },
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function B2BDashboard({
  dateRange, setDateRange,
}: {
  dateRange:    DateRange | undefined
  setDateRange: (r: DateRange | undefined) => void
}) {
  const {
    orders, customers, products, periodOrders, monthlyRevenue,
    rfmData, cohortData, funnelData, geoData, totals, isLoading,
    periodStart, periodEnd,
  } = useDashboardData()

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [sellerFilter, setSellerFilter]   = useState('all')
  const [stateFilter,  setStateFilter]    = useState('all')
  const [customerSearch, setCustomerSearch] = useState('')

  // ── Pagination ────────────────────────────────────────────────────────────────
  const [productPage,  setProductPage]  = useState(1)
  const [customerPage, setCustomerPage] = useState(1)

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
        id: 'pending-orders', type: 'warning', Icon: ShoppingCart, href: '/orders',
        title: `${pendingOrders.length} pedido${pendingOrders.length !== 1 ? 's' : ''} pendente${pendingOrders.length !== 1 ? 's' : ''}`,
        message: 'Aguardando processamento · Toque para ver',
      })
    if (pendingRegs.length > 0)
      result.push({
        id: 'pending-regs', type: 'danger', Icon: AlertCircle, href: '/customers',
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

  // ── Retention 30d ─────────────────────────────────────────────────────────────
  const retention30d = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
    const recent    = customers.filter(c => c.lastPurchaseAt && c.lastPurchaseAt >= cutoff)
    const returning = recent.filter(c => c.totalOrders > 1)
    return recent.length > 0 ? (returning.length / recent.length) * 100 : 0
  }, [customers])

  // ── Avg items per order ───────────────────────────────────────────────────────
  const avgItems = useMemo(() => {
    if (periodOrders.length === 0) return 0
    return periodOrders.reduce((s, o) => s + o.items, 0) / periodOrders.length
  }, [periodOrders])

  // ── Monthly recompras (last 6) ────────────────────────────────────────────────
  const monthlyRecompras = useMemo(() =>
    monthlyRevenue
      .map(m => ({ month: m.month, recompras: m.returningCustomers, novos: m.newCustomers }))
      .slice(-6),
    [monthlyRevenue]
  )

  // ── Category breakdown ────────────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map: Record<string, { requested: number; fulfilled: number }> = {}
    products.forEach(p => {
      if (!map[p.category]) map[p.category] = { requested: 0, fulfilled: 0 }
      map[p.category].requested += p.revenueRequested
      map[p.category].fulfilled += p.revenueFulfilled
    })
    return Object.entries(map)
      .map(([name, d]) => ({
        name, ...d,
        fulfillRate: d.requested > 0 ? (d.fulfilled / d.requested) * 100 : 0,
      }))
      .sort((a, b) => b.requested - a.requested)
  }, [products])

  // ── ABC sorted products ───────────────────────────────────────────────────────
  const abcProducts = useMemo(() =>
    [...products].sort((a, b) => {
      const order: Record<DCurve, number> = { A: 0, B: 1, C: 2 }
      const diff = order[a.curve] - order[b.curve]
      return diff !== 0 ? diff : b.revenueRequested - a.revenueRequested
    }),
    [products]
  )

  // ── ABC summary ───────────────────────────────────────────────────────────────
  const abcSummary = useMemo(() => {
    const curves: Record<DCurve, { count: number; revenue: number }> = {
      A: { count: 0, revenue: 0 }, B: { count: 0, revenue: 0 }, C: { count: 0, revenue: 0 },
    }
    abcProducts.forEach(p => {
      curves[p.curve].count++
      curves[p.curve].revenue += p.revenueRequested
    })
    return (['A', 'B', 'C'] as DCurve[]).map(c => ({ curve: c, ...curves[c] }))
  }, [abcProducts])

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

  // ── Sales by seller ───────────────────────────────────────────────────────────
  const salesBySeller = useMemo(() => {
    const map: Record<string, number> = {}
    customers.forEach(c => {
      const seller = (c as typeof c & { assignedSellerName?: string }).assignedSellerName ?? 'Sem vendedora'
      map[seller] = (map[seller] ?? 0) + c.totalRevenue
    })
    return Object.entries(map)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [customers])

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

  // ── Pagination ────────────────────────────────────────────────────────────────
  const {
    paginatedItems: pagedProducts,
    totalPages: productTotalPages,
    pageStart: productStart,
    pageEnd: productEnd,
  } = usePaginatedList({ items: sortedProducts, currentPage: productPage, pageSize: PAGE_SIZE })

  const {
    paginatedItems: pagedCustomers,
    totalPages: customerTotalPages,
    pageStart: customerStart,
    pageEnd: customerEnd,
  } = usePaginatedList({ items: sortedCustomers, currentPage: customerPage, pageSize: PAGE_SIZE })

  // ── CSV exports ───────────────────────────────────────────────────────────────
  function exportKpis() {
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
    downloadCSV([
      ['Nome', 'SKU', 'Categoria', 'Curva', 'Solicitado', 'Atendido', 'Unidades', 'Estoque', 'Dias Estoque'],
      ...abcProducts.map(p => [p.name, p.sku, p.category, p.curve, p.revenueRequested, p.revenueFulfilled, p.unitsRequested, p.stock, p.daysLeft]),
    ], `dashboard_produtos_${TODAY_STR}.csv`)
  }
  function exportCustomers() {
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
    downloadCSV([
      ['Cohort', 'M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'],
      ...cohortData.map(r => [r.cohort, ...r.months.map(v => v ?? '')]),
    ], `dashboard_retencao_${TODAY_STR}.csv`)
  }
  function exportTraffic() {
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
    exportKpis(); exportProducts(); exportCustomers(); exportRetention(); exportTraffic()
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AdminPage>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <AdminHero
        icon={BarChart3}
        eyebrow="Dashboard"
        title="Visão geral"
        description={`${num(totals.totalOrders)} pedidos • ${brl(totals.totalRequested)} em solicitações`}
        actions={
          <Button variant="outline" onClick={exportAll} className="min-h-12 gap-2 rounded-2xl">
            <Download className="h-4 w-4" />
            Exportar tudo
          </Button>
        }
      />

      {/* ── FILTROS ────────────────────────────────────────────────────────── */}
      <AdminToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="min-h-12 rounded-2xl gap-2 justify-start shrink-0 min-w-[220px] font-normal"
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
            <SelectTrigger className="min-h-12 rounded-2xl w-[170px] shrink-0">
              <SelectValue placeholder="Vendedora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas vendedoras</SelectItem>
              {sellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="min-h-12 rounded-2xl w-[150px] shrink-0">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estados</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px]">
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

      {isLoading && (
        <p className="text-center text-sm text-muted-foreground py-4">Carregando dados…</p>
      )}

      {/* ── KPI BAR ────────────────────────────────────────────────────────── */}
      <AdminStatGrid>
        <AdminStatCard icon={DollarSign}    label="Rec. Solicitada"       value={brl(totals.totalRequested)}                       hint={`${num(totals.totalOrders)} pedidos`} />
        <AdminStatCard icon={TrendingUp}    label="Rec. Atendida"         value={brl(totals.totalFulfilled)}                       hint={pct(totals.fulfillmentRate) + ' atend.'} tone="success" />
        <AdminStatCard icon={ShoppingCart}  label="Pedidos"               value={num(totals.totalOrders)}                          hint={`${totals.pendingOrders} pendentes`} tone="warning" />
        <AdminStatCard icon={ArrowUpRight}  label="Ticket Médio"          value={brl(totals.avgTicket)}                            hint="por pedido" />
        <AdminStatCard icon={Users}         label="Clientes Ativos"       value={num(totals.activeCustomers)}                      hint={`de ${num(customers.length)} total`} tone="info" />
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

      {/* ── PRODUTOS LINHA 1: ABC | CATEGORIA | TAXA ATEND. ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminPanel title="Curva ABC" description="Receita por classificação de produto">
          <ChartContainer config={abcChartConfig} className="w-full" style={{ height: `${abcChartData.length * 52 + 16}px` }}>
            <BarChart layout="vertical" data={abcChartData} margin={{ right: 72, left: 0, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} hide />
              <XAxis dataKey="revenue" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(v) => brl(v as number)} />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4}>
                <LabelList dataKey="name" position="insideLeft" offset={10} className="fill-(--color-label)" fontSize={12} fontWeight={500} />
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
          <ChartContainer config={categoryChartConfig} className="w-full" style={{ height: `${categoryChartData.length * 52 + 16}px` }}>
            <BarChart layout="vertical" data={categoryChartData} margin={{ right: 8, left: 0, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} hide />
              <XAxis dataKey="requested" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(v) => brl(v as number)} />} />
              <Bar dataKey="requested" name="Solicitado" fill="var(--color-requested)" radius={[4, 4, 4, 4]}>
                <LabelList dataKey="name" position="insideLeft" offset={10} className="fill-(--color-label)" fontSize={12} fontWeight={500} />
              </Bar>
              <Bar dataKey="fulfilled" name="Atendido" fill="var(--color-fulfilled)" radius={[4, 4, 4, 4]} />
            </BarChart>
          </ChartContainer>
        </AdminPanel>

        <AdminPanel title="Taxa de Atendimento" description="Geral do período">
          <ChartContainer config={fulfillmentConfig} className="mx-auto aspect-square max-h-[250px]">
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
        <AdminPanel title="Vendas por Cor" description="Participação por cor (amostra)">
          <ChartContainer config={colorChartConfig} className="w-full" style={{ height: `${COLOR_SALES_DATA.length * 52 + 16}px` }}>
            <BarChart layout="vertical" data={COLOR_SALES_DATA} margin={{ right: 52, left: 0, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="color" type="category" tickLine={false} axisLine={false} hide />
              <XAxis dataKey="pct" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(v) => `${v}%`} />} />
              <Bar dataKey="pct" radius={4}>
                {COLOR_SALES_DATA.map((entry) => (
                  <Cell key={entry.color} fill={entry.hex} fillOpacity={0.85} />
                ))}
                <LabelList dataKey="color" position="insideLeft" offset={10} className="fill-background" fontSize={12} fontWeight={500} />
                <LabelList dataKey="pct" position="right" offset={8} className="fill-foreground" fontSize={11}
                  formatter={(v: unknown) => `${v}%`} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </AdminPanel>

        <AdminPanel title="Vendas por Tamanho" description="Participação por grade (amostra)">
          <ChartContainer config={sizeChartConfig} className="mx-auto aspect-square max-h-[250px]">
            <RadarChart data={SIZE_DATA}>
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
        </AdminPanel>
      </div>

      {/* ── PRODUTOS LINHA 3: TABELA COMPLETA ────────────────────────────── */}
      <AdminPanel
        title="Todos os Produtos (Curva ABC)"
        action={
          <Button variant="outline" size="sm" onClick={exportProducts} className="gap-1.5 h-8">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        }
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
              {pagedProducts.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium max-w-[180px] truncate">{p.name}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
          <AdminPaginationControls
            currentPage={productPage}
            totalPages={productTotalPages}
            onPageChange={setProductPage}
            showing={{ start: productStart, end: productEnd, total: abcProducts.length }}
          />
        </div>
      </AdminPanel>

      {/* ── RETENÇÃO: 4 KPIs numa linha ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard icon={RefreshCcw}  label="Taxa Recompra"   value={pct(totals.repeatRate * 100)} hint="2+ pedidos"    tone="success" />
        <AdminStatCard icon={Users}       label="Retenção 30d"    value={pct(retention30d)}            hint="compra recente" tone="info"   />
        <AdminStatCard icon={TrendingUp}  label="Cohort M1 Médio" value={pct(avgM1)}                  hint="retenção média"              />
        <AdminStatCard icon={Package}     label="Clientes Ativos" value={num(totals.activeCustomers)}  hint="status ativo"  tone="success" />
      </div>

      {/* ── RECOMPRAS | COHORT numa linha ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <AdminPanel title="Recompras por Mês">
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
          action={
            <Button variant="outline" size="sm" onClick={exportRetention} className="gap-1.5 h-8">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          }
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

        <AdminPanel title="Vendas por Vendedora">
          <ChartContainer
            config={sellerChartConfig}
            className="w-full"
            style={{ height: `${salesBySeller.length * 52 + 16}px` }}
          >
            <BarChart
              layout="vertical"
              data={salesBySeller}
              margin={{ right: 80, left: 0, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} hide />
              <XAxis dataKey="revenue" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(v) => brl(v as number)} />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4}>
                <LabelList dataKey="name" position="insideLeft" offset={10} className="fill-(--color-label)" fontSize={12} fontWeight={500} />
                <LabelList dataKey="revenue" position="right" offset={8} className="fill-foreground" fontSize={11}
                  formatter={(v: unknown) => brl(v as number)} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </AdminPanel>
      </div>

      {/* ── CLIENTES LINHA 2: TABELA ──────────────────────────────────────── */}
      <AdminPanel
        title="Todos os Clientes"
        action={
          <Button variant="outline" size="sm" onClick={exportCustomers} className="gap-1.5 h-8">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        }
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
              {pagedCustomers.map(c => (
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
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
          <AdminPaginationControls
            currentPage={customerPage}
            totalPages={customerTotalPages}
            onPageChange={setCustomerPage}
            showing={{ start: customerStart, end: customerEnd, total: filteredCustomers.length }}
          />
        </div>
      </AdminPanel>

      {/* ── TRÁFEGO (2/3) | APROVAÇÃO (1/3) ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminPanel
          title="Origens de Tráfego"
          description="Dados de exemplo — conecte GA4 ou UTM backend"
          className="md:col-span-2"
          action={
            <Button variant="outline" size="sm" onClick={exportTraffic} className="gap-1.5 h-8">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          }
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

    </AdminPage>
  )
}
