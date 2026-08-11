import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { AttributesProvider } from "@/components/admin/attributes-provider"
import { getAttributesWithValuesByStore } from "@/lib/actions/attributes"
import { getSiteSettingsAction } from "@/lib/actions/settings"
import { isErpIntegrated } from "@/lib/erp-integration"
import AdminProductsPageClient from "@/components/admin/admin-products-page-client"
import type { Attribute } from "@/lib/actions/attributes"
import { ProductsSkeleton } from './products-skeleton'

export const metadata = {
  title: 'Produtos | Admin',
  description: 'Gerencie produtos da loja',
}

interface AdminProductsPageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    q?: string
    category?: string
    attribute_values?: string
    status?: string
    sort_by?: string
    sort_dir?: string
  }>
}

type ProductStatsSummary = {
  total: number
  active: number
  inactive: number
  featured: number
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  const normalized = raw.startsWith('#') ? raw : `#${raw}`
  if (/^#[0-9a-fA-F]{3}$/.test(normalized) || /^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized
  }

  return null
}

export default function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <AdminProductsPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminProductsPageContent({ searchParams }: AdminProductsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedPage = Number.parseInt(resolvedSearchParams.page ?? '1', 10)
  const requestedLimit = Number.parseInt(resolvedSearchParams.limit ?? '20', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const q = (resolvedSearchParams.q ?? '').trim()
  const category = (resolvedSearchParams.category ?? '').trim()
  const normalizedCategory = /^\d+$/.test(category) ? category : 'all'
  const attributeValuesRaw = (resolvedSearchParams.attribute_values ?? '').trim()
  const normalizedAttributeValues = Array.from(
    new Set(
      attributeValuesRaw
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^\d+$/.test(value)),
    ),
  ).join(',')
  const rawStatus = (resolvedSearchParams.status ?? '').trim().toLowerCase()
  const normalizedStatus = rawStatus === 'active' || rawStatus === 'inactive' ? rawStatus : 'all'
  const rawSortBy = (resolvedSearchParams.sort_by ?? '').trim().toLowerCase()
  const normalizedSortBy = rawSortBy === 'name' || rawSortBy === 'sku' || rawSortBy === 'base_price' || rawSortBy === 'promo_price'
    ? rawSortBy
    : ''
  const rawSortDir = (resolvedSearchParams.sort_dir ?? '').trim().toLowerCase()
  const normalizedSortDir = rawSortDir === 'asc' || rawSortDir === 'desc' ? rawSortDir : ''

  // Buscar settings para ordenação padrão e status do ERP
  let defaultSortBy = ''
  let defaultSortDir = ''
  let isErpIntegratedFlag = false
  try {
    const settingsResult = await getSiteSettingsAction(undefined, { include: { erp: true } })
    if (settingsResult.success && settingsResult.data) {
      isErpIntegratedFlag = isErpIntegrated(settingsResult.data.erpSettings)
    }
    if (settingsResult.success && settingsResult.data?.customization?.storefrontDefaultSort) {
      const defaultSort = settingsResult.data.customization.storefrontDefaultSort
      // Map de storefrontDefaultSort para sort_by do admin
      const sortMap: Record<string, { by: string; dir: string }> = {
        'relevance': { by: '', dir: '' },
        'price_asc': { by: 'base_price', dir: 'asc' },
        'price_desc': { by: 'base_price', dir: 'desc' },
        'newest': { by: '', dir: '' },
        'sku': { by: 'sku', dir: 'asc' },
      }
      if (sortMap[defaultSort]) {
        defaultSortBy = sortMap[defaultSort].by
        defaultSortDir = sortMap[defaultSort].dir
      }
    }
  } catch (error) {
    // Se não conseguir buscar settings, usa defaults vazios
    console.error('Error fetching settings for default sort:', error)
  }

  // Usa o valor do query se existir, caso contrário usa o default dos settings
  const finalSortBy = normalizedSortBy || defaultSortBy
  const finalSortDir = normalizedSortDir || defaultSortDir
  const limit = requestedLimit === 50 || requestedLimit === 100 ? requestedLimit : 20

  const cookieStore = await cookies()
  const base = process.env.NEXT_PUBLIC_RUST_URL
  const resolvedStoreId = await getAdminStoreIdFromToken()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  if (!adminToken) {
    redirect('/login')
  }

  if (base) {
    try {
      const permissionUrl = new URL('/permissions/check', base)
      permissionUrl.searchParams.set('code', 'products.view')

      const permissionRes = await fetch(permissionUrl, {
        headers: {
          cookie: `adminAuthToken=${adminToken}`,
        },
        cache: 'no-store',
      })

      if (!permissionRes.ok) {
        redirect('/login')
      }

      const permissionPayload = await permissionRes.json() as { has_permission?: boolean }
      if (!permissionPayload?.has_permission) {
        redirect('/')
      }
    } catch {
      redirect('/')
    }
  }

  let attributes: Attribute[] = []
  let storeId: number | null = resolvedStoreId
  let products: any[] = []
  let categories: any[] = []
  let pagination = {
    total: 0,
    page,
    limit,
    search: q,
    category: normalizedCategory,
    attributeValues: normalizedAttributeValues,
    status: normalizedStatus,
    sortBy: finalSortBy,
    sortDir: finalSortDir,
  }
  let summary: ProductStatsSummary = {
    total: 0,
    active: 0,
    inactive: 0,
    featured: 0,
  }

  // Buscar dados usando store_id da env
  if (base) {
    if (adminToken) {
      const headers = {
        cookie: `adminAuthToken=${adminToken}`,
      }

      try {
        // Buscar produtos paginados do Rust (filtrado por store_id da env)
        const productsUrl = new URL('/internal/admin/products-paginated', base)
        productsUrl.searchParams.set('page', String(page))
        productsUrl.searchParams.set('limit', String(limit))
        productsUrl.searchParams.set('summary', 'true')
        if (q.length > 0) {
          productsUrl.searchParams.set('search', q)
        }
        if (normalizedCategory !== 'all') {
          productsUrl.searchParams.set('category_id', normalizedCategory)
        }
        if (normalizedAttributeValues.length > 0) {
          productsUrl.searchParams.set('attribute_value_ids', normalizedAttributeValues)
        }
        if (normalizedStatus !== 'all') {
          productsUrl.searchParams.set('status', normalizedStatus)
        }
        if (finalSortBy && finalSortDir) {
          productsUrl.searchParams.set('sort_by', finalSortBy)
          productsUrl.searchParams.set('sort_dir', finalSortDir)
        }
        if (storeId) {
          productsUrl.searchParams.set('store_id', String(storeId))
        }

        const productsResPromise = fetch(productsUrl, {
          headers,
          cache: 'no-store',
        })

        // Buscar categorias do Rust (somente da loja)
        const categoriesUrl = new URL('/categories', base)
        if (storeId) {
          categoriesUrl.searchParams.set('store_id', String(storeId))
        }

        const categoriesResPromise = fetch(categoriesUrl, {
          headers,
          cache: 'no-store',
        })

        const attributesPromise: ReturnType<typeof getAttributesWithValuesByStore> = storeId
          ? getAttributesWithValuesByStore(storeId)
          : Promise.resolve({
              success: false,
              data: null,
              error: 'Store ID is not configured',
            })

        const [productsRes, categoriesRes, attributesResult] = await Promise.all([
          productsResPromise,
          categoriesResPromise,
          attributesPromise,
        ] as const)

        if (productsRes.ok) {
          const rustProductsResponse = await productsRes.json()
          const rustProducts = Array.isArray(rustProductsResponse?.items)
            ? rustProductsResponse.items
            : []

          pagination = {
            total: Number(rustProductsResponse?.total ?? 0),
            page: Number(rustProductsResponse?.page ?? page),
            limit: Number(rustProductsResponse?.limit ?? limit),
            search: q,
            category: normalizedCategory,
            attributeValues: normalizedAttributeValues,
            status: normalizedStatus,
            sortBy: finalSortBy,
            sortDir: finalSortDir,
          }

          summary = {
            total: Number(rustProductsResponse?.summary?.total ?? pagination.total ?? 0),
            active: Number(rustProductsResponse?.summary?.active ?? 0),
            inactive: Number(rustProductsResponse?.summary?.inactive ?? 0),
            featured: Number(rustProductsResponse?.summary?.featured ?? 0),
          }

          // Mapear produtos do endpoint interno (payload enxuto para listagem admin)
          products = rustProducts.map((item: any) => {
            const productInfo = item || {}
            const categoryIds = Array.isArray(productInfo.category_ids) ? productInfo.category_ids : []

            const colorsMap = new Map<string, any>()
            const sizesSet = new Set<string>()
            const productImages = new Set<string>()

            if (typeof productInfo.cover_image_url === 'string' && productInfo.cover_image_url.length > 0) {
              productImages.add(productInfo.cover_image_url)
            }

            const colors = Array.isArray(productInfo.colors) ? productInfo.colors : []
            colors.forEach((color: any) => {
              const id = Number(color?.id)
              const name = String(color?.name || '').trim()
              const hex = normalizeHexColor(color?.hex) || '#000000'
              if (!name) return
              const key = `${id || 0}-${name}`
              if (!colorsMap.has(key)) {
                colorsMap.set(key, {
                  id: id > 0 ? `color-${id}` : `color-${name}`,
                  name,
                  hex,
                  images: Array.from(productImages),
                  attributeValueId: id > 0 ? id : undefined,
                })
              }
            })

            const sizes = Array.isArray(productInfo.sizes) ? productInfo.sizes : []
            sizes.forEach((size: any) => {
              const sizeName = String(size || '').trim().toUpperCase()
              if (sizeName) sizesSet.add(sizeName)
            })

            return {
              id: String(productInfo.id),
              name: productInfo.name,
              slug: String(productInfo.slug || ''),
              sku: productInfo.code,
              description: productInfo.description || '',
              materials: productInfo.composition || '',
              measures: productInfo.location || '',
              basePrice: typeof productInfo.price_cents === 'number' ? productInfo.price_cents / 100 : 0,
              promoPrice: typeof productInfo.promo_cents === 'number' && productInfo.promo_cents > 0 ? productInfo.promo_cents / 100 : null,
              cost: typeof productInfo.cost_cents === 'number' ? productInfo.cost_cents / 100 : null,
              isActive: productInfo.active,
              isFeatured: false,
              categoryId: categoryIds.length > 0 ? String(categoryIds[0]) : '',
              categoryIds: categoryIds.map((value: number) => String(value)),
              tags: Array.isArray(productInfo.tags) ? productInfo.tags : [],
              images: Array.from(productImages),
              sizes: Array.from(sizesSet),
              colors: Array.from(colorsMap.values()),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          })
        }

        if (categoriesRes.ok) {
          const rustCategories = await categoriesRes.json()
          // Mapear categorias do Rust para o formato local
          categories = rustCategories.map((c: any) => ({
            id: String(c.id),
            name: c.name,
            slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
            description: c.description || '',
            parentId: c.parent_id ? String(c.parent_id) : null,
            imageUrl: null,
            isActive: c.active ?? true,
            sortOrder: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))
        }

        if (attributesResult.success && attributesResult.data) {
          attributes = attributesResult.data
        }
      } catch (err) {
        console.error('Erro ao buscar dados do backend:', err)
      }
    }
  }

  return (
    <AttributesProvider attributes={attributes} storeId={storeId}>
      <AdminProductsPageClient
        initialProducts={products}
        initialCategories={categories}
        initialPagination={pagination}
        initialSummary={summary}
        isErpIntegrated={isErpIntegratedFlag}
      />
    </AttributesProvider>
  )
}
