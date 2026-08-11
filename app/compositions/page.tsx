import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/actions/auth'
import { getProductsAction } from '@/lib/actions/products'
import { getAssetsAction } from '@/lib/actions/assets'
import { getCompositionsAction } from '@/lib/actions/compositions'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { AdminCompositionsPageClient } from '@/components/admin/admin-compositions-page-client'
import type { Asset, Product } from '@/lib/types'

export const metadata = { title: 'Composição de Produtos | Admin' }

export const instant = false

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function CompositionsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <CompositionsPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function CompositionsPageContent(props: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const session = await getAdminSession()
  if (!session) redirect('/login')

  const search = typeof props.searchParams.search === 'string' ? props.searchParams.search : ''
  const active = typeof props.searchParams.active === 'string' ? props.searchParams.active : 'all'
  const pricing_mode = typeof props.searchParams.pricing_mode === 'string' ? props.searchParams.pricing_mode : 'all'
  const page = typeof props.searchParams.page === 'string' ? parseInt(props.searchParams.page, 10) : 1

  const [compositionsResult, productsResult, assetsResult] = await Promise.all([
    getCompositionsAction({
      search: search || undefined,
      active: active as 'all' | 'active' | 'inactive',
      pricing_mode: pricing_mode as 'all' | 'NONE' | 'ITEM_PERCENT' | 'ITEM_FIXED',
      page,
      page_size: 20,
    }),
    getProductsAction({ isActive: true }),
    getAssetsAction({ limit: 200, sort: 'name-asc' }),
  ])

  const paginatedCompositions = compositionsResult.success ? compositionsResult.data : null
  const products: Product[] = productsResult.success && productsResult.data ? productsResult.data : []
  const assets: Asset[] = assetsResult.success && assetsResult.data ? assetsResult.data : []
  const initialError = compositionsResult.success ? null : compositionsResult.error

  return (
    <AdminCompositionsPageClient
      paginatedCompositions={paginatedCompositions}
      products={products}
      assets={assets}
      initialError={initialError}
    />
  )
}