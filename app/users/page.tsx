import React from "react"
import { cookies } from "next/headers"
import AdminUsersPageClient from "@/components/admin/admin-users-page-client"
import { getUsersAction } from "@/lib/actions/settings"
import { tAdmin } from "@/lib/i18n/admin"
import type { User } from "@/lib/types"

export async function generateMetadata() {
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"

  return {
    title: `${tAdmin(locale, "admin.users.title", "Users")} | Admin`,
    description: tAdmin(locale, "admin.users.subtitle", "Manage internal system users"),
  }
}

export default async function AdminUsersPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"
  let users: User[] = []

  try {
    const result = await getUsersAction()
    if (result.success && result.data) {
      users = result.data.filter((u) => !["B2B_CUSTOMER", "PENDING"].includes(u.role))
    }
  } catch (error) {
    console.error('Erro ao buscar usuários no server-side:', error)
  }

  return <AdminUsersPageClient initialUsers={users} locale={locale} />
}
