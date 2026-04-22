'use server'

import { cookies } from 'next/headers'

export type ProductSortContextType = 'category' | 'store'

export type ProductSortItem = {
  productId: string
  productName: string
  productCode: string | null
  imageUrl: string | null
  position: number | null
}

export type ProductSortListResult = {
  success: boolean
  error?: string
  items: ProductSortItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function resolveBackendBase(): string | null {
  return process.env.NEXT_PUBLIC_RUST_URL || null
}

export async function getProductSortItemsAction(input: {
  contextType: ProductSortContextType
  contextId: number
  sortType: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<ProductSortListResult> {
  try {
    const base = resolveBackendBase()
    if (!base) {
      return {
        success: false,
        error: 'NEXT_PUBLIC_RUST_URL não configurado',
        items: [],
        total: 0,
        page: 1,
        pageSize: Number(input.pageSize) > 0 ? Math.floor(Number(input.pageSize)) : 40,
        totalPages: 0,
      }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const url = new URL('/product-sort-orders/items', base)
    url.searchParams.set('context_type', input.contextType)
    url.searchParams.set('context_id', String(input.contextId))
    url.searchParams.set('sort_type', input.sortType)
    if (input.search?.trim()) {
      url.searchParams.set('search', input.search.trim())
    }
    if (Number.isFinite(input.page) && Number(input.page) > 0) {
      url.searchParams.set('page', String(Math.floor(Number(input.page))))
    }
    if (Number.isFinite(input.pageSize) && Number(input.pageSize) > 0) {
      url.searchParams.set('page_size', String(Math.floor(Number(input.pageSize))))
    }

    const res = await fetch(url, {
      headers: {
        ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      return {
        success: false,
        error: errorText || `Erro ao buscar ordenação (status ${res.status})`,
        items: [],
        total: 0,
        page: 1,
        pageSize: Number(input.pageSize) > 0 ? Math.floor(Number(input.pageSize)) : 40,
        totalPages: 0,
      }
    }

    const payload = await res.json()
    const itemsRaw = Array.isArray(payload?.items) ? payload.items : []

    return {
      success: true,
      items: itemsRaw.map((item: any) => ({
        productId: String(item.product_id),
        productName: String(item.product_name || ''),
        productCode: item.product_code ? String(item.product_code) : null,
        imageUrl: item.image_url ? String(item.image_url) : null,
        position: Number.isFinite(item.position) ? Number(item.position) : null,
      })),
      total: Number.isFinite(payload?.total) ? Number(payload.total) : itemsRaw.length,
      page: Number.isFinite(payload?.page) ? Number(payload.page) : 1,
      pageSize: Number.isFinite(payload?.page_size) ? Number(payload.page_size) : itemsRaw.length,
      totalPages: Number.isFinite(payload?.total_pages) ? Number(payload.total_pages) : 1,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar ordenação',
      items: [],
      total: 0,
      page: 1,
      pageSize: Number(input.pageSize) > 0 ? Math.floor(Number(input.pageSize)) : 40,
      totalPages: 0,
    }
  }
}

export async function saveProductSortOrderAction(input: {
  contextType: ProductSortContextType
  contextId: number
  sortType: string
  productIds: string[]
}): Promise<{ success: boolean; error?: string; updated?: number }> {
  try {
    const base = resolveBackendBase()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const productIds = input.productIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)

    if (productIds.length === 0) {
      return { success: false, error: 'Lista de produtos vazia' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL('/product-sort-orders/reorder', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
      },
      cache: 'no-store',
      body: JSON.stringify({
        context_type: input.contextType,
        context_id: input.contextId,
        sort_type: input.sortType,
        product_ids: productIds,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      return {
        success: false,
        error: errorText || `Erro ao salvar ordenação (status ${res.status})`,
      }
    }

    const payload = await res.json().catch(() => ({}))
    return {
      success: true,
      updated: Number.isFinite(payload?.updated) ? Number(payload.updated) : productIds.length,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao salvar ordenação',
    }
  }
}
