'use server'

import {
  fetchAllOrders,
  fetchAllCustomers,
  fetchAllProducts,
  fetchInventory,
  fetchDashboardAnalyticsFacts,
  fetchProductPrimaryImages,
} from '@/lib/upzero-api'
import { transformRawData, type DashboardRawData } from '@/lib/dashboard-compute'

export async function getDashboardDataAction(): Promise<
  { success: true; data: DashboardRawData } | { success: false; error: string }
> {
  try {
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const startDate = oneYearAgo.toISOString().split('T')[0]
    const endDate   = now.toISOString().split('T')[0]

    const [apiOrders, apiCustomers, apiProducts, analyticsFacts] = await Promise.all([
      fetchAllOrders(startDate, endDate),
      fetchAllCustomers(),
      fetchAllProducts(),
      fetchDashboardAnalyticsFacts(startDate, endDate).catch((error) => {
        console.warn('[getDashboardDataAction] analytics facts unavailable', error)
        return []
      }),
    ])

    const variantIds = apiProducts.flatMap(p => p.variants.map(v => v.id))
    const variantToProductId = new Map<string, string>()
    apiProducts.forEach(product => {
      product.variants.forEach(variant => variantToProductId.set(variant.id, product.id))
    })

    const productIdsForImages = Array.from(new Set([
      ...apiOrders.flatMap(order => (order.items ?? []).map(item => variantToProductId.get(item.variant_id) ?? '')),
      ...analyticsFacts
        .filter(fact => fact.event_name === 'product_view' && fact.product_id)
        .map(fact => String(fact.product_id ?? '')),
      ...apiProducts.slice(0, 20).map(product => product.id),
    ].filter(Boolean))).slice(0, 80)

    const [inventory, productImages] = await Promise.all([
      fetchInventory(variantIds),
      fetchProductPrimaryImages(productIdsForImages).catch((error) => {
        console.warn('[getDashboardDataAction] product images unavailable', error)
        return {}
      }),
    ])

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
