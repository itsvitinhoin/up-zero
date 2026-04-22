'use server'

import { cookies } from 'next/headers'
import { getAttributesWithValuesByStore } from './attributes'

export interface CreateAttributePayload {
  store_id: number
  code: string
  name: string
  sort_order: number
}

export interface CreateAttributeValuePayload {
  code: string
  name: string
  sort_order: number
  meta?: {
    rgb?: string
    imageUrl?: string
    [key: string]: any
  }
}

export interface UpdateAttributeValuePayload {
  meta?: {
    rgb?: string
    imageUrl?: string | null
    [key: string]: any
  }
}

function normalizeAttributeValueCode(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
}

async function getOrCreateAttribute(
  storeId: number,
  code: 'color' | 'size'
) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    console.log('Checking for existing attribute:', code, 'in store:', storeId)

    // Buscar atributos existentes
    const existingRes = await getAttributesWithValuesByStore(storeId)
    if (existingRes.success && existingRes.data) {
      const existing = existingRes.data.find((a) => a.code === code)
      if (existing) {
        console.log('Found existing attribute:', existing)
        return { success: true, data: existing, isNew: false }
      }
    }

    console.log('Attribute does not exist, creating new one for code:', code)

    // Criar novo atributo
    const name = code === 'color' ? 'Cores' : 'Tamanhos'
    const payload: CreateAttributePayload = {
      store_id: storeId,
      code,
      name,
      sort_order: code === 'color' ? 0 : 1,
    }

    console.log('Creating attribute with payload:', payload)

    const res = await fetch(new URL('/product-attributes', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    const responseText = await res.text()
    console.log('Create attribute response status:', res.status, 'text:', responseText)

    if (!res.ok) {
      throw new Error(`Failed to create attribute: ${responseText}`)
    }

    const attribute = JSON.parse(responseText)
    console.log('Created attribute:', attribute)
    return { success: true, data: attribute, isNew: true }
  } catch (err) {
    console.error('Error getting or creating attribute:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function createColorValue(
  colorName: string,
  colorHex: string,
  storeId: number,
  meta?: { rgb?: string; imageUrl?: string; [key: string]: any }
) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    // Obter ou criar atributo color
    const attrResult = await getOrCreateAttribute(storeId, 'color')
    if (!attrResult.success || !attrResult.data) {
      throw new Error('Failed to get or create color attribute')
    }

    const attributeId = attrResult.data.id
    console.log('Creating color value for attribute ID:', attributeId, 'Color:', colorName)

    // Criar valor
    const payload: CreateAttributeValuePayload = {
      code: normalizeAttributeValueCode(colorName),
      name: colorName,
      sort_order: 0,
      ...(meta && { meta }),
    }

    const url = new URL(`/product-attributes/${attributeId}/values`, base)
    console.log('Calling URL:', url.toString(), 'with payload:', payload)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    const responseText = await res.text()
    console.log('Response status:', res.status, 'text:', responseText)

    if (!res.ok) {
      if (res.status === 409) {
        console.warn('Color value already exists:', payload.code)
        return { success: false, data: null, error: 'Color already exists' }
      }
      throw new Error(`Failed to create color value: ${responseText}`)
    }

    const value = JSON.parse(responseText)
    return { success: true, data: value, error: null }
  } catch (err) {
    console.error('Error creating color value:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function createSizeValue(
  sizeName: string,
  storeId: number,
  meta?: { rgb?: string; imageUrl?: string; [key: string]: any }
) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    // Obter ou criar atributo size
    const attrResult = await getOrCreateAttribute(storeId, 'size')
    if (!attrResult.success || !attrResult.data) {
      throw new Error('Failed to get or create size attribute')
    }

    const attributeId = attrResult.data.id
    console.log('Creating size value for attribute ID:', attributeId, 'Size:', sizeName)

    // Criar valor
    const payload: CreateAttributeValuePayload = {
      code: normalizeAttributeValueCode(sizeName),
      name: sizeName,
      sort_order: 0,
      ...(meta && { meta }),
    }

    const url = new URL(`/product-attributes/${attributeId}/values`, base)
    console.log('Calling URL:', url.toString(), 'with payload:', payload)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    const responseText = await res.text()
    console.log('Response status:', res.status, 'text:', responseText)

    if (!res.ok) {
      if (res.status === 409) {
        console.warn('Size value already exists:', payload.code)
        return { success: false, data: null, error: 'Size already exists' }
      }
      throw new Error(`Failed to create size value: ${responseText}`)
    }

    const value = JSON.parse(responseText)
    return { success: true, data: value, error: null }
  } catch (err) {
    console.error('Error creating size value:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function createAttributeValue(
  attributeId: number,
  valueName: string,
  options?: {
    code?: string
    sortOrder?: number
    meta?: { [key: string]: any }
  }
) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const normalizedName = valueName.trim()
    if (!normalizedName) {
      throw new Error('Value name is required')
    }

    const payload: CreateAttributeValuePayload = {
      code: normalizeAttributeValueCode(options?.code || normalizedName),
      name: normalizedName,
      sort_order: options?.sortOrder ?? 0,
      ...(options?.meta && { meta: options.meta }),
    }

    const res = await fetch(new URL(`/product-attributes/${attributeId}/values`, base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    const responseText = await res.text()

    if (!res.ok) {
      if (res.status === 409) {
        return { success: false, data: null, error: 'Value already exists' }
      }
      throw new Error(`Failed to create attribute value: ${responseText}`)
    }

    const value = JSON.parse(responseText)
    return { success: true, data: value, error: null }
  } catch (err) {
    console.error('Error creating attribute value:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function updateAttributeValueMeta(
  valueId: number,
  meta: UpdateAttributeValuePayload['meta']
) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const payload: UpdateAttributeValuePayload = {
      meta,
    }

    const res = await fetch(new URL(`/product-attribute-values/${valueId}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    const responseText = await res.text()

    if (!res.ok) {
      throw new Error(`Failed to update attribute value: ${responseText}`)
    }

    const value = JSON.parse(responseText)
    return { success: true, data: value, error: null }
  } catch (err) {
    console.error('Error updating attribute value:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function updateAttributeValueSortOrder(
  valueId: number,
  sortOrder: number
) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL(`/product-attribute-values/${valueId}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({ sort_order: sortOrder }),
    })

    const responseText = await res.text()

    if (!res.ok) {
      throw new Error(`Failed to update attribute value sort order: ${responseText}`)
    }

    const value = JSON.parse(responseText)
    return { success: true, data: value, error: null }
  } catch (err) {
    console.error('Error updating attribute value sort order:', err)
    return { success: false, data: null, error: String(err) }
  }
}

export async function deleteAttributeValue(valueId: number) {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const res = await fetch(new URL(`/product-attribute-values/${valueId}`, base), {
      method: 'DELETE',
      headers: {
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
    })

    if (!res.ok) {
      const responseText = await res.text()
      throw new Error(`Failed to delete attribute value: ${responseText}`)
    }

    return { success: true, error: null }
  } catch (err) {
    console.error('Error deleting attribute value:', err)
    return { success: false, error: String(err) }
  }
}
