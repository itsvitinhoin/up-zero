import { Suspense } from 'react'
import { SmartListBuilderClient } from '@/components/admin/smart-lists/smart-list-builder-client'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: 'Nova Smart List | Admin',
}

export default function NewSmartListPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <NewSmartListPageContent />
    </Suspense>
  )
}

async function NewSmartListPageContent() {
  await connection()

  return <SmartListBuilderClient />
}
