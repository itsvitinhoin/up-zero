'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, FilterX, SlidersHorizontal } from 'lucide-react'
import DatePeriodFilter from '@/components/admin/date-period-filter'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { OfflineAttributionReport } from '@/lib/actions/offline'
import { getDateRangeForPreset } from '@/lib/date-period-presets'
import { formatOfflineMoney } from '@/lib/offline-page-utils'

interface OfflineAttributionPageClientProps {
  report: OfflineAttributionReport
  initialFromDate: string
  initialToDate: string
  error?: string | null
}

export function OfflineAttributionPageClient({
  report,
  initialFromDate,
  initialToDate,
  error,
}: OfflineAttributionPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [fromDate, setFromDate] = useState(initialFromDate)
  const [toDate, setToDate] = useState(initialToDate)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const defaultDateRange = getDateRangeForPreset('30d')

  const hasActiveFilter =
    fromDate !== defaultDateRange.from || toDate !== defaultDateRange.to

  useEffect(() => {
    setFromDate(initialFromDate)
  }, [initialFromDate])

  useEffect(() => {
    setToDate(initialToDate)
  }, [initialToDate])

  function applyPeriod(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams()
    if (nextFrom) params.set('from', nextFrom)
    if (nextTo) params.set('to', nextTo)
    if (!nextFrom && !nextTo) params.set('period', 'all')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function handleDatePeriodChange(nextFromDate: string, nextToDate: string) {
    setFromDate(nextFromDate)
    setToDate(nextToDate)
    applyPeriod(nextFromDate, nextToDate)
  }

  function clearFilters() {
    setFromDate(defaultDateRange.from)
    setToDate(defaultDateRange.to)
    setMobileFiltersOpen(false)
    applyPeriod(defaultDateRange.from, defaultDateRange.to)
  }

  const filterControls = (
    <>
      <DatePeriodFilter
        fromDate={fromDate}
        toDate={toDate}
        onChange={handleDatePeriodChange}
      />
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
              <BarChart3 className="h-3.5 w-3.5" />
              Offline
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <BarChart3 className="h-6 w-6 text-primary" />
              Atribuição
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Vendas online e offline atribuídas à mesma vendedora canônica.
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
            <DrawerDescription>Refine o relatório de atribuição no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-wrap items-center gap-3 px-4 pb-6">
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

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {(report.unassignedOfflineOrdersCount ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {report.unassignedOfflineOrdersCount} pedido(s) offline sem comissão atribuída (
            {formatOfflineMoney(report.unassignedOfflineTotalCents)}).
          </p>
          <p className="mt-1 text-muted-foreground">
            Verifique o{' '}
            <Link href="/offline/sellers" className="text-primary underline-offset-4 hover:underline">
              mapeamento de vendedoras
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm md:block">
        <div className="flex flex-wrap items-center gap-3">
          {filterControls}
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead>Vendedora</TableHead>
              <TableHead>Online</TableHead>
              <TableHead>Offline</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Ped. offline</TableHead>
              <TableHead>Indicações site→loja</TableHead>
              <TableHead>Cadastros site</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.sellers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum dado de comissão no período. Sincronize pedidos offline após mapear vendedoras.
                </TableCell>
              </TableRow>
            ) : (
              report.sellers.map((row) => (
                <TableRow key={row.adminId}>
                  <TableCell className="font-medium">{row.adminName}</TableCell>
                  <TableCell>
                    {formatOfflineMoney(row.onlineTotalCents)}
                    <span className="ml-1 text-xs text-muted-foreground">({row.onlineOrdersCount})</span>
                  </TableCell>
                  <TableCell>
                    {formatOfflineMoney(row.offlineTotalCents)}
                    <span className="ml-1 text-xs text-muted-foreground">({row.offlineOrdersCount})</span>
                  </TableCell>
                  <TableCell className="font-semibold">{formatOfflineMoney(row.unifiedTotalCents)}</TableCell>
                  <TableCell>{row.offlineOrdersCount}</TableCell>
                  <TableCell>{row.influencedBySiteCount}</TableCell>
                  <TableCell>{row.siteRegistrationsCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
