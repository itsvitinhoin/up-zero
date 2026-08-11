'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  FilterX,
  Link2,
  Link2Off,
  Package,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from 'lucide-react'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import DatePeriodFilter from '@/components/admin/date-period-filter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  OfflineOrderRow,
  OfflineOrdersSummary,
  OfflineSellerRow,
} from '@/lib/actions/offline'
import { getDateRangeForPreset } from '@/lib/date-period-presets'
import { formatOfflineMoney, parseOfflinePageLimit } from '@/lib/offline-page-utils'
import { usePaginationMeta } from '@/hooks/use-paginated-list'

const STATUS_OPTIONS = [
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'SHIPPED', label: 'Enviado' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'PROCESSING', label: 'Processando' },
] as const

function statusTone(status?: string | null): {
  dot: string
  badge: 'amber' | 'emerald' | 'rose' | 'sky' | 'blue' | 'slate'
  label: string
} {
  const normalized = String(status || '').trim().toUpperCase()
  if (!normalized) return { dot: 'bg-slate-300', badge: 'slate', label: '-' }
  if (normalized.includes('CANCEL')) return { dot: 'bg-rose-500', badge: 'rose', label: status || 'Cancelado' }
  if (normalized.includes('DELIVER') || normalized.includes('ENTREG')) {
    return { dot: 'bg-emerald-500', badge: 'emerald', label: status || 'Entregue' }
  }
  if (normalized.includes('SHIP') || normalized.includes('ENVIA')) {
    return { dot: 'bg-sky-500', badge: 'sky', label: status || 'Enviado' }
  }
  if (normalized.includes('PROCESS') || normalized.includes('CONFIRM')) {
    return { dot: 'bg-blue-500', badge: 'blue', label: status || normalized }
  }
  if (normalized.includes('PEND')) return { dot: 'bg-amber-500', badge: 'amber', label: status || 'Pendente' }
  return { dot: 'bg-slate-400', badge: 'slate', label: status || normalized }
}

function formatOrderDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

interface OfflineOrdersPageClientProps {
  initialOrders: OfflineOrderRow[]
  initialSellers: OfflineSellerRow[]
  initialSummary: OfflineOrdersSummary
  total: number
  currentPage: number
  pageSize: number
  initialSearch: string
  initialStatus: string
  initialSellerId: string
  initialFromDate: string
  initialToDate: string
  error?: string | null
}

export function OfflineOrdersPageClient({
  initialOrders,
  initialSellers,
  initialSummary,
  total,
  currentPage,
  pageSize,
  initialSearch,
  initialStatus,
  initialSellerId,
  initialFromDate,
  initialToDate,
  error,
}: OfflineOrdersPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [orders, setOrders] = useState(initialOrders)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [sellerFilter, setSellerFilter] = useState(initialSellerId)
  const [fromDate, setFromDate] = useState(initialFromDate)
  const [toDate, setToDate] = useState(initialToDate)
  const [selectedLimit, setSelectedLimit] = useState(parseOfflinePageLimit(pageSize))
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const totalItems = Math.max(0, Number(total) || 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(selectedLimit, 1)))
  const { safeCurrentPage, pageStart, pageEnd } = usePaginationMeta({
    currentPage,
    pageSize: selectedLimit,
    totalItems,
    currentPageItemCount: orders.length,
  })

  const defaultDateRange = getDateRangeForPreset('30d')
  const avgTicketCents =
    initialSummary.total > 0
      ? Math.round(initialSummary.totalValueCents / initialSummary.total)
      : 0

  const hasActiveFilter = searchInput.trim().length > 0
    || statusFilter !== 'all'
    || sellerFilter !== 'all'
    || fromDate !== defaultDateRange.from
    || toDate !== defaultDateRange.to

  const hasAppliedFilter = initialSearch.trim().length > 0
    || initialStatus !== 'all'
    || initialSellerId !== 'all'
    || initialFromDate !== defaultDateRange.from
    || initialToDate !== defaultDateRange.to

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  useEffect(() => {
    setSearchInput(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setStatusFilter(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    setSellerFilter(initialSellerId)
  }, [initialSellerId])

  useEffect(() => {
    setFromDate(initialFromDate)
  }, [initialFromDate])

  useEffect(() => {
    setToDate(initialToDate)
  }, [initialToDate])

  useEffect(() => {
    setSelectedLimit(parseOfflinePageLimit(pageSize))
  }, [pageSize])

  function buildQuery(
    nextSearch: string,
    nextStatus: string,
    nextSeller: string,
    nextPage: number,
    nextFrom?: string,
    nextTo?: string,
    nextLimit?: number,
  ) {
    const params = new URLSearchParams()
    const normalizedSearch = nextSearch.trim()
    const normalizedStatus = nextStatus.trim()
    const normalizedSeller = nextSeller.trim()
    const resolvedLimit = parseOfflinePageLimit(nextLimit ?? selectedLimit)
    const resolvedFrom = nextFrom ?? fromDate
    const resolvedTo = nextTo ?? toDate

    if (normalizedSearch) params.set('q', normalizedSearch)
    if (normalizedStatus && normalizedStatus !== 'all') params.set('status', normalizedStatus)
    if (normalizedSeller && normalizedSeller !== 'all') params.set('seller', normalizedSeller)
    if (resolvedFrom) params.set('from', resolvedFrom)
    if (resolvedTo) params.set('to', resolvedTo)
    if (!resolvedFrom && !resolvedTo) params.set('period', 'all')
    if (resolvedLimit !== 20) params.set('limit', String(resolvedLimit))
    if (nextPage > 1) params.set('page', String(nextPage))

    return params.toString()
  }

  function applyFilters(
    nextSearch: string,
    nextStatus: string,
    nextSeller: string,
    nextFrom?: string,
    nextTo?: string,
    nextLimit?: number,
  ) {
    const query = buildQuery(nextSearch, nextStatus, nextSeller, 1, nextFrom, nextTo, nextLimit)
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function goToPage(page: number) {
    const nextPage = Math.max(1, Math.min(totalPages, page))
    const query = buildQuery(
      initialSearch,
      initialStatus,
      initialSellerId,
      nextPage,
      initialFromDate,
      initialToDate,
      selectedLimit,
    )
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function clearFilters() {
    setSearchInput('')
    setStatusFilter('all')
    setSellerFilter('all')
    setFromDate(defaultDateRange.from)
    setToDate(defaultDateRange.to)
    setMobileFiltersOpen(false)
    const query = buildQuery(
      '',
      'all',
      'all',
      1,
      defaultDateRange.from,
      defaultDateRange.to,
      selectedLimit,
    )
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function handleDatePeriodChange(nextFromDate: string, nextToDate: string) {
    setFromDate(nextFromDate)
    setToDate(nextToDate)
    applyFilters(searchInput, statusFilter, sellerFilter, nextFromDate, nextToDate)
  }

  function handleSearchSubmit() {
    applyFilters(searchInput, statusFilter, sellerFilter, fromDate, toDate)
  }

  const filterControls = (
    <>
      <Select
        value={statusFilter}
        onValueChange={(nextStatus) => {
          setStatusFilter(nextStatus)
          applyFilters(searchInput, nextStatus, sellerFilter, fromDate, toDate)
        }}
      >
        <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sellerFilter}
        onValueChange={(nextSeller) => {
          setSellerFilter(nextSeller)
          applyFilters(searchInput, statusFilter, nextSeller, fromDate, toDate)
        }}
      >
        <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-44">
          <SelectValue placeholder="Vendedora" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas vendedoras</SelectItem>
          {initialSellers.map((seller) => (
            <SelectItem key={seller.id} value={String(seller.id)}>
              {seller.name || `Vendedora #${seller.id}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DatePeriodFilter
        fromDate={fromDate}
        toDate={toDate}
        onChange={handleDatePeriodChange}
      />

      <Select
        value={String(selectedLimit)}
        onValueChange={(value) => {
          const nextLimit = Number.parseInt(value, 10)
          if (!Number.isFinite(nextLimit)) return
          setSelectedLimit(nextLimit)
          applyFilters(searchInput, statusFilter, sellerFilter, fromDate, toDate, nextLimit)
        }}
      >
        <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
          <SelectValue placeholder="Itens/pagina" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="20">20 por pagina</SelectItem>
          <SelectItem value="50">50 por pagina</SelectItem>
          <SelectItem value="100">100 por pagina</SelectItem>
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={clearFilters}
        className="h-10 w-10 shrink-0 rounded-full"
        aria-label="Limpar filtros"
        title="Limpar filtros"
        disabled={!hasActiveFilter}
      >
        <FilterX className="h-4 w-4" />
      </Button>
    </>
  )

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
              <ShoppingBag className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Offline
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              <ShoppingBag className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              Pedidos Offline
            </h1>
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground sm:text-sm">
              {hasAppliedFilter
                ? `${formatOfflineMoney(initialSummary.totalValueCents)} em ${totalItems} pedidos com os filtros atuais.`
                : `${formatOfflineMoney(initialSummary.totalValueCents)} em ${totalItems} pedidos sincronizados do ERP.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full md:hidden"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Abrir filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="right">
        <DrawerContent className="max-w-none flex flex-col data-[vaul-drawer-direction=right]:w-[80vw] sm:data-[vaul-drawer-direction=right]:w-[80vw]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine a lista de pedidos offline no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID ERP, cliente ou vendedora..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearchSubmit()
                  }
                }}
                className="h-10 rounded-full pl-10 pr-24"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute right-1 top-1/2 h-8 -translate-y-1/2 rounded-full"
                onClick={handleSearchSubmit}
              >
                Buscar
              </Button>
            </div>
            {filterControls}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" className="w-full cursor-pointer bg-black text-white hover:bg-black/90">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">
                Valor Total
              </p>
              <p className="mt-2 whitespace-nowrap text-lg font-semibold leading-none tracking-tight sm:text-2xl">
                {formatOfflineMoney(initialSummary.totalValueCents)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{initialSummary.total} pedidos</p>
            </div>
            <div className="mt-0.5 shrink-0 rounded-full bg-emerald-100 p-2 text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">
                Ticket Médio
              </p>
              <p className="mt-2 whitespace-nowrap text-lg font-semibold leading-none tracking-tight sm:text-2xl">
                {formatOfflineMoney(avgTicketCents)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">por pedido</p>
            </div>
            <div className="mt-0.5 shrink-0 rounded-full bg-slate-100 p-2 text-slate-700">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">
                Com Vendedora
              </p>
              <p className="mt-2 text-lg font-semibold leading-none tracking-tight sm:text-2xl">
                {initialSummary.withSeller}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">pedidos atribuídos</p>
            </div>
            <div className="mt-0.5 shrink-0 rounded-full bg-sky-100 p-2 text-sky-700">
              <Link2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-sky-300 to-sky-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-[11px] sm:tracking-[0.18em]">
                Sem Vendedora
              </p>
              <p className="mt-2 text-lg font-semibold leading-none tracking-tight sm:text-2xl">
                {initialSummary.withoutSeller}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">sem atribuição</p>
            </div>
            <div className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-2 text-amber-700">
              <Link2Off className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-amber-300 to-amber-500" />
        </div>
      </div>

      <form
        className="hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm md:block"
        onSubmit={(e) => {
          e.preventDefault()
          handleSearchSubmit()
        }}
      >
        <div className="flex w-full flex-col items-stretch gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 xl:max-w-xl">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID ERP, cliente ou vendedora..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-10 rounded-full pl-10"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" className="h-10 shrink-0 rounded-full px-5">
              Buscar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">{filterControls}</div>
        </div>
      </form>

      <div className="rounded-2xl border border-border/40 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="font-medium">Status do Pedido:</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" />Pendente</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-300" />Processando</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-300" />Enviado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />Entregue</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-300" />Cancelado</span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm md:block">
        {orders.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Nenhum pedido offline encontrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/20 bg-muted/60">
                <TableHead className="w-6" />
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vendedora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const tone = statusTone(order.status)
                return (
                  <TableRow
                    key={order.id}
                    className="odd:bg-background even:bg-muted/25 hover:bg-muted/40"
                  >
                    <TableCell>
                      <span className={`block h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatOrderDate(order.orderDate)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{order.offlineCustomerName || '-'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium">
                        {formatOfflineMoney(order.totalCents)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm">{order.itemsCount}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tone.badge} className="text-xs font-medium">
                        {tone.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.offlineSellerName ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {order.offlineSellerName
                              .split(' ')
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join('')
                              .toUpperCase()}
                          </div>
                          <span className="text-sm">{order.offlineSellerName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="space-y-3 md:hidden">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum pedido offline encontrado
          </div>
        ) : (
          orders.map((order) => {
            const tone = statusTone(order.status)
            return (
              <div key={order.id} className="space-y-3 rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{order.offlineCustomerName || 'Sem cliente'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatOrderDate(order.orderDate)}
                    </p>
                  </div>
                  <Badge variant={tone.badge} className="text-xs">
                    {tone.label}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{order.offlineSellerName || 'Sem vendedora'}</p>
                  <p className="font-medium text-foreground">
                    {formatOfflineMoney(order.totalCents)} · {order.itemsCount} itens
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <AdminPaginationControls
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
        showing={{
          start: pageStart,
          end: pageEnd,
          total: totalItems,
        }}
      />
    </div>
  )
}
