import type { ReactNode } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export default async function NewOrderLayout({ children }: { children: ReactNode }) {
  await ensureAdminPermission('orders.create', '/orders')
  return children
}