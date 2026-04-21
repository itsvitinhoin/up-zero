// next-upzero/lib/actions/permissions.ts
'use server'

import { cookies } from 'next/headers'
import type { Permission, RoleGroup, UserPermissionSummary, PermissionCheckResult } from '@/lib/permissions'

function resolveBackendBaseUrl(): string {
  const base = (process.env.NEXT_PUBLIC_RUST_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').trim()
  return base.replace(/\/$/, '')
}

async function getAuthHeaders(contentType = false): Promise<Record<string, string>> {
  const cookieStore = await cookies()
  const token = cookieStore.get('adminAuthToken')?.value
  if (!token) throw new Error('Not authenticated')

  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    cookie: `adminAuthToken=${token}`,
    Authorization: `Bearer ${token}`,
  }
}

async function getCurrentAdminId(): Promise<number> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/admin/me`, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) throw new Error('Failed to fetch current admin')
  const admin = await response.json()
  return Number(admin.id)
}

export async function listPermissions(): Promise<Permission[]> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/permissions`, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) throw new Error('Failed to fetch permissions')
  return response.json()
}

export async function listRoleGroups(): Promise<RoleGroup[]> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/permissions/groups`, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) throw new Error('Failed to fetch role groups')
  return response.json()
}

export async function createRoleGroup(data: {
  name: string
  description?: string
  color?: string
}): Promise<RoleGroup> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders(true)

  const normalizedDescription =
    data.description && data.description !== '$undefined'
      ? data.description.trim() || undefined
      : undefined

  const normalizedColor =
    data.color && data.color !== '$undefined'
      ? data.color.trim() || undefined
      : undefined

  const response = await fetch(`${API_BASE}/permissions/groups`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: data.name.trim(),
      description: normalizedDescription,
      color: normalizedColor,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    const isDuplicateNameError =
      errorText.includes('role_groups_store_id_name_key') ||
      errorText.toLowerCase().includes('duplicate key value')

    if (isDuplicateNameError) {
      throw new Error('Perfil já existe para esta loja')
    }

    throw new Error(errorText || 'Failed to create role group')
  }
  return response.json()
}

export async function getRoleWithPermissions(roleId: number): Promise<{
  role: RoleGroup
  permissions: Permission[]
  permission_count: number
}> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/permissions/groups/${roleId}`, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) throw new Error('Failed to fetch role with permissions')
  return response.json()
}

export async function updateRoleGroup(roleId: number, data: {
  name?: string
  description?: string
  color?: string
}): Promise<RoleGroup> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders(true)

  const response = await fetch(`${API_BASE}/permissions/groups/${roleId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || 'Failed to update role group')
  }
  return response.json()
}

export async function assignPermissionToRole(roleId: number, permissionId: number): Promise<void> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders(true)

  const response = await fetch(`${API_BASE}/permissions/groups/${roleId}/permissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ permission_id: permissionId }),
  })

  if (!response.ok) throw new Error('Failed to assign permission')
}

export async function removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders()

  const response = await fetch(
    `${API_BASE}/permissions/groups/${roleId}/permissions/${permissionId}`,
    {
      method: 'DELETE',
      headers,
    }
  )

  if (!response.ok) throw new Error('Failed to remove permission')
}

export async function getUserPermissions(userId?: number): Promise<UserPermissionSummary> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders()
  const resolvedUserId = userId ?? (await getCurrentAdminId())

  const response = await fetch(`${API_BASE}/permissions/user/${resolvedUserId}/permissions`, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) throw new Error('Failed to fetch user permissions')
  return response.json()
}

export async function setUserPermissionOverride(
  userId: number,
  permissionId: number,
  granted: boolean,
  reason?: string
): Promise<void> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders(true)

  const response = await fetch(
    `${API_BASE}/permissions/user/${userId}/permissions/${permissionId}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ granted, reason }),
    }
  )

  if (!response.ok) throw new Error('Failed to set permission override')
}

export async function removeUserPermissionOverride(
  userId: number,
  permissionId: number
): Promise<void> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders()

  const response = await fetch(
    `${API_BASE}/permissions/user/${userId}/permissions/${permissionId}`,
    {
      method: 'DELETE',
      headers,
    }
  )

  if (!response.ok) throw new Error('Failed to remove permission override')
}

export async function checkUserPermission(code: string): Promise<PermissionCheckResult> {
  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/permissions/check?code=${encodeURIComponent(code)}`, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) throw new Error('Failed to check permission')
  return response.json()
}
