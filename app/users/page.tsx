import React from "react"
import { Suspense } from 'react'
import { cookies } from "next/headers"
import AdminUsersPageClient from "@/components/admin/admin-users-page-client"
import { getUsersPageAction, type UsersPageData } from "@/lib/actions/settings"
import { listRoleGroups } from "@/lib/actions/permissions"
import { tAdmin } from "@/lib/i18n/admin"
import type { RoleGroup } from "@/lib/permissions"
import type { User } from "@/lib/types"
import Loading from './loading'

type AdminUsersPageSearchParams = {
  page?: string | string[]
  limit?: string | string[]
  q?: string | string[]
  status?: string | string[]
}

const USERS_PAGE_SIZE_OPTIONS = new Set([20, 50, 100])

function parseUsersPageLimit(value?: string | null): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return USERS_PAGE_SIZE_OPTIONS.has(parsed) ? parsed : 20
}

function firstParam(value?: string | string[]): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function parseUsersStatusFilter(value?: string): 'all' | 'active' | 'inactive' {
  const normalized = String(value || 'all').trim().toLowerCase()
  if (normalized === 'active' || normalized === 'inactive') return normalized
  return 'all'
}

function filterAssignableUsers(items: User[], systemRoleIds: Set<string>): User[] {
  return items.filter(
    (user) => !['B2B_CUSTOMER', 'PENDING'].includes(user.role) && !systemRoleIds.has(String(user.roleId || '')),
  )
}

function buildUsersSummary(items: User[], total: number) {
  return {
    total,
    active: items.filter((user) => user.isActive).length,
    inactive: items.filter((user) => !user.isActive).length,
    withDevices: items.filter((user) => Boolean(user.hasDevices)).length,
  }
}

export async function generateMetadata() {
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"

  return {
    title: `${tAdmin(locale, "admin.users.title", "Users")} | Admin`,
    description: tAdmin(locale, "admin.users.subtitle", "Manage internal system users"),
  }
}

type AdminUsersPageProps = {
  searchParams?: Promise<AdminUsersPageSearchParams>
}

export default function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminUsersPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminUsersPageContent({
  searchParams,
}: {
  searchParams?: Promise<AdminUsersPageSearchParams>
}) {
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"
  const resolvedSearchParams = (await searchParams) ?? {}
  const parsedPage = Number.parseInt(firstParam(resolvedSearchParams.page), 10)
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const limit = parseUsersPageLimit(firstParam(resolvedSearchParams.limit))
  const query = firstParam(resolvedSearchParams.q).trim()
  const statusFilter = parseUsersStatusFilter(firstParam(resolvedSearchParams.status))
  const isActive =
    statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined

  let initialRoleGroups: RoleGroup[] = []
  let initialData: UsersPageData = {
    items: [],
    total: 0,
    page: 1,
    perPage: limit,
    totalPages: 0,
  }
  let initialSummary = {
    total: 0,
    active: 0,
    inactive: 0,
    withDevices: 0,
  }

  try {
    const [result, statsResult, roleGroups] = await Promise.all([
      getUsersPageAction({ page, perPage: limit, query, isActive }),
      getUsersPageAction({ page: 1, perPage: 200 }),
      listRoleGroups(),
    ])

    initialRoleGroups = roleGroups
    const systemRoleIds = new Set(
      roleGroups.filter((group) => group.is_system).map((group) => String(group.id)),
    )

    if (result.success && result.data) {
      const filteredItems = filterAssignableUsers(result.data.items, systemRoleIds)
      initialData = {
        ...result.data,
        items: filteredItems,
        perPage: limit,
      }
    }

    if (statsResult.success && statsResult.data) {
      const statsItems = filterAssignableUsers(statsResult.data.items, systemRoleIds)
      initialSummary = buildUsersSummary(statsItems, statsResult.data.total)
    } else {
      initialSummary = buildUsersSummary(initialData.items, initialData.total)
    }
  } catch (error) {
    console.error('Erro ao buscar usuários no server-side:', error)
  }

  return (
    <AdminUsersPageClient
      initialData={initialData}
      initialRoleGroups={initialRoleGroups}
      initialSummary={initialSummary}
      initialStatus={statusFilter}
      locale={locale}
    />
  )
}
