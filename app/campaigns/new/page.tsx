import { getSmartListsAction } from '@/lib/actions/smart-lists'
import { getPricingSnapshotsAction } from '@/lib/actions/campaigns'
import { CampaignWizardClient } from '@/components/admin/campaigns/campaign-wizard-client'

export const metadata = {
  title: 'Nova Campanha | Admin',
}

export const dynamic = 'force-dynamic'

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ smartListId?: string; smartListName?: string }>
}) {
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
