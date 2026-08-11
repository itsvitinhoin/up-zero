'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Check,
  Copy,
  Factory,
  FilterX,
  Link2,
  Search,
  SlidersHorizontal,
  Store,
  UserCog,
  Users,
} from 'lucide-react'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import DatePeriodFilter from '@/components/admin/date-period-filter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import type { OfflineCustomerRow, OfflineCustomersSummary, OfflineSellerRow } from '@/lib/actions/offline'
import { formatCNPJorCPF, formatPhoneNumber } from '@/lib/format'
import { parseOfflinePageLimit } from '@/lib/offline-page-utils'
import { usePaginationMeta } from '@/hooks/use-paginated-list'

const customerTypeMap: Record<string, string> = {
  RETAIL: 'Varejo',
  WHOLESALE: 'Atacado',
}

const customerTypeBadgeVariant: Record<string, 'outline' | 'sky' | 'violet'> = {
  RETAIL: 'sky',
  WHOLESALE: 'violet',
}

interface OfflineCustomersPageClientProps {
  initialCustomers: OfflineCustomerRow[]
  initialSellers: OfflineSellerRow[]
  initialSummary: OfflineCustomersSummary
  total: number
  currentPage: number
  pageSize: number
  initialSearch: string
  initialType: string
  initialSellerId: string
  initialFromDate: string
  initialToDate: string
  error?: string | null
}

function formatCadastroDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function OfflineCustomersPageClient({
  initialCustomers,
  initialSellers,
  initialSummary,
  total,
  currentPage,
  pageSize,
  initialSearch,
  initialType,
  initialSellerId,
  initialFromDate,
  initialToDate,
  error,
}: OfflineCustomersPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [customers, setCustomers] = useState(initialCustomers)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [sellerFilter, setSellerFilter] = useState(initialSellerId)
  const [fromDate, setFromDate] = useState(initialFromDate)
  const [toDate, setToDate] = useState(initialToDate)
  const [selectedLimit, setSelectedLimit] = useState(parseOfflinePageLimit(pageSize))
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const totalItems = Math.max(0, Number(total) || 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(selectedLimit, 1)))
  const {
    safeCurrentPage,
    pageStart,
    pageEnd,
  } = usePaginationMeta({
    currentPage,
    pageSize: selectedLimit,
    totalItems,
    currentPageItemCount: customers.length,
  })

  const hasActiveFilter = searchInput.trim().length > 0
    || typeFilter !== 'all'
    || sellerFilter !== 'all'
    || fromDate.length > 0
    || toDate.length > 0

  const hasAppliedFilter = initialSearch.trim().length > 0
    || initialType !== 'all'
    || initialSellerId !== 'all'
    || initialFromDate.length > 0
    || initialToDate.length > 0

  useEffect(() => {
    setCustomers(initialCustomers)
  }, [initialCustomers])

  useEffect(() => {
    setSearchInput(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setTypeFilter(initialType)
  }, [initialType])

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
    nextType: string,
    nextSeller: string,
    nextPage: number,
    nextFrom?: string,
    nextTo?: string,
    nextLimit?: number,
  ) {
    const params = new URLSearchParams()
    const normalizedSearch = nextSearch.trim()
    const normalizedType = nextType.trim().toUpperCase()
    const normalizedSeller = nextSeller.trim()
    const resolvedLimit = parseOfflinePageLimit(nextLimit ?? selectedLimit)

    if (normalizedSearch) params.set('q', normalizedSearch)
    if (normalizedType && normalizedType !== 'ALL') params.set('type', normalizedType)
    if (normalizedSeller && normalizedSeller !== 'all') params.set('seller', normalizedSeller)

    const resolvedFrom = nextFrom ?? fromDate
    const resolvedTo = nextTo ?? toDate
    if (resolvedFrom) {
      params.set('from', resolvedFrom)
    }
    if (resolvedTo) {
      params.set('to', resolvedTo)
    }
    if (!resolvedFrom && !resolvedTo) {
      params.set('period', 'all')
    }
    if (resolvedLimit !== 20) params.set('limit', String(resolvedLimit))
    if (nextPage > 1) params.set('page', String(nextPage))

    return params.toString()
  }

  function applyFilters(
    nextSearch: string,
    nextType: string,
    nextSeller: string,
    nextFrom?: string,
    nextTo?: string,
    nextLimit?: number,
  ) {
    const query = buildQuery(nextSearch, nextType, nextSeller, 1, nextFrom, nextTo, nextLimit)
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function goToPage(page: number) {
    const nextPage = Math.max(1, Math.min(totalPages, page))
    const query = buildQuery(
      initialSearch,
      initialType,
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
    setTypeFilter('all')
    setSellerFilter('all')
    setFromDate('')
    setToDate('')
    setMobileFiltersOpen(false)
    const query = buildQuery('', 'all', 'all', 1, '', '', selectedLimit)
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function handleDatePeriodChange(nextFromDate: string, nextToDate: string) {
    setFromDate(nextFromDate)
    setToDate(nextToDate)
    applyFilters(searchInput, typeFilter, sellerFilter, nextFromDate, nextToDate)
  }

  function handleSearchSubmit() {
    applyFilters(searchInput, typeFilter, sellerFilter, fromDate, toDate)
  }

  async function copyTextWithFeedback(value: string, key: string) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current))
      }, 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  const filterControls = (
    <>
      <Select
        value={typeFilter}
        onValueChange={(nextType) => {
          setTypeFilter(nextType)
          applyFilters(searchInput, nextType, sellerFilter, fromDate, toDate)
        }}
      >
        <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-36">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos tipos</SelectItem>
          <SelectItem value="WHOLESALE">Atacado</SelectItem>
          <SelectItem value="RETAIL">Varejo</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={sellerFilter}
        onValueChange={(nextSeller) => {
          setSellerFilter(nextSeller)
          applyFilters(searchInput, typeFilter, nextSeller, fromDate, toDate)
        }}
      >
        <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-44">
          <SelectValue placeholder="Vendedora" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas vendedoras</SelectItem>
          <SelectItem value="none">Sem vendedora</SelectItem>
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
          applyFilters(searchInput, typeFilter, sellerFilter, fromDate, toDate, nextLimit)
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
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Offline
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <Users className="h-6 w-6 text-primary" />
              Clientes Offline
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {hasAppliedFilter
                ? `${totalItems} clientes encontrados com os filtros atuais.`
                : `${totalItems} clientes sincronizados do ERP.`}
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
            <DrawerDescription>Refine a lista de clientes offline no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou CNPJ..."
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
            <p className="text-xs text-muted-foreground">Digite e toque em Buscar para aplicar o filtro.</p>
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Clientes</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.total}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2 text-slate-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Atacado</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.wholesale}</p>
            </div>
            <div className="rounded-full bg-violet-100 p-2 text-violet-700">
              <Factory className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-violet-300 to-violet-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Varejo</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.retail}</p>
            </div>
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-sky-300 to-sky-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Com vendedora</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.withSeller}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <UserCog className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Sem vendedora</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.withoutSeller}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <UserCog className="h-4 w-4" />
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
                placeholder="Buscar por nome, e-mail ou CNPJ..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearchSubmit()
                  }
                }}
                className="h-10 rounded-full pl-10"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" className="h-10 shrink-0 rounded-full px-5">
              Buscar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {filterControls}
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-border/40 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="font-medium">Tipo do Cliente:</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-400" />Atacado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" />Varejo</span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card className="hidden rounded-xl border border-border/20 shadow-none overflow-hidden p-0 md:block">
        {customers.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Nenhum cliente offline encontrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Data de Cadastro</TableHead>
                <TableHead>Identificação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Vendedora</TableHead>
                <TableHead className="w-16 text-center">UpZero</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => {
                const customerType = customer.customerType || null
                const typeLabel = customerType ? customerTypeMap[customerType] : null
                const identificationName = customer.name || '-'
                const identificationDocument = formatCNPJorCPF(customer.document || '')
                const cadastroDate = customer.erpCreatedAt || customer.syncedAt

                return (
                  <TableRow
                    key={customer.id}
                    className="odd:bg-background even:bg-muted/25 hover:bg-muted/40"
                  >
                    <TableCell>
                      <span
                        className={`block h-2.5 w-2.5 rounded-full ${
                          customerType === 'WHOLESALE'
                            ? 'bg-violet-500'
                            : customerType === 'RETAIL'
                              ? 'bg-sky-500'
                              : 'bg-slate-300'
                        }`}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatCadastroDate(cadastroDate)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="group flex items-center gap-2 text-left hover:text-primary">
                          <span className="inline-block w-18 text-xs text-muted-foreground">nome:</span>
                          <span className="text-sm">{identificationName}</span>
                          {copiedKey === `name-${customer.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-xs text-emerald-600">copiado</span>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={() => copyTextWithFeedback(identificationName, `name-${customer.id}`)}
                              title="Copiar nome"
                              aria-label="Copiar nome"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                        <div className="group flex items-center gap-2 text-left hover:text-primary">
                          <span className="inline-block w-18 text-xs text-muted-foreground">CNPJ/CPF:</span>
                          <span className="text-xs">{identificationDocument || '-'}</span>
                          {copiedKey === `document-${customer.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-xs text-emerald-600">copiado</span>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={() => copyTextWithFeedback(customer.document || '', `document-${customer.id}`)}
                              title="Copiar CNPJ/CPF"
                              aria-label="Copiar CNPJ ou CPF"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {typeLabel ? (
                        <Badge
                          variant={customerTypeBadgeVariant[customerType!] || 'outline'}
                          className="text-xs font-medium"
                        >
                          {typeLabel}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="group flex items-center gap-2 text-left hover:text-primary">
                          <span className="inline-block w-15 text-xs text-muted-foreground">telefone:</span>
                          <span className="text-sm">{formatPhoneNumber(customer.phone || '') || '-'}</span>
                          {copiedKey === `phone-${customer.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-xs text-emerald-600">copiado</span>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={() => copyTextWithFeedback(customer.phone || '', `phone-${customer.id}`)}
                              title="Copiar telefone"
                              aria-label="Copiar telefone"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                        <div className="group flex items-center gap-2 text-left hover:text-primary">
                          <span className="inline-block w-15 text-xs text-muted-foreground">e-mail:</span>
                          <span className="text-xs">{customer.email || '-'}</span>
                          {copiedKey === `email-${customer.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-xs text-emerald-600">copiado</span>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={() => copyTextWithFeedback(customer.email || '', `email-${customer.id}`)}
                              title="Copiar e-mail"
                              aria-label="Copiar e-mail"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.offlineSellerName ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {customer.offlineSellerName
                              .split(' ')
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join('')
                              .toUpperCase()}
                          </div>
                          <span className="text-sm">{customer.offlineSellerName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {customer.onlineCustomerId ? (
                        <Link
                          href={`/customers/${customer.onlineCustomerId}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200"
                          title={`Vinculado ao cliente UpZero${customer.onlineCustomerName ? `: ${customer.onlineCustomerName}` : ''}`}
                          aria-label={`Abrir cliente UpZero ${customer.onlineCustomerName || customer.onlineCustomerId}`}
                        >
                          <Link2 className="h-4 w-4" />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {customers.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum cliente offline encontrado
          </div>
        ) : (
          customers.map((customer) => {
            const customerType = customer.customerType || null
            const typeLabel = customerType ? customerTypeMap[customerType] : null
            return (
              <div key={customer.id} className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{customer.name || '-'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCNPJorCPF(customer.document || '') || '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {customer.onlineCustomerId ? (
                      <Link
                        href={`/customers/${customer.onlineCustomerId}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
                        title={`Vinculado ao cliente UpZero${customer.onlineCustomerName ? `: ${customer.onlineCustomerName}` : ''}`}
                        aria-label={`Abrir cliente UpZero ${customer.onlineCustomerName || customer.onlineCustomerId}`}
                      >
                        <Link2 className="h-4 w-4" />
                      </Link>
                    ) : null}
                    {typeLabel ? (
                      <Badge variant={customerTypeBadgeVariant[customerType!] || 'outline'} className="text-xs">
                        {typeLabel}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>{formatPhoneNumber(customer.phone || '') || '-'}</p>
                  <p>{customer.email || '-'}</p>
                  <p>{customer.offlineSellerName || 'Sem vendedora'}</p>
                  {customer.onlineCustomerId ? (
                    <Link
                      href={`/customers/${customer.onlineCustomerId}`}
                      className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {customer.onlineCustomerName || `Cliente #${customer.onlineCustomerId}`}
                    </Link>
                  ) : null}
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
