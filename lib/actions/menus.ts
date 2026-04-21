'use server'

import { buildAdminCookieHeader } from './auth'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from '@/lib/actions/storefront-scope'

const BACKEND_URL = process.env.NEXT_PUBLIC_RUST_URL || 'http://localhost:8080'

export type MenuType = 'retail' | 'wholesale' | 'footer_retail' | 'footer_wholesale'

export interface Menu {
  id: number
  store_id: number
  name: string
  type: MenuType
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: number
  updated_by?: number
  deleted_at?: string
  items?: MenuItem[]
}

export interface MenuItem {
  id: number
  menu_id: number
  parent_id?: number | null
  label: string
  type: 'category' | 'page' | 'external'
  href: string
  category_id?: number
  page_slug?: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface CreateMenuData {
  store_id?: number
  name: string
  type: MenuType
  is_active?: boolean
  created_by?: number
}

export interface UpdateMenuData {
  name?: string
  type?: MenuType
  is_active?: boolean
  updated_by?: number
}

export interface CreateMenuItemData {
  menu_id: number
  parent_id?: number | null
  label: string
  type: 'category' | 'page' | 'external'
  href: string
  category_id?: number
  page_slug?: string
  sort_order?: number
  is_active?: boolean
}

export interface UpdateMenuItemData {
  parent_id?: number | null
  label?: string
  type?: 'category' | 'page' | 'external'
  href?: string
  category_id?: number
  page_slug?: string
  sort_order?: number
  is_active?: boolean
}

export interface BulkMenuItemData {
  id?: number
  parent_id?: number | null
  label: string
  type: 'category' | 'page' | 'external'
  href: string
  category_id?: number
  page_slug?: string
  sort_order: number
  is_active: boolean
}

// Listar menus
export async function getMenusAction(storeId?: number, menuType?: string) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    const params = new URLSearchParams()
    
    if (storeId) params.append('store_id', storeId.toString())
    if (menuType) params.append('type', menuType)

    const url = `${BACKEND_URL}/menus${params.toString() ? `?${params}` : ''}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader || '',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao buscar menus')
    }

    const menus: Menu[] = await response.json()
    return { success: true, menus }
  } catch (error) {
    console.error('Erro ao buscar menus:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      menus: []
    }
  }
}

// Buscar menu por ID
export async function getMenuAction(menuId: number) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    
    const response = await fetch(`${BACKEND_URL}/menus/${menuId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader || '',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao buscar menu')
    }

    const menu: Menu = await response.json()
    return { success: true, menu }
  } catch (error) {
    console.error('Erro ao buscar menu:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      menu: null
    }
  }
}

// Criar menu
export async function createMenuAction(data: CreateMenuData) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    const adminStoreId = await getAdminStoreIdFromToken()
    const explicitStoreId = Number.isInteger(Number(data.store_id)) && Number(data.store_id) > 0
      ? Number(data.store_id)
      : null
    const resolvedStoreId = adminStoreId ?? explicitStoreId

    if (!resolvedStoreId) {
      return {
        success: false,
        error: 'Loja do admin não resolvida para criar menu',
        menu: null,
      }
    }
    
    const response = await fetch(`${BACKEND_URL}/menus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader || '',
      },
      body: JSON.stringify({
        ...data,
        store_id: resolvedStoreId,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao criar menu')
    }

    const menu: Menu = await response.json()
    return { success: true, menu }
  } catch (error) {
    console.error('Erro ao criar menu:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      menu: null
    }
  }
}

// Atualizar menu
export async function updateMenuAction(menuId: number, data: UpdateMenuData) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    
    const response = await fetch(`${BACKEND_URL}/menus/${menuId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader || '',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao atualizar menu')
    }

    const menu: Menu = await response.json()
    return { success: true, menu }
  } catch (error) {
    console.error('Erro ao atualizar menu:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      menu: null
    }
  }
}

// Deletar menu
export async function deleteMenuAction(menuId: number) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    
    const response = await fetch(`${BACKEND_URL}/menus/${menuId}`, {
      method: 'DELETE',
      headers: {
        Cookie: cookieHeader || '',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao deletar menu')
    }

    return { success: true }
  } catch (error) {
    console.error('Erro ao deletar menu:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

// Listar itens de menu
export async function getMenuItemsAction(menuId: number) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    const adminStoreId = await getAdminStoreIdFromToken()
    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(adminStoreId)
    const scopedUrl = new URL(`${BACKEND_URL}/menus/${menuId}/items`)

    if (adminStoreId) {
      scopedUrl.searchParams.set('store_id', String(adminStoreId))
    }
    
    const response = await fetch(scopedUrl, {
      method: 'GET',
      headers: withStorefrontScopeHeaders({
        'Content-Type': 'application/json',
        Cookie: cookieHeader || '',
      }, storefrontApiKey),
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao buscar itens do menu')
    }

    const items: MenuItem[] = await response.json()
    return { success: true, items }
  } catch (error) {
    console.error('Erro ao buscar itens do menu:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      items: []
    }
  }
}

// Buscar itens de menu para a loja (público)
export async function getStoreMenuItemsAction(storeId: number, type: 'retail' | 'wholesale') {
  try {
    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)
    if (!storefrontApiKey) {
      console.error('API key da loja não resolvida para menus públicos', { storeId, type })
      return { success: false, error: 'API key da loja não encontrada', items: [] }
    }

    // Novo endpoint dedicado ao storefront: já retorna menus com items.
    const menuUrl = new URL(`${BACKEND_URL}/storefront/menus`)
    menuUrl.searchParams.set('type', type)

    let menuResponse = await fetch(menuUrl, {
      method: 'GET',
      headers: withStorefrontScopeHeaders({
        'Content-Type': 'application/json',
      }, storefrontApiKey),
      cache: 'no-store',
    })

    // Fallback para backend antigo (sem endpoint dedicado)
    if (menuResponse.status === 404) {
      const legacyUrl = new URL(`${BACKEND_URL}/menus`)
      legacyUrl.searchParams.set('type', type)
      menuResponse = await fetch(legacyUrl, {
        method: 'GET',
        headers: withStorefrontScopeHeaders({
          'Content-Type': 'application/json',
        }, storefrontApiKey),
        cache: 'no-store',
      })
    }

    if (!menuResponse.ok) {
      console.error('Erro ao buscar menus da loja, status:', menuResponse.status)
      return { success: false, items: [] }
    }

    const menus: Menu[] = await menuResponse.json()
    const targetMenu = menus[0]

    if (!targetMenu) {
      return { success: true, items: [] }
    }

    // Novo contrato: /menus já pode retornar os itens embutidos.
    if (Array.isArray(targetMenu.items)) {
      return { success: true, items: targetMenu.items }
    }

    // Agora busca os itens
    const itemsUrl = new URL(`${BACKEND_URL}/menus/${targetMenu.id}/items`)

    const itemsResponse = await fetch(itemsUrl, {
      method: 'GET',
      headers: withStorefrontScopeHeaders({
        'Content-Type': 'application/json',
      }, storefrontApiKey),
      cache: 'no-store',
    })

    if (!itemsResponse.ok) {
      const errorText = await itemsResponse.text()
      console.error('Erro ao buscar itens do menu público, status:', itemsResponse.status)
      console.error('Erro response body:', errorText)
      return { success: false, items: [] }
    }

    const items: MenuItem[] = await itemsResponse.json()
    return { success: true, items }
  } catch (error) {
    console.error('Erro ao buscar itens do menu da loja:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      items: []
    }
  }
}

// Criar item de menu
export async function createMenuItemAction(data: CreateMenuItemData) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    
    const response = await fetch(`${BACKEND_URL}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader || '',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao criar item')
    }

    const item: MenuItem = await response.json()
    return { success: true, item }
  } catch (error) {
    console.error('Erro ao criar item:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      item: null
    }
  }
}

// Atualizar item de menu
export async function updateMenuItemAction(itemId: number, data: UpdateMenuItemData) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    
    const response = await fetch(`${BACKEND_URL}/menu-items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader || '',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao atualizar item')
    }

    const item: MenuItem = await response.json()
    return { success: true, item }
  } catch (error) {
    console.error('Erro ao atualizar item:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      item: null
    }
  }
}

// Deletar item de menu
export async function deleteMenuItemAction(itemId: number) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    
    const response = await fetch(`${BACKEND_URL}/menu-items/${itemId}`, {
      method: 'DELETE',
      headers: {
        Cookie: cookieHeader || '',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao deletar item')
    }

    return { success: true }
  } catch (error) {
    console.error('Erro ao deletar item:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

// Atualização em lote de itens (remove antigos e recria)
export async function bulkUpdateMenuItemsAction(menuId: number, items: BulkMenuItemData[]) {
  try {
    const cookieHeader = await buildAdminCookieHeader()
    
    const response = await fetch(`${BACKEND_URL}/menus/${menuId}/items/bulk`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader || '',
      },
      body: JSON.stringify({ items }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Erro ao atualizar itens')
    }

    const updatedItems: MenuItem[] = await response.json()
    return { success: true, items: updatedItems }
  } catch (error) {
    console.error('Erro ao atualizar itens:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      items: []
    }
  }
}

// Atualizar ordem dos itens do menu
export async function updateMenuItemsOrderAction(
  updates: Array<{ id: string; sortOrder: number; parentId: string | null }>
) {
  try {
    const cookieHeader = await buildAdminCookieHeader()

    await Promise.all(
      updates.map(async (update) => {
        const response = await fetch(`${BACKEND_URL}/menu-items/${update.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader || '',
          },
          body: JSON.stringify({
            sort_order: update.sortOrder,
            parent_id: update.parentId ? Number(update.parentId) : null,
          }),
        })

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '')
          throw new Error(
            `Falha ao atualizar item ${update.id}: ${response.status} ${errorBody}`,
          )
        }
      }),
    )

    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar ordem dos itens:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}
