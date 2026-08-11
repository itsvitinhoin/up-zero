import { getSmartListsAction } from '@/lib/actions/smart-lists'
import { getPricingSnapshotsAction } from '@/lib/actions/campaigns'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { CampaignWizardClient } from '@/components/admin/campaigns/campaign-wizard-client'
import { Suspense } from 'react'
import { connection } from 'next/server'

export const metadata = {
  title: 'Nova Campanha | Admin',
}

export const instant = false

export default function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ smartListId?: string; smartListName?: string }>
}) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <NewCampaignPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function NewCampaignPageContent({
  searchParams,
}: {
  searchParams: Promise<{ smartListId?: string; smartListName?: string }>
}) {
  await connection()

  const [listsResult, pricingResult, sp] = await Promise.all([
    getSmartListsAction(),
    getPricingSnapshotsAction(),
    searchParams,
  ])
  const lists = listsResult.success && listsResult.data ? listsResult.data : []
  const pricing = pricingResult.success && pricingResult.data ? pricingResult.data : []
  return (
    <CampaignWizardClient
      initialSmartLists={lists}
      initialPricing={pricing}
      preSelectedSmartListId={sp.smartListId}
      preSelectedSmartListName={sp.smartListName}
    />
  )
}
