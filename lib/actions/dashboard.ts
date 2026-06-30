'use server'

import { cookies } from 'next/headers'
import {
  fetchAllOrders,
  fetchAllCustomers,
  fetchAllProducts,
  fetchInventory,
  fetchDashboardAnalyticsFacts,
  fetchProductPrimaryImages,
} from '@/lib/upzero-api'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { getProductImagesAction } from '@/lib/actions/store-product-images'
import { transformRawData, type DashboardRawData } from '@/lib/dashboard-compute'

type DashboardProductImageItem = {
  productId?: string | number | null
  primaryImageUrl?: string | null
  images?: Array<{ imageUrl?: string | null; storagePath?: string | null; isPrimary?: boolean | null }>
}

type RustProductCatalogItem = Record<string, unknown>

function imageLookupKey(kind: 'id' | 'sku' | 'name', value: unknown): string {
  return `${kind}:${String(value ?? '').trim().toLowerCase()}`
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`

  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) return trimmed

  try {
    return new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, base).toString()
  } catch {
    return trimmed
  }
}

function pickDashboardProductImage(item: DashboardProductImageItem): string | null {
  const primaryImage = normalizeImageUrl(item.primaryImageUrl)
  if (primaryImage) return primaryImage

  const images = Array.isArray(item.images) ? item.images : []
  const primaryFromList = images.find((image) => image?.isPrimary)
  const primaryFromListUrl = normalizeImageUrl(primaryFromList?.imageUrl ?? primaryFromList?.storagePath)
  if (primaryFromListUrl) return primaryFromListUrl

  for (const image of images) {
    const url = normalizeImageUrl(image?.imageUrl ?? image?.storagePath)
    if (url) return url
  }

  return null
}

function firstImageFromUnknownImages(images: unknown): string | null {
  if (!Array.isArray(images)) return null
  for (const image of images) {
    if (typeof image === 'string') {
      const url = normalizeImageUrl(image)
      if (url) return url
      continue
    }

    if (!image || typeof image !== 'object') continue
    const record = image as Record<string, unknown>
    const url = normalizeImageUrl(
      record.image_url
      ?? record.imageUrl
      ?? record.url
      ?? record.src
      ?? record.storage_path
      ?? record.storagePath
    )
    if (url) return url
  }

  return null
}

function pickRustCatalogProductImage(item: RustProductCatalogItem): string | null {
  const product = (item.product && typeof item.product === 'object' ? item.product : item) as Record<string, unknown>
  const direct = normalizeImageUrl(
    product.primary_image_url
    ?? product.primaryImageUrl
    ?? product.cover_image_url
    ?? product.coverImageUrl
    ?? product.image_url
    ?? product.imageUrl
    ?? item.cover_image_url
  )
  if (direct) return direct

  const variants = Array.isArray(item.variants) ? item.variants : []
  for (const variant of variants) {
    const variantImage = firstImageFromUnknownImages((variant as Record<string, unknown>)?.images)
    if (variantImage) return variantImage
  }

  const imageGroups = Array.isArray(item.image_groups) ? item.image_groups : []
  for (const group of imageGroups) {
    const groupImage = firstImageFromUnknownImages((group as Record<string, unknown>)?.images)
    if (groupImage) return groupImage
  }

  return firstImageFromUnknownImages(product.images)
}

function rememberImageAliases(
  imageMap: Record<string, string>,
  aliases: Array<{ kind: 'id' | 'sku' | 'name'; value: unknown }>,
  imageUrl: string | null,
) {
  if (!imageUrl) return
  aliases.forEach(({ kind, value }) => {
    const raw = String(value ?? '').trim()
    if (!raw) return
    if (!imageMap[raw]) imageMap[raw] = imageUrl
    const key = imageLookupKey(kind, raw)
    if (!imageMap[key]) imageMap[key] = imageUrl
  })
}

async function fetchRustProductPrimaryImages(
  productIds: string[],
  storeId: number | null,
): Promise<Record<string, string>> {
  const imageMap: Record<string, string> = {}
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean))).slice(0, 80)

  const rememberImages = (items: DashboardProductImageItem[]) => {
    items.forEach((item) => {
      const productId = item.productId != null ? String(item.productId) : ''
      const imageUrl = pickDashboardProductImage(item)
      rememberImageAliases(imageMap, [{ kind: 'id', value: productId }], imageUrl)
    })
  }

  const storeIdParam = storeId ?? undefined

  const bulk = await getProductImagesAction({ limit: 200, storeId: storeIdParam }).catch((error) => {
    console.warn('[getDashboardDataAction] rust product images bulk unavailable', error)
    return null
  })

  if (bulk?.success && bulk.data?.items) {
    rememberImages(bulk.data.items as DashboardProductImageItem[])
  }

  const missingIds = uniqueIds.filter((id) => !imageMap[id]).slice(0, 40)
  if (missingIds.length === 0) return imageMap

  const targetedResults = await Promise.allSettled(
    missingIds.map((productId) =>
      getProductImagesAction({ productId, limit: 20, storeId: storeIdParam })
    ),
  )

  targetedResults.forEach((result) => {
    if (result.status !== 'fulfilled') return
    if (!result.value.success || !result.value.data?.items) return
    rememberImages(result.value.data.items as DashboardProductImageItem[])
  })

  return imageMap
}

async function fetchRustCatalogProductImages(storeId: number | null): Promise<Record<string, string>> {
  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) return {}

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  if (!adminToken) return {}

  const url = new URL('/products-paginated', base)
  url.searchParams.set('page', '1')
  url.searchParams.set('limit', '200')
  if (storeId) url.searchParams.set('store_id', String(storeId))

  const response = await fetch(url, {
    headers: { cookie: `adminAuthToken=${adminToken}` },
    cache: 'no-store',
  })
  if (!response.ok) return {}

  const payload = await response.json()
  const items = Array.isArray(payload?.items) ? payload.items as RustProductCatalogItem[] : []
  const imageMap: Record<string, string> = {}

  items.forEach((item) => {
    const product = (item.product && typeof item.product === 'object' ? item.product : item) as Record<string, unknown>
    const imageUrl = pickRustCatalogProductImage(item)
    rememberImageAliases(imageMap, [
      { kind: 'id', value: product.id ?? item.id },
      { kind: 'sku', value: product.code ?? item.code ?? product.sku ?? item.sku },
      { kind: 'name', value: product.name ?? item.name },
    ], imageUrl)
  })

  return imageMap
}

export async function getDashboardDataAction(): Promise<
  { success: true; data: DashboardRawData } | { success: false; error: string }
> {
  try {
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const startDate = oneYearAgo.toISOString().split('T')[0]
    const endDate   = now.toISOString().split('T')[0]

    const [apiOrders, apiCustomers, apiProducts, analyticsFacts, storeId] = await Promise.all([
      fetchAllOrders(startDate, endDate),
      fetchAllCustomers(),
      fetchAllProducts(),
      fetchDashboardAnalyticsFacts(startDate, endDate).catch((error) => {
        console.warn('[getDashboardDataAction] analytics facts unavailable', error)
        return []
      }),
      getAdminStoreIdFromToken().catch((error) => {
        console.warn('[getDashboardDataAction] store id unavailable', error)
        return null
      }),
    ])

    const variantIds = apiProducts.flatMap(p => p.variants.map(v => v.id))
    const variantToProductId = new Map<string, string>()
    apiProducts.forEach(product => {
      product.variants.forEach(variant => variantToProductId.set(variant.id, product.id))
    })

    const productIdsForImages = Array.from(new Set([
      ...apiOrders.flatMap(order => (order.items ?? []).map(item =>
        variantToProductId.get(item.variant_id) ?? (item.product_id != null ? String(item.product_id) : '')
      )),
      ...analyticsFacts
        .filter(fact => fact.event_name === 'product_view' && fact.product_id)
        .map(fact => String(fact.product_id ?? '')),
      ...apiProducts.slice(0, 20).map(product => product.id),
    ].filter(Boolean))).slice(0, 80)

    const [inventory, externalProductImages, rustProductImages, rustCatalogProductImages] = await Promise.all([
      fetchInventory(variantIds),
      fetchProductPrimaryImages(productIdsForImages).catch((error) => {
        console.warn('[getDashboardDataAction] product images unavailable', error)
        return {}
      }),
      fetchRustProductPrimaryImages(productIdsForImages, storeId).catch((error) => {
        console.warn('[getDashboardDataAction] rust product images unavailable', error)
        return {}
      }),
      fetchRustCatalogProductImages(storeId).catch((error) => {
        console.warn('[getDashboardDataAction] rust catalog images unavailable', error)
        return {}
      }),
    ])

    const productImages = { ...externalProductImages, ...rustProductImages, ...rustCatalogProductImages }
    const data = transformRawData(apiOrders, apiCustomers, apiProducts, inventory, analyticsFacts, productImages)
    return { success: true, data }
  } catch (err) {
    console.error('[getDashboardDataAction]', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard',
    }
  }
}
