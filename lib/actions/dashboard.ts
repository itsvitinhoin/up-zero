'use server'

import { fetchAllOrders, fetchAllCustomers, fetchAllProducts, fetchInventory } from '@/lib/upzero-api'
import { transformRawData, type DashboardRawData } from '@/lib/dashboard-compute'

export async function getDashboardDataAction(): Promise<
  { success: true; data: DashboardRawData } | { success: false; error: string }
> {
  try {
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const startDate = oneYearAgo.toISOString().split('T')[0]
    const endDate   = now.toISOString().split('T')[0]

    const [apiOrders, apiCustomers, apiProducts] = await Promise.all([
      fetchAllOrders(startDate, endDate),
      fetchAllCustomers(),
      fetchAllProducts(),
    ])

    const variantIds = apiProducts.flatMap(p => p.variants.map(v => v.id))
    const inventory  = await fetchInventory(variantIds)

    const data = transformRawData(apiOrders, apiCustomers, apiProducts, inventory)
    return { success: true, data }
  } catch (err) {
    console.error('[getDashboardDataAction]', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard',
    }
  }
}
