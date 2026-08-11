import type { ReactNode } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export default async function CustomLinksLayout({ children }: { children: ReactNode }) {
  await ensureAdminPermission('custom_links.view')
  return children
}
