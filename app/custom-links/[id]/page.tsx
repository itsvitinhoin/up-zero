import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getCategoriesAction, getPaginatedStoreProductsAction } from '@/lib/actions/products'
import { getCustomLinkAction, getCustomLinkProductsBySlugForStoreAction } from '@/lib/actions/custom-links'
import { NewCustomLinkForm } from '@/components/admin/new-custom-link-form'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

interface EditCustomLinkPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Editar Link Personalizado | Admin',
}

export default function EditCustomLinkPage({ params }: EditCustomLinkPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <EditCustomLinkPageContent params={params} />
    </Suspense>
  )
}

async function EditCustomLinkPageContent({ params }: EditCustomLinkPageProps) {
  await ensureAdminPermission('custom_links.edit', '/custom-links')
  await connection()

  const { id } = await params

  const linkResult = await getCustomLinkAction(id)

  if (!linkResult.success || !linkResult.data) {
    notFound()
  }

  const [productsResult, categoriesResult, selectedProductsResult] = await Promise.all([
    getPaginatedStoreProductsAction({ page: 1, limit: 24, isActive: true }),
    getCategoriesAction(),
    linkResult.data.productIds.length > 0
      ? getCustomLinkProductsBySlugForStoreAction(linkResult.data.link.slug, linkResult.data.link.storeId)
      : Promise.resolve({ success: true, data: [] }),
  ])

  const initialPagination = productsResult.success && productsResult.data
    ? productsResult.data
    : { items: [], total: 0, page: 1, pageSize: 24, totalPages: 1 }
  const categories = categoriesResult.success && categoriesResult.data ? categoriesResult.data : []
  const initialSelectedProducts = selectedProductsResult.success && selectedProductsResult.data
    ? selectedProductsResult.data
    : []

  return (
    <NewCustomLinkForm
      initialPagination={initialPagination}
      categories={categories}
      initialLink={linkResult.data}
      initialSelectedProducts={initialSelectedProducts}
    />
  )
}
