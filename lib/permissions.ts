import { tAdmin } from "@/lib/i18n/admin"
import type { UserRole } from "@/lib/types"

export type PermissionKey =
  | "canViewDashboard"
  | "canManageCustomers"
  | "canManageOrders"
  | "canManageProducts"
  | "canManageCategories"
  | "canManagePriceTables"
  | "canManageCoupons"
  | "canManageUsers"
  | "canManageSettings"
  | "canViewReports"

export type PermissionMap = Record<PermissionKey, boolean>

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, PermissionMap> = {
  ADMIN: {
    canViewDashboard: true,
    canManageCustomers: true,
    canManageOrders: true,
    canManageProducts: true,
    canManageCategories: true,
    canManagePriceTables: true,
    canManageCoupons: true,
    canManageUsers: true,
    canManageSettings: true,
    canViewReports: true,
  },
  SALES_MANAGER: {
    canViewDashboard: true,
    canManageCustomers: true,
    canManageOrders: true,
    canManageProducts: true,
    canManageCategories: true,
    canManagePriceTables: true,
    canManageCoupons: true,
    canManageUsers: false,
    canManageSettings: false,
    canViewReports: true,
  },
  SELLER: {
    canViewDashboard: true,
    canManageCustomers: true,
    canManageOrders: true,
    canManageProducts: false,
    canManageCategories: false,
    canManagePriceTables: false,
    canManageCoupons: false,
    canManageUsers: false,
    canManageSettings: false,
    canViewReports: false,
  },
  B2B_CUSTOMER: {
    canViewDashboard: false,
    canManageCustomers: false,
    canManageOrders: false,
    canManageProducts: false,
    canManageCategories: false,
    canManagePriceTables: false,
    canManageCoupons: false,
    canManageUsers: false,
    canManageSettings: false,
    canViewReports: false,
  },
  PENDING: {
    canViewDashboard: false,
    canManageCustomers: false,
    canManageOrders: false,
    canManageProducts: false,
    canManageCategories: false,
    canManagePriceTables: false,
    canManageCoupons: false,
    canManageUsers: false,
    canManageSettings: false,
    canViewReports: false,
  },
}

type PermissionDefinition = {
  key: PermissionKey
  label: string
}

export function getPermissionsByCategory(locale?: string): Record<string, PermissionDefinition[]> {
  return {
    [tAdmin(locale, "admin.users.permissionCategory.general", "General")]: [
      { key: "canViewDashboard", label: tAdmin(locale, "admin.users.permission.canViewDashboard", "View dashboard") },
      { key: "canViewReports", label: tAdmin(locale, "admin.users.permission.canViewReports", "View reports") },
    ],
    [tAdmin(locale, "admin.users.permissionCategory.commercial", "Commercial")]: [
      { key: "canManageCustomers", label: tAdmin(locale, "admin.users.permission.canManageCustomers", "Manage customers") },
      { key: "canManageOrders", label: tAdmin(locale, "admin.users.permission.canManageOrders", "Manage orders") },
      { key: "canManageCoupons", label: tAdmin(locale, "admin.users.permission.canManageCoupons", "Manage coupons") },
      { key: "canManagePriceTables", label: tAdmin(locale, "admin.users.permission.canManagePriceTables", "Manage price tables") },
    ],
    [tAdmin(locale, "admin.users.permissionCategory.catalog", "Catalog")]: [
      { key: "canManageProducts", label: tAdmin(locale, "admin.users.permission.canManageProducts", "Manage products") },
      { key: "canManageCategories", label: tAdmin(locale, "admin.users.permission.canManageCategories", "Manage categories") },
    ],
    [tAdmin(locale, "admin.users.permissionCategory.administration", "Administration")]: [
      { key: "canManageUsers", label: tAdmin(locale, "admin.users.permission.canManageUsers", "Manage users") },
      { key: "canManageSettings", label: tAdmin(locale, "admin.users.permission.canManageSettings", "Manage settings") },
    ],
  }
}

// ============================================================================
// NEW RBAC SYSTEM WITH GRANULAR PERMISSIONS AND USER OVERRIDES
// ============================================================================

export type Permission = {
  id: number
  code: string
  description?: string
  group: string
  created_at: string
}

export type RoleGroup = {
  id: number
  store_id: number
  name: string
  description?: string
  is_system: boolean
  color?: string
  created_at: string
  updated_at: string
}

export type UserPermissionSummary = {
  user_id: number
  role_id?: number
  role_name?: string
  permissions_from_role: Permission[]
  permission_overrides: Array<[Permission, boolean]>
  total_permissions: number
}

export type PermissionSource = 'role' | 'override' | 'denied'

export type PermissionCheckResult = {
  has_permission: boolean
  source: PermissionSource
}

/**
 * Permission Groups
 */
export const PERMISSION_GROUPS = {
  PRODUCTS: 'products',
  ORDERS: 'orders',
  CUSTOMERS: 'customers',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  INVENTORY: 'inventory',
  CUSTOM_LINKS: 'custom_links',
  MESSAGING: 'messaging',
  ASSETS: 'assets',
  PRICES: 'prices',
  PAGES: 'pages',
}

/**
 * Check if current user has a permission
 */
export async function checkUserPermission(
  permissionCode: string
): Promise<PermissionCheckResult> {
  try {
    const response = await fetch(
      `/api/permissions/check?code=${encodeURIComponent(permissionCode)}`
    )

    if (!response.ok) {
      return { has_permission: false, source: 'denied' }
    }

    return response.json()
  } catch (error) {
    console.error('Error checking permission:', error)
    return { has_permission: false, source: 'denied' }
  }
}

/**
 * Get all permissions for current user
 */
export async function getUserPermissions(): Promise<UserPermissionSummary | null> {
  try {
    const response = await fetch('/api/permissions/my-permissions')

    if (!response.ok) return null

    return response.json()
  } catch (error) {
    console.error('Error fetching user permissions:', error)
    return null
  }
}

/**
 * Get role with all permissions
 */
export async function getRolePermissions(roleId: number): Promise<{
  role: RoleGroup
  permissions: Permission[]
}> {
  const response = await fetch(`/api/roles/${roleId}/permissions`)
  if (!response.ok) throw new Error('Failed to fetch role permissions')
  return response.json()
}

/**
 * Helper to check multiple permissions (AND logic)
 */
export async function hasAllPermissions(
  permissionCodes: string[]
): Promise<boolean> {
  const results = await Promise.all(
    permissionCodes.map(code => checkUserPermission(code))
  )
  return results.every(result => result.has_permission)
}

/**
 * Helper to check multiple permissions (OR logic)
 */
export async function hasAnyPermission(
  permissionCodes: string[]
): Promise<boolean> {
  const results = await Promise.all(
    permissionCodes.map(code => checkUserPermission(code))
  )
  return results.some(result => result.has_permission)
}

/**
 * Format permission code to readable text
 */
export function formatPermissionCode(code: string): string {
  return code
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' > ')
}

/**
 * Get UI color for permission group
 */
export function getGroupColor(group: string): string {
  const colors: Record<string, string> = {
    products: 'bg-blue-100 text-blue-800',
    orders: 'bg-green-100 text-green-800',
    customers: 'bg-purple-100 text-purple-800',
    reports: 'bg-yellow-100 text-yellow-800',
    settings: 'bg-gray-100 text-gray-800',
    inventory: 'bg-orange-100 text-orange-800',
    custom_links: 'bg-cyan-100 text-cyan-800',
    messaging: 'bg-indigo-100 text-indigo-800',
    assets: 'bg-emerald-100 text-emerald-800',
    prices: 'bg-rose-100 text-rose-800',
    pages: 'bg-teal-100 text-teal-800',
  }
  return colors[group] || 'bg-gray-100 text-gray-800'
}
