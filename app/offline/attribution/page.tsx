import { Suspense } from 'react'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { OfflineAttributionPageClient } from '@/components/admin/offline-attribution-page-client'
import { getOfflineAttributionReportAction } from '@/lib/actions/offline'
import { getDateRangeForPreset } from '@/lib/date-period-presets'
import { firstSearchParam } from '@/lib/offline-page-utils'

export const metadata = {
  title: 'Atribuição Offline | Admin',
}

export const instant = false

type OfflineAttributionPageProps = {
  searchParams?: Promise<{
    from?: string | string[]
    to?: string | string[]
    period?: string | string[]
  }>
}

export default function OfflineAttributionPage({ searchParams }: OfflineAttributionPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <OfflineAttributionPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function OfflineAttributionPageContent({ searchParams }: OfflineAttributionPageProps) {
  await connection()

  const resolved = (await searchParams) ?? {}
  const rawFromDate = firstSearchParam(resolved.from).trim()
  const rawToDate = firstSearchParam(resolved.to).trim()
  const period = firstSearchParam(resolved.period).trim().toLowerCase()
  const wantsAllPeriods = period === 'all'
  const shouldUseDefaultRange = !rawFromDate && !rawToDate && !wantsAllPeriods
  const defaultRange = getDateRangeForPreset('30d')
  const fromDate = shouldUseDefaultRange ? defaultRange.from : rawFromDate
  const toDate = shouldUseDefaultRange ? defaultRange.to : rawToDate

  const result = await getOfflineAttributionReportAction({
    from: fromDate || undefined,
    to: toDate || undefined,
  })

  return (
    <OfflineAttributionPageClient
      report={
        result.data ?? {
          sellers: [],
          unassignedOfflineTotalCents: 0,
          unassignedOfflineOrdersCount: 0,
        }
      }
      initialFromDate={fromDate}
      initialToDate={toDate}
      error={result.error}
    />
  )
}
