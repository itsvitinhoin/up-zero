import React from "react"
import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { AttributesProvider } from "@/components/admin/attributes-provider"
import { getAttributesWithValuesByStore } from "@/lib/actions/attributes"
import AdminProductsPageClient from "@/components/admin/admin-products-page-client"
import type { Attribute } from "@/lib/actions/attributes"
import { withAdminMockProducts } from "@/lib/admin-mock-data"

export const metadata = {
  title: 'Produtos | Admin',
  description: 'Gerencie produtos da loja',
}

interface AdminProductsPageProps {
  searchParams?: Promise<{
    page?: string
    q?: string
    category?: string
    status?: string
  }>
}

type ProductStatsSummary = {
  total: number
  active: number
  inactive: number
  featured: number
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedPage = Number.parseInt(resolvedSearchParams.page ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const q = (resolvedSearchParams.q ?? '').trim()
  const category = (resolvedSearchParams.category ?? '').trim()
  const normalizedCategory = /^\d+$/.test(category) ? category : 'all'
  const rawStatus = (resolvedSearchParams.status ?? '').trim().toLowerCase()
  const normalizedStatus = rawStatus === 'active' || rawStatus === 'inactive' ? rawStatus : 'all'
  const limit = 20

  const cookieStore = await cookies()
  const base = process.env.NEXT_PUBLIC_RUST_URL
  const resolvedStoreId = await getAdminStoreIdFromToken()

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
    status: normalizedStatus,
  }
  let summary: ProductStatsSummary = {
    total: 0,
    active: 0,
    inactive: 0,
    featured: 0,
  }

  // Buscar dados usando store_id da env
  if (base) {
    const adminToken = cookieStore.get('adminAuthToken')?.value
    if (adminToken) {
      const headers = {
        cookie: `adminAuthToken=${adminToken}`,
      }

      try {
        // Buscar produtos paginados do Rust (filtrado por store_id da env)
        const productsUrl = new URL('/products-paginated', base)
        productsUrl.searchParams.set('page', String(page))
        productsUrl.searchParams.set('limit', String(limit))
        productsUrl.searchParams.set('summary', 'true')
        if (q.length > 0) {
          productsUrl.searchParams.set('search', q)
        }
        if (normalizedCategory !== 'all') {
          productsUrl.searchParams.set('category_id', normalizedCategory)
        }
        if (normalizedStatus !== 'all') {
          productsUrl.searchParams.set('status', normalizedStatus)
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
            status: normalizedStatus,
          }

          summary = {
            total: Number(rustProductsResponse?.summary?.total ?? pagination.total ?? 0),
            active: Number(rustProductsResponse?.summary?.active ?? 0),
            inactive: Number(rustProductsResponse?.summary?.inactive ?? 0),
            featured: Number(rustProductsResponse?.summary?.featured ?? 0),
          }

          // Mapear produtos do Rust para o formato local
          products = rustProducts.map((item: any) => {
            const productInfo = item.product || item
            const variants = Array.isArray(item.variants) ? item.variants : []
            const activeVariants = variants.filter((variantItem: any) => variantItem?.active !== false)
            const displayVariants = activeVariants.length > 0 ? activeVariants : variants
            const categoryIds = Array.isArray(item.category_ids) ? item.category_ids : []

            const colorsMap = new Map<string, any>()
            const sizesSet = new Set<string>()
            const productImages = new Set<string>()

            displayVariants.forEach((variantItem: any) => {
              if (Array.isArray(variantItem.images)) {
                variantItem.images.forEach((img: string) => {
                  if (typeof img === 'string' && img.length > 0) {
                    productImages.add(img)
                  }
                })
              }

              const attributeValues = variantItem.attribute_values || []
              attributeValues.forEach((attr: any) => {
                const attrCode = attr.attribute_code || attr.attribute?.code
                const attrName = attr.attribute_name || attr.attribute?.name
                const valueName = attr.value_name || attr.value?.name || ''
                const valueCode = attr.value_code || attr.value?.code || valueName
                const valueId = attr.value_id || attr.value?.id
                const valueMeta = attr.value_meta || {}

                const codeNorm = String(attrCode || '').trim().toLowerCase()
                const nameNorm = String(attrName || '').trim().toLowerCase()

                if (['color', 'colors', 'cor', 'cores'].includes(codeNorm) || nameNorm.includes('cor') || nameNorm.includes('color')) {
                  const key = valueCode || valueName
                  if (key && !colorsMap.has(key)) {
                    const rgb = typeof valueMeta.rgb === 'string' && valueMeta.rgb.length > 0
                      ? valueMeta.rgb
                      : '#000000'
                    const images = typeof valueMeta.imageUrl === 'string' && valueMeta.imageUrl.length > 0
                      ? [valueMeta.imageUrl]
                      : (Array.isArray(variantItem.images) ? variantItem.images : [])
                    colorsMap.set(key, {
                      id: valueId ? `color-${valueId}` : `color-${key}`,
                      name: valueName,
                      hex: rgb,
                      images,
                      attributeValueId: valueId,
                    })
                  }
                }

                if (['size', 'sizes', 'tamanho', 'tamanhos'].includes(codeNorm) || nameNorm.includes('tamanho') || nameNorm.includes('size')) {
                  const sizeName = String(valueName).trim().toUpperCase()
                  if (sizeName) sizesSet.add(sizeName)
                }
              })

              if (productImages.size === 0 && typeof item.cover_image_url === 'string' && item.cover_image_url.length > 0) {
                productImages.add(item.cover_image_url)
              }
            })

            const firstVariant = displayVariants.length > 0 ? displayVariants[0] : null
            const firstVariantPrice = firstVariant?.price_cents
            const firstVariantCost = firstVariant?.cost_cents

            return {
              id: String(productInfo.id),
              name: productInfo.name,
              slug: String(productInfo.slug || ''),
              sku: productInfo.code,
              description: productInfo.description || '',
              materials: productInfo.composition || '',
              measures: productInfo.location || '',
              basePrice: typeof firstVariantPrice === 'number' ? firstVariantPrice / 100 : 0,
              cost: typeof firstVariantCost === 'number' ? firstVariantCost / 100 : null,
              isActive: productInfo.active,
              isFeatured: false,
              categoryId: categoryIds.length > 0 ? String(categoryIds[0]) : '',
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

  products = withAdminMockProducts(products)

  if (summary.total === 0 && products.length > 0) {
    summary = {
      total: products.length,
      active: products.filter((product) => product.isActive).length,
      inactive: products.filter((product) => !product.isActive).length,
      featured: products.filter((product) => product.isFeatured).length,
    }
  }

  return (
    <AttributesProvider attributes={attributes} storeId={storeId}>
      <AdminProductsPageClient 
        initialProducts={products} 
        initialCategories={categories}
        initialPagination={pagination}
        initialSummary={summary}
      />
    </AttributesProvider>
  )
}
