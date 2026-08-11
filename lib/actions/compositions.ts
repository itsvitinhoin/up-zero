'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getAdminSession } from '@/lib/actions/auth'

const RUST_URL = process.env.NEXT_PUBLIC_RUST_URL || process.env.RUST_URL || 'http://localhost:8080'

export interface Composition {
  id: number
  store_id: number
  code: string
  slug: string
  name: string
  description: string | null
  active: boolean
  selection_mode: 'PRODUCT' | 'IMAGE_LEVEL' | 'ASSET'
  pricing_mode: 'NONE' | 'ITEM_PERCENT' | 'ITEM_FIXED' | 'BUNDLE_PERCENT' | 'BUNDLE_FIXED'
  display_mode: 'GROUPED' | 'SPLIT'
  images_url: string
  videos_url: string
  total_discount_cents?: number
  total_composition_cents?: number
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface CompositionItem {
  id: number
  composition_id: number
  product_id: number
  variant_image_level_code: string | null
  asset_id: number | null
  quantity: number
  item_discount_mode: 'NONE' | 'PERCENT_BPS' | 'FIXED_CENTS'
  item_discount_value: number
  sort_order: number
  estimate: {
    avg_price_cents?: number
    subtotal_cents?: number
    discount_cents?: number
    total_cents?: number
    variant_count?: number
    product_name?: string
    image_url?: string
  } | null
  created_at: string
  updated_at: string
}

export interface CompositionItemsSummary {
  subtotal_cents: number
  discount_cents: number
  total_cents: number
}

export interface CompositionItemsResponse {
  items: CompositionItem[]
  summary: CompositionItemsSummary
}

export interface CreateCompositionItemPayload {
  product_id: number
  variant_image_level_code?: string | null
  asset_id?: number | null
  quantity: number
  item_discount_mode?: 'NONE' | 'PERCENT_BPS' | 'FIXED_CENTS'
  item_discount_value?: number
  sort_order?: number
}

export interface PaginatedCompositionsResponse {
  items: Composition[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface CompositionsQueryParams {
  search?: string
  active?: 'all' | 'active' | 'inactive'
  pricing_mode?: 'all' | 'NONE' | 'ITEM_PERCENT' | 'ITEM_FIXED'
  page?: number
  page_size?: number
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

async function getAdminCompositionHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const session = await getAdminSession()
  if (!session) {
    throw new Error('Não autenticado')
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  if (!adminToken) {
    throw new Error('Token admin não encontrado')
  }

  return {
    ...(extra || {}),
    cookie: `adminAuthToken=${adminToken}`,
    Authorization: `Bearer ${adminToken}`,
  }
}

async function readError(response: Response, fallback: string) {
  const text = await response.text().catch(() => '')
  return text || fallback
}

export async function getCompositionsAction(
  params?: CompositionsQueryParams
): Promise<ActionResult<PaginatedCompositionsResponse>> {
  try {
    const searchParams = new URLSearchParams()

    if (params?.search) {
      searchParams.set('search', params.search)
    }
    if (params?.active && params.active !== 'all') {
      searchParams.set('active', params.active)
    }
    if (params?.pricing_mode && params.pricing_mode !== 'all') {
      searchParams.set('pricing_mode', params.pricing_mode)
    }
    if (params?.page) {
      searchParams.set('page', params.page.toString())
    }
    if (params?.page_size) {
      searchParams.set('page_size', params.page_size.toString())
    }

    const url = `${RUST_URL}/compositions${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    const response = await fetch(url, {
      headers: await getAdminCompositionHeaders(),
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Erro ao buscar composições') }
    }

    return { success: true, data: await response.json() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao buscar composições' }
  }
}

export async function createCompositionAction(payload: {
  code: string
  name: string
  description?: string
  active?: boolean
  selection_mode?: Composition['selection_mode']
  pricing_mode: Composition['pricing_mode']
  display_mode?: Composition['display_mode']
  images_url?: string
  videos_url?: string
  items?: CreateCompositionItemPayload[]
}): Promise<ActionResult<Composition>> {
  try {
    const response = await fetch(`${RUST_URL}/compositions`, {
      method: 'POST',
      headers: await getAdminCompositionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Erro ao criar composição') }
    }

    revalidatePath('/compositions')
    return { success: true, data: await response.json() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao criar composição' }
  }
}

export async function updateCompositionAction(
  id: number,
  payload: Partial<{
    code: string
    name: string
    description: string
    active: boolean
    selection_mode: Composition['selection_mode']
    pricing_mode: Composition['pricing_mode']
    display_mode: Composition['display_mode']
    images_url: string
    videos_url: string
  }>
): Promise<ActionResult<Composition>> {
  try {
    const response = await fetch(`${RUST_URL}/compositions/${id}`, {
      method: 'PUT',
      headers: await getAdminCompositionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Erro ao atualizar composição') }
    }

    revalidatePath('/compositions')
    return { success: true, data: await response.json() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar composição' }
  }
}

export async function deleteCompositionAction(id: number): Promise<ActionResult<null>> {
  try {
    const response = await fetch(`${RUST_URL}/compositions/${id}`, {
      method: 'DELETE',
      headers: await getAdminCompositionHeaders(),
    })

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Erro ao excluir composição') }
    }

    revalidatePath('/compositions')
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao excluir composição' }
  }
}

export async function getCompositionItemsAction(compositionId: number): Promise<ActionResult<CompositionItemsResponse>> {
  try {
    const response = await fetch(`${RUST_URL}/compositions/${compositionId}/items`, {
      headers: await getAdminCompositionHeaders(),
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Erro ao buscar itens da composição') }
    }

    return { success: true, data: await response.json() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao buscar itens da composição' }
  }
}

export async function createCompositionItemAction(
  compositionId: number,
  payload: {
    product_id: number
    variant_image_level_code?: string | null
    asset_id?: number | null
    quantity: number
    item_discount_mode?: CompositionItem['item_discount_mode']
    item_discount_value?: number
    sort_order?: number
  }
): Promise<ActionResult<CompositionItem>> {
  try {
    const response = await fetch(`${RUST_URL}/compositions/${compositionId}/items`, {
      method: 'POST',
      headers: await getAdminCompositionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Erro ao criar item da composição') }
    }

    revalidatePath('/compositions')
    return { success: true, data: await response.json() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao criar item da composição' }
  }
}

export async function updateCompositionItemAction(
  compositionId: number,
  itemId: number,
  payload: Partial<{
    product_id: number
    variant_image_level_code: string | null
    asset_id: number | null
    quantity: number
    item_discount_mode: CompositionItem['item_discount_mode']
    item_discount_value: number
    sort_order: number
  }>
): Promise<ActionResult<CompositionItem>> {
  try {
    const response = await fetch(`${RUST_URL}/compositions/${compositionId}/items/${itemId}`, {
      method: 'PUT',
      headers: await getAdminCompositionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Erro ao atualizar item da composição') }
    }

    revalidatePath('/compositions')
    return { success: true, data: await response.json() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar item da composição' }
  }
}

export async function deleteCompositionItemAction(
  compositionId: number,
  itemId: number,
): Promise<ActionResult<null>> {
  try {
    const response = await fetch(`${RUST_URL}/compositions/${compositionId}/items/${itemId}`, {
      method: 'DELETE',
      headers: await getAdminCompositionHeaders(),
    })

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Erro ao excluir item da composição') }
    }

    revalidatePath('/compositions')
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao excluir item da composição' }
  }
}