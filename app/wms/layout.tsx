import type { ReactNode } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export default async function WmsLayout({ children }: { children: ReactNode }) {
  await ensureAdminPermission('inventory.view')
  return children
}
