import { notFound } from 'next/navigation'
import { getCampaignAction } from '@/lib/actions/campaigns'
import { CampaignDetailClient } from '@/components/admin/campaigns/campaign-detail-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getCampaignAction(id)
  if (!result.success || !result.data) notFound()
  return <CampaignDetailClient campaign={result.data} />
}
