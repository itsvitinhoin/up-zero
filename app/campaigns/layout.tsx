import type { ReactNode } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export default async function CampaignsLayout({ children }: { children: ReactNode }) {
  await ensureAdminPermission('messaging.view')
  return children
}
