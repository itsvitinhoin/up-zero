'use server'

import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import type { ApiResponse } from '@/lib/types'

export interface Admin {
  id: number
  name: string
  email: string
  role: string
  active: boolean
  storeId: number | null
  createdAt: string
  updatedAt: string
}

type PermissionSummary = {
  permissions_from_role?: Array<{ code?: string }>
  permission_overrides?: Array<[{ code?: string }, boolean]>
}

const CUSTOMER_SUPPORT_PERMISSION = 'customers.support'

function resolveBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

export async function getAdminsAction(): Promise<ApiResponse<Admin[]>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const scopedStoreId = await getAdminStoreIdFromToken()

    const response = await fetch(`${baseUrl}/admins`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { 
        success: false, 
        error: `HTTP ${response.status}: Erro ao buscar vendedoras` 
      }
    }

    const admins = (await response.json()) as Array<Record<string, unknown>>
    const transformedAdmins = admins.map((admin) => ({
      id: Number(admin.id || 0),
      name: String(admin.name || ''),
      email: String(admin.email || ''),
      role: String(admin.role || ''),
      active: Boolean(admin.active),
      storeId: admin.store_id ? Number(admin.store_id) : null,
      createdAt: String(admin.created_at || ''),
      updatedAt: String(admin.updated_at || ''),
    }))

    const scopedAdmins = transformedAdmins.filter((admin) => {
      if (!admin.active) return false

      if (typeof scopedStoreId === 'number' && scopedStoreId > 0) {
        return admin.storeId === scopedStoreId
      }

      return true
    })

    const withSupportPermission = await Promise.all(
      scopedAdmins.map(async (admin) => {
        const permissionsResponse = await fetch(
          `${baseUrl}/permissions/user/${admin.id}/permissions`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
            },
            cache: 'no-store',
          }
        )

        if (!permissionsResponse.ok) {
          return null
        }

        const summary = (await permissionsResponse.json()) as PermissionSummary
        const rolePermissions = Array.isArray(summary.permissions_from_role)
          ? summary.permissions_from_role
          : []
        const overrides = Array.isArray(summary.permission_overrides)
          ? summary.permission_overrides
          : []

        const overrideForSupport = overrides.find(
          ([permission]) => permission?.code === CUSTOMER_SUPPORT_PERMISSION
        )

        const hasSupportPermission =
          overrideForSupport !== undefined
            ? Boolean(overrideForSupport[1])
            : rolePermissions.some(
                (permission) => permission?.code === CUSTOMER_SUPPORT_PERMISSION
              )

        return hasSupportPermission ? admin : null
      })
    )

    const filteredAdmins = withSupportPermission.filter(
      (admin): admin is Admin => admin !== null
    )

    return { success: true, data: filteredAdmins }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao buscar atendentes',
    }
  }
}
