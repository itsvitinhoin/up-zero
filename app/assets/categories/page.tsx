import { Suspense } from 'react'
import React from "react"
import { getAssetCategoriesAction } from '@/lib/actions/asset-categories'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import AdminAssetCategoriesPageClient from "@/components/admin/admin-asset-categories-page-client"
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: 'Categorias de Assets | Admin',
  description: 'Gerencie categorias para assets',
}

export const instant = false

export default function AdminAssetCategoriesPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminAssetCategoriesPageContent />
    </Suspense>
  )
}

async function AdminAssetCategoriesPageContent() {
  const storeId = await getAdminStoreIdFromToken()

  const categoriesResult = await getAssetCategoriesAction(storeId || undefined)
  const categories = categoriesResult.success && categoriesResult.data ? categoriesResult.data : []

  return (
    <AdminAssetCategoriesPageClient
      initialCategories={categories}
      storeId={storeId}
    />
  )
}
