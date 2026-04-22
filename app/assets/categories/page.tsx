import React from "react"
import { getAssetCategoriesAction } from '@/lib/actions/asset-categories'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import AdminAssetCategoriesPageClient from "@/components/admin/admin-asset-categories-page-client"

export const metadata = {
  title: 'Categorias de Assets | Admin',
  description: 'Gerencie categorias para assets',
}

export default async function AdminAssetCategoriesPage() {
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
