import { redirect } from "next/navigation"

export const metadata = {
  title: "Configurações | Admin",
  description: "Configure as regras, aparência e pagamentos da loja B2B",
}

export default async function AdminSettingsPage() {
  redirect("/settings/general")
}
