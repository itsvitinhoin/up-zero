'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import type { ApiResponse, Category } from '@/lib/types'

function parseStoreIdInput(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function mapCategory(category: any): Category {
  return {
    id: String(category.id),
    name: category.name,
    slug: category.slug || category.name.toLowerCase().replace(/\s+/g, '-'),
    description: category.description || '',
    parentId: category.parent_id ? String(category.parent_id) : null,
    imageUrl: null,
    isActive: category.status ?? true,
    isFeatured: false,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function createAssetCategoryAction(formData: FormData): Promise<ApiResponse<Category>> {
  try {
    const name = String(formData.get('name') || '').trim()
    const status = String(formData.get('isActive') || 'true') === 'true'
    const storeIdRaw = String(formData.get('storeId') || '').trim()
    const explicitStoreId = storeIdRaw ? parseStoreIdInput(storeIdRaw) : null
    const adminStoreId = await getAdminStoreIdFromToken()
    const storeId = explicitStoreId ?? adminStoreId

    if (!storeId) {
      return { success: false, error: 'Loja do admin não resolvida para criar categoria de asset' }
    }

    if (!name) {
      return { success: false, error: 'Nome é obrigatório' }
    }

    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL('/asset-categories', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({
        name,
        status,
        store_id: storeId,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: text || 'Erro ao criar categoria de asset' }
    }

    const category = await res.json()
    revalidatePath('/assets/categories')
    revalidatePath('/assets')

    return { success: true, data: mapCategory(category) }
  } catch (error) {
    console.error('Erro ao criar categoria de asset:', error)
    return { success: false, error: 'Erro ao criar categoria de asset' }
  }
}

export async function updateAssetCategoryAction(id: string, formData: FormData): Promise<ApiResponse<Category>> {
  try {
    const name = String(formData.get('name') || '').trim()
    const status = String(formData.get('isActive') || 'true') === 'true'

    if (!name) {
      return { success: false, error: 'Nome é obrigatório' }
    }

    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericId = Number.parseInt(id, 10)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return { success: false, error: 'ID inválido' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL(`/asset-categories/${numericId}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({
        name,
        status,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: text || 'Erro ao atualizar categoria de asset' }
    }

    const category = await res.json()
    revalidatePath('/assets/categories')
    revalidatePath('/assets')

    return { success: true, data: mapCategory(category) }
  } catch (error) {
    console.error('Erro ao atualizar categoria de asset:', error)
    return { success: false, error: 'Erro ao atualizar categoria de asset' }
  }
}

export async function deleteAssetCategoryAction(id: string): Promise<ApiResponse<void>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericId = Number.parseInt(id, 10)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return { success: false, error: 'ID inválido' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL(`/asset-categories/${numericId}`, base), {
      method: 'DELETE',
      headers: {
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: text || 'Erro ao deletar categoria de asset' }
    }

    revalidatePath('/assets/categories')
    revalidatePath('/assets')
    return { success: true }
  } catch (error) {
    console.error('Erro ao deletar categoria de asset:', error)
    return { success: false, error: 'Erro ao deletar categoria de asset' }
  }
}

export async function getAssetCategoriesAction(storeId?: number | string): Promise<ApiResponse<Category[]>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado', data: [] }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    let resolvedStoreId: number | null = null

    if (storeId) {
      resolvedStoreId = typeof storeId === 'string' ? parseInt(storeId, 10) : storeId
    } else {
      const adminStoreId = await getAdminStoreIdFromToken()
      if (adminStoreId) {
        resolvedStoreId = adminStoreId
      } else {
      const rawStoreId = process.env.STORE_ID
      const parsedStoreId = rawStoreId ? Number(rawStoreId) : null
      resolvedStoreId = Number.isInteger(parsedStoreId) && (parsedStoreId as number) > 0
        ? (parsedStoreId as number)
        : null
      }
    }

    const categoriesUrl = new URL('/asset-categories', base)
    if (resolvedStoreId) {
      categoriesUrl.searchParams.set('store_id', String(resolvedStoreId))
    }

    const res = await fetch(categoriesUrl, {
      headers: {
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: text || 'Erro ao buscar categorias de asset', data: [] }
    }

    const categories = await res.json()
    return { success: true, data: categories.map(mapCategory) }
  } catch (error) {
    console.error('Erro ao buscar categorias de asset:', error)
    return { success: false, error: 'Erro ao buscar categorias de asset', data: [] }
  }
}
