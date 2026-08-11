import { AdminB2CLeadsPageClient } from '@/components/admin/admin-b2c-leads-page-client'
import { getB2CAdminData } from '@/lib/b2c-leads/admin-data'

export type B2CAdminView = 'dashboard' | 'customers' | 'orders'

export async function AdminB2CPage({ view }: { view: B2CAdminView }) {
  const data = await getB2CAdminData()
  return (
    <AdminB2CLeadsPageClient
      view={view}
      initialLeads={data.leads}
      initialError={data.leadsError}
      resellers={data.resellers}
      settings={data.settings}
    />
  )
}
