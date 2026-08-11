import { Suspense } from 'react'
import { getCategoriesAction, getPaginatedStoreProductsAction } from '@/lib/actions/products'
import { NewCustomLinkForm } from '@/components/admin/new-custom-link-form'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export const metadata = {
  title: 'Novo Link Personalizado | Admin',
}

export const instant = false

export default function NewCustomLinkPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <NewCustomLinkPageContent />
    </Suspense>
  )
}

async function NewCustomLinkPageContent() {
  await ensureAdminPermission('custom_links.create', '/custom-links')
  await connection()

  const [productsResult, categoriesResult] = await Promise.all([
    getPaginatedStoreProductsAction({ page: 1, limit: 24, isActive: true }),
    getCategoriesAction(),
  ])

  const initialPagination = productsResult.success && productsResult.data
    ? productsResult.data
    : { items: [], total: 0, page: 1, pageSize: 24, totalPages: 1 }
  const categories = categoriesResult.success && categoriesResult.data ? categoriesResult.data : []

  return (
    <NewCustomLinkForm
      initialPagination={initialPagination}
      categories={categories}
    />
  )
}
