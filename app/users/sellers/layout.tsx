import { ensureAdminPermission } from "@/lib/server-admin-permissions"

export default async function AdminSellersLayout({ children }: { children: React.ReactNode }) {
  await ensureAdminPermission('users.view')
  return children
}