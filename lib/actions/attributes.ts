'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getAdminStoreIdFromToken } from '@/lib/auth'

export interface AttributeValue {
  id: number
  attribute_id: number
  code: string
  name: string
  sort_order: number
  meta?: {
    rgb?: string
    imageUrl?: string
    [key: string]: any
  }
}

export interface Attribute {
  id: number
  store_id: number | null
  code: string
  name: string
  sort_order: number
  values: AttributeValue[]
}

interface CreateStoreAttributePayload {
  store_id: number
  code: string
  name: string
  sort_order: number
}

export async function getAttributesWithValuesByStore(storeId: number) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(
      new URL(`/product-attributes/store/${storeId}/with-values`, base),
      {
        headers: {
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '')
      throw new Error(`Failed to fetch attributes: ${res.status} ${res.statusText}${errorBody ? ` - ${errorBody}` : ''}`)
    }

    const attributes: Attribute[] = await res.json()
    return { success: true, data: attributes }
  } catch (err) {
    console.error('Error fetching attributes:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function getStoreIdFromToken(): Promise<number | null> {
  try {
    const adminStoreId = await getAdminStoreIdFromToken()
    if (adminStoreId) return adminStoreId

    const rawStoreId = process.env.STORE_ID
    if (!rawStoreId) return null

    const parsed = Number(rawStoreId)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  } catch (err) {
    console.error('Error fetching store ID:', err)
    return null
  }
}

export async function createStoreAttribute(params: {
  storeId: number
  label: string
  value: string
  sortOrder?: number
}) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const label = String(params.label || '').trim()
    const value = String(params.value || '').trim().toLowerCase()

    if (!label || !value) {
      throw new Error('Label e Value são obrigatórios')
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const payload: CreateStoreAttributePayload = {
      store_id: params.storeId,
      code: value,
      name: label,
      sort_order: params.sortOrder ?? 0,
    }

    const res = await fetch(new URL('/product-attributes', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    const responseText = await res.text()
    if (!res.ok) {
      throw new Error(`Failed to create attribute: ${responseText}`)
    }

    const attribute = JSON.parse(responseText) as Attribute
    return { success: true, data: attribute, error: null }
  } catch (err) {
    console.error('Error creating store attribute:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function updateStoreAttributeName(params: {
  attributeId: number
  name: string
}) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const name = String(params.name || '').trim()
    if (!name) {
      throw new Error('Nome do atributo é obrigatório')
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL(`/product-attributes/${params.attributeId}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({ name }),
    })

    const responseText = await res.text()
    if (!res.ok) {
      throw new Error(`Failed to update attribute: ${responseText}`)
    }

    const attribute = JSON.parse(responseText) as Attribute
    return { success: true, data: attribute, error: null }
  } catch (err) {
    console.error('Error updating store attribute:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function updateStoreAttributeSortOrder(params: {
  attributeId: number
  sortOrder: number
}) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL(`/product-attributes/${params.attributeId}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({ sort_order: params.sortOrder }),
    })

    const responseText = await res.text()
    if (!res.ok) {
      throw new Error(`Failed to update attribute sort order: ${responseText}`)
    }

    const attribute = JSON.parse(responseText) as Attribute
    revalidatePath('/products')
    return { success: true, data: attribute, error: null }
  } catch (err) {
    console.error('Error updating store attribute sort order:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function deleteStoreAttribute(attributeId: number) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL(`/product-attributes/${attributeId}`, base), {
      method: 'DELETE',
      headers: {
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
    })

    if (!res.ok) {
      const responseText = await res.text().catch(() => '')
      throw new Error(`Failed to delete attribute: ${responseText}`)
    }

    revalidatePath('/products')
    return { success: true, error: null }
  } catch (err) {
    console.error('Error deleting store attribute:', err)
    return { success: false, error: String(err) }
  }
}
