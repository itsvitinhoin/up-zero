'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  CheckCircle,
  FilterX,
  Link2,
  Link2Off,
  Search,
  SlidersHorizontal,
  UserCog,
  XCircle,
} from 'lucide-react'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import { OfflineSellerAdminSelect } from '@/components/admin/offline-seller-admin-select'
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
import type { Admin } from '@/lib/actions/admins'
import type { OfflineSellerRow, OfflineSellersSummary } from '@/lib/actions/offline'
import { parseOfflinePageLimit } from '@/lib/offline-page-utils'
import { usePaginationMeta } from '@/hooks/use-paginated-list'

interface OfflineSellersListClientProps {
  sellers: OfflineSellerRow[]
  admins: Admin[]
  initialSummary: OfflineSellersSummary
  total: number
  currentPage: number
  pageSize: number
  initialSearch: string
  initialActive: string
  initialMapping: string
  error?: string | null
}

export function OfflineSellersListClient({
  sellers: initialSellers,
  admins,
  initialSummary,
  total,
  currentPage,
  pageSize,
  initialSearch,
  initialActive,
  initialMapping,
  error,
}: OfflineSellersListClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [sellers, setSellers] = useState(initialSellers)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [activeFilter, setActiveFilter] = useState(initialActive)
  const [mappingFilter, setMappingFilter] = useState(initialMapping)
  const [selectedLimit, setSelectedLimit] = useState(parseOfflinePageLimit(pageSize))
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const totalItems = Math.max(0, Number(total) || 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(selectedLimit, 1)))
  const { safeCurrentPage, pageStart, pageEnd } = usePaginationMeta({
    currentPage,
    pageSize: selectedLimit,
    totalItems,
    currentPageItemCount: sellers.length,
  })

  const hasActiveFilter = searchInput.trim().length > 0
    || activeFilter !== 'all'
    || mappingFilter !== 'all'

  const hasAppliedFilter = initialSearch.trim().length > 0
    || initialActive !== 'all'
    || initialMapping !== 'all'

  useEffect(() => {
    setSellers(initialSellers)
  }, [initialSellers])

  useEffect(() => {
    setSearchInput(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setActiveFilter(initialActive)
  }, [initialActive])

  useEffect(() => {
    setMappingFilter(initialMapping)
  }, [initialMapping])

  useEffect(() => {
    setSelectedLimit(parseOfflinePageLimit(pageSize))
  }, [pageSize])

  function buildQuery(
    nextSearch: string,
    nextActive: string,
    nextMapping: string,
    nextPage: number,
    nextLimit?: number,
  ) {
    const params = new URLSearchParams()
    const normalizedSearch = nextSearch.trim()
    const resolvedLimit = parseOfflinePageLimit(nextLimit ?? selectedLimit)

    if (normalizedSearch) params.set('q', normalizedSearch)
    if (nextActive === 'true' || nextActive === 'false') params.set('active', nextActive)
    if (nextMapping === 'mapped' || nextMapping === 'unmapped') params.set('mapping', nextMapping)
    if (resolvedLimit !== 20) params.set('limit', String(resolvedLimit))
    if (nextPage > 1) params.set('page', String(nextPage))

    return params.toString()
  }

  function applyFilters(
    nextSearch: string,
    nextActive: string,
    nextMapping: string,
    nextLimit?: number,
  ) {
    const query = buildQuery(nextSearch, nextActive, nextMapping, 1, nextLimit)
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function goToPage(page: number) {
    const nextPage = Math.max(1, Math.min(totalPages, page))
    const query = buildQuery(
      initialSearch,
      initialActive,
      initialMapping,
      nextPage,
      selectedLimit,
    )
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function clearFilters() {
    setSearchInput('')
    setActiveFilter('all')
    setMappingFilter('all')
    setMobileFiltersOpen(false)
    const query = buildQuery('', 'all', 'all', 1, selectedLimit)
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function handleSearchSubmit() {
    applyFilters(searchInput, activeFilter, mappingFilter)
  }

  const filterControls = (
    <>
      <Select
        value={activeFilter}
        onValueChange={(nextActive) => {
          setActiveFilter(nextActive)
          applyFilters(searchInput, nextActive, mappingFilter)
        }}
      >
        <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          <SelectItem value="true">Ativas</SelectItem>
          <SelectItem value="false">Inativas</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={mappingFilter}
        onValueChange={(nextMapping) => {
          setMappingFilter(nextMapping)
          applyFilters(searchInput, activeFilter, nextMapping)
        }}
      >
        <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-44">
          <SelectValue placeholder="Mapeamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos vínculos</SelectItem>
          <SelectItem value="mapped">Mapeadas</SelectItem>
          <SelectItem value="unmapped">Não mapeadas</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={String(selectedLimit)}
        onValueChange={(value) => {
          const nextLimit = Number.parseInt(value, 10)
          if (!Number.isFinite(nextLimit)) return
          setSelectedLimit(nextLimit)
          applyFilters(searchInput, activeFilter, mappingFilter, nextLimit)
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
              <UserCog className="h-3.5 w-3.5" />
              Offline
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <UserCog className="h-6 w-6 text-primary" />
              Vendedoras Offline
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {hasAppliedFilter
                ? `${totalItems} vendedoras encontradas com os filtros atuais.`
                : `${totalItems} vendedoras sincronizadas do ERP.`}
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
            <DrawerDescription>Refine a lista de vendedoras offline no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ERP ou ID externo..."
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
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Vendedoras</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.total}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2 text-slate-700">
              <UserCog className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Ativas</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.active}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Inativas</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.inactive}</p>
            </div>
            <div className="rounded-full bg-rose-100 p-2 text-rose-700">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-rose-300 to-rose-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Mapeadas</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.mapped}</p>
            </div>
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <Link2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-sky-300 to-sky-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Não mapeadas</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{initialSummary.unmapped}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
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
                placeholder="Buscar por nome, código ERP ou ID externo..."
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
          <span className="font-medium">Status da Vendedora:</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Ativa</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />Inativa</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" />Mapeada</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Não mapeada</span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card className="hidden rounded-xl border border-border/20 shadow-none overflow-hidden p-0 md:block">
        {sellers.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Nenhuma vendedora offline encontrada
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Identificação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vendedora no site</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller) => {
                return (
                  <TableRow
                    key={seller.id}
                    className="odd:bg-background even:bg-muted/25 hover:bg-muted/40"
                  >
                    <TableCell>
                      <span
                        className={`block h-2.5 w-2.5 rounded-full ${
                          seller.active ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-18 text-xs text-muted-foreground">nome:</span>
                          <span className="text-sm">{seller.name || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-18 text-xs text-muted-foreground">código:</span>
                          <span className="text-xs">{seller.erpCode || seller.externalId || '-'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Badge
                          variant={seller.active ? 'emerald' : 'rose'}
                          className="w-fit text-xs font-medium"
                        >
                          {seller.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <Badge
                          variant={seller.adminId != null ? 'sky' : 'amber'}
                          className="w-fit text-xs font-medium"
                        >
                          {seller.adminId != null ? 'Mapeada' : 'Não mapeada'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <OfflineSellerAdminSelect
                        sellerId={seller.id}
                        currentAdminId={seller.adminId}
                        admins={admins}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="space-y-3 md:hidden">
        {sellers.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma vendedora offline encontrada
          </div>
        ) : (
          sellers.map((seller) => (
            <div key={seller.id} className="space-y-3 rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{seller.name || '-'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {seller.erpCode || seller.externalId || '-'}
                  </p>
                </div>
                <Badge variant={seller.active ? 'emerald' : 'rose'} className="text-xs">
                  {seller.active ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
              <OfflineSellerAdminSelect
                sellerId={seller.id}
                currentAdminId={seller.adminId}
                admins={admins}
              />
            </div>
          ))
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
