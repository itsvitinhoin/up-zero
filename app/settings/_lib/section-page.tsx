import AdminSettingsPageClient from "@/components/admin/admin-settings-page-client"
import { AdminRouteSkeleton } from "@/components/admin/admin-route-skeleton"
import { cookies } from "next/headers"
import { Suspense } from "react"
import {
  getSiteSettingsAction,
  getStoreProfileAction,
  getCustomerSupportAdminsAction,
  type StoreProfileConfig,
} from "@/lib/actions/settings"
import { getCategoriesAction } from "@/lib/actions/categories"
import { getAdminSession } from "@/lib/actions/auth"
import { getFiscalNaturesAction, type FiscalOperationNature } from "@/lib/actions/fiscal"
import { getBranchesAction, getAdminUsersForSelectAction, type AdminUserOption } from "@/lib/actions/branches"
import {
  getWmsLocationsAction,
  getWmsWarehousesAction,
  type WmsLocation,
  type WmsWarehouse,
} from "@/lib/actions/wms"
import {
  getRoleWithPermissions,
  listPermissions,
  listRoleGroups,
} from "@/lib/actions/permissions"
import type { Permission, RoleGroup } from "@/lib/permissions"
import type { Branch, Category, SiteSettings, User } from "@/lib/types"
import type { RoleWithPermissions, SettingsPageKey } from "@/components/admin/settings/settings-types"
import { redirect } from "next/navigation"
import { ensureAdminPermission } from "@/lib/server-admin-permissions"

const SECTION_TITLES: Record<SettingsPageKey, string> = {
  general: "General",
  permissions: "Permissions",
  b2b: "B2B",
  appearance: "Appearance",
  payments: "Payments",
  shipping: "Shipping",
  marketing: "Marketing",
  domain: "Domain",
  billing: "Billing",
  stock: "Stock",
  "stock-warehouses": "Stock Warehouses",
  "stock-locations": "Stock Locations",
  integrations: "Integrations",
  erp: "ERP",
  fiscal: "Fiscal",
  branches: "Branches",
}

export function buildSectionMetadata(section: SettingsPageKey) {
  return {
    title: `Settings - ${SECTION_TITLES[section]} | Admin`,
    description: "Configure your B2B store rules, appearance, and payments",
  }
}

export function SettingsSectionPage({ section }: { section: SettingsPageKey }) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <SettingsSectionPageContent section={section} />
    </Suspense>
  )
}

async function SettingsSectionPageContent({ section }: { section: SettingsPageKey }) {
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"

  await ensureAdminPermission("settings.view")

  if (section === "permissions") {
    await ensureAdminPermission("settings.manage_roles", "/settings/general")
  }

  if (section === "stock-warehouses" || section === "stock-locations") {
    await ensureAdminPermission("settings.edit", "/settings/stock")
  }

  if (section === "stock") {
    await ensureAdminPermission("inventory.view", "/settings/general")
  }

  if (section === "stock-warehouses" || section === "stock-locations") {
    await ensureAdminPermission("inventory.edit", "/settings/stock")
  }

  const adminSession = await getAdminSession()
  if (!adminSession) {
    redirect("/login")
  }

  let initialSettings: SiteSettings | null = null
  let initialCategories: Category[] = []
  let initialStoreProfile: StoreProfileConfig | null = null
  let initialSellerUsers: User[] = []
  let initialFiscalNatures: FiscalOperationNature[] = []
  let initialBranches: Branch[] = []
  let initialBranchAdmins: AdminUserOption[] = []
  let initialWmsWarehouses: WmsWarehouse[] = []
  let initialWmsLocations: WmsLocation[] = []
  let initialWmsLoadError: string | null = null
  let initialPermissions: Permission[] = []
  let initialRoleGroups: RoleGroup[] = []
  let initialSelectedRoleDetails: RoleWithPermissions | null = null

  const fetchWmsWarehouses = getWmsWarehousesAction as unknown as () => Promise<unknown>
  const fetchWmsLocations = getWmsLocationsAction as unknown as () => Promise<unknown>

  try {
    const shouldLoadSettings = !["branches", "stock-warehouses", "stock-locations"].includes(section)
    const shouldLoadCategories = section === "appearance"
    const shouldLoadStoreProfile = section === "general" || section === "b2b"
    const shouldLoadSellerUsers = section === "b2b"

    const settingsIncludeBySection: Partial<Record<SettingsPageKey, Record<string, boolean>>> = {
      general: { b2b: true, stock: true },
      b2b: { b2b: true, stock: true },
      appearance: { theme: true, product: true },
      payments: { payment: true },
      shipping: { shippingFixed: true, shipping: true },
      marketing: { marketing: true },
      domain: { domain: true },
      erp: { erp: true },
      stock: { stock: true },
      billing: {},
    }

    const settingsPromise = shouldLoadSettings
      ? getSiteSettingsAction(undefined, { include: settingsIncludeBySection[section] || {} })
      : Promise.resolve({ success: true, data: null as SiteSettings | null })

    const categoriesPromise = shouldLoadCategories
      ? getCategoriesAction()
      : Promise.resolve({ success: true, data: [] as Category[] })

    const storeProfilePromise = shouldLoadStoreProfile
      ? getStoreProfileAction()
      : Promise.resolve({ success: true, data: null as StoreProfileConfig | null })

    const sellerUsersPromise = shouldLoadSellerUsers
      ? getCustomerSupportAdminsAction()
      : Promise.resolve({ success: true, data: [] as User[] })

    const fiscalNaturesPromise =
      section === "fiscal"
        ? getFiscalNaturesAction()
        : Promise.resolve([] as FiscalOperationNature[])

    const branchesPromise =
      section === "branches"
        ? getBranchesAction()
        : Promise.resolve({ success: true, data: [] as Branch[] })

    const branchAdminsPromise =
      section === "branches"
        ? getAdminUsersForSelectAction()
        : Promise.resolve({ success: true, data: [] as AdminUserOption[] })

    const permissionsPromise =
      section === "permissions"
        ? listPermissions()
        : Promise.resolve([] as Permission[])

    const roleGroupsPromise =
      section === "permissions"
        ? listRoleGroups()
        : Promise.resolve([] as RoleGroup[])

    const [
      settingsResult,
      categoriesResult,
      storeProfileResult,
      sellerUsersResult,
      fiscalNaturesResult,
      branchesResult,
      branchAdminsResult,
      permissionsResult,
      roleGroupsResult,
    ] = await Promise.all([
      settingsPromise,
      categoriesPromise,
      storeProfilePromise,
      sellerUsersPromise,
      fiscalNaturesPromise,
      branchesPromise,
      branchAdminsPromise,
      permissionsPromise,
      roleGroupsPromise,
    ])

    if (shouldLoadSettings && settingsResult.success && settingsResult.data) {
      initialSettings = settingsResult.data
    }

    if (shouldLoadCategories && categoriesResult.success && categoriesResult.data) {
      initialCategories = categoriesResult.data
    }

    if (shouldLoadStoreProfile && storeProfileResult.success && storeProfileResult.data) {
      initialStoreProfile = storeProfileResult.data
    }

    if (shouldLoadSellerUsers && sellerUsersResult.success && sellerUsersResult.data) {
      initialSellerUsers = sellerUsersResult.data
    }

    initialFiscalNatures = fiscalNaturesResult

    if (branchesResult.success && branchesResult.data) {
      initialBranches = branchesResult.data
    }

    if (branchAdminsResult.success && branchAdminsResult.data) {
      initialBranchAdmins = branchAdminsResult.data
    }

    let wmsWarehousesResult: unknown = null
    let wmsLocationsResult: unknown = null

    if (section === "stock-warehouses" || section === "stock-locations") {
      wmsWarehousesResult = await fetchWmsWarehouses()
      const warehousesData = extractResultData<WmsWarehouse[]>(wmsWarehousesResult)
      if (warehousesData) {
        initialWmsWarehouses = warehousesData
      }
    }

    if (section === "stock-locations") {
      wmsLocationsResult = await fetchWmsLocations()
      const locationsData = extractResultData<WmsLocation[]>(wmsLocationsResult)
      if (locationsData) {
        initialWmsLocations = locationsData
      }
    }

    initialPermissions = permissionsResult
    initialRoleGroups = roleGroupsResult

    if (section === "permissions" && roleGroupsResult.length > 0) {
      initialSelectedRoleDetails = await getRoleWithPermissions(roleGroupsResult[0].id)
    }

    const wmsWarehousesError = extractResultError(wmsWarehousesResult)
    const wmsLocationsError = extractResultError(wmsLocationsResult)

    initialWmsLoadError = wmsWarehousesError || wmsLocationsError || null
  } catch (error) {
    console.error("Erro ao carregar dados de settings:", error)
  }

  return (
    <AdminSettingsPageClient
      locale={locale}
      currentPage={section}
      initialSettings={initialSettings}
      initialCategories={initialCategories}
      initialStoreProfile={initialStoreProfile}
      initialSellerUsers={initialSellerUsers}
      initialFiscalNatures={initialFiscalNatures}
      initialBranches={initialBranches}
      initialBranchAdmins={initialBranchAdmins}
      initialWmsWarehouses={initialWmsWarehouses}
      initialWmsLocations={initialWmsLocations}
      initialWmsLoadError={initialWmsLoadError}
      initialPermissions={initialPermissions}
      initialRoleGroups={initialRoleGroups}
      initialSelectedRoleDetails={initialSelectedRoleDetails}
    />
  )
}

const extractResultError = (result: unknown): string | null => {
  if (!result || typeof result !== "object" || !("error" in result)) {
    return null
  }
  const value = (result as { error?: unknown }).error
  if (value == null) return null
  return typeof value === "string" ? value : String(value)
}

function extractResultData<T>(result: unknown): T | null {
  if (!result || typeof result !== "object" || !("data" in result)) {
    return null
  }
  return (result as { data?: T | null }).data ?? null
}