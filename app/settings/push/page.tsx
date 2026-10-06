import { Suspense } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'
import { PushSettingsPage } from '@/components/admin/push/settings'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
export const metadata = { title: 'Configurações de Push | Admin' }
async function Settings() { await ensureAdminPermission('settings.view'); return <PushSettingsPage /> }
export default function Page() { return <Suspense fallback={<AdminRouteSkeleton />}><Settings /></Suspense> }
