import { Suspense } from 'react'
import QueryPerformancePageClient from '@/components/admin/query-performance-page-client'
import { getQueryPerformanceSummaryAction, type QueryPerformanceSummary } from '@/lib/actions/query-performance'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: 'Performance SQL | Admin',
}

export const instant = false

export default function QueryPerformancePage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <QueryPerformancePageContent />
    </Suspense>
  )
}

async function QueryPerformancePageContent() {
  const result = await getQueryPerformanceSummaryAction({ limit: 20 })
  const initialData: QueryPerformanceSummary | null = result.success && result.data ? result.data : null

  return <QueryPerformancePageClient initialData={initialData} />
}
