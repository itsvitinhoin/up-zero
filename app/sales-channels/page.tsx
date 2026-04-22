import { getAdminSession } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { getSalesChannelsAction } from '@/lib/actions/sales-channels'
import { AdminSalesChannelsClient } from '@/components/admin/admin-sales-channels-client'

export const metadata = { title: 'Canais de Venda | Admin' }

export default async function SalesChannelsPage() {
  const session = await getAdminSession()
  if (!session) redirect('/login')

  const result = await getSalesChannelsAction()
  const channels = result.data ?? []

  return <AdminSalesChannelsClient initialChannels={channels} />
}
