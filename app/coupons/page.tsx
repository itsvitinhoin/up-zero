import React from "react"
import { cookies } from "next/headers"
import { getAdminStoreIdFromToken } from '@/lib/auth'
import AdminCouponsPageClient from "@/components/admin/admin-coupons-page-client"
import { getCouponsAction } from '@/lib/actions/coupons'
import type { Coupon } from "@/lib/types"

export const metadata = {
  title: 'Cupons | Admin',
  description: 'Gerencie cupons de desconto',
}

export default async function AdminCouponsPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"
  const resolvedStoreId = await getAdminStoreIdFromToken()

  let coupons: Coupon[] = []
  const storeId: number | null = resolvedStoreId

  const result = await getCouponsAction()
  if (result.success && result.data) {
    coupons = result.data
  }

  return (
    <AdminCouponsPageClient 
      initialCoupons={coupons}
      storeId={storeId}
      locale={locale}
    />
  )
}
