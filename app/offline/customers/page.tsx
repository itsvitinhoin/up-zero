import { Suspense } from 'react'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { OfflineCustomersPageClient } from '@/components/admin/offline-customers-page-client'
import {
  getOfflineCustomersAction,
  getOfflineCustomersSummaryAction,
  getOfflineSellersAction,
} from '@/lib/actions/offline'
import {
  firstSearchParam,
  parseOfflinePageLimit,
} from '@/lib/offline-page-utils'

export const metadata = {
  title: 'Clientes Offline | Admin',
  description: 'Clientes sincronizados do ERP da loja física',
}

export const instant = false

type OfflineCustomersPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    limit?: string | string[]
    q?: string | string[]
    type?: string | string[]
    seller?: string | string[]
    from?: string | string[]
    to?: string | string[]
    period?: string | string[]
  }>
}

export default function OfflineCustomersPage({ searchParams }: OfflineCustomersPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <OfflineCustomersPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function OfflineCustomersPageContent({ searchParams }: OfflineCustomersPageProps) {
  await connection()

  const resolved = (await searchParams) ?? {}
  const q = firstSearchParam(resolved.q).trim()
  const customerType = firstSearchParam(resolved.type).trim().toUpperCase()
  const sellerRaw = firstSearchParam(resolved.seller).trim()
  const requestedPage = Number.parseInt(firstSearchParam(resolved.page), 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = parseOfflinePageLimit(firstSearchParam(resolved.limit))

  const normalizedCustomerType = ['WHOLESALE', 'RETAIL'].includes(customerType)
    ? customerType
    : undefined
  const withoutSeller = sellerRaw === 'none'
  const normalizedSellerId = !withoutSeller && /^\d+$/.test(sellerRaw) ? Number(sellerRaw) : undefined

  const rawFromDate = firstSearchParam(resolved.from).trim()
  const rawToDate = firstSearchParam(resolved.to).trim()
  const fromDate = rawFromDate
  const toDate = rawToDate

  const filterParams = {
    search: q || undefined,
    customerType: normalizedCustomerType,
    offlineSellerId: normalizedSellerId,
    withoutSeller: withoutSeller || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  }

  const [customersResult, summaryResult, sellersResult] = await Promise.all([
    getOfflineCustomersAction({
      page,
      limit,
      ...filterParams,
    }),
    getOfflineCustomersSummaryAction(filterParams),
    getOfflineSellersAction({ page: 1, limit: 200 }),
  ])

  const customers = customersResult.data?.data ?? []
  const total = customersResult.data?.total ?? 0
  const summary = summaryResult.data ?? {
    total,
    wholesale: customers.filter((row) => row.customerType === 'WHOLESALE').length,
    retail: customers.filter((row) => row.customerType === 'RETAIL').length,
    withSeller: customers.filter((row) => row.offlineSellerId != null).length,
    withoutSeller: customers.filter((row) => row.offlineSellerId == null).length,
  }

  const error = customersResult.error || summaryResult.error || sellersResult.error || null

  return (
    <OfflineCustomersPageClient
      initialCustomers={customers}
      initialSellers={sellersResult.data?.data ?? []}
      initialSummary={summary}
      total={total}
      currentPage={customersResult.data?.page ?? page}
      pageSize={customersResult.data?.limit ?? limit}
      initialSearch={q}
      initialType={normalizedCustomerType || 'all'}
      initialSellerId={withoutSeller ? 'none' : normalizedSellerId ? String(normalizedSellerId) : 'all'}
      initialFromDate={fromDate}
      initialToDate={toDate}
      error={error}
    />
  )
}
