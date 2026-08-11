import type { ReactNode } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export const instant = false

export default async function OrdersLayout({ children }: { children: ReactNode }) {
  await ensureAdminPermission('orders.view')
  return children
}