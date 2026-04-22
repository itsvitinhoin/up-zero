'use server'

import { cookies } from 'next/headers'
import { appendStoreScopeParam, resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from '@/lib/actions/storefront-scope'
import type { ApiResponse, PaginatedResponse, Product, ProductVariant } from '@/lib/types'

export interface StoreProductsQuery {
  page?: number
  limit?: number
  withCount?: boolean
  storeId?: number | string
  category?: string
  search?: string
  sort?: string
  minPrice?: number
  maxPrice?: number
  colors?: string[]
  sizes?: string[]
  materials?: string[]
  tags?: string[]
  cardMode?: boolean
  includeVariants?: boolean
  maxImagesPerProduct?: number
}

function normalizeSortParam(sort?: string): string | undefined {
  const raw = sort?.trim()
  if (!raw) return undefined
  return raw.replace(/_/g, '-').toLowerCase()
}

async function buildStorefrontAuthHeaders(storeId?: number | string): Promise<Record<string, string>> {
  const cookieStore = await cookies()

  const clientToken =
    cookieStore.get('clientAuthToken')?.value ?? cookieStore.get('b2bAuthToken')?.value

  const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)

  const headers: Record<string, string> = {}
  const scopedHeaders = withStorefrontScopeHeaders(headers, storefrontApiKey)

  if (!clientToken) {
    return scopedHeaders
  }

  scopedHeaders.cookie = `clientAuthToken=${clientToken}`
  scopedHeaders.authorization = `Bearer ${clientToken}`

  return scopedHeaders
}

function colorNameToHex(name?: string): string {
  const normalized = (name || '').toLowerCase()
  if (normalized.includes('preto')) return '#111111'
  if (normalized.includes('off') || normalized.includes('branco')) return '#f3f4f6'
  if (normalized.includes('azul')) return '#2563eb'
  if (normalized.includes('verde')) return '#16a34a'
  if (normalized.includes('vermelho')) return '#dc2626'
  if (normalized.includes('laranja')) return '#ea580c'
  if (normalized.includes('fucs') || normalized.includes('fúcs') || normalized.includes('rosa')) return '#db2777'
  if (normalized.includes('bege')) return '#c7a47b'
  if (normalized.includes('amarelo')) return '#eab308'
  if (normalized.includes('roxo') || normalized.includes('lilas') || normalized.includes('lilás')) return '#7c3aed'
  return '#6b7280'
}

function normalizeHexColor(value?: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  const normalized = raw.startsWith('#') ? raw : `#${raw}`
  if (/^#[0-9a-fA-F]{3}$/.test(normalized) || /^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized
  }

  return null
}

function extractColorMeta(attr: any): { hex: string | null; imageUrl: string | null } {
  const metaRaw = attr?.value_meta
  const meta = (() => {
    if (!metaRaw) return null
    if (typeof metaRaw === 'string') {
      try {
        const parsed = JSON.parse(metaRaw)
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    }
    return typeof metaRaw === 'object' ? metaRaw : null
  })() as Record<string, unknown> | null

  const hex = normalizeHexColor(
    meta?.rgb
    ?? meta?.hex
    ?? meta?.color
    ?? attr?.value_rgb
    ?? attr?.value_hex,
  )

  const imageUrlCandidate =
    meta?.imageUrl
    ?? meta?.image_url
    ?? meta?.image
    ?? meta?.url
    ?? meta?.swatchImageUrl
    ?? meta?.swatch_image_url
    ?? meta?.swatch
    ?? meta?.swatchUrl
    ?? meta?.swatch_url
    ?? meta?.assetImageUrl
    ?? meta?.asset_image_url

  const imageUrl = typeof imageUrlCandidate === 'string' && imageUrlCandidate.trim().length > 0
    ? imageUrlCandidate.trim()
    : null

  return { hex, imageUrl }
}

function parseMetaObject(metaRaw: unknown): Record<string, unknown> | null {
  if (!metaRaw) return null
  if (typeof metaRaw === 'string') {
    try {
      const parsed = JSON.parse(metaRaw)
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
    } catch {
      return null
    }
  }
  return typeof metaRaw === 'object' ? metaRaw as Record<string, unknown> : null
}

function extractImageUrlFromMeta(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null

  const candidate =
    meta.imageUrl
    ?? meta.image_url
    ?? meta.image
    ?? meta.url
    ?? meta.swatchImageUrl
    ?? meta.swatch_image_url
    ?? meta.variantImageUrl
    ?? meta.variant_image_url
    ?? meta.assetImageUrl
    ?? meta.asset_image_url

  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate.trim()
    : null
}

function extractVariantMetaImage(variantRow: any, variantNode: any): string | null {
  const direct = extractImageUrlFromMeta(parseMetaObject(variantNode?.meta))
    || extractImageUrlFromMeta(parseMetaObject(variantRow?.meta))
  if (direct) return direct

  const variantImageCandidate =
    variantNode?.image_url
    ?? variantNode?.imageUrl
    ?? variantRow?.image_url
    ?? variantRow?.imageUrl

  return typeof variantImageCandidate === 'string' && variantImageCandidate.trim().length > 0
    ? variantImageCandidate.trim()
    : null
}

/**
 * Busca produtos do backend Rust
 * Endpoint: GET /products/catalog
 */
export async function getStoreProductsAction(
  query: StoreProductsQuery = {},
): Promise<ApiResponse<PaginatedResponse<Product>>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(query.storeId)

    const authHeaders = await buildStorefrontAuthHeaders(query.storeId)

    const useCardMode = query.cardMode === true
    const url = new URL(useCardMode ? '/v1/products' : '/products/catalog', base)
    const page = Number.isFinite(query.page) ? Math.max(1, Number(query.page)) : 1
    const limit = Number.isFinite(query.limit) ? Math.max(1, Number(query.limit)) : 24

    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('with_count', String(query.withCount !== false))

    appendStoreScopeParam(url, { apiKey: storefrontApiKey, storeId: query.storeId })

    if (useCardMode) {
      const includeVariants = query.includeVariants ?? true
      const maxImagesPerProduct = Number.isFinite(query.maxImagesPerProduct)
        ? Math.max(1, Number(query.maxImagesPerProduct))
        : 1

      url.searchParams.set('include_variants', String(includeVariants))
      url.searchParams.set('max_images_per_product', String(maxImagesPerProduct))
      url.searchParams.set('card_mode', 'true')

      if (query.category && query.category !== 'all') {
        url.searchParams.set('category_slug', query.category)
      }
      if (query.search?.trim()) {
        url.searchParams.set('search', query.search.trim())
      }
      const normalizedSort = normalizeSortParam(query.sort)
      if (normalizedSort) {
        url.searchParams.set('sort', normalizedSort)
      }
      if (Number.isFinite(query.minPrice)) {
        url.searchParams.set('minPrice', String(Math.max(0, Number(query.minPrice))))
      }
      if (Number.isFinite(query.maxPrice)) {
        url.searchParams.set('maxPrice', String(Math.max(0, Number(query.maxPrice))))
      }
      if (query.colors?.length) {
        url.searchParams.set('colors', query.colors.join(','))
      }
      if (query.sizes?.length) {
        url.searchParams.set('sizes', query.sizes.join(','))
      }
      if (query.materials?.length) {
        url.searchParams.set('materials', query.materials.join(','))
      }
      if (query.tags?.length) {
        url.searchParams.set('tags', query.tags.join(','))
      }
    } else {
      if (query.category && query.category !== 'all') {
        url.searchParams.set('category_slug', query.category)
      }
      if (query.search?.trim()) {
        url.searchParams.set('search', query.search.trim())
      }
      const normalizedSort = normalizeSortParam(query.sort)
      if (normalizedSort) {
        url.searchParams.set('sort', normalizedSort)
      }
      if (Number.isFinite(query.minPrice)) {
        url.searchParams.set('minPrice', String(Math.max(0, Number(query.minPrice))))
      }
      if (Number.isFinite(query.maxPrice)) {
        url.searchParams.set('maxPrice', String(Math.max(0, Number(query.maxPrice))))
      }
      if (query.colors?.length) {
        url.searchParams.set('colors', query.colors.join(','))
      }
      if (query.sizes?.length) {
        url.searchParams.set('sizes', query.sizes.join(','))
      }
      if (query.materials?.length) {
        url.searchParams.set('materials', query.materials.join(','))
      }
      if (query.tags?.length) {
        url.searchParams.set('tags', query.tags.join(','))
      }
    }
    
    const res = await fetch(url, {
      headers: authHeaders,
      cache: 'no-store',
    })

    if (!res.ok) {
      const backendMessage = await res.text().catch(() => '')
      console.error('Erro ao buscar produtos:', res.status, backendMessage)
      return {
        success: false,
        error: backendMessage || `Erro ao buscar produtos (status ${res.status})`,
      }
    }

    const payload = await res.json()

    if (useCardMode) {
      const items = Array.isArray(payload) ? payload : []

      const mapped = items.map((row: any) => {
        const cardData = row?.card_data || {}
        const variants = Array.isArray(cardData?.variants) ? cardData.variants : []

        // Coletar TODAS as imagens das variantes
        const allImages = variants
          .filter((v: any) => v.image_url && typeof v.image_url === 'string')
          .map((v: any) => v.image_url)

        // Encontrar min/max preço entre variantes
        const prices = variants
          .map((v: any) => typeof v.price_cents === 'number' ? v.price_cents : 0)
          .filter((p: number) => p > 0)
        const minPrice = prices.length > 0 ? Math.min(...prices) / 100 : 0
        const maxPrice = prices.length > 0 ? Math.max(...prices) / 100 : 0

        // Extrair cores e tamanhos ÚNICOS de todas as variantes
        const allColorValues = new Map<string, any>()
        const allSizeValues = new Map<string, any>()
        // Mapear imagens específicas por cor (code → urls)
        const colorImages = new Map<string, string[]>()

        variants.forEach((variant: any) => {
          const attributes = Array.isArray(variant?.attributes) ? variant.attributes : []
          const variantImageUrl = typeof variant?.image_url === 'string' && variant.image_url.trim().length > 0
            ? variant.image_url.trim()
            : null

          attributes.forEach((attr: any) => {
            const code = String(attr?.code || '').toLowerCase()
            const name = String(attr?.name || '').toLowerCase()

            if (code === 'cor' || code === 'color' || name === 'cor' || name === 'color') {
              const vals = Array.isArray(attr?.values) ? attr.values : []
              vals.forEach((val: any) => {
                const key = String(val?.code || val?.name)
                allColorValues.set(key, val)
                if (variantImageUrl) {
                  const existing = colorImages.get(key) || []
                  if (!existing.includes(variantImageUrl)) {
                    colorImages.set(key, [...existing, variantImageUrl])
                  }
                }
              })
            } else if (code === 'tamanho' || code === 'size' || name === 'tamanho' || name === 'size') {
              const vals = Array.isArray(attr?.values) ? attr.values : []
              vals.forEach((val: any) => {
                allSizeValues.set(String(val?.code || val?.name), val)
              })
            }
          })
        })

        // Construir array de colors com hex
        const colors = Array.from(allColorValues.values())
          .map((value: any) => {
            const meta = value?.meta && typeof value.meta === 'object' ? value.meta : {}
            const hex = normalizeHexColor(
              (meta as Record<string, unknown>)?.rgb
              ?? (meta as Record<string, unknown>)?.hex
              ?? (meta as Record<string, unknown>)?.color,
            ) || colorNameToHex(value?.name)

            const swatchImageRaw =
              (meta as Record<string, unknown>)?.imageUrl
              ?? (meta as Record<string, unknown>)?.image_url
              ?? (meta as Record<string, unknown>)?.swatch_image_url

            const swatchImageUrl = typeof swatchImageRaw === 'string' && swatchImageRaw.trim().length > 0
              ? swatchImageRaw.trim()
              : undefined

            const key = String(value?.code || value?.name)
            const specificImages = colorImages.get(key)
            const images = specificImages && specificImages.length > 0 ? specificImages : allImages

            return {
              id: value?.code ? String(value.code) : undefined,
              name: String(value?.name || value?.code || 'Sem nome'),
              hex,
              images,
              swatchImageUrl,
            }
          })
          .filter((color: any) => Boolean(color?.name))

        // Construir array de sizes
        const sizes = Array.from(allSizeValues.values())
          .map((value: any) => String(value?.name || value?.code || '').trim())
          .filter(Boolean)

        return {
          id: String(row?.id || ''),
          name: String(row?.name || ''),
          slug: String(row?.slug || ''),
          sku: String(row?.code || ''),
          description: null,
          materials: null,
          measures: null,
          basePrice: minPrice,  // Preço mínimo entre variantes
          cost: null,
          isActive: row?.active !== false,
          isFeatured: false,
          categoryId: '',
          tags: [],
          images: allImages,  // Todas as imagens das variantes
          sizes,
          colors,
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies Product
      })

      const headerTotal = Number(res.headers.get('x-total-count'))
      const headerPage = Number(res.headers.get('x-page'))
      const headerLimit = Number(res.headers.get('x-limit'))

      const total = Number.isFinite(headerTotal) && headerTotal >= 0 ? headerTotal : mapped.length
      const currentPage = Number.isFinite(headerPage) && headerPage > 0 ? headerPage : page
      const pageSize = Number.isFinite(headerLimit) && headerLimit > 0 ? headerLimit : limit
      const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)))

      return {
        success: true,
        data: {
          items: mapped,
          total,
          page: currentPage,
          pageSize,
          totalPages,
        },
      }
    }

    const items = Array.isArray(payload?.items) ? payload.items : []
    const total = typeof payload?.total === 'number' ? payload.total : 0
    const currentPage = typeof payload?.page === 'number' ? payload.page : page
    const pageSize = typeof payload?.limit === 'number' ? payload.limit : limit
    const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)))

    const mapped = items.map((row: any) => {
      const productNode = row?.product || row || {}
      const variants = Array.isArray(row?.variants) ? row.variants : []

      const imageGroups = Array.isArray(row?.image_groups) ? row.image_groups : []
      const imagesByKey = new Map<string, string[]>()
      const imagesById = new Map<number, string>()
      const imagesByVariantId = new Map<number, string[]>()

      for (const group of imageGroups) {
        const key = typeof group?.image_key === 'string' ? group.image_key : ''
        if (!key) continue

        const groupImagesRaw = Array.isArray(group?.images) ? group.images : []
        const groupImages = groupImagesRaw
          .map((img: any) => img?.image_url)
          .filter((img: unknown): img is string => typeof img === 'string' && img.length > 0)

        for (const image of groupImagesRaw) {
          const imageId = Number(image?.id)
          const imageUrl = typeof image?.image_url === 'string' ? image.image_url : ''
          if (Number.isInteger(imageId) && imageId > 0 && imageUrl) {
            imagesById.set(imageId, imageUrl)
          }
        }

        if (Array.isArray(group?.variants) && groupImages.length > 0) {
          for (const variantRef of group.variants) {
            const variantId = Number(variantRef?.variant_id ?? variantRef?.id)
            if (!Number.isInteger(variantId) || variantId <= 0) continue

            const current = imagesByVariantId.get(variantId) || []
            imagesByVariantId.set(variantId, Array.from(new Set([...current, ...groupImages])))
          }
        }

        imagesByKey.set(key, groupImages)
      }

      const productImageVariantMap = Array.isArray(row?.product_image_variant_map)
        ? row.product_image_variant_map
        : []

      if (productImageVariantMap.length > 0 && imagesById.size > 0) {
        for (const relation of productImageVariantMap) {
          const variantId = Number(
            relation?.product_variant_id
            ?? relation?.variant_id
            ?? relation?.variantId,
          )
          const imageId = Number(
            relation?.product_image_id
            ?? relation?.image_id
            ?? relation?.productImageId
            ?? relation?.imageId,
          )

          if (!Number.isInteger(variantId) || variantId <= 0) continue
          if (!Number.isInteger(imageId) || imageId <= 0) continue

          const imageUrl = imagesById.get(imageId)
          if (!imageUrl) continue

          const current = imagesByVariantId.get(variantId) || []
          if (!current.includes(imageUrl)) {
            imagesByVariantId.set(variantId, [...current, imageUrl])
          }
        }
      }

      const firstVariant = [...variants]
        .sort((a: any, b: any) => {
          const pa = typeof a?.price_cents === 'number' ? a.price_cents : Number.MAX_SAFE_INTEGER
          const pb = typeof b?.price_cents === 'number' ? b.price_cents : Number.MAX_SAFE_INTEGER
          return pa - pb
        })[0]

      const colorMap = new Map<string, {
        id?: string
        name: string
        hex: string
        images?: string[]
        swatchImageUrl?: string
        attributeValueId?: number
        price?: number
        variantSku?: string
        sortOrder?: number
      }>()
      const colorOrderMap = new Map<string, number>()
      const sizeOrderMap = new Map<string, number>()
      const sizeSet = new Set<string>()

      for (const variantRow of variants) {
        const variant = variantRow?.variant || variantRow
        const attrs = Array.isArray(variantRow?.attribute_values) ? variantRow.attribute_values : []

        const variantId = Number(variant?.id)
        const mappedVariantImages = Number.isInteger(variantId) && variantId > 0
          ? imagesByVariantId.get(variantId) || []
          : []
        const rowVariantImages = Array.isArray(variantRow?.images)
          ? variantRow.images.filter((img: unknown): img is string => typeof img === 'string' && img.length > 0)
          : []
        const fallbackImagesByKey = typeof variant?.image_key === 'string'
          ? imagesByKey.get(variant.image_key) || []
          : []
        const variantMetaImage = extractVariantMetaImage(variantRow, variant)
        const resolvedVariantImages = mappedVariantImages.length > 0
          ? mappedVariantImages
          : rowVariantImages.length > 0
            ? rowVariantImages
            : fallbackImagesByKey

        for (const attr of attrs) {
          const attrCode = String(attr?.attribute_code || '').toLowerCase()
          const colorMeta = extractColorMeta(attr)

          if ((attrCode === 'color' || attrCode === 'cor') && attr?.value_name) {
            const key = String(attr.value_code || attr.value_name)
            const rawColorSortOrder = Number(attr?.value_sort_order ?? attr?.sort_order)
            const colorSortOrder = Number.isFinite(rawColorSortOrder) ? rawColorSortOrder : Number.MAX_SAFE_INTEGER
            const currentColorSortOrder = colorOrderMap.get(key)
            if (currentColorSortOrder === undefined || colorSortOrder < currentColorSortOrder) {
              colorOrderMap.set(key, colorSortOrder)
            }
            const colorCode = String(attr?.value_code || '').trim()
            const fallbackImagesByColorCode = colorCode
              ? imagesByKey.get(`${String(productNode.code || '').trim()}-${colorCode}`)
                || imagesByKey.get(`${String(productNode.code || '').trim().toUpperCase()}-${colorCode}`)
                || imagesByKey.get(`${String(productNode.code || '').trim().toLowerCase()}-${colorCode}`)
                || []
              : []
            // Na listagem: galeria usa imagens reais do produto/variante.
            // MAS a bolinha (swatch) deve usar APENAS imagem do atributo value, não do produto.
            const colorImages = resolvedVariantImages.length > 0
              ? resolvedVariantImages
              : fallbackImagesByColorCode.length > 0
                ? fallbackImagesByColorCode
                : []
            // Swatch: prioriza colorMeta.imageUrl (imagem do atributo value), depois hex, NUNCA imagem do produto
            const colorSwatchImage = colorMeta.imageUrl || undefined
            if (!colorMap.has(key)) {
              colorMap.set(key, {
                id: attr.value_id ? String(attr.value_id) : undefined,
                name: String(attr.value_name),
                hex: colorMeta.hex || colorNameToHex(attr.value_name),
                images: colorImages,
                swatchImageUrl: colorSwatchImage,
                attributeValueId: attr.value_id,
                price: typeof variant?.price_cents === 'number' ? variant.price_cents / 100 : undefined,
                variantSku: variant?.sku || undefined,
                sortOrder: colorSortOrder,
              })
            } else {
              const currentColor = colorMap.get(key)
              if (currentColor) {
                const mergedImages = Array.from(new Set([...(currentColor.images || []), ...colorImages]))
                colorMap.set(key, {
                  ...currentColor,
                  hex: currentColor.hex || colorMeta.hex || colorNameToHex(attr.value_name),
                  images: mergedImages,
                  swatchImageUrl: colorSwatchImage || currentColor.swatchImageUrl || undefined,
                  sortOrder: Math.min(currentColor.sortOrder ?? Number.MAX_SAFE_INTEGER, colorSortOrder),
                })
              }
            }
          }

          if ((attrCode === 'size' || attrCode === 'tamanho') && attr?.value_name) {
            const sizeName = String(attr.value_name)
            sizeSet.add(sizeName)

            const rawSizeSortOrder = Number(attr?.value_sort_order ?? attr?.sort_order)
            const sizeSortOrder = Number.isFinite(rawSizeSortOrder) ? rawSizeSortOrder : Number.MAX_SAFE_INTEGER
            const currentSizeSortOrder = sizeOrderMap.get(sizeName)
            if (currentSizeSortOrder === undefined || sizeSortOrder < currentSizeSortOrder) {
              sizeOrderMap.set(sizeName, sizeSortOrder)
            }
          }
        }
      }

      const orderedColors = Array.from(colorMap.entries())
        .sort((a, b) => {
          const orderA = colorOrderMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER
          const orderB = colorOrderMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER
          if (orderA !== orderB) return orderA - orderB
          return a[1].name.localeCompare(b[1].name)
        })
        .map(([, value]) => value)

      const orderedSizes = Array.from(sizeSet)
        .sort((a, b) => {
          const orderA = sizeOrderMap.get(a) ?? Number.MAX_SAFE_INTEGER
          const orderB = sizeOrderMap.get(b) ?? Number.MAX_SAFE_INTEGER
          if (orderA !== orderB) return orderA - orderB
          return a.localeCompare(b)
        })
      const sizeSortOrders = Object.fromEntries(
        Array.from(sizeOrderMap.entries()).map(([sizeName, sortOrder]) => [sizeName, sortOrder])
      )

      const firstVariantData = firstVariant?.variant || firstVariant
      const firstVariantId = Number(firstVariantData?.id)
      const firstVariantMappedImages = Number.isInteger(firstVariantId) && firstVariantId > 0
        ? imagesByVariantId.get(firstVariantId) || []
        : []
      const firstVariantRowImages = firstVariant && Array.isArray(firstVariant?.images)
        ? firstVariant.images.filter((img: unknown): img is string => typeof img === 'string' && img.length > 0)
        : []
      const firstVariantImagesByKey = typeof firstVariantData?.image_key === 'string'
        ? imagesByKey.get(firstVariantData.image_key) || []
        : []
      const firstVariantImages = firstVariantMappedImages.length > 0
        ? firstVariantMappedImages
        : firstVariantRowImages.length > 0
          ? firstVariantRowImages
          : firstVariantImagesByKey

      return {
        id: String(productNode.id || ''),
        name: productNode.name || '',
        slug: productNode.slug || productNode.code?.toLowerCase() || '',
        sku: productNode.code || firstVariant?.variant?.sku || firstVariant?.sku || '',
        description: productNode.description || null,
        materials: productNode.composition || null,
        measures: productNode.measures || null,
        basePrice: firstVariant?.variant && typeof firstVariant.variant.price_cents === 'number'
          ? firstVariant.variant.price_cents / 100
          : typeof firstVariant?.price_cents === 'number'
            ? firstVariant.price_cents / 100
            : 0,
        cost: firstVariant?.variant && typeof firstVariant.variant.cost_cents === 'number'
          ? firstVariant.variant.cost_cents / 100
          : typeof firstVariant?.cost_cents === 'number'
            ? firstVariant.cost_cents / 100
            : null,
        isActive: productNode.active !== false,
        isFeatured: productNode.is_featured === true || productNode.isFeatured === true,
        categoryId: Array.isArray(row?.category_ids) && row.category_ids.length > 0
          ? String(row.category_ids[0])
          : '',
        tags: Array.isArray(productNode.tags) ? productNode.tags : [],
        images: firstVariantImages,
        sizes: orderedSizes,
        sizeSortOrders,
        colors: orderedColors,
        createdAt: productNode.created_at ? new Date(productNode.created_at) : new Date(),
        updatedAt: productNode.updated_at ? new Date(productNode.updated_at) : new Date(),
      } satisfies Product
    })

    return {
      success: true,
      data: {
        items: mapped,
        total,
        page: currentPage,
        pageSize,
        totalPages,
      },
    }
  } catch (error) {
    console.error('Erro ao buscar produtos:', error)
    return { success: false, error: 'Erro ao buscar produtos' }
  }
}

/**
 * Busca um produto específico do backend
 */
export async function getStoreProductBySlugAction(
  slug: string,
  storeId?: number | string,
): Promise<ApiResponse<Product | null>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const authHeaders = await buildStorefrontAuthHeaders(storeId)
    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)

    const url = new URL(`/product/data/${slug}`, base)
    appendStoreScopeParam(url, { apiKey: storefrontApiKey, storeId })

    let res = await fetch(url, {
      headers: authHeaders,
      cache: 'no-store',
    })

    // Se estiver apontando para o front (3001), o retorno pode ser HTML.
    // Nesse caso, tenta automaticamente a API local em 8081.
    const contentType = res.headers.get('content-type') || ''
    if (res.ok && contentType.includes('text/html')) {
      const fallbackUrl = new URL(`/product/data/${slug}`, 'http://localhost:8080')
      appendStoreScopeParam(fallbackUrl, { apiKey: storefrontApiKey, storeId })
      res = await fetch(fallbackUrl, {
        headers: authHeaders,
        cache: 'no-store',
      })
    }

    if (!res.ok) {
      if (res.status === 404) {
        return { success: false, error: 'Produto não encontrado' }
      }
      console.error('Erro ao buscar produto:', res.status)
      return { success: false, error: 'Erro ao buscar produto' }
    }

    const payload = await res.json()
    const fullPayload = payload?.product && payload?.variants
      ? payload
      : payload?.data?.product && payload?.data?.variants
        ? payload.data
        : null

    if (!fullPayload) {
      return { success: false, error: 'Formato de resposta inválido do backend' }
    }

    const productNode = fullPayload?.product?.product || fullPayload?.product || {}
    const categoryIds = Array.isArray(fullPayload?.product?.category_ids)
      ? fullPayload.product.category_ids
      : []
    const variants = Array.isArray(fullPayload?.variants) ? fullPayload.variants : []
    const imageGroups = Array.isArray(fullPayload?.image_groups) ? fullPayload.image_groups : []

    const imagesByKey = new Map<string, string[]>()
    const imagesById = new Map<number, string>()
    const imagesByVariantId = new Map<number, string[]>()

    for (const group of imageGroups) {
      const key = typeof group?.image_key === 'string' ? group.image_key : ''
      if (!key) continue
      const groupImagesRaw = Array.isArray(group?.images) ? group.images : []
      const groupImages = groupImagesRaw
        .map((img: any) => img?.image_url)
        .filter((img: unknown): img is string => typeof img === 'string' && img.length > 0)

      for (const image of groupImagesRaw) {
        const imageId = Number(image?.id)
        const imageUrl = typeof image?.image_url === 'string' ? image.image_url : ''
        if (Number.isInteger(imageId) && imageId > 0 && imageUrl) {
          imagesById.set(imageId, imageUrl)
        }
      }

      if (Array.isArray(group?.variants) && groupImages.length > 0) {
        for (const variantRef of group.variants) {
          const variantId = Number(variantRef?.variant_id ?? variantRef?.id)
          if (!Number.isInteger(variantId) || variantId <= 0) continue

          const current = imagesByVariantId.get(variantId) || []
          const merged = Array.from(new Set([...current, ...groupImages]))
          imagesByVariantId.set(variantId, merged)
        }
      }

      imagesByKey.set(key, groupImages)
    }

    const productImageVariantMap = Array.isArray(fullPayload?.product_image_variant_map)
      ? fullPayload.product_image_variant_map
      : []

    if (productImageVariantMap.length > 0 && imagesById.size > 0) {
      for (const relation of productImageVariantMap) {
        const variantId = Number(
          relation?.product_variant_id
          ?? relation?.variant_id
          ?? relation?.variantId,
        )
        const imageId = Number(
          relation?.product_image_id
          ?? relation?.image_id
          ?? relation?.productImageId
          ?? relation?.imageId,
        )

        if (!Number.isInteger(variantId) || variantId <= 0) continue
        if (!Number.isInteger(imageId) || imageId <= 0) continue

        const imageUrl = imagesById.get(imageId)
        if (!imageUrl) continue

        const current = imagesByVariantId.get(variantId) || []
        if (!current.includes(imageUrl)) {
          imagesByVariantId.set(variantId, [...current, imageUrl])
        }
      }
    }

    const sizeSet = new Set<string>()
    const colorMap = new Map<string, Product['colors'][number]>()
    const normalizedVariants: ProductVariant[] = []
    const productCodeTrim = String(productNode.code || '').trim()
    const productCodeLower = productCodeTrim.toLowerCase()
    const productCodeUpper = productCodeTrim.toUpperCase()

    for (const variant of variants) {
      const attrs = Array.isArray(variant?.attribute_values) ? variant.attribute_values : []
      const colorAttr = attrs.find((a: any) => {
        const code = String(a?.attribute_code || '').toLowerCase()
        return code === 'color' || code === 'cor'
      })
      const sizeAttr = attrs.find((a: any) => {
        const code = String(a?.attribute_code || '').toLowerCase()
        return code === 'size' || code === 'tamanho'
      })

      const colorName = colorAttr?.value_name ? String(colorAttr.value_name) : 'ÚNICO'
      const sizeName = sizeAttr?.value_name ? String(sizeAttr.value_name) : 'ÚNICO'
      const colorMeta = extractColorMeta(colorAttr)
      const attributeValueHexa = colorMeta.hex || (colorAttr?.value_name ? colorNameToHex(colorAttr.value_name) : null)

      normalizedVariants.push({
        id: String(variant?.id || ''),
        productId: String(productNode.id || ''),
        color: colorName,
        size: sizeName,
        variantSku: variant?.sku || '',
        attribute_value_hexa: attributeValueHexa,
        stock: typeof variant?.stock_qty === 'number' ? variant.stock_qty : 0,
        priceOverride: typeof variant?.price_cents === 'number' ? variant.price_cents / 100 : null,
        createdAt: variant?.created_at ? new Date(variant.created_at) : new Date(),
      })

      if (sizeAttr?.value_name) {
        sizeSet.add(String(sizeAttr.value_name))
      }

      if (colorAttr?.value_name) {
        const colorKey = String(colorAttr.value_code || colorAttr.value_name)
        const variantId = Number(variant?.id)
        const hasValidVariantId = Number.isInteger(variantId) && variantId > 0
        const colorCode = String(colorAttr?.value_code || '').trim()

        let variantImages: string[] = []
        if (hasValidVariantId && imagesByVariantId.has(variantId)) {
          variantImages = imagesByVariantId.get(variantId) || []
        } else if (typeof variant?.image_key === 'string' && imagesByKey.has(variant.image_key)) {
          variantImages = imagesByKey.get(variant.image_key) || []
        } else if (colorCode) {
          variantImages = imagesByKey.get(`${productCodeTrim}-${colorCode}`)
            || imagesByKey.get(`${productCodeUpper}-${colorCode}`)
            || imagesByKey.get(`${productCodeLower}-${colorCode}`)
            || []
        }
        // Regra da bolinha: usa imagem apenas quando vier no meta do atributo value.
        const swatchImageUrl = colorMeta.imageUrl || undefined

        if (!colorMap.has(colorKey)) {
          colorMap.set(colorKey, {
            id: colorAttr.value_id ? String(colorAttr.value_id) : undefined,
            variantId: variant?.id ? String(variant.id) : undefined,
            name: String(colorAttr.value_name),
            hex: colorMeta.hex || colorNameToHex(colorAttr.value_name),
            images: variantImages,
            swatchImageUrl,
            attributeValueId: colorAttr.value_id,
            price: typeof variant?.price_cents === 'number' ? variant.price_cents / 100 : undefined,
            variantSku: variant?.sku || undefined,
          })
        } else {
          const currentColor = colorMap.get(colorKey)
          if (currentColor) {
            const mergedImages = Array.from(new Set([...(currentColor.images || []), ...variantImages]))
            colorMap.set(colorKey, {
              ...currentColor,
              hex: currentColor.hex || colorMeta.hex || colorNameToHex(colorAttr.value_name),
              images: mergedImages,
              swatchImageUrl: swatchImageUrl || currentColor.swatchImageUrl || undefined,
            })
          }
        }
      }
    }

    const firstVariant = variants[0]
    const firstVariantId = Number(firstVariant?.id)
    const firstVariantMappedImages = Number.isInteger(firstVariantId) && firstVariantId > 0
      ? imagesByVariantId.get(firstVariantId) || []
      : []
    const firstVariantImagesByKey = firstVariant?.image_key
      ? imagesByKey.get(firstVariant.image_key) || []
      : []
    const firstVariantImages = firstVariantMappedImages.length > 0
      ? firstVariantMappedImages
      : firstVariantImagesByKey
    const images = firstVariantImages.length > 0 ? firstVariantImages : []
    const basePrice = typeof firstVariant?.price_cents === 'number'
      ? firstVariant.price_cents / 100
      : 0

    const product: Product = {
      id: String(productNode.id || ''),
      name: productNode.name || '',
      slug: productNode.slug || slug,
      sku: productNode.code || firstVariant?.sku || '',
      description: productNode.description || null,
      materials: productNode.composition || null,
      measures: productNode.measures || null,
      basePrice,
      cost: typeof firstVariant?.cost_cents === 'number' ? firstVariant.cost_cents / 100 : null,
      isActive: productNode.active !== false,
      isFeatured: false,
      categoryId: categoryIds.length > 0 ? String(categoryIds[0]) : '',
      tags: Array.isArray(productNode.tags) ? productNode.tags : [],
      images,
      sizes: Array.from(sizeSet),
      colors: Array.from(colorMap.values()),
      variants: normalizedVariants,
      createdAt: productNode.created_at ? new Date(productNode.created_at) : new Date(),
      updatedAt: productNode.updated_at ? new Date(productNode.updated_at) : new Date(),
    }

    return { success: true, data: product }
  } catch (error) {
    console.error('Erro ao buscar produto:', error)
    return { success: false, error: 'Erro ao buscar produto' }
  }
}
