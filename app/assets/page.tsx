import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import AdminAssetsPageClient from '@/components/admin/admin-assets-page-client'
import { getAttributesWithValuesByStore } from '@/lib/actions/attributes'
import { getAssetsAction, getAssetsSummaryAction } from '@/lib/actions/assets'
import { getAssetCategoriesAction } from '@/lib/actions/asset-categories'
import type { Attribute } from '@/lib/actions/attributes'
import type { Category } from '@/lib/types'

export const metadata = {
  title: 'Assets | Admin',
  description: 'Gerencie assets e imagens por combinação de atributos',
}

type ProductOption = {
  id: string
  name: string
  code?: string
}

type AdminAssetsPageProps = {
  searchParams?: Promise<{ page?: string }>
}

export default async function AdminAssetsPage({ searchParams }: AdminAssetsPageProps) {
  const resolvedSearchParams = await searchParams
  const page = Number.isFinite(Number(resolvedSearchParams?.page))
    ? Math.max(1, Number(resolvedSearchParams?.page))
    : 1
  const limit = 25

  const cookieStore = await cookies()
  const base = process.env.NEXT_PUBLIC_RUST_URL
  const storeId = await getAdminStoreIdFromToken()

  let products: ProductOption[] = []
  let attributes: Attribute[] = []
  let categories: Category[] = []

  if (base) {
    const adminToken = cookieStore.get('adminAuthToken')?.value

    if (adminToken) {
      const headers = {
        cookie: `adminAuthToken=${adminToken}`,
      }

      try {
        const productsUrl = new URL('/products-paginated', base)
        productsUrl.searchParams.set('page', '1')
        productsUrl.searchParams.set('limit', '200')
        if (storeId) {
          productsUrl.searchParams.set('store_id', String(storeId))
        }

        const [productsRes, attributesResult, categoriesResult] = await Promise.all([
          fetch(productsUrl, {
            headers,
            cache: 'no-store',
          }),
          storeId
            ? getAttributesWithValuesByStore(storeId)
            : Promise.resolve({ success: false, data: null, error: 'Store ID não configurado' }),
          getAssetCategoriesAction(storeId || undefined),
        ])

        if (productsRes.ok) {
          const payload = await productsRes.json()
          const rawProducts = Array.isArray(payload?.items) ? payload.items : []

          products = rawProducts.map((item: any) => {
            const product = item?.product || item
            return {
              id: String(product?.id || ''),
              name: String(product?.name || ''),
              code: product?.code ? String(product.code) : undefined,
            }
          }).filter((product: ProductOption) => product.id.length > 0 && product.name.length > 0)
        }

        if (attributesResult.success && attributesResult.data) {
          attributes = attributesResult.data
        }

        if (categoriesResult.success && categoriesResult.data) {
          categories = categoriesResult.data
        }
      } catch (error) {
        console.error('Erro ao carregar dados de assets:', error)
      }
    }
  }

  const [assetsResult, assetsSummaryResult] = await Promise.all([
    getAssetsAction({ page, limit }),
    getAssetsSummaryAction(),
  ])
  const assets = assetsResult.success && assetsResult.data ? assetsResult.data : []
  const total = assetsResult.success ? Number(assetsResult.total || 0) : 0
  const currentPage = assetsResult.success ? Number(assetsResult.page || page) : page
  const pageSize = assetsResult.success ? Number(assetsResult.limit || limit) : limit
  const summary = assetsSummaryResult.success && assetsSummaryResult.data
    ? assetsSummaryResult.data
    : {
      assets: total,
      skus: assets.reduce((sum, asset) => sum + asset.skuGroups.length, 0),
      images: assets.reduce((sum, asset) => sum + asset.skuGroups.reduce((groupSum, group) => groupSum + group.images.length, 0), 0),
    }

  return (
    <AdminAssetsPageClient
      initialAssets={assets}
      summary={summary}
      total={total}
      currentPage={currentPage}
      pageSize={pageSize}
      products={products}
      attributes={attributes}
      categories={categories}
      storeId={storeId}
    />
  )
}
