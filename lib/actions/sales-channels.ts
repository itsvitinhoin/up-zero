'use server'

import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'

const RUST_URL = (process.env.NEXT_PUBLIC_RUST_URL || process.env.RUST_URL || 'http://localhost:8080').replace(/\/$/, '')

export interface SalesChannel {
  id: number
  store_id: number
  name: string
  code: string
  description: string | null
  is_default: boolean
  is_active: boolean
  min_qty: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ChannelPrice {
  id: number
  variant_id: number
  channel_id: number
  price_cents: number
  promo_cents: number
  is_active: boolean
  sku: string | null
  product_name: string | null
  product_code: string | null
  combination_key: string | null
  base_price_cents: number
}

type AdminScopeResult =
  | { success: true; adminToken: string; storeId: number }
  | { success: false; error: string }

async function resolveAdminScope(): Promise<AdminScopeResult> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  if (!adminToken) {
    return { success: false, error: 'Não autenticado' }
  }

  const storeId = await getAdminStoreIdFromToken()
  if (!storeId) {
    return { success: false, error: 'Loja do admin não identificada' }
  }

  return { success: true, adminToken, storeId }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const text = (await res.text()).trim()
    if (!text) return fallback
    return text
  } catch {
    return fallback
  }
}

// ─── Channels ────────────────────────────────────────────────────────────────

export async function getSalesChannelsAction(): Promise<{ success: boolean; data?: SalesChannel[]; error?: string }> {
  try {
    const scope = await resolveAdminScope()
    if (!scope.success) return scope

    const res = await fetch(`${RUST_URL}/sales-channels?store_id=${scope.storeId}`, {
      headers: {
        cookie: `adminAuthToken=${scope.adminToken}`,
      },
      cache: 'no-store',
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Erro ao listar canais de venda') }
    return { success: true, data: await res.json() }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function createSalesChannelAction(data: {
  name: string
  code: string
  description?: string
  is_default?: boolean
  is_active?: boolean
  min_qty?: number
  sort_order?: number
}): Promise<{ success: boolean; data?: SalesChannel; error?: string }> {
  try {
    const scope = await resolveAdminScope()
    if (!scope.success) return scope

    const res = await fetch(`${RUST_URL}/sales-channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `adminAuthToken=${scope.adminToken}`,
      },
      body: JSON.stringify({ ...data, store_id: scope.storeId }),
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Erro ao criar canal de venda') }
    return { success: true, data: await res.json() }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function updateSalesChannelAction(
  id: number,
  data: Partial<Omit<SalesChannel, 'id' | 'store_id' | 'code' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; data?: SalesChannel; error?: string }> {
  try {
    const scope = await resolveAdminScope()
    if (!scope.success) return scope

    const res = await fetch(`${RUST_URL}/sales-channels/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: `adminAuthToken=${scope.adminToken}`,
      },
      body: JSON.stringify(data),
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Erro ao atualizar canal de venda') }
    return { success: true, data: await res.json() }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function deleteSalesChannelAction(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await resolveAdminScope()
    if (!scope.success) return scope

    const res = await fetch(`${RUST_URL}/sales-channels/${id}`, {
      method: 'DELETE',
      headers: {
        cookie: `adminAuthToken=${scope.adminToken}`,
      },
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Erro ao remover canal de venda') }
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ─── Prices ──────────────────────────────────────────────────────────────────

export async function getChannelPricesAction(
  channelId: number,
  opts?: { search?: string; storeId?: number }
): Promise<{ success: boolean; data?: ChannelPrice[]; error?: string }> {
  try {
    const scope = await resolveAdminScope()
    if (!scope.success) return scope

    const params = new URLSearchParams({ store_id: String(opts?.storeId ?? scope.storeId) })
    if (opts?.search) params.set('search', opts.search)

    const res = await fetch(`${RUST_URL}/sales-channels/${channelId}/prices?${params}`, {
      headers: {
        cookie: `adminAuthToken=${scope.adminToken}`,
      },
      cache: 'no-store',
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Erro ao listar preços por canal') }
    return { success: true, data: await res.json() }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function upsertChannelPricesAction(
  channelId: number,
  prices: { variant_id: number; price_cents: number; promo_cents?: number; is_active?: boolean }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await resolveAdminScope()
    if (!scope.success) return scope

    const res = await fetch(`${RUST_URL}/sales-channels/${channelId}/prices`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: `adminAuthToken=${scope.adminToken}`,
      },
      body: JSON.stringify(prices),
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Erro ao salvar preços do canal') }
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function deleteChannelPriceAction(
  channelId: number,
  variantId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await resolveAdminScope()
    if (!scope.success) return scope

    const res = await fetch(`${RUST_URL}/sales-channels/${channelId}/prices/${variantId}`, {
      method: 'DELETE',
      headers: {
        cookie: `adminAuthToken=${scope.adminToken}`,
      },
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Erro ao remover preço do canal') }
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
