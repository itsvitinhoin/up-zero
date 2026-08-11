import { redirect } from "next/navigation"
import { ensureAdminPermission } from "@/lib/server-admin-permissions"

export const instant = false

export const metadata = {
  title: "Configurações | Admin",
  description: "Configure as regras, aparência e pagamentos da loja B2B",
}

export default async function AdminSettingsPage() {
  await ensureAdminPermission('settings.view')
  redirect("/settings/general")
}
