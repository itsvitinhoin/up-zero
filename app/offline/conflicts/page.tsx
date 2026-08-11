import { Suspense } from 'react'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { OfflineConflictsPageClient } from '@/components/admin/offline-conflicts-page-client'
import { getOfflineSellerConflictsAction } from '@/lib/actions/offline'
import { parseOfflineListSearchParams } from '@/lib/offline-page-utils'

export const metadata = {
  title: 'Conflitos Offline | Admin',
}

export const instant = false

type Props = {
  searchParams?: Promise<{ page?: string | string[]; limit?: string | string[] }>
}

export default function OfflineConflictsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <OfflineConflictsPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function OfflineConflictsPageContent({ searchParams }: Props) {
  await connection()
  const { page, limit } = parseOfflineListSearchParams(await searchParams)
  const result = await getOfflineSellerConflictsAction({ page, limit })

  return (
    <OfflineConflictsPageClient
      rows={result.data?.data ?? []}
      total={result.data?.total ?? 0}
      currentPage={result.data?.page ?? page}
      pageSize={result.data?.limit ?? limit}
      error={result.error}
    />
  )
}
