'use server'

import { cookies } from 'next/headers'
import { appendStoreScopeParam, resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from '@/lib/actions/storefront-scope'
import type { ApiResponse } from '@/lib/types'

async function buildStorefrontAuthHeaders(storeId?: number | string): Promise<Record<string, string>> {
  const cookieStore = await cookies()
  const clientToken =
    cookieStore.get('clientAuthToken')?.value ?? cookieStore.get('b2bAuthToken')?.value

  const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)
  const headers: Record<string, string> = {}
  const scopedHeaders = withStorefrontScopeHeaders(headers, storefrontApiKey)

  if (!clientToken) {
    return scopedHeaders
  }

  scopedHeaders.cookie = `clientAuthToken=${clientToken}`
  scopedHeaders.authorization = `Bearer ${clientToken}`
  return scopedHeaders
}

export interface StorefrontProductImageItem {
  product_id: number
  store_id: number
  product_name: string
  product_slug: string | null
  image_key: string
  primary_image_url: string | null
  images: Array<{
    id: number
    image_url: string
    storage_path: string | null
    display_order: number
    is_primary: boolean
  }>
  total_images: number
  variants: Array<{
    id: number
    sku: string | null
    image_key: string | null
    stock_qty: number | null
    price_cents: number | null
    promo_cents: number | null
  }>
}

export interface GetProductImagesParams {
  storeId?: number | string
  productId?: number | string
  imageKey?: string
  search?: string
  page?: number
  limit?: number
}

export async function getStorefrontProductImagesAction(
  params: GetProductImagesParams = {}
): Promise<ApiResponse<StorefrontProductImageItem[]>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const { storeId, productId, imageKey, search, page = 1, limit = 10 } = params

    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)
    const headers = await buildStorefrontAuthHeaders(storeId)

    const url = new URL('/v1/product-images', base)
    appendStoreScopeParam(url, { apiKey: storefrontApiKey, storeId })

    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(limit))

    if (productId) {
      url.searchParams.set('product_id', String(productId))
    }

    if (imageKey) {
      url.searchParams.set('image_key', imageKey)
    }

    if (search) {
      url.searchParams.set('search', search)
    }

    const res = await fetch(url, {
      headers,
      cache: 'no-store',
    })

    if (!res.ok) {
      const backendMessage = await res.text().catch(() => '')
      return {
        success: false,
        error: backendMessage || `Erro ao buscar níveis de imagem (status ${res.status})`,
      }
    }

    const payload = await res.json()
    const items: StorefrontProductImageItem[] = Array.isArray(payload?.items)
      ? payload.items
      : []

    return { success: true, data: items }
  } catch (error) {
    console.error('[getStorefrontProductImagesAction] Erro:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao buscar níveis de imagem',
    }
  }
}
