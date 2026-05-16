import React from "react"
import { cookies } from "next/headers"
import { getAdminStoreIdFromToken } from '@/lib/auth'
import AdminCouponsPageClient from "@/components/admin/admin-coupons-page-client"
import { getCouponsAction } from '@/lib/actions/coupons'
import { getCategoriesAction } from "@/lib/actions/categories"
import { getProductsAction } from "@/lib/actions/products"
import type { Category, Coupon, Product } from "@/lib/types"

export const metadata = {
  title: 'Cupons | Admin',
  description: 'Gerencie cupons de desconto',
}

export default async function AdminCouponsPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"
  const resolvedStoreId = await getAdminStoreIdFromToken()

  let coupons: Coupon[] = []
  let products: Product[] = []
  let categories: Category[] = []
  const storeId: number | null = resolvedStoreId

  const [couponsResult, productsResult, categoriesResult] = await Promise.all([
    getCouponsAction(),
    getProductsAction(),
    getCategoriesAction(storeId ?? undefined),
  ])

  if (couponsResult.success && couponsResult.data) {
    coupons = couponsResult.data
  }
  if (productsResult.success && productsResult.data) {
    products = productsResult.data
  }
  if (categoriesResult.success && categoriesResult.data) {
    categories = categoriesResult.data
  }

  return (
    <AdminCouponsPageClient 
      initialCoupons={coupons}
      initialProducts={products}
      initialCategories={categories}
      storeId={storeId}
      locale={locale}
    />
  )
}
