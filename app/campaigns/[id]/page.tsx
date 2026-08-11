import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getCampaignAction } from '@/lib/actions/campaigns'
import { CampaignDetailClient } from '@/components/admin/campaigns/campaign-detail-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <CampaignDetailPageContent params={params} />
    </Suspense>
  )
}

async function CampaignDetailPageContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await connection()

  const { id } = await params
  const result = await getCampaignAction(id)
  if (!result.success || !result.data) notFound()
  return <CampaignDetailClient campaign={result.data} />
}
