'use server'

import { cookies } from 'next/headers'
import { appendStoreScopeParam, resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from '@/lib/actions/storefront-scope'
import type { ApiResponse, StorefrontProductImagesResponse } from '@/lib/types'

export interface StoreProductImagesQuery {
  page?: number
  limit?: number
  storeId?: number | string
  productId?: string
  imageKey?: string
  search?: string
  category?: string
  colors?: string[]
  sizes?: string[]
  minPrice?: number
  maxPrice?: number
  sort?: string
}

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

/**
 * Busca imagens de produtos agrupadas por product_id + image_key
 * 
 * Endpoint: GET /v1/product-images
 */
export async function getProductImagesAction(
  query: StoreProductImagesQuery = {},
): Promise<ApiResponse<StorefrontProductImagesResponse>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(query.storeId)

    const authHeaders = await buildStorefrontAuthHeaders(query.storeId)

    const url = new URL('/v1/product-images', base)
    const page = Number.isFinite(query.page) ? Math.max(1, Number(query.page)) : 1
    const limit = Number.isFinite(query.limit) ? Math.max(1, Math.min(Number(query.limit), 200)) : 24

    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(limit))

    appendStoreScopeParam(url, { apiKey: storefrontApiKey, storeId: query.storeId })

    if (query.productId?.trim()) {
      url.searchParams.set('product_id', query.productId.trim())
    }
    if (query.imageKey?.trim()) {
      url.searchParams.set('image_key', query.imageKey.trim())
    }
    if (query.search?.trim()) {
      url.searchParams.set('search', query.search.trim())
    }
    if (query.category?.trim()) {
      url.searchParams.set('category', query.category.trim())
    }
    if (Array.isArray(query.colors) && query.colors.length > 0) {
      url.searchParams.set('colors', query.colors.join(','))
    }
    if (Array.isArray(query.sizes) && query.sizes.length > 0) {
      url.searchParams.set('sizes', query.sizes.join(','))
    }
    if (Number.isFinite(query.minPrice)) {
      url.searchParams.set('min_price', String(query.minPrice))
    }
    if (Number.isFinite(query.maxPrice)) {
      url.searchParams.set('max_price', String(query.maxPrice))
    }
    if (query.sort?.trim()) {
      url.searchParams.set('sort', query.sort.trim())
    }
    
    const res = await fetch(url, {
      headers: authHeaders,
      cache: 'no-store',
    })

    if (!res.ok) {
      const backendMessage = await res.text().catch(() => '')
      console.error('Erro ao buscar imagens de produtos:', res.status, backendMessage)
      return {
        success: false,
        error: backendMessage || `Erro ao buscar imagens (status ${res.status})`,
      }
    }

    const payload = await res.json()
    
    // Normalizar resposta e converter snake_case para camelCase
    const items = Array.isArray(payload?.items)
      ? payload.items.map((item: any) => ({
          productId: item.product_id,
          storeId: item.store_id,
          productName: item.product_name,
          productSlug: item.product_slug,
          imageKey: item.image_key,
          primaryImageUrl: item.primary_image_url,
          images: Array.isArray(item.images)
            ? item.images.map((img: any) => ({
                id: img.id,
                imageUrl: img.image_url,
                storagePath: img.storage_path,
                displayOrder: img.display_order,
                isPrimary: img.is_primary,
              }))
            : [],
          variants: Array.isArray(item.variants)
            ? item.variants.map((variant: any) => ({
                id: Number(variant.id),
                sku: typeof variant.sku === 'string' ? variant.sku : undefined,
                imageKey: typeof variant.image_key === 'string' ? variant.image_key : undefined,
                stockQty: Number.isFinite(Number(variant.stock_qty))
                  ? Number(variant.stock_qty)
                  : undefined,
                priceCents: Number.isFinite(Number(variant.price_cents))
                  ? Number(variant.price_cents)
                  : undefined,
                promoCents: Number.isFinite(Number(variant.promo_cents))
                  ? Number(variant.promo_cents)
                  : undefined,
                attributeValues: Array.isArray(variant.attribute_values)
                  ? variant.attribute_values.map((attr: any) => ({
                      attributeId: Number(attr.attribute_id),
                      attributeCode: String(attr.attribute_code || ''),
                      attributeName: String(attr.attribute_name || ''),
                      attributeValueId: Number(attr.attribute_value_id),
                      valueCode: String(attr.value_code || ''),
                      valueName: String(attr.value_name || ''),
                      valueMeta: attr.value_meta && typeof attr.value_meta === 'object'
                        ? attr.value_meta
                        : undefined,
                    }))
                  : [],
              }))
            : [],
          totalImages: item.total_images,
        }))
      : []
    const total = typeof payload?.total === 'number' ? payload.total : 0
    const currentPage = typeof payload?.page === 'number' ? payload.page : page
    const pageSize = typeof payload?.limit === 'number' ? payload.limit : limit

    return {
      success: true,
      data: {
        items,
        total,
        page: currentPage,
        limit: pageSize,
      },
    }
  } catch (error) {
    console.error('Erro analisando resposta de imagens:', error)
    return {
      success: false,
      error: `Erro ao processar imagens: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
    }
  }
}
