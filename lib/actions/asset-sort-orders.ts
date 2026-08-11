'use server'

import { cookies } from 'next/headers'
import { checkUserPermission } from '@/lib/actions/permissions'

async function hasAssetPermission(permissionCode: string): Promise<boolean> {
  try {
    const result = await checkUserPermission(permissionCode)
    return result?.has_permission === true
  } catch {
    return false
  }
}

export type AssetSortContextType = 'category' | 'store'

export type AssetSortItem = {
  assetId: string
  assetCode: string
  assetTitle: string | null
  productName: string | null
  imageUrl: string | null
  position: number | null
}

export type AssetSortListResult = {
  success: boolean
  error?: string
  items: AssetSortItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function resolveBackendBase(): string | null {
  return process.env.NEXT_PUBLIC_RUST_URL || null
}

export async function getAssetSortItemsAction(input: {
  contextType: AssetSortContextType
  contextId: number
  sortType: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<AssetSortListResult> {
  if (!(await hasAssetPermission('assets.view'))) {
    return {
      success: false,
      error: 'Você não tem permissão para visualizar assets',
      items: [],
      total: 0,
      page: 1,
      pageSize: Number(input.pageSize) > 0 ? Math.floor(Number(input.pageSize)) : 40,
      totalPages: 0,
    }
  }

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

    const url = new URL('/asset-sort-orders/items', base)
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
        assetId: String(item.asset_id),
        assetCode: String(item.asset_code || ''),
        assetTitle: item.asset_title ? String(item.asset_title) : null,
        productName: item.product_name ? String(item.product_name) : null,
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

export async function saveAssetSortOrderAction(input: {
  contextType: AssetSortContextType
  contextId: number
  sortType: string
  assetIds: string[]
}): Promise<{ success: boolean; error?: string; updated?: number }> {
  if (!(await hasAssetPermission('assets.edit'))) {
    return { success: false, error: 'Você não tem permissão para editar assets' }
  }

  try {
    const base = resolveBackendBase()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const assetIds = input.assetIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)

    if (assetIds.length === 0) {
      return { success: false, error: 'Lista de assets vazia' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL('/asset-sort-orders/reorder', base), {
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
        asset_ids: assetIds,
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
      updated: Number.isFinite(payload?.updated) ? Number(payload.updated) : assetIds.length,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao salvar ordenação',
    }
  }
}

export async function rebuildAssetSortOrderAction(input: {
  contextType: AssetSortContextType
  contextId: number
  sortType: string
  resetSortType: string
}): Promise<{ success: boolean; error?: string; updated?: number }> {
  if (!(await hasAssetPermission('assets.edit'))) {
    return { success: false, error: 'Você não tem permissão para editar assets' }
  }

  try {
    const base = resolveBackendBase()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL('/asset-sort-orders/rebuild', base), {
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
        reset_sort_type: input.resetSortType,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      return {
        success: false,
        error: errorText || `Erro ao resetar ordenação (status ${res.status})`,
      }
    }

    const payload = await res.json().catch(() => ({}))
    return {
      success: true,
      updated: Number.isFinite(payload?.updated) ? Number(payload.updated) : undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao resetar ordenação',
    }
  }
}
