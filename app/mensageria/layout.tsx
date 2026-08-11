import type { ReactNode } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export default async function MensageriaLayout({ children }: { children: ReactNode }) {
  await ensureAdminPermission('messaging.view')
  return children
}
