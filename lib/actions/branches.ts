'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import type { ApiResponse, Branch, BranchStatus, CreateBranchInput, UpdateBranchInput } from '@/lib/types'

export interface AdminUserOption {
  id: string
  name: string
  email: string
  role: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('adminAuthToken')?.value ?? null
}

async function readBackendError(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text()
    if (!text) return fallback
    try {
      const payload = JSON.parse(text) as { message?: string; error?: string }
      if (payload?.message) return payload.message
      if (payload?.error) return payload.error
    } catch {
      // plain text
    }
    return text
  } catch {
    return fallback
  }
}

function transformBranch(raw: Record<string, unknown>): Branch {
  const meta = (raw.meta && typeof raw.meta === 'object')
    ? (raw.meta as Record<string, unknown>)
    : {}

  return {
    id: String(raw.id || ''),
    storeId: Number(raw.store_id ?? raw.storeId ?? 0),
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    status: (raw.status === 'inactive' ? 'inactive' : 'active') as BranchStatus,
    isDefault: Boolean(raw.is_default ?? raw.isDefault ?? false),
    city: raw.city ? String(raw.city) : null,
    state: raw.state ? String(raw.state) : null,
    description: raw.description ? String(raw.description) : null,
    responsibleName: (raw.responsible_name ?? meta.responsible_name)
      ? String(raw.responsible_name ?? meta.responsible_name)
      : null,
    contactWhatsapp: (raw.contact_whatsapp ?? meta.contact_whatsapp)
      ? String(raw.contact_whatsapp ?? meta.contact_whatsapp)
      : null,
    contactEmail: (raw.contact_email ?? meta.contact_email)
      ? String(raw.contact_email ?? meta.contact_email)
      : null,
    themeConfig:
      (raw.theme_config && typeof raw.theme_config === 'object')
        ? (raw.theme_config as Record<string, unknown>)
        : null,
    seoConfig:
      (raw.seo_config && typeof raw.seo_config === 'object')
        ? (raw.seo_config as Record<string, unknown>)
        : null,
    trackingConfig:
      (raw.tracking_config && typeof raw.tracking_config === 'object')
        ? (raw.tracking_config as Record<string, unknown>)
        : null,
    catalogConfig:
      (raw.catalog_config && typeof raw.catalog_config === 'object')
        ? (raw.catalog_config as Record<string, unknown>)
        : null,
    pricingTableId: (raw.pricing_table_id ?? raw.pricingTableId)
      ? String(raw.pricing_table_id ?? raw.pricingTableId)
      : null,
    salesChannelCode: (raw.sales_channel_code ?? raw.salesChannelCode)
      ? String(raw.sales_channel_code ?? raw.salesChannelCode)
      : null,
    createdAt: new Date(String(raw.created_at ?? raw.createdAt ?? new Date())),
    updatedAt: new Date(String(raw.updated_at ?? raw.updatedAt ?? new Date())),
    deletedAt: (raw.deleted_at ?? raw.deletedAt)
      ? new Date(String(raw.deleted_at ?? raw.deletedAt))
      : null,
  }
}

function buildBranchPayload(input: CreateBranchInput | UpdateBranchInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if ('name' in input && input.name !== undefined) payload.name = input.name
  if ('slug' in input && input.slug !== undefined) payload.slug = input.slug
  if ('status' in input && input.status !== undefined) payload.status = input.status
  if ('isDefault' in input && input.isDefault !== undefined) payload.is_default = input.isDefault
  if ('city' in input) payload.city = input.city ?? null
  if ('state' in input) payload.state = input.state ?? null
  if ('description' in input) payload.description = input.description ?? null
  if ('responsibleName' in input) payload.responsible_name = input.responsibleName ?? null
  if ('contactWhatsapp' in input) payload.contact_whatsapp = input.contactWhatsapp ?? null
  if ('contactEmail' in input) payload.contact_email = input.contactEmail ?? null
  if ('themeConfig' in input) payload.theme_config = input.themeConfig ?? null
  if ('seoConfig' in input) payload.seo_config = input.seoConfig ?? null
  if ('trackingConfig' in input) payload.tracking_config = input.trackingConfig ?? null
  if ('catalogConfig' in input) payload.catalog_config = input.catalogConfig ?? null
  if ('pricingTableId' in input) payload.pricing_table_id = input.pricingTableId ?? null
  if ('salesChannelCode' in input) payload.sales_channel_code = input.salesChannelCode ?? null

  return payload
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Fetch active admin users for the responsible-person dropdown in the branch form.
 * Uses the existing /admin/users endpoint (same as the Users page).
 * Returns a minimal shape — only what the dropdown needs.
 * Backend endpoint: GET /admin/users?store_id={storeId}&perPage=200
 */
export async function getAdminUsersForSelectAction(): Promise<ApiResponse<AdminUserOption[]>> {
  const base = resolveBackendBaseUrl()
  const storeId = await getAdminStoreIdFromToken()
  const token = await getAuthCookie()

  if (!base || !token) {
    return { success: true, data: [] }
  }

  try {
    const url = new URL('/admin/users', base)
    url.searchParams.set('perPage', '200')
    if (storeId) url.searchParams.set('store_id', String(storeId))

    const response = await fetch(url.toString(), {
      headers: { cookie: `adminAuthToken=${token}` },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: true, data: [] }
    }

    const raw = await response.json() as unknown
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as Record<string, unknown>)?.data)
        ? ((raw as Record<string, unknown>).data as unknown[])
        : (raw as Record<string, unknown>)?.items
          ? ((raw as Record<string, unknown>).items as unknown[])
          : []

    const users: AdminUserOption[] = list
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .filter((item) => Boolean(item.active ?? item.is_active ?? true))
      .filter((item) => {
        const role = String(item.role || '').toUpperCase()
        return !['B2B_CUSTOMER', 'PENDING'].includes(role)
      })
      .map((item) => ({
        id: String(item.id || ''),
        name: String(item.name || ''),
        email: String(item.email || ''),
        role: String(item.role || ''),
      }))
      .filter((u) => u.id && u.name)

    return { success: true, data: users }
  } catch {
    return { success: true, data: [] }
  }
}

/**
 * List all branches for the current store.
 * Backend endpoint: GET /stores/{storeId}/branches
 */
export async function getBranchesAction(): Promise<ApiResponse<Branch[]>> {
  const base = resolveBackendBaseUrl()
  const storeId = await getAdminStoreIdFromToken()
  const token = await getAuthCookie()

  if (!base || !storeId || !token) {
    return { success: true, data: [] }
  }

  try {
    const response = await fetch(`${base}/stores/${storeId}/branches`, {
      headers: { cookie: `adminAuthToken=${token}` },
      cache: 'no-store',
    })

    if (response.status === 404) {
      // Backend endpoint not yet implemented — return empty gracefully
      return { success: true, data: [] }
    }

    if (!response.ok) {
      const msg = await readBackendError(response, 'Erro ao carregar filiais')
      return { success: false, error: msg }
    }

    const raw = await response.json() as unknown
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as Record<string, unknown>)?.data)
        ? ((raw as Record<string, unknown>).data as unknown[])
        : []

    const branches = list
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map(transformBranch)
      .filter(b => b.deletedAt === null)

    return { success: true, data: branches }
  } catch {
    return { success: true, data: [] }
  }
}

/**
 * Get a single branch by id.
 * Backend endpoint: GET /stores/{storeId}/branches/{branchId}
 */
export async function getBranchAction(branchId: string): Promise<ApiResponse<Branch>> {
  const base = resolveBackendBaseUrl()
  const storeId = await getAdminStoreIdFromToken()
  const token = await getAuthCookie()

  if (!base || !storeId || !token) {
    return { success: false, error: 'Configuração inválida' }
  }

  try {
    const response = await fetch(`${base}/stores/${storeId}/branches/${branchId}`, {
      headers: { cookie: `adminAuthToken=${token}` },
      cache: 'no-store',
    })

    if (!response.ok) {
      const msg = await readBackendError(response, 'Filial não encontrada')
      return { success: false, error: msg }
    }

    const raw = await response.json() as Record<string, unknown>
    return { success: true, data: transformBranch(raw) }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Create a new branch.
 * Backend endpoint: POST /stores/{storeId}/branches
 *
 * Slug must be unique per store and URL-friendly.
 */
export async function createBranchAction(input: CreateBranchInput): Promise<ApiResponse<Branch>> {
  const base = resolveBackendBaseUrl()
  const storeId = await getAdminStoreIdFromToken()
  const token = await getAuthCookie()

  if (!base || !storeId || !token) {
    return { success: false, error: 'Configuração inválida' }
  }

  const payload = buildBranchPayload(input)

  try {
    const response = await fetch(`${base}/stores/${storeId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `adminAuthToken=${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const msg = await readBackendError(response, 'Erro ao criar filial')
      return { success: false, error: msg }
    }

    const raw = await response.json() as Record<string, unknown>
    revalidatePath('/branches')
    revalidatePath('/')
    return { success: true, data: transformBranch(raw) }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Update an existing branch.
 * Backend endpoint: PATCH /stores/{storeId}/branches/{branchId}
 */
export async function updateBranchAction(
  branchId: string,
  input: UpdateBranchInput,
): Promise<ApiResponse<Branch>> {
  const base = resolveBackendBaseUrl()
  const storeId = await getAdminStoreIdFromToken()
  const token = await getAuthCookie()

  if (!base || !storeId || !token) {
    return { success: false, error: 'Configuração inválida' }
  }

  const payload = buildBranchPayload(input)

  try {
    const response = await fetch(`${base}/stores/${storeId}/branches/${branchId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `adminAuthToken=${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const msg = await readBackendError(response, 'Erro ao atualizar filial')
      return { success: false, error: msg }
    }

    const raw = await response.json() as Record<string, unknown>
    revalidatePath('/branches')
    revalidatePath('/')
    return { success: true, data: transformBranch(raw) }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Soft-delete a branch (sets deleted_at, does not remove record).
 * Backend endpoint: DELETE /stores/{storeId}/branches/{branchId}
 */
export async function deleteBranchAction(branchId: string): Promise<ApiResponse<void>> {
  const base = resolveBackendBaseUrl()
  const storeId = await getAdminStoreIdFromToken()
  const token = await getAuthCookie()

  if (!base || !storeId || !token) {
    return { success: false, error: 'Configuração inválida' }
  }

  try {
    const response = await fetch(`${base}/stores/${storeId}/branches/${branchId}`, {
      method: 'DELETE',
      headers: { cookie: `adminAuthToken=${token}` },
    })

    if (!response.ok) {
      const msg = await readBackendError(response, 'Erro ao remover filial')
      return { success: false, error: msg }
    }

    revalidatePath('/branches')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Toggle a branch active/inactive.
 * Backend endpoint: PATCH /stores/{storeId}/branches/{branchId}  { status }
 */
export async function toggleBranchStatusAction(
  branchId: string,
  status: BranchStatus,
): Promise<ApiResponse<Branch>> {
  return updateBranchAction(branchId, { status })
}

/**
 * Set a branch as the default for the store.
 * Backend endpoint: POST /stores/{storeId}/branches/{branchId}/set-default
 * Falls back to PATCH if the dedicated endpoint doesn't exist.
 */
export async function setDefaultBranchAction(branchId: string): Promise<ApiResponse<Branch>> {
  const base = resolveBackendBaseUrl()
  const storeId = await getAdminStoreIdFromToken()
  const token = await getAuthCookie()

  if (!base || !storeId || !token) {
    return { success: false, error: 'Configuração inválida' }
  }

  try {
    // Try dedicated set-default endpoint first
    const response = await fetch(`${base}/stores/${storeId}/branches/${branchId}/set-default`, {
      method: 'POST',
      headers: { cookie: `adminAuthToken=${token}` },
    })

    if (response.ok) {
      const raw = await response.json() as Record<string, unknown>
      revalidatePath('/branches')
      revalidatePath('/')
      return { success: true, data: transformBranch(raw) }
    }

    // Fallback: PATCH with is_default flag
    return updateBranchAction(branchId, { isDefault: true })
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Duplicate an existing branch with a new name and slug.
 * Backend endpoint: POST /stores/{storeId}/branches/{branchId}/duplicate
 * Falls back to client-side create if the dedicated endpoint doesn't exist.
 */
export async function duplicateBranchAction(
  branchId: string,
  overrides: { name: string; slug: string },
): Promise<ApiResponse<Branch>> {
  const base = resolveBackendBaseUrl()
  const storeId = await getAdminStoreIdFromToken()
  const token = await getAuthCookie()

  if (!base || !storeId || !token) {
    return { success: false, error: 'Configuração inválida' }
  }

  try {
    // Try dedicated duplicate endpoint first
    const response = await fetch(`${base}/stores/${storeId}/branches/${branchId}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `adminAuthToken=${token}`,
      },
      body: JSON.stringify({ name: overrides.name, slug: overrides.slug }),
    })

    if (response.ok) {
      const raw = await response.json() as Record<string, unknown>
      revalidatePath('/branches')
      revalidatePath('/')
      return { success: true, data: transformBranch(raw) }
    }

    // Fallback: fetch source and create copy
    const sourceResult = await getBranchAction(branchId)
    if (!sourceResult.success || !sourceResult.data) {
      return { success: false, error: 'Filial de origem não encontrada' }
    }

    const source = sourceResult.data
    return createBranchAction({
      name: overrides.name,
      slug: overrides.slug,
      status: 'inactive', // duplicates start inactive
      isDefault: false,
      city: source.city,
      state: source.state,
      description: source.description,
      responsibleName: source.responsibleName,
      contactWhatsapp: source.contactWhatsapp,
      contactEmail: source.contactEmail,
      themeConfig: source.themeConfig,
      seoConfig: source.seoConfig,
      trackingConfig: source.trackingConfig,
      catalogConfig: source.catalogConfig,
      pricingTableId: source.pricingTableId,
      salesChannelCode: source.salesChannelCode,
    })
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
