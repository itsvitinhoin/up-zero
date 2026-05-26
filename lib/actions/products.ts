'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getSession, canManageProducts, getAdminStoreIdFromToken } from '@/lib/auth'
import { getAttributesWithValuesByStore } from '@/lib/actions/attributes'
import { productSchema, productVariantSchema } from '@/lib/validations'
import type { ApiResponse, Category, Product, ProductVariant, ProductWithVariants } from '@/lib/types'

type SubmittedVariant = {
  variantSku?: string
  color?: string
  size?: string
  active?: boolean
  isHighlighted?: boolean
  stock?: number
  basePrice?: number | null
  cost?: number | null
  priceOverride?: number | null
  images?: string[]
  attribute_values?: number[]
}

type SubmittedColor = {
  name?: string
  hex?: string
  images?: string[]
}

type ImageGroupingType = 'product' | 'attributes' | 'full_sku'

type SubmittedImageGroupingRule = {
  type: ImageGroupingType
  attribute_ids?: number[]
}

function getFormField(formData: FormData, key: string): string | null {
  const direct = formData.get(key)
  if (typeof direct === 'string') return direct

  const suffix = `_${key}`
  for (const [entryKey, entryValue] of formData.entries()) {
    if (entryKey.endsWith(suffix) && typeof entryValue === 'string') {
      return entryValue
    }
  }

  return null
}

function getFormJson<T>(formData: FormData, key: string, fallback: T): T {
  const raw = getFormField(formData, key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function toCents(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.round(value * 100)
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function resolveNumericCategoryIds(categoryId: string, categoryIds: string[] = []): number[] {
  const parsedIds = Array.from(
    new Set(
      (Array.isArray(categoryIds) ? categoryIds : [])
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );

  if (parsedIds.length > 0) {
    return parsedIds;
  }

  const fallback = Number.parseInt(categoryId, 10);
  return Number.isFinite(fallback) ? [fallback] : [];
}

function buildProductSlug(code: string | null | undefined, name: string | null | undefined): string {
  return `${String(code ?? '').trim()}-${String(name ?? '').trim()}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function isProductsAuthorized(session: Awaited<ReturnType<typeof getSession>>): Promise<boolean> {
  if (session && canManageProducts(session.role)) {
    return true
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

    return Boolean(adminToken)
}

async function getRustStoreId(_base: string): Promise<number | null> {
  const adminStoreId = await getAdminStoreIdFromToken()
  if (adminStoreId) return adminStoreId

  const rawStoreId = process.env.STORE_ID
  if (!rawStoreId) return null

  const parsed = Number(rawStoreId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function resolveBackendBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function getStoreAttributes(storeId: number) {
  const attrsResult = await getAttributesWithValuesByStore(storeId)
  if (!attrsResult.success || !attrsResult.data) return null
  return attrsResult.data
}

async function resolveVariantAttributeValueIds(
  variant: SubmittedVariant,
  existingIds: number[] = [],
  context?: {
    attributes?: Array<{ code?: string | null; values: Array<{ id: number; name?: string | null; code?: string | null }> }>
  },
): Promise<number[]> {
  const attributes = context?.attributes
  if (!attributes || attributes.length === 0) return existingIds

  const colorAttr = attributes.find((a) => normalizeText(a.code) === 'color')
  const sizeAttr = attributes.find((a) => normalizeText(a.code) === 'size')

  const colorNorm = normalizeText(variant.color)
  const sizeNorm = normalizeText(variant.size)

  const resolved = [...existingIds]

  if (colorNorm && colorNorm !== 'unico' && colorNorm !== 'único' && colorAttr) {
    const colorValue = colorAttr.values.find((value) => {
      return normalizeText(value.name) === colorNorm || normalizeText(value.code) === colorNorm
    })
    if (colorValue && !resolved.includes(colorValue.id)) {
      resolved.push(colorValue.id)
    }
  }

  if (sizeNorm && sizeNorm !== 'unico' && sizeNorm !== 'único' && sizeAttr) {
    const sizeValue = sizeAttr.values.find((value) => {
      return normalizeText(value.name) === sizeNorm || normalizeText(value.code) === sizeNorm
    })
    if (sizeValue && !resolved.includes(sizeValue.id)) {
      resolved.push(sizeValue.id)
    }
  }

  return resolved
}

function sanitizeExistingAttributeValueIds(
  existingIds: number[] = [],
  attributes?: Array<{ values: Array<{ id: number }> }>,
): number[] {
  if (!Array.isArray(existingIds) || existingIds.length === 0) return []
  if (!attributes || attributes.length === 0) {
    return Array.from(new Set(existingIds.filter((id) => Number.isInteger(id) && id > 0)))
  }

  const validValueIds = new Set<number>()
  for (const attribute of attributes) {
    for (const value of attribute.values || []) {
      if (Number.isInteger(value.id) && value.id > 0) {
        validValueIds.add(value.id)
      }
    }
  }

  return Array.from(
    new Set(
      existingIds.filter((id) => Number.isInteger(id) && id > 0 && validValueIds.has(id))
    )
  )
}

function resolveVariantImages(
  variant: SubmittedVariant,
  fallbackImages: string[],
): string[] {
  // Se a variante tem suas próprias imagens, usar essas
  if (Array.isArray(variant.images) && variant.images.length > 0) {
    const images = variant.images
      .filter((url): url is string => typeof url === 'string')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
    return images.length > 0 ? images : fallbackImages
  }

  // Caso contrário, usar o fallback (imagens padrão do produto)
  return fallbackImages
}

function resolveVariantImagesNoFallback(variant: SubmittedVariant): string[] {
  if (!Array.isArray(variant.images) || variant.images.length === 0) {
    return []
  }

  return variant.images
    .filter((url): url is string => typeof url === 'string')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
}

function normalizeSubmittedColors(colors: SubmittedColor[]): SubmittedColor[] {
  return colors
    .map((color) => {
      const name = typeof color?.name === 'string' ? color.name.trim() : ''
      const hex = typeof color?.hex === 'string' && color.hex.trim().length > 0
        ? color.hex.trim()
        : '#000000'
      const images = Array.isArray(color?.images)
        ? color.images
            .filter((image): image is string => typeof image === 'string')
            .map((image) => image.trim())
            .filter((image) => image.length > 0)
        : []

      return {
        name,
        hex,
        images,
      }
    })
    .filter((color) => color.name.length > 0)
}

async function syncProductBundleToRust(data: {
  rustProductId?: number
  sku: string
  slug?: string
  name: string
  description?: string
  materials?: string
  measures?: string
  isActive: boolean
  categoryId: string
  categoryIds?: string[]
  basePrice: number
  cost: number | null
  images: string[]
  colors: SubmittedColor[]
  variants: SubmittedVariant[]
  tags: string[]
  imageGroupingRule?: SubmittedImageGroupingRule
}) {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').replace(/\/$/, '')
  if (!base) {
    throw new Error('NEXT_PUBLIC_RUST_URL não configurado')
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
  }

  const storeId = await getRustStoreId(base)
  const storeAttributes = storeId ? await getStoreAttributes(storeId) : null

  // Encontrar o ID do atributo de cores
  let colorAttributeId: number | null = null
  if (storeAttributes && Array.isArray(storeAttributes)) {
    const colorAttr = storeAttributes.find((attr: any) => 
      attr.code?.toLowerCase() === 'color' || 
      attr.code?.toLowerCase() === 'cores' ||
      attr.name?.toLowerCase().includes('cor')
    )
    if (colorAttr) {
      colorAttributeId = colorAttr.id
    }
  }

  // Construir image_grouping_rule baseado na escolha da UI (fallback para cor)
  const imageGroupingRule = (() => {
    const selectedType = data.imageGroupingRule?.type
    const selectedAttributes = Array.isArray(data.imageGroupingRule?.attribute_ids)
      ? data.imageGroupingRule!.attribute_ids!.filter((id) => Number.isInteger(id) && id > 0)
      : []

    if (selectedType === 'attributes') {
      if (selectedAttributes.length > 0) {
        return {
          type: 'attributes' as const,
          attribute_ids: selectedAttributes,
        }
      }

      if (colorAttributeId) {
        return {
          type: 'attributes' as const,
          attribute_ids: [colorAttributeId],
        }
      }

      return { type: 'product' as const }
    }

    if (selectedType === 'full_sku') {
      return { type: 'full_sku' as const }
    }

    return { type: 'product' as const }
  })()

  const numericCategoryIds = resolveNumericCategoryIds(data.categoryId, data.categoryIds)
  const fallbackImages = (Array.isArray(data.images) ? data.images : [])
    .filter((url): url is string => typeof url === 'string')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)

  const variantsToSync = data.variants.length > 0
    ? data.variants
    : [{
        variantSku: data.sku,
        stock: 0,
        basePrice: data.basePrice,
        cost: data.cost,
        priceOverride: null,
      }]

  const variantPayloadByCombination = new Map<string, {
    sku: string
    price_cents: number
    cost_cents: number
    promo_cents: number
    stock_qty: number
    active: boolean
    is_highlighted: boolean
    attribute_values: number[]
    tags: string[]
    images: string[]
  }>()

  for (const variant of variantsToSync) {
    const sanitizedExistingAttributeValues = sanitizeExistingAttributeValueIds(
      Array.isArray(variant.attribute_values) ? variant.attribute_values : [],
      storeAttributes ?? undefined,
    )

    const resolvedAttributeValues = await resolveVariantAttributeValueIds(
      variant,
      sanitizedExistingAttributeValues,
      { attributes: storeAttributes ?? undefined },
    )

    const normalizedAttributeValues = Array.from(new Set(resolvedAttributeValues)).sort((a, b) => a - b)
    const combinationKey = normalizedAttributeValues.join(',')

    variantPayloadByCombination.set(combinationKey, {
      sku: variant.variantSku || data.sku,
      price_cents: toCents(variant.basePrice ?? data.basePrice),
      cost_cents: toCents(variant.cost ?? data.cost),
      promo_cents: toCents(variant.priceOverride),
      stock_qty: typeof variant.stock === 'number' ? variant.stock : 0,
      active: variant.active !== false,
      is_highlighted: variant.isHighlighted === true,
      attribute_values: normalizedAttributeValues,
      tags: data.tags,
      images: data.variants.length > 0
        ? resolveVariantImagesNoFallback(variant)
        : resolveVariantImages(variant, fallbackImages),
    })
  }

  const variantPayloads = Array.from(variantPayloadByCombination.values())

  const payload = {
    id: data.rustProductId,
    store_id: storeId ?? undefined,
    code: data.sku,
    slug: data.slug,
    name: data.name,
    description: data.description || null,
    weight_grams: null,
    active: data.isActive,
    ncm: null,
    composition: data.materials || null,
    location: data.measures || null,
    category_ids: numericCategoryIds,
    tags: data.tags,
    image_grouping_rule: JSON.stringify(imageGroupingRule),
    variants: variantPayloads,
    prune_missing: true,
  }

  const response = await fetch(`${base}/products/sync`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    const slugConflict =
      Boolean(data.rustProductId) &&
      Boolean(data.slug) &&
      /slug/i.test(errorText) &&
      /(já|jÃ¡|existe|exists|duplic)/i.test(errorText)

    if (slugConflict) {
      const payloadWithoutSlug = {
        ...payload,
        slug: undefined,
      }

      const retryResponse = await fetch(`${base}/products/sync`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payloadWithoutSlug),
      })

      if (retryResponse.ok) {
        return
      }

      const retryErrorText = await retryResponse.text()
      throw new Error(retryErrorText || errorText || 'Falha ao sincronizar produto no backend')
    }

    throw new Error(errorText || 'Falha ao sincronizar produto no backend')
  }
}

async function syncCreateProductToRust(data: {
  sku: string
  slug?: string
  name: string
  description?: string
  materials?: string
  measures?: string
  isActive: boolean
  categoryId: string
  categoryIds?: string[]
  basePrice: number
  cost: number | null
  images: string[]
  colors: SubmittedColor[]
  variants: SubmittedVariant[]
  tags: string[]
  imageGroupingRule?: SubmittedImageGroupingRule
}) {
  await syncProductBundleToRust({
    sku: data.sku,
    slug: data.slug,
    name: data.name,
    description: data.description,
    materials: data.materials,
    measures: data.measures,
    isActive: data.isActive,
    categoryId: data.categoryId,
    categoryIds: data.categoryIds,
    basePrice: data.basePrice,
    cost: data.cost,
    images: data.images,
    colors: data.colors,
    variants: data.variants,
    tags: data.tags,
    imageGroupingRule: data.imageGroupingRule,
  })
}

async function resolveRustProductIdByCode(
  base: string,
  code: string,
): Promise<number | null> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  const headers: HeadersInit = {
    ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
  }

  const productsRes = await fetch(`${base}/products`, {
    headers,
    credentials: 'include',
  })

  if (!productsRes.ok) {
    const errorText = await productsRes.text()
    throw new Error(errorText || 'Falha ao listar produtos no backend')
  }

  const products = (await productsRes.json()) as Array<{ id: number; code: string }>
  const exactMatch = products.find(product => product.code === code)
  if (exactMatch) return exactMatch.id

  const normalizedCode = code.trim().toLowerCase()
  const caseInsensitiveMatch = products.find(product => product.code.trim().toLowerCase() === normalizedCode)

  return caseInsensitiveMatch?.id ?? null
}

async function syncUpdateProductToRust(data: {
  lookupCode?: string
  rustProductId?: number
  sku: string
  slug?: string
  name: string
  description?: string
  materials?: string
  measures?: string
  isActive: boolean
  categoryId: string
  categoryIds?: string[]
  basePrice?: number
  cost?: number | null
  images?: string[]
  colors?: SubmittedColor[]
  variants?: SubmittedVariant[]
  tags: string[]
  imageGroupingRule?: SubmittedImageGroupingRule
}) {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').replace(/\/$/, '')
  if (!base) {
    throw new Error('NEXT_PUBLIC_RUST_URL não configurado')
  }

  const rustProductId = data.rustProductId
    ?? (data.lookupCode ? await resolveRustProductIdByCode(base, data.lookupCode) : null)
  if (!rustProductId) {
    throw new Error(`Produto não encontrado no backend Rust${data.lookupCode ? ` para o código ${data.lookupCode}` : ''}`)
  }

  await syncProductBundleToRust({
    rustProductId,
    sku: data.sku,
    slug: data.slug,
    name: data.name,
    description: data.description,
    materials: data.materials,
    measures: data.measures,
    isActive: data.isActive,
    categoryId: data.categoryId,
    categoryIds: data.categoryIds,
    basePrice: data.basePrice ?? 0,
    cost: data.cost ?? null,
    images: data.images || [],
    colors: data.colors || [],
    variants: data.variants || [],
    tags: data.tags,
    imageGroupingRule: data.imageGroupingRule,
  })
}

async function syncDeleteProductToRust(data: { id: string; lookupCode: string }) {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').replace(/\/$/, '')
  if (!base) {
    throw new Error('NEXT_PUBLIC_RUST_URL não configurado')
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  const headers: HeadersInit = {
    ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
  }

  const numericId = Number.parseInt(data.id, 10)
  const rustProductId = Number.isFinite(numericId)
    ? numericId
    : await resolveRustProductIdByCode(base, data.lookupCode)

  if (!rustProductId) return

  const response = await fetch(`${base}/products/${rustProductId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  })

  if (response.status === 404) return

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Falha ao excluir produto no backend')
  }
}

export async function getProductsAction(filters?: {
  categoryId?: string
  isActive?: boolean
  isFeatured?: boolean
  search?: string
  ids?: string[]
}): Promise<ApiResponse<Product[]>> {
  const result = await getStoreProductsAction({
    isActive: filters?.isActive,
    search: filters?.search,
  })

  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao carregar produtos' }
  }

  let products = result.data

  if (filters?.categoryId) {
    const selectedCategoryId = filters.categoryId
    products = products.filter((product) => {
      const categoryIds = Array.isArray(product.categoryIds) ? product.categoryIds : []
      return product.categoryId === selectedCategoryId || categoryIds.includes(selectedCategoryId)
    })
  }

  if (Array.isArray(filters?.ids) && filters!.ids!.length > 0) {
    const selectedIds = new Set(filters!.ids!.map(String))
    products = products.filter((product) => selectedIds.has(String(product.id)))
  }

  if (typeof filters?.isFeatured === 'boolean') {
    products = products.filter((product) => product.isFeatured === filters.isFeatured)
  }

  return { success: true, data: products }
}

async function findStoreProductBySlug(slug: string): Promise<Product | undefined> {
  if (!slug?.trim()) return undefined
  const result = await getStoreProductsAction()
  if (!result.success || !result.data) return undefined
  return result.data.find((product) => String(product.slug) === String(slug))
}

async function findStoreProductBySku(sku: string): Promise<Product | undefined> {
  if (!sku?.trim()) return undefined
  const result = await getStoreProductsAction()
  if (!result.success || !result.data) return undefined
  return result.data.find((product) => String(product.sku) === String(sku))
}

type RustProductListVariant = {
  id?: number
  product_id?: number
  sku?: string | null
  price_cents?: number
  promo_cents?: number
  stock_qty?: number
  active?: boolean
  is_highlighted?: boolean
  attribute_values?: Array<{
    attribute_code?: string
    value_name?: string
    value_meta?: Record<string, unknown> | null
  }>
  images?: string[]
}

type RustProductListItem = {
  id?: number
  code?: string
  slug?: string | null
  name?: string
  description?: string | null
  active?: boolean
  tags?: string[] | null
  category_ids?: number[]
  variants?: RustProductListVariant[]
}

type RustProductFullResponse = {
  product?: {
    id?: number
    code?: string
    slug?: string | null
    name?: string
    description?: string | null
    active?: boolean
    tags?: string[] | null
    category_ids?: number[]
  }
  variants?: Array<{
    id?: number
    product_id?: number
    sku?: string | null
    price_cents?: number
    promo_cents?: number
    stock_qty?: number
    active?: boolean
    is_highlighted?: boolean
    attribute_values?: Array<{
      attribute_code?: string
      value_name?: string
      value_meta?: Record<string, unknown> | null
    }>
  }>
}

function toStoreProduct(item: RustProductListItem): Product {
  const variants = Array.isArray(item.variants) ? item.variants : []
  const activeVariants = variants.filter((entry) => entry?.active !== false)
  const priceSource = activeVariants.length > 0 ? activeVariants : variants

  const minPriceCents = priceSource.reduce<number>((min, entry) => {
    const promoCents = Number(entry?.promo_cents ?? 0)
    const baseCents = Number(entry?.price_cents ?? 0)
    const cents = promoCents > 0 ? promoCents : baseCents
    if (!Number.isFinite(cents) || cents <= 0) return min
    return min === 0 ? cents : Math.min(min, cents)
  }, 0)

  const images = Array.from(
    new Set(
      variants.flatMap((entry) =>
        Array.isArray(entry?.images)
          ? entry.images.filter((image): image is string => typeof image === 'string' && image.length > 0)
          : []
      )
    )
  )

  const colorsMap = new Map<string, { name: string; hex: string }>()
  for (const variant of variants) {
    const attrs = Array.isArray(variant?.attribute_values) ? variant.attribute_values : []
    const colorAttr = attrs.find((attr) => {
      const code = String(attr?.attribute_code || '').toLowerCase()
      return code === 'color' || code === 'cor'
    })
    const colorName = String(colorAttr?.value_name || '').trim()
    if (!colorName) continue
    const hex = String(colorAttr?.value_meta?.hex || '#000000')
    if (!colorsMap.has(colorName)) {
      colorsMap.set(colorName, { name: colorName, hex })
    }
  }

  return {
    id: String(item.id || ''),
    name: String(item.name || ''),
    slug: String(item.slug || ''),
    sku: String(item.code || ''),
    description: item.description ? String(item.description) : null,
    materials: null,
    measures: null,
    basePrice: (minPriceCents > 0 ? minPriceCents : 0) / 100,
    cost: null,
    isActive: item.active !== false,
    isFeatured: false,
    categoryId: String(item.category_ids?.[0] || ''),
    categoryIds: Array.isArray(item.category_ids) ? item.category_ids.map((value) => String(value)) : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    images,
    sizes: [],
    colors: Array.from(colorsMap.values()),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
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

export async function getStoreProductsAction(filters?: {
  isActive?: boolean
  search?: string
}): Promise<ApiResponse<Product[]>> {
  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const storeId = await getRustStoreId(base)

    const url = new URL('/products', base)
    if (storeId) {
      url.searchParams.set('store_id', String(storeId))
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao listar produtos da loja' }
    }

    const payload = (await response.json()) as RustProductListItem[]
    let mapped = (Array.isArray(payload) ? payload : []).map(toStoreProduct)

    if (filters?.isActive === true) {
      mapped = mapped.filter((product) => product.isActive)
    }

    const searchTerm = String(filters?.search || '').trim().toLowerCase()
    if (searchTerm) {
      mapped = mapped.filter((product) => {
        return (
          product.name.toLowerCase().includes(searchTerm) ||
          product.sku.toLowerCase().includes(searchTerm)
        )
      })
    }

    return { success: true, data: mapped }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao listar produtos da loja',
    }
  }
}

export async function getStoreProductWithVariantsAction(
  id: string
): Promise<ApiResponse<ProductWithVariants>> {
  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { success: false, error: 'Produto inválido' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${base}/products/${Math.trunc(numericId)}/full`, {
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Produto não encontrado' }
    }

    const payload = (await response.json()) as RustProductFullResponse
    const productPayload = payload.product
    const variantPayload = Array.isArray(payload.variants) ? payload.variants : []

    if (!productPayload?.id) {
      return { success: false, error: 'Produto inválido no backend' }
    }

    const variants: ProductVariant[] = variantPayload.map((entry) => {
      const attrs = Array.isArray(entry.attribute_values) ? entry.attribute_values : []
      const colorAttr = attrs.find((attr) => {
        const code = String(attr?.attribute_code || '').toLowerCase()
        return code === 'color' || code === 'cor'
      })
      const sizeAttr = attrs.find((attr) => {
        const code = String(attr?.attribute_code || '').toLowerCase()
        return code === 'size' || code === 'tamanho'
      })
      const attributeValueHexa = normalizeHexColor(
        colorAttr?.value_meta?.rgb
        ?? colorAttr?.value_meta?.hex
        ?? colorAttr?.value_meta?.color,
      )

      return {
        id: String(entry.id || ''),
        productId: String(entry.product_id || productPayload.id),
        color: String(colorAttr?.value_name || ''),
        size: String(sizeAttr?.value_name || ''),
        variantSku: String(entry.sku || ''),
        isHighlighted: entry.is_highlighted === true,
        attribute_value_hexa: attributeValueHexa,
        stock: Number(entry.stock_qty || 0),
        priceOverride:
          typeof entry.promo_cents === 'number' && entry.promo_cents > 0
            ? Number(entry.promo_cents) / 100
            : typeof entry.price_cents === 'number'
            ? Number(entry.price_cents) / 100
            : null,
        createdAt: new Date(),
      }
    })

    const baseProduct = toStoreProduct({
      id: Number(productPayload.id),
      code: String(productPayload.code || ''),
      slug: productPayload.slug || null,
      name: String(productPayload.name || ''),
      description: productPayload.description || null,
      active: productPayload.active !== false,
      tags: productPayload.tags || [],
      variants: [],
      category_ids: [],
    })

    return {
      success: true,
      data: {
        ...baseProduct,
        variants,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar produto com variantes',
    }
  }
}

export async function getProductWithVariantsAction(idOrSlug: string): Promise<ApiResponse<ProductWithVariants>> {
  const numericId = Number(idOrSlug)
  if (Number.isFinite(numericId) && numericId > 0) {
    return getStoreProductWithVariantsAction(String(Math.trunc(numericId)))
  }

  const bySlug = await findStoreProductBySlug(idOrSlug)
  if (!bySlug?.id) {
    return { success: false, error: 'Produto não encontrado' }
  }

  return getStoreProductWithVariantsAction(String(bySlug.id))
}

export async function createProductAction(formData: FormData): Promise<ApiResponse<Product>> {
  const session = await getSession()
  if (!(await isProductsAuthorized(session))) {
    return { success: false, error: 'Não autorizado' }
  }
  const actorUserId = session?.id || 'store-session'

  const data = {
    name: getFormField(formData, 'name') ?? '',
    sku: getFormField(formData, 'sku') ?? '',
    slug: buildProductSlug(getFormField(formData, 'sku'), getFormField(formData, 'name')),
    description: getFormField(formData, 'description') || undefined,
    materials: getFormField(formData, 'materials') || undefined,
    measures: getFormField(formData, 'measures') || undefined,
    basePrice: parseFloat(getFormField(formData, 'basePrice') ?? '0'),
    cost: getFormField(formData, 'cost') ? parseFloat(getFormField(formData, 'cost') as string) : null,
    isActive: getFormField(formData, 'isActive') === 'true',
    isFeatured: getFormField(formData, 'isFeatured') === 'true',
    categoryId: getFormField(formData, 'categoryId') ?? '',
    categoryIds: getFormJson<string[]>(formData, 'categoryIds', []),
    tags: getFormJson<string[]>(formData, 'tags', []),
    images: getFormJson<string[]>(formData, 'images', []),
    sizes: getFormJson<string[]>(formData, 'sizes', []),
    colors: normalizeSubmittedColors(getFormJson<SubmittedColor[]>(formData, 'colors', [])),
    variants: getFormJson<SubmittedVariant[]>(formData, 'variants', []),
    imageGroupingType: (getFormField(formData, 'imageGroupingType') as ImageGroupingType | null) || 'attributes',
    imageGroupingAttributeIds: getFormJson<number[]>(formData, 'imageGroupingAttributeIds', []),
  }

  const validation = productSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  // Check for duplicate slug in Rust store products
  const existing = await findStoreProductBySlug(data.slug)
  if (existing) {
    return { success: false, error: 'Slug ja existe' }
  }

  try {
    await syncCreateProductToRust({
      sku: data.sku,
      slug: data.slug,
      name: data.name,
      description: data.description,
      materials: data.materials,
      measures: data.measures,
      isActive: data.isActive,
      categoryId: data.categoryId,
      categoryIds: data.categoryIds,
      basePrice: data.basePrice,
      cost: data.cost,
      images: data.images,
      colors: data.colors,
      variants: data.variants,
      tags: data.tags,
      imageGroupingRule: {
        type: data.imageGroupingType,
        attribute_ids: data.imageGroupingType === 'attributes'
          ? data.imageGroupingAttributeIds
          : undefined,
      },
    })
  } catch (error) {
    console.error('Rust sync (create) failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao sincronizar com backend' }
  }

  revalidatePath('/products')
  revalidatePath('/app/products')

  const created = (await findStoreProductBySlug(data.slug)) ?? (await findStoreProductBySku(data.sku))

  return {
    success: true,
    data: created ?? {
      id: data.sku,
      name: validation.data.name,
      slug: validation.data.slug,
      sku: validation.data.sku,
      description: validation.data.description ?? null,
      materials: validation.data.materials ?? null,
      measures: validation.data.measures ?? null,
      basePrice: validation.data.basePrice,
      cost: validation.data.cost ?? null,
      isActive: validation.data.isActive,
      isFeatured: validation.data.isFeatured,
      categoryId: validation.data.categoryId ?? '',
      categoryIds: data.categoryIds,
      tags: validation.data.tags,
      images: validation.data.images,
      sizes: validation.data.sizes,
      colors: validation.data.colors,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

export async function updateProductAction(id: string, formData: FormData): Promise<ApiResponse<Product>> {
  const session = await getSession()
  if (!(await isProductsAuthorized(session))) {
    return { success: false, error: 'Não autorizado' }
  }
  const _actorUserId = session?.id || 'store-session'

  const data = {
    name: getFormField(formData, 'name') ?? '',
    sku: getFormField(formData, 'sku') ?? '',
    slug: buildProductSlug(getFormField(formData, 'sku'), getFormField(formData, 'name')),
    description: getFormField(formData, 'description') || undefined,
    materials: getFormField(formData, 'materials') || undefined,
    measures: getFormField(formData, 'measures') || undefined,
    basePrice: parseFloat(getFormField(formData, 'basePrice') ?? '0'),
    cost: getFormField(formData, 'cost') ? parseFloat(getFormField(formData, 'cost') as string) : null,
    isActive: getFormField(formData, 'isActive') === 'true',
    isFeatured: getFormField(formData, 'isFeatured') === 'true',
    categoryId: getFormField(formData, 'categoryId') ?? '',
    categoryIds: getFormJson<string[]>(formData, 'categoryIds', []),
    tags: getFormJson<string[]>(formData, 'tags', []),
    images: getFormJson<string[]>(formData, 'images', []),
    sizes: getFormJson<string[]>(formData, 'sizes', []),
    colors: normalizeSubmittedColors(getFormJson<SubmittedColor[]>(formData, 'colors', [])),
    variants: getFormJson<SubmittedVariant[]>(formData, 'variants', []),
    imageGroupingType: (getFormField(formData, 'imageGroupingType') as ImageGroupingType | null) || 'attributes',
    imageGroupingAttributeIds: getFormJson<number[]>(formData, 'imageGroupingAttributeIds', []),
  }

  const existingResult = await getStoreProductWithVariantsAction(id)
  const existing = existingResult.success ? existingResult.data : undefined

  const validation = productSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  // Check for duplicate slug (excluding current)
  const slugExists = await findStoreProductBySlug(data.slug)
  const slugBelongsToOther = slugExists &&
    String(slugExists.id) !== String(id) &&
    String(slugExists.sku) !== String(data.sku) &&
    (!existing || String(slugExists.id) !== String(existing.id))
  if (slugBelongsToOther) {
    return { success: false, error: 'Slug ja existe' }
  }

  try {
    const numericRustId = Number.parseInt(id, 10)
    const rustProductId = Number.isFinite(numericRustId) ? numericRustId : undefined
    
    await syncUpdateProductToRust({
      lookupCode: existing?.sku ?? data.sku,
      rustProductId,
      sku: data.sku,
      slug: data.slug,
      name: data.name,
      description: data.description,
      materials: data.materials,
      measures: data.measures,
      isActive: data.isActive,
      categoryId: data.categoryId,
      categoryIds: data.categoryIds,
      basePrice: data.basePrice,
      cost: data.cost,
      images: data.images,
      colors: data.colors,
      variants: data.variants,
      tags: data.tags,
      imageGroupingRule: {
        type: data.imageGroupingType,
        attribute_ids: data.imageGroupingType === 'attributes'
          ? data.imageGroupingAttributeIds
          : undefined,
      },
    })
  } catch (error) {
    console.error('Rust sync (update) failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao sincronizar com backend' }
  }

  revalidatePath('/products')
  revalidatePath(`/products/${id}`)
  revalidatePath('/app/products')
  revalidatePath(`/app/products/${validation.data.slug}`)

  const updatedResult = await getStoreProductWithVariantsAction(id)
  if (updatedResult.success && updatedResult.data) {
    return { success: true, data: updatedResult.data }
  }

  return {
    success: true,
    data: {
      id,
      name: validation.data.name,
      slug: validation.data.slug,
      sku: validation.data.sku,
      description: validation.data.description ?? null,
      materials: validation.data.materials ?? null,
      measures: validation.data.measures ?? null,
      basePrice: validation.data.basePrice,
      cost: validation.data.cost ?? null,
      isActive: validation.data.isActive,
      isFeatured: validation.data.isFeatured,
      categoryId: validation.data.categoryId ?? '',
      categoryIds: data.categoryIds,
      tags: validation.data.tags,
      images: validation.data.images,
      sizes: validation.data.sizes,
      colors: validation.data.colors,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

export type BulkProductDiscountInput = {
  type: 'fixed' | 'percent'
  value: number
}

export type BulkUpdateProductsInput = {
  productIds: string[]
  categoryIds?: string[]
  tags?: string[]
  measures?: string
  status?: 'active' | 'inactive'
  discount?: BulkProductDiscountInput | null
}

function applyBulkProductDiscount(price: number, discount?: BulkProductDiscountInput | null) {
  const normalizedPrice = Number.isFinite(price) ? Math.max(0, price) : 0
  if (!discount || !Number.isFinite(discount.value) || discount.value <= 0) {
    return normalizedPrice
  }

  if (discount.type === 'percent') {
    const percentage = Math.min(100, Math.max(0, discount.value))
    return Math.max(0, Number((normalizedPrice * (1 - percentage / 100)).toFixed(2)))
  }

  return Math.max(0, Number((normalizedPrice - discount.value).toFixed(2)))
}

function parseSubmittedImageGroupingRule(raw: unknown): SubmittedImageGroupingRule | undefined {
  if (!raw) return undefined
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const type = String((parsed as any)?.type || '').trim()
    if (type !== 'product' && type !== 'attributes' && type !== 'full_sku') return undefined

    return {
      type,
      attribute_ids: Array.isArray((parsed as any)?.attribute_ids)
        ? (parsed as any).attribute_ids
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isInteger(value) && value > 0)
        : undefined,
    }
  } catch {
    return undefined
  }
}

export async function bulkUpdateProductsAction(
  input: BulkUpdateProductsInput
): Promise<ApiResponse<{ updated: number }>> {
  const session = await getSession()
  if (!(await isProductsAuthorized(session))) {
    return { success: false, error: 'Não autorizado' }
  }

  const productIds = Array.from(new Set((input.productIds || []).map(String).filter(Boolean)))
  if (productIds.length === 0) {
    return { success: false, error: 'Selecione ao menos um produto' }
  }

  const nextCategoryIds = Array.isArray(input.categoryIds)
    ? input.categoryIds.map(String).filter(Boolean)
    : undefined
  const nextTags = Array.isArray(input.tags)
    ? input.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : undefined
  const nextMeasures = typeof input.measures === 'string' && input.measures.trim().length > 0
    ? input.measures.trim()
    : undefined
  const nextStatus = input.status === 'active' || input.status === 'inactive'
    ? input.status
    : undefined
  const nextDiscount = input.discount && input.discount.value > 0
    ? input.discount
    : null

  if (
    (!nextCategoryIds || nextCategoryIds.length === 0) &&
    (!nextTags || nextTags.length === 0) &&
    !nextMeasures &&
    !nextStatus &&
    !nextDiscount
  ) {
    return { success: false, error: 'Informe pelo menos uma alteração' }
  }

  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').replace(/\/$/, '')
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
  }

  let updated = 0

  for (const productId of productIds) {
    const response = await fetch(`${base}/products/${productId}/full`, {
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || `Falha ao carregar produto ${productId}` }
    }

    const fullData = await response.json()
    const productInfo = fullData?.product || {}
    const variants = Array.isArray(fullData?.variants) ? fullData.variants : []
    const imageGroups = Array.isArray(fullData?.image_groups) ? fullData.image_groups : []

    const imagesByVariantId = new Map<number, string[]>()
    imageGroups.forEach((group: any) => {
      const urls = Array.isArray(group?.images)
        ? group.images
            .map((img: any) => img?.image_url || img)
            .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
        : []

      if (!Array.isArray(group?.variants) || urls.length === 0) return
      group.variants.forEach((variantRef: any) => {
        const variantId = Number(variantRef?.variant_id ?? variantRef?.id)
        if (Number.isInteger(variantId) && variantId > 0) {
          imagesByVariantId.set(variantId, urls)
        }
      })
    })

    const existingTags = Array.isArray(productInfo.tags)
      ? productInfo.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
      : []
    const tags = nextTags && nextTags.length > 0
      ? Array.from(new Set([...existingTags, ...nextTags]))
      : existingTags

    const categoryIds = nextCategoryIds && nextCategoryIds.length > 0
      ? nextCategoryIds
      : Array.isArray(productInfo.category_ids)
        ? productInfo.category_ids.map((id: unknown) => String(id)).filter(Boolean)
        : []

    const submittedVariants: SubmittedVariant[] = variants.map((entry: any) => {
      const variantInfo = entry?.variant || entry || {}
      const variantId = Number(variantInfo.id ?? entry?.id)
      const basePrice = Number(variantInfo.price_cents || 0) / 100
      const promoCents = Number(variantInfo.promo_cents || 0)

      return {
        variantSku: String(variantInfo.sku || ''),
        active: variantInfo.active !== false,
        isHighlighted: variantInfo.is_highlighted === true,
        stock: Number(variantInfo.stock_qty || 0),
        basePrice: applyBulkProductDiscount(basePrice, nextDiscount),
        cost: typeof variantInfo.cost_cents === 'number' ? Number(variantInfo.cost_cents) / 100 : null,
        priceOverride: promoCents > 0 ? promoCents / 100 : null,
        attribute_values: Array.isArray(entry?.attribute_values)
          ? entry.attribute_values
              .map((attr: any) => Number(attr?.value_id ?? attr?.value?.id ?? attr?.id))
              .filter((value: number) => Number.isInteger(value) && value > 0)
          : [],
        images: imagesByVariantId.get(variantId) || (Array.isArray(entry?.images) ? entry.images : []),
      }
    })

    const firstVariant = submittedVariants[0]
    const firstRawVariant = variants[0]?.variant || variants[0] || {}
    const fallbackBasePrice = Number(firstRawVariant.price_cents || 0) / 100

    await syncUpdateProductToRust({
      lookupCode: String(productInfo.code || ''),
      rustProductId: Number(productInfo.id || productId),
      sku: String(productInfo.code || ''),
      slug: productInfo.slug || undefined,
      name: String(productInfo.name || ''),
      description: productInfo.description || undefined,
      materials: productInfo.composition || undefined,
      measures: nextMeasures || productInfo.location || undefined,
      isActive: nextStatus ? nextStatus === 'active' : productInfo.active !== false,
      categoryId: categoryIds[0] || '',
      categoryIds,
      basePrice: firstVariant?.basePrice ?? applyBulkProductDiscount(fallbackBasePrice, nextDiscount),
      cost: firstVariant?.cost ?? null,
      images: Array.from(new Set(submittedVariants.flatMap((variant) => variant.images || []))),
      colors: [],
      variants: submittedVariants,
      tags,
      imageGroupingRule: parseSubmittedImageGroupingRule(productInfo.image_grouping_rule),
    })

    updated += 1
  }

  revalidatePath('/products')
  revalidatePath('/app/products')

  return { success: true, data: { updated } }
}

export async function deleteProductAction(id: string): Promise<ApiResponse<void>> {
  const session = await getSession()
  if (!(await isProductsAuthorized(session))) {
    return { success: false, error: 'Não autorizado' }
  }
  const _actorUserId = session?.id || 'store-session'
  
  // Tentar deletar do Rust backend
  try {
    await syncDeleteProductToRust({
      id,
      lookupCode: id,
    })
  } catch (error) {
    console.error('Rust sync (delete) failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao sincronizar com backend' }
  }

  revalidatePath('/products')
  revalidatePath('/app/products')
  
  return { success: true }
}

// Variant actions
export async function createVariantAction(formData: FormData): Promise<ApiResponse<ProductVariant>> {
  const session = await getSession()
  if (!session || !canManageProducts(session.role)) {
    return { success: false, error: 'Não autorizado' }
  }

  const data = {
    productId: formData.get('productId') as string,
    color: formData.get('color') as string,
    size: formData.get('size') as string,
    variantSku: formData.get('variantSku') as string,
    stock: parseInt(formData.get('stock') as string),
    priceOverride: formData.get('priceOverride') ? parseFloat(formData.get('priceOverride') as string) : null,
  }

  const validation = productVariantSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  return { success: false, error: 'Operação de variante isolada desativada. Edite variantes no formulário de produto.' }
}

export async function updateVariantAction(id: string, formData: FormData): Promise<ApiResponse<ProductVariant>> {
  const session = await getSession()
  if (!session || !canManageProducts(session.role)) {
    return { success: false, error: 'Não autorizado' }
  }

  const data = {
    stock: parseInt(formData.get('stock') as string),
    priceOverride: formData.get('priceOverride') ? parseFloat(formData.get('priceOverride') as string) : null,
  }

  return { success: false, error: 'Operação de variante isolada desativada. Edite variantes no formulário de produto.' }
}

export async function deleteVariantAction(id: string): Promise<ApiResponse<void>> {
  const session = await getSession()
  if (!session || !canManageProducts(session.role)) {
    return { success: false, error: 'Não autorizado' }
  }

  return { success: false, error: 'Operação de variante isolada desativada. Edite variantes no formulário de produto.' }
}

export async function getCategoriesAction(): Promise<ApiResponse<Category[]>> {
  try {
    const base = resolveBackendBaseUrl()
    if (!base) {
      return { success: false, error: 'Backend URL não configurado' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(new URL('/categories', base), {
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao carregar categorias' }
    }

    const payload = (await response.json()) as Array<{ id?: number; name?: string; slug?: string | null; active?: boolean }>
    const categories: Category[] = (Array.isArray(payload) ? payload : []).map((category) => ({
      id: String(category.id || ''),
      name: String(category.name || ''),
      slug: String(category.slug || ''),
      description: null,
      parentId: null,
      imageUrl: null,
      isActive: category.active !== false,
      isFeatured: false,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    return { success: true, data: categories }
  } catch (error) {
    console.error('Error in getCategoriesAction:', error)
    return { success: false, error: 'Erro ao carregar categorias' }
  }
}

export async function getProductBySlugAction(slug: string): Promise<ApiResponse<Product | null>> {
  try {
    const product = await findStoreProductBySlug(slug)
    return { success: true, data: product }
  } catch (error) {
    console.error('Error in getProductBySlugAction:', error)
    return { success: false, error: 'Erro ao carregar produto' }
  }
}
  
export async function getProductVariantsAction(productId: string): Promise<ApiResponse<ProductVariant[]>> {
  try {
    const result = await getStoreProductWithVariantsAction(productId)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Erro ao carregar variantes' }
    }
    return { success: true, data: result.data.variants || [] }
  } catch (error) {
    console.error('Error in getProductVariantsAction:', error)
    return { success: false, error: 'Erro ao carregar variantes' }
  }
}

type OrderVariantCatalogItem = {
  productId: string
  productName: string
  productCode: string
  variantId: string
  variantSku: string
  stock: number
  unitPrice: number
  color: string
  size: string
}

type ProductVariantsCatalogResponse = {
  items?: Array<{
    id: number
    code: string
    name: string
    variants?: Record<string, { id: number; stock: number; price_cents: number }>
    attributes?: Array<{
      attribute_code?: string
      value_name?: string
    }>
  }>
}

export async function getOrderProductVariantsCatalogAction(search?: string): Promise<ApiResponse<OrderVariantCatalogItem[]>> {
  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const url = new URL('/product/variants', base)
    url.searchParams.set('limit', '100')
    if (search?.trim()) {
      url.searchParams.set('search', search.trim())
    }

    const response = await fetch(url, {
      headers: {
          ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { success: false, error: text || 'Erro ao carregar variantes' }
    }

    const payload = (await response.json()) as ProductVariantsCatalogResponse
    const items = Array.isArray(payload?.items) ? payload.items : []

    const catalog: OrderVariantCatalogItem[] = []

    for (const item of items) {
      const variants = item.variants || {}

      const colorAttr = (item.attributes || []).find(
        (attr) => String(attr.attribute_code || '').toLowerCase() === 'color'
          || String(attr.attribute_code || '').toLowerCase() === 'cor'
      )
      const sizeAttr = (item.attributes || []).find(
        (attr) => String(attr.attribute_code || '').toLowerCase() === 'size'
          || String(attr.attribute_code || '').toLowerCase() === 'tamanho'
          || String(attr.attribute_code || '').toLowerCase() === 'tam'
      )

      const fallbackColor = String(colorAttr?.value_name || '').trim()
      const fallbackSize = String(sizeAttr?.value_name || '').trim()

      for (const [sku, variant] of Object.entries(variants)) {
        if (!variant || !Number.isFinite(Number(variant.id))) continue

        catalog.push({
          productId: String(item.id),
          productName: String(item.name || ''),
          productCode: String(item.code || ''),
          variantId: String(variant.id),
          variantSku: sku,
          stock: Number(variant.stock || 0),
          unitPrice: Number(variant.price_cents || 0) / 100,
          color: fallbackColor || '-',
          size: fallbackSize || '-',
        })
      }
    }

    return { success: true, data: catalog }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao carregar catálogo de variantes',
    }
  }
}

export async function getProductImageGroupsAction(productId: string): Promise<ApiResponse<any>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const response = await fetch(`${base}/products/${productId}/image-groups`, {
      credentials: 'include',
    })

    if (!response.ok) {
      console.warn(`Failed to fetch image groups: ${response.status}`)
      return { success: false, error: 'Falha ao carregar imagens' }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Error in getProductImageGroupsAction:', error)
    return { success: false, error: 'Erro ao carregar imagens' }
  }
}

export async function getProductFullAction(productId: string): Promise<ApiResponse<any>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not set')

    const response = await fetch(`${base}/products/${productId}/full`, {
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      console.warn(`Failed to fetch product full data: ${response.status}`)
      return { success: false, error: 'Falha ao carregar dados completos do produto' }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Error in getProductFullAction:', error)
    return { success: false, error: 'Erro ao carregar dados completos do produto' }
  }
}
