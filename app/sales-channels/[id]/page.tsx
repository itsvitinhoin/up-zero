import { cookies } from 'next/headers'
import { getAdminSession } from '@/lib/actions/auth'
import { redirect, notFound } from 'next/navigation'
import { getSalesChannelsAction, getChannelPricesAction } from '@/lib/actions/sales-channels'
import { AdminChannelPricesClient, type SalesChannelProduct } from '@/components/admin/admin-channel-prices-client'

interface Props {
  params: Promise<{ id: string }>
  searchParams?: Promise<{
    page?: string
    q?: string
  }>
}

type RustProductVariant = {
  id?: number
  sku?: string
  price_cents?: number
  promo_cents?: number
  active?: boolean
  attribute_values?: Array<{
    attribute_code?: string
    attribute_name?: string
    value_name?: string
  }>
}

type RustProductItem = {
  id?: number
  code?: string
  name?: string
  active?: boolean
  variants?: RustProductVariant[]
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const result = await getSalesChannelsAction()
  const channel = result.data?.find(c => String(c.id) === id)
  return { title: `${channel?.name ?? 'Canal'} — Preços por Produto | Admin` }
}

export default async function ChannelPricesPage({ params, searchParams }: Props) {
  const session = await getAdminSession()
  if (!session) redirect('/login')

  const { id } = await params
  const channelId = Number(id)

  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedPage = Number.parseInt(resolvedSearchParams.page ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const q = (resolvedSearchParams.q ?? '').trim()
  const limit = 20

  const [channelsResult, pricesResult] = await Promise.all([
    getSalesChannelsAction(),
    getChannelPricesAction(channelId),
  ])

  const channel = channelsResult.data?.find(c => c.id === channelId)
  if (!channel) return notFound()

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  const base = process.env.NEXT_PUBLIC_RUST_URL

  let products: SalesChannelProduct[] = []
  let pagination = {
    total: 0,
    page,
    limit,
    search: q,
  }

  if (base && adminToken) {
    try {
      const productsUrl = new URL('/products-paginated', base)
      productsUrl.searchParams.set('page', String(page))
      productsUrl.searchParams.set('limit', String(limit))
      productsUrl.searchParams.set('store_id', String(session.storeId))
      if (q.length > 0) {
        productsUrl.searchParams.set('search', q)
      }

      const productsRes = await fetch(productsUrl, {
        headers: {
          cookie: `adminAuthToken=${adminToken}`,
        },
        cache: 'no-store',
      })

      if (productsRes.ok) {
        const payload = await productsRes.json()
        const items = Array.isArray(payload?.items) ? payload.items as RustProductItem[] : []

        pagination = {
          total: Number(payload?.total ?? 0),
          page: Number(payload?.page ?? page),
          limit: Number(payload?.limit ?? limit),
          search: q,
        }

        products = items
          .map((item) => ({
            id: Number(item.id ?? 0),
            code: String(item.code ?? ''),
            name: String(item.name ?? ''),
            active: item.active !== false,
            variants: (Array.isArray(item.variants) ? item.variants : [])
              .filter((variant) => Number.isFinite(Number(variant?.id)))
              .map((variant) => ({
                id: Number(variant.id),
                sku: String(variant.sku ?? ''),
                price_cents: Number(variant.price_cents ?? 0),
                promo_cents: Number(variant.promo_cents ?? 0),
                active: variant.active !== false,
                attribute_values: Array.isArray(variant.attribute_values)
                  ? variant.attribute_values.map((value) => ({
                      attribute_code: String(value.attribute_code ?? ''),
                      attribute_name: String(value.attribute_name ?? ''),
                      value_name: String(value.value_name ?? ''),
                    }))
                  : [],
              })),
          }))
          .filter((product) => product.id > 0)
      }
    } catch (error) {
      console.error('Erro ao carregar produtos paginados para canal:', error)
    }
  }

  return (
    <AdminChannelPricesClient
      channel={channel}
      initialPrices={pricesResult.data ?? []}
      initialProducts={products}
      pagination={pagination}
    />
  )
}
