import { Suspense } from 'react'
import { getAdminSession } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { getSalesChannelsAction } from '@/lib/actions/sales-channels'
import { AdminSalesChannelsClient } from '@/components/admin/admin-sales-channels-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = { title: 'Canais de Venda | Admin' }

export const instant = false

export default function SalesChannelsPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <SalesChannelsPageContent />
    </Suspense>
  )
}

async function SalesChannelsPageContent() {
  const session = await getAdminSession()
  if (!session) redirect('/login')

  const result = await getSalesChannelsAction()
  const channels = result.data ?? []

  return <AdminSalesChannelsClient initialChannels={channels} />
}
