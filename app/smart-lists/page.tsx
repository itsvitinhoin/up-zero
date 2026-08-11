import { Suspense } from 'react'
import { getSmartListsAction } from '@/lib/actions/smart-lists'
import { AdminSmartListsPageClient } from '@/components/admin/smart-lists/admin-smart-lists-page-client'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: 'Smart Lists | Admin',
  description: 'Segmentação avançada de clientes',
}

export const instant = false

export default function SmartListsPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <SmartListsPageContent />
    </Suspense>
  )
}

async function SmartListsPageContent() {
  await connection()

  const result = await getSmartListsAction()
  const initialLists = result.success && result.data ? result.data : []
  return <AdminSmartListsPageClient initialLists={initialLists} />
}
