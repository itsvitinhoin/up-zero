import { Suspense } from 'react'
import { getAssetCategoriesAction } from '@/lib/actions/asset-categories'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { getAssetSortItemsAction } from '@/lib/actions/asset-sort-orders'
import AdminAssetShowcasePageClient from '@/components/admin/admin-asset-showcase-page-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export const metadata = {
  title: 'Vitrine Assets | Catálogo',
  description: 'Ordenação manual da vitrine de assets por categoria e tipo de ordenação',
}

export const instant = false

type AdminAssetShowcasePageProps = {
  searchParams?: Promise<{
    scope?: string
    category?: string
    sort?: string
    search?: string
    page?: string
  }>
}

export default function AdminAssetShowcasePage({ searchParams }: AdminAssetShowcasePageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminAssetShowcasePageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminAssetShowcasePageContent({ searchParams }: AdminAssetShowcasePageProps) {
  await ensureAdminPermission('assets.edit', '/assets')

  const resolvedSearchParams = (await searchParams) ?? {}
  const storeId = await getAdminStoreIdFromToken()
  const categoriesResult = await getAssetCategoriesAction(storeId || undefined)

  const categories = categoriesResult.success && Array.isArray(categoriesResult.data)
    ? categoriesResult.data
    : []

  const categoryIds = new Set(categories.map((category) => Number(category.id)).filter((id) => Number.isInteger(id) && id > 0))
  const requestedScope = resolvedSearchParams.scope === 'category' ? 'category' : 'store'
  const requestedSortType = 'manual_default'
  const requestedSearch = (resolvedSearchParams.search || '').trim()
  const requestedPageRaw = Number(resolvedSearchParams.page)
  const requestedPage = Number.isInteger(requestedPageRaw) && requestedPageRaw > 0 ? requestedPageRaw : 1
  const requestedCategoryRaw = Number(resolvedSearchParams.category)
  const requestedCategoryId = Number.isInteger(requestedCategoryRaw) && requestedCategoryRaw > 0
    ? requestedCategoryRaw
    : null

  const initialScopeType = requestedScope === 'category' && requestedCategoryId && categoryIds.has(requestedCategoryId)
    ? 'category'
    : 'store'
  const initialCategoryId = initialScopeType === 'category' ? String(requestedCategoryId) : ''

  let initialItems = undefined
  let initialTotal = 0
  let initialPage = 1
  let initialTotalPages = 0

  const initialContextId = initialScopeType === 'category'
    ? requestedCategoryId
    : (storeId && Number.isInteger(storeId) && storeId > 0 ? storeId : null)

  if (initialContextId && Number.isInteger(initialContextId) && initialContextId > 0) {
    const initialResult = await getAssetSortItemsAction({
      contextType: initialScopeType,
      contextId: initialContextId,
      sortType: requestedSortType,
      search: requestedSearch || undefined,
      page: requestedPage,
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
    <AdminAssetShowcasePageClient
      categories={categories}
      storeId={storeId}
      initialScopeType={initialScopeType}
      initialCategoryId={initialCategoryId}
      initialSortType={requestedSortType}
      initialSearchTerm={requestedSearch}
      initialItems={initialItems}
      initialTotal={initialTotal}
      initialPage={initialPage}
      initialTotalPages={initialTotalPages}
    />
  )
}
