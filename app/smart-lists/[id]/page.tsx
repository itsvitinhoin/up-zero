import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getSmartListAction } from '@/lib/actions/smart-lists'
import { SmartListDetailClient } from '@/components/admin/smart-lists/smart-list-detail-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export default function SmartListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <SmartListDetailPageContent params={params} />
    </Suspense>
  )
}

async function SmartListDetailPageContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await connection()

  const { id } = await params
  const result = await getSmartListAction(id)
  if (!result.success || !result.data) notFound()
  return <SmartListDetailClient list={result.data} />
}
