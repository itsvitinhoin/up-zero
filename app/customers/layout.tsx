import type { ReactNode } from 'react'
import { connection } from 'next/server'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export default async function CustomersLayout({ children }: { children: ReactNode }) {
  await connection()
  await ensureAdminPermission('customers.view')
  return children
}
