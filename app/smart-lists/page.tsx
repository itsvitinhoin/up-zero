import { getSmartListsAction } from '@/lib/actions/smart-lists'
import { AdminSmartListsPageClient } from '@/components/admin/smart-lists/admin-smart-lists-page-client'

export const metadata = {
  title: 'Smart Lists | Admin',
  description: 'Segmentação avançada de clientes',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SmartListsPage() {
  const result = await getSmartListsAction()
  const initialLists = result.success && result.data ? result.data : []
  return <AdminSmartListsPageClient initialLists={initialLists} />
}
