'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from '@/lib/actions/storefront-scope'
import type { ApiResponse, CustomLink, CustomLinkDetail, CustomLinkSummary } from '@/lib/types'

function parsePositiveInt(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function resolveBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

function resolvePublicStoreId(): number {
  const candidates: Array<string | number | null | undefined> = [
    process.env.NEXT_PUBLIC_STORE_ID,
    process.env.STORE_ID,
    1,
  ]

  for (const candidate of candidates) {
    const parsed = parsePositiveInt(candidate)
    if (parsed) return parsed
  }

  return 1
}

function mapCustomLink(raw: any): CustomLink {
  return {
    id: String(raw?.id ?? ''),
    storeId: Number(raw?.store_id ?? 0),
    name: String(raw?.name ?? ''),
    slug: String(raw?.slug ?? ''),
    isActive: Boolean(raw?.is_active),
    startsAt: raw?.starts_at ? String(raw.starts_at) : null,
    endsAt: raw?.ends_at ? String(raw.ends_at) : null,
    createdBy: raw?.created_by != null ? String(raw.created_by) : null,
    updatedBy: raw?.updated_by != null ? String(raw.updated_by) : null,
    createdAt: String(raw?.created_at ?? ''),
    updatedAt: String(raw?.updated_at ?? ''),
  }
}

function readErrorMessage(raw: string, fallback: string): string {
  const text = raw.trim()
  if (!text) return fallback
  try {
    const json = JSON.parse(text) as { message?: string; error?: string }
    if (typeof json?.message === 'string' && json.message.trim()) return json.message
    if (typeof json?.error === 'string' && json.error.trim()) return json.error
  } catch {
    return text
  }
  return text
}

async function buildAdminHeaders() {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  return {
    'Content-Type': 'application/json',
    ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
  } as HeadersInit
}

export async function listCustomLinksAction(): Promise<ApiResponse<CustomLinkSummary[]>> {
  try {
    const base = resolveBaseUrl()
    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

    const res = await fetch(`${base}/custom-links`, {
      headers: await buildAdminHeaders(),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: readErrorMessage(text, 'Erro ao listar links personalizados') }
    }

    const payload = (await res.json()) as any[]
    const data: CustomLinkSummary[] = (Array.isArray(payload) ? payload : []).map((item) => ({
      id: String(item?.id ?? ''),
      name: String(item?.name ?? ''),
      slug: String(item?.slug ?? ''),
      isActive: Boolean(item?.is_active),
      productCount: Number(item?.product_count ?? 0),
      clicks: Number(item?.clicks ?? 0),
      orders: Number(item?.orders ?? 0),
      createdAt: String(item?.created_at ?? ''),
    }))

    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado ao listar links' }
  }
}

export async function getCustomLinkAction(id: string): Promise<ApiResponse<CustomLinkDetail>> {
  try {
    const base = resolveBaseUrl()
    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

    const res = await fetch(`${base}/custom-links/${id}`, {
      headers: await buildAdminHeaders(),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: readErrorMessage(text, 'Erro ao buscar link personalizado') }
    }

    const payload = await res.json()
    const link = mapCustomLink(payload?.link)
    const productIds = Array.isArray(payload?.product_ids)
      ? payload.product_ids.map((v: unknown) => String(v))
      : []

    return { success: true, data: { link, productIds } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado ao buscar link' }
  }
}

export async function createCustomLinkAction(input: {
  name: string
  slug: string
  productIds: string[]
  isActive?: boolean
}): Promise<ApiResponse<CustomLinkDetail>> {
  try {
    const base = resolveBaseUrl()
    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

    const body = {
      name: input.name,
      slug: input.slug,
      is_active: input.isActive ?? true,
      product_ids: (input.productIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0),
    }

    const res = await fetch(`${base}/custom-links`, {
      method: 'POST',
      headers: await buildAdminHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: readErrorMessage(text, 'Erro ao criar link personalizado') }
    }

    const payload = await res.json()
    const link = mapCustomLink(payload?.link)
    const productIds = Array.isArray(payload?.product_ids)
      ? payload.product_ids.map((v: unknown) => String(v))
      : []

    revalidatePath('/custom-links')
    return { success: true, data: { link, productIds } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado ao criar link' }
  }
}

export async function updateCustomLinkAction(
  id: string,
  input: {
    name?: string
    slug?: string
    productIds?: string[]
    isActive?: boolean
  },
): Promise<ApiResponse<CustomLinkDetail>> {
  try {
    const base = resolveBaseUrl()
    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

    const body: Record<string, unknown> = {}
    if (typeof input.name === 'string') body.name = input.name
    if (typeof input.slug === 'string') body.slug = input.slug
    if (typeof input.isActive === 'boolean') body.is_active = input.isActive
    if (Array.isArray(input.productIds)) {
      body.product_ids = input.productIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    }

    const res = await fetch(`${base}/custom-links/${id}`, {
      method: 'PUT',
      headers: await buildAdminHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: readErrorMessage(text, 'Erro ao atualizar link personalizado') }
    }

    const payload = await res.json()
    const link = mapCustomLink(payload?.link)
    const productIds = Array.isArray(payload?.product_ids)
      ? payload.product_ids.map((v: unknown) => String(v))
      : []

    revalidatePath('/custom-links')
    revalidatePath(`/custom-links/${id}`)
    return { success: true, data: { link, productIds } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado ao atualizar link' }
  }
}

export async function deleteCustomLinkAction(id: string): Promise<ApiResponse<void>> {
  try {
    const base = resolveBaseUrl()
    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

    const res = await fetch(`${base}/custom-links/${id}`, {
      method: 'DELETE',
      headers: await buildAdminHeaders(),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: readErrorMessage(text, 'Erro ao excluir link personalizado') }
    }

    revalidatePath('/custom-links')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado ao excluir link' }
  }
}

export async function getCustomLinkBySlugAction(slug: string): Promise<ApiResponse<CustomLinkDetail>> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const scopedStoreId = storeId || resolvePublicStoreId()

    return getCustomLinkBySlugForStoreAction(slug, scopedStoreId)
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado ao buscar link por slug' }
  }
}

export async function getCustomLinkBySlugPublicAction(slug: string): Promise<ApiResponse<CustomLinkDetail>> {
  try {
    const base = resolveBaseUrl()
    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

    const res = await fetch(`${base}/custom-links/public/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: readErrorMessage(text, 'Link personalizado não encontrado') }
    }

    const payload = await res.json()
    const link = mapCustomLink(payload?.link)
    const productIds = Array.isArray(payload?.product_ids)
      ? payload.product_ids.map((v: unknown) => String(v))
      : []

    return { success: true, data: { link, productIds } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado ao buscar link público por slug' }
  }
}

export async function getCustomLinkBySlugForStoreAction(
  slug: string,
  storeId: number,
): Promise<ApiResponse<CustomLinkDetail>> {
  try {
    const base = resolveBaseUrl()
    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

    const apiKey = await resolveStorefrontApiKeyFromRequest(storeId)
    if (!apiKey) return { success: false, error: 'X-API-Key da loja não encontrada' }

    const res = await fetch(`${base}/custom-links/slug/${encodeURIComponent(slug)}`, {
      headers: withStorefrontScopeHeaders({}, apiKey),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: readErrorMessage(text, 'Link personalizado não encontrado') }
    }

    const payload = await res.json()
    const link = mapCustomLink(payload?.link)
    const productIds = Array.isArray(payload?.product_ids)
      ? payload.product_ids.map((v: unknown) => String(v))
      : []

    return { success: true, data: { link, productIds } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado ao buscar link por slug' }
  }
}

export async function registerCustomLinkClickAction(linkId: string): Promise<ApiResponse<void>> {
  try {
    const base = resolveBaseUrl()
    if (!base) return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }

    const res = await fetch(`${base}/custom-links/${encodeURIComponent(linkId)}/click`, {
      method: 'POST',
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: readErrorMessage(text, 'Erro ao registrar clique do link') }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro inesperado ao registrar clique' }
  }
}
