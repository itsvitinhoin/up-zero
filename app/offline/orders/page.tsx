import { Suspense } from 'react'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { OfflineOrdersPageClient } from '@/components/admin/offline-orders-page-client'
import {
  getOfflineOrdersAction,
  getOfflineOrdersSummaryAction,
  getOfflineSellersAction,
} from '@/lib/actions/offline'
import { getDateRangeForPreset } from '@/lib/date-period-presets'
import {
  firstSearchParam,
  parseOfflinePageLimit,
} from '@/lib/offline-page-utils'

export const metadata = {
  title: 'Pedidos Offline | Admin',
  description: 'Pedidos sincronizados do ERP da loja física',
}

export const instant = false

type OfflineOrdersPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    limit?: string | string[]
    q?: string | string[]
    status?: string | string[]
    seller?: string | string[]
    from?: string | string[]
    to?: string | string[]
    period?: string | string[]
  }>
}

export default function OfflineOrdersPage({ searchParams }: OfflineOrdersPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <OfflineOrdersPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function OfflineOrdersPageContent({ searchParams }: OfflineOrdersPageProps) {
  await connection()

  const resolved = (await searchParams) ?? {}
  const q = firstSearchParam(resolved.q).trim()
  const statusRaw = firstSearchParam(resolved.status).trim()
  const sellerRaw = firstSearchParam(resolved.seller).trim()
  const requestedPage = Number.parseInt(firstSearchParam(resolved.page), 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = parseOfflinePageLimit(firstSearchParam(resolved.limit))

  const normalizedStatus = statusRaw && statusRaw.toLowerCase() !== 'all' ? statusRaw : undefined
  const normalizedSellerId = /^\d+$/.test(sellerRaw) ? Number(sellerRaw) : undefined
  const rawFromDate = firstSearchParam(resolved.from).trim()
  const rawToDate = firstSearchParam(resolved.to).trim()
  const period = firstSearchParam(resolved.period).trim().toLowerCase()
  const wantsAllPeriods = period === 'all'
  const shouldUseDefaultRange = !rawFromDate && !rawToDate && !wantsAllPeriods
  const defaultRange = getDateRangeForPreset('30d')
  const fromDate = shouldUseDefaultRange ? defaultRange.from : rawFromDate
  const toDate = shouldUseDefaultRange ? defaultRange.to : rawToDate

  const filterParams = {
    search: q || undefined,
    status: normalizedStatus,
    offlineSellerId: normalizedSellerId,
    from: fromDate || undefined,
    to: toDate || undefined,
  }

  const [ordersResult, summaryResult, sellersResult] = await Promise.all([
    getOfflineOrdersAction({
      page,
      limit,
      ...filterParams,
    }),
    getOfflineOrdersSummaryAction(filterParams),
    getOfflineSellersAction({ page: 1, limit: 200 }),
  ])

  const orders = ordersResult.data?.data ?? []
  const total = ordersResult.data?.total ?? 0
  const summary = summaryResult.data ?? {
    total,
    totalValueCents: orders.reduce((sum, row) => sum + row.totalCents, 0),
    withSeller: orders.filter((row) => row.offlineSellerId != null).length,
    withoutSeller: orders.filter((row) => row.offlineSellerId == null).length,
  }

  const error = ordersResult.error || summaryResult.error || sellersResult.error || null

  return (
    <OfflineOrdersPageClient
      initialOrders={orders}
      initialSellers={sellersResult.data?.data ?? []}
      initialSummary={summary}
      total={total}
      currentPage={ordersResult.data?.page ?? page}
      pageSize={ordersResult.data?.limit ?? limit}
      initialSearch={q}
      initialStatus={normalizedStatus || 'all'}
      initialSellerId={normalizedSellerId ? String(normalizedSellerId) : 'all'}
      initialFromDate={fromDate}
      initialToDate={toDate}
      error={error}
    />
  )
}
