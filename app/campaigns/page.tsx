import { getCampaignsAction } from '@/lib/actions/campaigns'
import { getPricingSnapshotsAction } from '@/lib/actions/campaigns'
import { AdminCampaignsPageClient } from '@/components/admin/campaigns/admin-campaigns-page-client'

export const metadata = {
  title: 'Campanhas WhatsApp | Admin',
  description: 'Gerencie campanhas de WhatsApp em massa',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CampaignsPage() {
  const [campaignsResult, pricingResult] = await Promise.all([
    getCampaignsAction(),
    getPricingSnapshotsAction(),
  ])
  const initialCampaigns = campaignsResult.success && campaignsResult.data ? campaignsResult.data : []
  const initialPricing = pricingResult.success && pricingResult.data ? pricingResult.data : []
  return <AdminCampaignsPageClient initialCampaigns={initialCampaigns} initialPricing={initialPricing} />
}
