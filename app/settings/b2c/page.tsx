import { AdminB2CSettingsPageClient } from '@/components/admin/admin-b2c-settings-page-client'
import { getB2CAdminData } from '@/lib/b2c-leads/admin-data'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { Suspense } from 'react'

export const metadata = {
  title: 'Configurações B2C | Admin',
  description: 'Configure a distribuição de oportunidades B2C para revendedores.',
}

async function B2CSettingsPageContent() {
  await ensureAdminPermission('settings.view')
  const data = await getB2CAdminData()
  return <AdminB2CSettingsPageClient initialSettings={data.settings} resellers={data.resellers} initialError={data.settingsError} />
}

export default function B2CSettingsPage() {
  return <Suspense fallback={<AdminRouteSkeleton />}><B2CSettingsPageContent /></Suspense>
}
