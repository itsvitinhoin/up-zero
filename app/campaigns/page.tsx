import { Suspense } from 'react'
import { getCampaignsAction } from '@/lib/actions/campaigns'
import { getPricingSnapshotsAction } from '@/lib/actions/campaigns'
import { AdminCampaignsPageClient } from '@/components/admin/campaigns/admin-campaigns-page-client'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: 'Campanhas WhatsApp | Admin',
  description: 'Gerencie campanhas de WhatsApp em massa',
}

export const instant = false

export default function CampaignsPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <CampaignsPageContent />
    </Suspense>
  )
}

async function CampaignsPageContent() {
  await connection()

  const [campaignsResult, pricingResult] = await Promise.all([
    getCampaignsAction(),
    getPricingSnapshotsAction(),
  ])
  const initialCampaigns = campaignsResult.success && campaignsResult.data ? campaignsResult.data : []
  const initialPricing = pricingResult.success && pricingResult.data ? pricingResult.data : []
  return <AdminCampaignsPageClient initialCampaigns={initialCampaigns} initialPricing={initialPricing} />
}
