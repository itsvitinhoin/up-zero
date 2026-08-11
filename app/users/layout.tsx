import type { ReactNode } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export default async function UsersLayout({ children }: { children: ReactNode }) {
  await ensureAdminPermission('users.view')
  return children
}
