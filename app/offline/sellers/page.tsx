import { Suspense } from 'react'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { OfflineSellersListClient } from '@/components/admin/offline-sellers-list-client'
import { getAdminsAction } from '@/lib/actions/admins'
import {
  getOfflineSellersAction,
  getOfflineSellersSummaryAction,
} from '@/lib/actions/offline'
import {
  firstSearchParam,
  parseOfflinePageLimit,
} from '@/lib/offline-page-utils'

export const metadata = {
  title: 'Vendedoras Offline | Admin',
  description: 'Vendedoras sincronizadas do ERP da loja física',
}

export const instant = false

type OfflineSellersPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    limit?: string | string[]
    q?: string | string[]
    active?: string | string[]
    mapping?: string | string[]
  }>
}

export default function OfflineSellersPage({ searchParams }: OfflineSellersPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <OfflineSellersPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function OfflineSellersPageContent({ searchParams }: OfflineSellersPageProps) {
  await connection()

  const resolved = (await searchParams) ?? {}
  const q = firstSearchParam(resolved.q).trim()
  const activeRaw = firstSearchParam(resolved.active).trim().toLowerCase()
  const mappingRaw = firstSearchParam(resolved.mapping).trim().toLowerCase()
  const requestedPage = Number.parseInt(firstSearchParam(resolved.page), 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = parseOfflinePageLimit(firstSearchParam(resolved.limit))

  const normalizedActive =
    activeRaw === 'true' ? true : activeRaw === 'false' ? false : undefined
  const normalizedMapping =
    mappingRaw === 'mapped' || mappingRaw === 'unmapped' ? mappingRaw : undefined

  const filterParams = {
    search: q || undefined,
    active: normalizedActive,
    mapping: normalizedMapping,
  }

  const [sellersResult, summaryResult, adminsResult] = await Promise.all([
    getOfflineSellersAction({
      page,
      limit,
      ...filterParams,
    }),
    getOfflineSellersSummaryAction(filterParams),
    getAdminsAction(),
  ])

  const sellers = sellersResult.data?.data ?? []
  const total = sellersResult.data?.total ?? 0
  const summary = summaryResult.data ?? {
    total,
    active: sellers.filter((row) => row.active).length,
    inactive: sellers.filter((row) => !row.active).length,
    mapped: sellers.filter((row) => row.adminId != null).length,
    unmapped: sellers.filter((row) => row.adminId == null).length,
  }

  const admins = adminsResult.success && adminsResult.data ? adminsResult.data : []
  const error = sellersResult.error || summaryResult.error || adminsResult.error || null

  return (
    <OfflineSellersListClient
      sellers={sellers}
      admins={admins}
      initialSummary={summary}
      total={total}
      currentPage={sellersResult.data?.page ?? page}
      pageSize={sellersResult.data?.limit ?? limit}
      initialSearch={q}
      initialActive={typeof normalizedActive === 'boolean' ? String(normalizedActive) : 'all'}
      initialMapping={normalizedMapping || 'all'}
      error={error}
    />
  )
}
