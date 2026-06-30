'use server'

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

async function fetchRustProductPrimaryImages(
  productIds: string[],
  storeId: number | null,
): Promise<Record<string, string>> {
  const imageMap: Record<string, string> = {}
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean))).slice(0, 80)

  const rememberImages = (items: DashboardProductImageItem[]) => {
    items.forEach((item) => {
      const productId = item.productId != null ? String(item.productId) : ''
      if (!productId || imageMap[productId]) return

      const imageUrl = pickDashboardProductImage(item)
      if (imageUrl) imageMap[productId] = imageUrl
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

    const [inventory, externalProductImages, rustProductImages] = await Promise.all([
      fetchInventory(variantIds),
      fetchProductPrimaryImages(productIdsForImages).catch((error) => {
        console.warn('[getDashboardDataAction] product images unavailable', error)
        return {}
      }),
      fetchRustProductPrimaryImages(productIdsForImages, storeId).catch((error) => {
        console.warn('[getDashboardDataAction] rust product images unavailable', error)
        return {}
      }),
    ])

    const productImages = { ...rustProductImages, ...externalProductImages }
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
