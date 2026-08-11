import type { ReactNode } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export default async function AssetsLayout({ children }: { children: ReactNode }) {
  await ensureAdminPermission('assets.view')
  return children
}
