'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from '@/lib/actions/storefront-scope'
import type { ApiResponse, Category } from '@/lib/types'

export async function createCategoryAction(formData: FormData): Promise<ApiResponse<Category>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const name = formData.get('name') as string
    let slug = formData.get('slug') as string
    const isActiveStr = formData.get('isActive') as string | null
    const isActive = isActiveStr === null ? true : isActiveStr === 'true'
    const adminStoreId = await getAdminStoreIdFromToken()

    if (!adminStoreId) {
      return { success: false, error: 'Admin sem loja vinculada para criar categoria' }
    }

    if (!name || !name.trim()) {
      return { success: false, error: 'Nome é obrigatório' }
    }

    // Gerar slug automaticamente se não fornecido
    if (!slug || !slug.trim()) {
      slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
    }

    const isFeaturedStr = formData.get('isFeatured') as string | null
    const isFeatured = isFeaturedStr === 'true'
    const sortOrderStr = formData.get('sortOrder') as string | null
    const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0
    const parentIdStr = formData.get('parentId') as string | null
    const parentId = parentIdStr && parentIdStr.trim()
      ? Number.parseInt(parentIdStr.trim(), 10)
      : null

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      status: isActive,
      parent_id: Number.isInteger(parentId) && (parentId as number) > 0 ? parentId : null,
      is_featured: isFeatured,
      sort_order: sortOrder,
    }

    const res = await fetch(new URL('/categories', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('Erro ao criar categoria:', error)
      return { success: false, error: 'Erro ao criar categoria no backend' }
    }

    const category = await res.json()

    revalidatePath('/categories')
    revalidatePath('/products')

    return {
      success: true,
      data: {
        id: String(category.id),
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        parentId: category.parent_id ? String(category.parent_id) : null,
        imageUrl: null,
        isActive: category.status ?? true,
        isFeatured: category.is_featured ?? false,
        sortOrder: category.sort_order ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error('Erro ao criar categoria:', error)
    return { success: false, error: 'Erro ao criar categoria' }
  }
}

export async function updateCategoryAction(
  id: string,
  formData: FormData
): Promise<ApiResponse<Category>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const name = formData.get('name') as string
    let slug = formData.get('slug') as string
    const isActiveStr = formData.get('isActive') as string | null
    const isActive = isActiveStr === null ? true : isActiveStr === 'true'
    const adminStoreId = await getAdminStoreIdFromToken()

    if (!adminStoreId) {
      return { success: false, error: 'Admin sem loja vinculada para atualizar categoria' }
    }

    if (!name || !name.trim()) {
      return { success: false, error: 'Nome é obrigatório' }
    }

    // Gerar slug automaticamente se não fornecido
    if (!slug || !slug.trim()) {
      slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
    }

    const isFeaturedStr = formData.get('isFeatured') as string | null
    const isFeatured = isFeaturedStr === 'true'
    const sortOrderStr = formData.get('sortOrder') as string | null
    const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0
    const parentIdStr = formData.get('parentId') as string | null
    const parentId = parentIdStr && parentIdStr.trim()
      ? Number.parseInt(parentIdStr.trim(), 10)
      : null

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      status: isActive,
      parent_id: Number.isInteger(parentId) && (parentId as number) > 0 ? parentId : null,
      is_featured: isFeatured,
      sort_order: sortOrder,
    }

    const res = await fetch(new URL(`/categories/${id}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('Erro ao atualizar categoria:', error)
      return { success: false, error: 'Erro ao atualizar categoria no backend' }
    }

    const category = await res.json()

    revalidatePath('/categories')
    revalidatePath('/products')

    return {
      success: true,
      data: {
        id: String(category.id),
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        parentId: category.parent_id ? String(category.parent_id) : null,
        imageUrl: null,
        isActive: category.status ?? true,
        isFeatured: category.is_featured ?? false,
        sortOrder: category.sort_order ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error)
    return { success: false, error: 'Erro ao atualizar categoria' }
  }
}

export async function deleteCategoryAction(id: string): Promise<ApiResponse<void>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL(`/categories/${id}`, base), {
      method: 'DELETE',
      headers: {
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('Erro ao deletar categoria:', error)
      return { success: false, error: 'Erro ao deletar categoria no backend' }
    }

    return { success: true }
  } catch (error) {
    console.error('Erro ao deletar categoria:', error)
    return { success: false, error: 'Erro ao deletar categoria' }
  }
}

export async function getCategoriesAction(storeId?: number | string): Promise<ApiResponse<Category[]>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado', data: [] }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)

    const categoriesUrl = new URL('/categories', base)

    const res = await fetch(categoriesUrl, {
      headers: withStorefrontScopeHeaders({
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      }, storefrontApiKey),
      cache: 'no-store',
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      console.error('Erro ao buscar categorias:', res.status, errorText)
      return { success: false, error: 'Erro ao buscar categorias', data: [] }
    }

    const categories = await res.json()
    const mapped = categories.map((c: any) => ({
      id: String(c.id),
      name: c.name,
      slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
      description: c.description || '',
      parentId: c.parent_id ? String(c.parent_id) : null,
      imageUrl: null,
      isActive: c.status ?? true,
      isFeatured: c.is_featured ?? false,
      sortOrder: c.sort_order ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('Erro ao buscar categorias:', error)
    return { success: false, error: 'Erro ao buscar categorias', data: [] }
  }
}

export async function getStorefrontCategoriesAction(storeId?: number | string): Promise<ApiResponse<Category[]>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado', data: [] }
    }

    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)
    const categoriesUrl = new URL('/v1/categories', base)

    const res = await fetch(categoriesUrl, {
      headers: withStorefrontScopeHeaders({}, storefrontApiKey),
      cache: 'no-store',
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      console.error('Erro ao buscar categorias storefront:', res.status, errorText)
      return { success: false, error: 'Erro ao buscar categorias storefront', data: [] }
    }

    const categories = await res.json()
    const mapped = categories.map((c: any) => ({
      id: String(c.id),
      name: c.name,
      slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
      description: c.description || '',
      parentId: c.parent_id ? String(c.parent_id) : null,
      imageUrl: null,
      isActive: c.status ?? true,
      isFeatured: c.is_featured ?? false,
      sortOrder: c.sort_order ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('Erro ao buscar categorias storefront:', error)
    return { success: false, error: 'Erro ao buscar categorias storefront', data: [] }
  }
}

export async function updateCategoriesOrderAction(
  updates: Array<{ id: string; sortOrder: number; parentId: string | null }>,
): Promise<ApiResponse<void>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const payload = updates.map((u) => ({
      id: Number(u.id),
      sort_order: u.sortOrder,
      parent_id: u.parentId ? Number(u.parentId) : null,
    }))

    const res = await fetch(new URL('/categories/order', base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '')
      throw new Error(`Falha ao atualizar ordem: ${res.status} ${errorBody}`)
    }

    revalidatePath('/categories')
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar ordem das categorias:', error)
    return { success: false, error: 'Erro ao atualizar ordem das categorias' }
  }
}

