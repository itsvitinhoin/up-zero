// next-upzero/lib/actions/permissions.ts
'use server'

import { cookies } from 'next/headers'
import type { Permission, RoleGroup, UserPermissionSummary, PermissionCheckResult } from '@/lib/permissions'
import { isLocalAdminToken, verifyLocalAdminToken } from '@/lib/local-admin-session'

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

async function hasLocalAdminRole(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('adminAuthToken')?.value?.trim()
  if (!token) return false

  if (isLocalAdminToken(token)) {
    const secret = (
      process.env.LOCAL_ADMIN_SESSION_SECRET
      || process.env.LOCAL_ADMIN_PASSWORD
      || ''
    ).trim()
    if (!secret) return false

    const payload = await verifyLocalAdminToken(token, secret)
    return payload?.role === 'ADMIN'
  }

  // The isolated sandbox API issues this intentionally local-only token. It is
  // never accepted outside development and cannot grant access in Vercel.
  if (process.env.NODE_ENV === 'development') {
    try {
      const [prefix, encodedPayload, suffix] = token.split('.')
      if (prefix !== 'sandbox' || suffix !== 'local' || !encodedPayload) return false
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
        role?: unknown
        exp?: unknown
      }
      const expiresAt = Number(payload.exp)
      return String(payload.role ?? '').toUpperCase() === 'ADMIN'
        && Number.isFinite(expiresAt)
        && expiresAt > Math.floor(Date.now() / 1000)
    } catch {
      return false
    }
  }

  return false
}

const LEGACY_PERMISSION_FALLBACKS: Readonly<Record<string, string>> = {
  'messaging.view': 'settings.view',
  'messaging.manage_settings': 'settings.edit',
  'messaging.manage_templates': 'settings.edit',
}

async function fetchPermissionCheck(
  apiBase: string,
  headers: Record<string, string>,
  code: string,
): Promise<PermissionCheckResult | null> {
  try {
    const response = await fetch(
      `${apiBase}/permissions/check?code=${encodeURIComponent(code)}`,
      { headers, cache: 'no-store' },
    )

    if (!response.ok) return null
    return response.json() as Promise<PermissionCheckResult>
  } catch {
    return null
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

async function hasAnyPermission(permissionCodes: string[]): Promise<boolean> {
  for (const code of permissionCodes) {
    try {
      const result = await checkUserPermission(code)
      if (result?.has_permission === true) return true
    } catch {
      // keep checking remaining permissions
    }
  }

  return false
}

async function ensureAnyPermission(permissionCodes: string[]): Promise<void> {
  const allowed = await hasAnyPermission(permissionCodes)
  if (!allowed) throw new Error('Não autorizado')
}

async function ensureRoleManagementPermission(): Promise<void> {
  await ensureAnyPermission(['settings.manage_roles'])
}

async function ensurePermissionsReadPermission(): Promise<void> {
  await ensureAnyPermission(['settings.manage_roles', 'settings.manage_team'])
}

export async function listPermissions(): Promise<Permission[]> {
  await ensurePermissionsReadPermission()

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
  await ensurePermissionsReadPermission()

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
  await ensureRoleManagementPermission()

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
  await ensurePermissionsReadPermission()

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
  await ensureRoleManagementPermission()

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

export async function deleteRoleGroup(roleId: number): Promise<void> {
  await ensureRoleManagementPermission()

  const API_BASE = resolveBackendBaseUrl()
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/permissions/groups/${roleId}`, {
    method: 'DELETE',
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || 'Failed to delete role group')
  }
}

export async function assignPermissionToRole(roleId: number, permissionId: number): Promise<void> {
  await ensureRoleManagementPermission()

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
  await ensureRoleManagementPermission()

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
  if (typeof userId === 'number') {
    await ensurePermissionsReadPermission()
  }

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
  await ensureAnyPermission(['settings.manage_team', 'settings.manage_roles'])

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
  await ensureAnyPermission(['settings.manage_team', 'settings.manage_roles'])

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
  const headers = await getAuthHeaders()
  const configuredBackend = (
    process.env.NEXT_PUBLIC_RUST_URL
    || process.env.NEXT_PUBLIC_API_URL
    || ''
  ).trim()

  // The local sandbox is deliberately self-contained. Authentication is
  // already required by getAuthHeaders; without a configured Rust backend
  // there is no external RBAC service to query.
  if (!configuredBackend) {
    return { has_permission: true, source: 'system_role' }
  }

  const API_BASE = resolveBackendBaseUrl()

  const result = await fetchPermissionCheck(API_BASE, headers, code)
  if (result?.has_permission === true) return result

  // A signed local administrator session is authoritative when the optional
  // Rust backend is not running. This keeps the sandbox usable without
  // accepting an unsigned role claim from a user-controlled cookie.
  if (await hasLocalAdminRole()) {
    return { has_permission: true, source: 'system_role' }
  }

  // Compatibility bridge for backends deployed before messaging.* permission
  // rows existed. The existing settings permissions still enforce RBAC; this
  // can be removed after every backend has migrated the new permission codes.
  const legacyCode = LEGACY_PERMISSION_FALLBACKS[code]
  if (legacyCode) {
    const legacyResult = await fetchPermissionCheck(API_BASE, headers, legacyCode)
    if (legacyResult?.has_permission === true) {
      return { has_permission: true, source: legacyResult.source }
    }
  }

  if (!result) throw new Error('Failed to check permission')

  return result
}
