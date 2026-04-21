import { getCategoriesAction } from '@/lib/actions/categories'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { getProductSortItemsAction } from '@/lib/actions/product-sort-orders'
import AdminProductShowcasePageClient from '@/components/admin/admin-product-showcase-page-client'

export const metadata = {
  title: 'Vitrine | Catálogo',
  description: 'Ordenação manual da vitrine por categoria e tipo de ordenação',
}

export default async function AdminProductShowcasePage() {
  const [categoriesResult, storeId] = await Promise.all([
    getCategoriesAction(),
    getAdminStoreIdFromToken(),
  ])

  const categories = categoriesResult.success && Array.isArray(categoriesResult.data)
    ? categoriesResult.data
    : []

  // SSR: pré-carrega a primeira página com o contexto padrão (loja, manual_default)
  let initialItems = undefined
  let initialTotal = 0
  let initialPage = 1
  let initialTotalPages = 0

  if (storeId && Number.isInteger(storeId) && storeId > 0) {
    const initialResult = await getProductSortItemsAction({
      contextType: 'store',
      contextId: storeId,
      sortType: 'manual_default',
      page: 1,
      pageSize: 40,
    })
    if (initialResult.success) {
      initialItems = initialResult.items
      initialTotal = initialResult.total
      initialPage = initialResult.page
      initialTotalPages = initialResult.totalPages
    }
  }

  return (
    <AdminProductShowcasePageClient
      categories={categories}
      storeId={storeId}
      initialItems={initialItems}
      initialTotal={initialTotal}
      initialPage={initialPage}
      initialTotalPages={initialTotalPages}
    />
  )
}
