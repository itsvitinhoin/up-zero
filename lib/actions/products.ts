'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getSession, canManageProducts, getAdminStoreIdFromToken } from '@/lib/auth'
import { buildAdminCookieHeader } from '@/lib/actions/auth'
import { assertManualProductCreationAllowed, getStoreErpIntegrationStatus } from '@/lib/actions/erp-integration'
import { getAttributesWithValuesByStore } from '@/lib/actions/attributes'
import { productSchema, productVariantSchema } from '@/lib/validations'
import { getValidationErrorMessage } from '@/lib/utils/validation-error'
import type { ApiResponse, Category, PaginatedResponse, Product, ProductVariant, ProductWithVariants, StockMode } from '@/lib/types'
import { resolveAvailableQtyByStockMode } from '@/lib/stock-mode'
import { getSiteSettingsAction } from '@/lib/actions/settings'

type SubmittedVariant = {
  variantId?: string | null
  variantSku?: string
  color?: string
  size?: string
  ncm?: string | null
  weightGrams?: number | null
  active?: boolean
  isHighlighted?: boolean
  preferredSellableLocationIds?: number[]
  stock?: number
  basePrice?: number | null
  cost?: number | null
  priceOverride?: number | null
  images?: string[]
  attribute_values?: number[]
  barcode?: string | null
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

type SubmittedVideoGroupingRule = {
  type: ImageGroupingType
  attribute_ids?: number[]
}

function buildSubmittedVariantKey(variant: SubmittedVariant): string {
  const attributeValueIds = Array.isArray(variant.attribute_values)
    ? variant.attribute_values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : []

  if (attributeValueIds.length > 0) {
    return [...attributeValueIds].sort((a, b) => a - b).join('|')
  }

  return '_default'
}

function buildExistingVariantKey(variant: ProductVariant): string {
  const attributeValueIds = Array.isArray(variant.attributeValueIds)
    ? variant.attributeValueIds.filter((value) => Number.isInteger(value) && value > 0)
    : []

  if (attributeValueIds.length > 0) {
    return [...attributeValueIds].sort((a, b) => a - b).join('|')
  }

  if (variant.isSimpleProduct || variant.combinationKey === '_default') {
    return '_default'
  }

  const color = String(variant.color || '').trim().toUpperCase()
  const size = String(variant.size || '').trim().toUpperCase()
  if (color && size) {
    return `${color}|${size}`
  }

  return `${variant.color}-${variant.size}`
}

function buildSubmittedColorSizeKey(variant: SubmittedVariant): string {
  const color = String(variant.color || '').trim().toUpperCase()
  const size = String(variant.size || '').trim().toUpperCase()
  if (!color || !size) return ''
  return `${color}|${size}`
}

function preserveErpSkusOnUpdate(
  submittedVariants: SubmittedVariant[],
  existing?: ProductWithVariants,
): SubmittedVariant[] {
  if (!existing?.variants?.length) return submittedVariants

  const skuByVariantId = new Map<string, string>()
  const skuByAttributeKey = new Map<string, string>()
  const skuByColorSize = new Map<string, string>()

  existing.variants.forEach((variant) => {
    const sku = String(variant.variantSku || '').trim()
    if (!sku) return

    if (variant.id) {
      skuByVariantId.set(String(variant.id), sku)
    }

    skuByAttributeKey.set(buildExistingVariantKey(variant), sku)

    const colorSizeKey = buildSubmittedColorSizeKey({
      color: variant.color,
      size: variant.size,
    })
    if (colorSizeKey) {
      skuByColorSize.set(colorSizeKey, sku)
    }
  })

  return submittedVariants.map((variant) => {
    const submittedVariantId = variant.variantId ? String(variant.variantId).trim() : ''
    const erpSku = (submittedVariantId ? skuByVariantId.get(submittedVariantId) : undefined)
      ?? skuByAttributeKey.get(buildSubmittedVariantKey(variant))
      ?? skuByColorSize.get(buildSubmittedColorSizeKey(variant))

    return {
      ...variant,
      variantSku: erpSku ?? '',
    }
  })
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

function normalizeAttributeValuesByAttributeMap(raw: unknown): Record<number, number[]> {
  if (!raw || typeof raw !== 'object') return {}

  const normalized: Record<number, number[]> = {}

  for (const [attributeIdRaw, valueIdsRaw] of Object.entries(raw as Record<string, unknown>)) {
    const attributeId = Number(attributeIdRaw)
    if (!Number.isInteger(attributeId) || attributeId <= 0) continue

    if (!Array.isArray(valueIdsRaw)) continue

    const valueIds = Array.from(
      new Set(
        valueIdsRaw
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    )

    if (valueIds.length > 0) {
      normalized[attributeId] = valueIds
    }
  }

  return normalized
}

function mergeMetaWithAttributeSelectionOrder(
  baseMeta: Record<string, unknown>,
  attributeValuesByAttribute: Record<number, number[]>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(baseMeta || {}) }

  if (Object.keys(attributeValuesByAttribute).length === 0) {
    return merged
  }

  merged.attribute_values_by_attribute = attributeValuesByAttribute
  return merged
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

const productTopLevelLabels: Record<string, string> = {
  name: 'Nome',
  slug: 'Slug',
  sku: 'SKU',
  basePrice: 'Preço base',
  cost: 'Custo',
  categoryId: 'Categoria',
}

const productNestedLabels: Record<string, string> = {
  variants: 'Variantes',
  variantSku: 'SKU da variante',
  attribute_values: 'Valores de atributo',
  basePrice: 'Preço base',
  priceOverride: 'Preço promocional',
  stock: 'Estoque',
  size: 'Tamanho',
  color: 'Cor',
  images: 'Imagens',
  categoryIds: 'Categorias',
  categoryId: 'Categoria',
  tags: 'Tags',
  sizes: 'Tamanhos',
  colors: 'Cores',
}

function formatProductValidationError(validationError: unknown): string {
  return getValidationErrorMessage(validationError, {
    fallbackMessage: 'Dados do produto inválidos',
    topLevelLabels: productTopLevelLabels,
    nestedLabels: productNestedLabels,
  })
}

function normalizeBackendErrorMessage(raw: string | null | undefined, fallback: string): string {
  const text = String(raw || '').trim()
  if (!text) return fallback

  let parsedMessage = text
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'string') {
      parsedMessage = parsed
    } else if (parsed && typeof parsed === 'object') {
      parsedMessage = String(
        (parsed as any).error
          || (parsed as any).message
          || (parsed as any).details
          || text,
      )
    }
  } catch {
    parsedMessage = text
  }

  const compact = parsedMessage.replace(/\s+/g, ' ').trim()
  if (!compact || /^<!doctype html/i.test(compact) || /^<html/i.test(compact)) {
    return fallback
  }

  if (/category_ids|categoria|category/i.test(compact)) {
    return 'Selecione pelo menos uma categoria válida para o produto.'
  }

  if (/price_cents|basePrice|preço|price.*positive|must be positive|deve ser positivo/i.test(compact)) {
    return 'Informe um preço maior que zero para o produto/variantes.'
  }

  if (/\bsku\b/i.test(compact) && /(already exists|duplicate|já existe|existe|conflict)/i.test(compact)) {
    const duplicatedSku = compact.match(/sku\s*(?:já\s*existente|já\s*existe|already\s*exists|exists|duplicate|conflict)?\s*[:\-]?\s*([a-z0-9._\/-]+)/i)?.[1]
    if (duplicatedSku) {
      return `SKU ${duplicatedSku} já está em uso. Informe um SKU diferente.`
    }
    return 'Este SKU já está em uso. Informe um SKU diferente.'
  }

  if (/slug/i.test(compact) && /(already exists|duplicate|já existe|existe)/i.test(compact)) {
    return 'Já existe produto com esse slug. Ajuste o nome/SKU e tente novamente.'
  }

  if (/product_variant_values_variant_id_attribute_id_key/i.test(compact)) {
    return 'Uma variante está com mais de um valor para o mesmo atributo (ex.: duas cores ou dois tamanhos na mesma variante). Revise os atributos das variantes e tente novamente.'
  }

  return compact
}

function formatThrownError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return normalizeBackendErrorMessage(error.message, fallback)
  }
  return fallback
}

type BulkDiscountPayload = {
  mode: string
  value: number | null
}

type BulkUpdateProductsPayload = {
  product_ids: number[]
  category_ids?: number[]
  add_category_ids?: number[]
  remove_category_ids?: number[]
  add_tags?: string[]
  remove_tags?: string[]
  measurement_table_id?: number
  active?: boolean
  discount?: BulkDiscountPayload
  ncm?: string
  weight_grams?: number
}

type BulkUpdateProductsResponse = {
  requested_count?: number
  updated_count?: number
  updated_product_ids?: number[]
  updated_products?: Array<{ id: number; name: string }>
  message?: string
}

async function hasProductPermission(permissionCode: string): Promise<boolean> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  if (!adminToken) {
    return false
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return false
  }

  try {
    const permissionUrl = new URL('/permissions/check', base)
    permissionUrl.searchParams.set('code', permissionCode)

    const permissionResponse = await fetch(permissionUrl, {
      headers: {
        cookie: `adminAuthToken=${adminToken}`,
      },
      cache: 'no-store',
    })

    if (!permissionResponse.ok) {
      return false
    }

    const payload = await permissionResponse.json() as { has_permission?: boolean }
    return payload?.has_permission === true
  } catch {
    return false
  }
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

function buildVariantAttributeLookupContext(
  attributes?: Array<{ code?: string | null; values: Array<{ id: number; name?: string | null; code?: string | null }> }>,
) {
  const validValueIds = new Set<number>()
  const colorValueByNorm = new Map<string, number>()
  const sizeValueByNorm = new Map<string, number>()

  if (!Array.isArray(attributes) || attributes.length === 0) {
    return {
      validValueIds,
      colorValueByNorm,
      sizeValueByNorm,
    }
  }

  const colorAttr = attributes.find((a) => normalizeText(a.code) === 'color')
  const sizeAttr = attributes.find((a) => normalizeText(a.code) === 'size')

  for (const attribute of attributes) {
    for (const value of attribute.values || []) {
      if (Number.isInteger(value.id) && value.id > 0) {
        validValueIds.add(value.id)
      }
    }
  }

  for (const value of colorAttr?.values || []) {
    if (!Number.isInteger(value.id) || value.id <= 0) continue
    const normalizedName = normalizeText(value.name)
    const normalizedCode = normalizeText(value.code)
    if (normalizedName) colorValueByNorm.set(normalizedName, value.id)
    if (normalizedCode) colorValueByNorm.set(normalizedCode, value.id)
  }

  for (const value of sizeAttr?.values || []) {
    if (!Number.isInteger(value.id) || value.id <= 0) continue
    const normalizedName = normalizeText(value.name)
    const normalizedCode = normalizeText(value.code)
    if (normalizedName) sizeValueByNorm.set(normalizedName, value.id)
    if (normalizedCode) sizeValueByNorm.set(normalizedCode, value.id)
  }

  return {
    validValueIds,
    colorValueByNorm,
    sizeValueByNorm,
  }
}

function resolveVariantAttributeValueIds(
  variant: SubmittedVariant,
  existingIds: number[] = [],
  context: {
    colorValueByNorm: Map<string, number>
    sizeValueByNorm: Map<string, number>
  },
): number[] {
  if (context.colorValueByNorm.size === 0 && context.sizeValueByNorm.size === 0) {
    return existingIds
  }

  const colorNorm = normalizeText(variant.color)
  const sizeNorm = normalizeText(variant.size)

  const resolved = [...existingIds]

  if (colorNorm && colorNorm !== 'unico' && colorNorm !== 'único') {
    const colorValueId = context.colorValueByNorm.get(colorNorm)
    if (typeof colorValueId === 'number' && !resolved.includes(colorValueId)) {
      resolved.push(colorValueId)
    }
  }

  if (sizeNorm && sizeNorm !== 'unico' && sizeNorm !== 'único') {
    const sizeValueId = context.sizeValueByNorm.get(sizeNorm)
    if (typeof sizeValueId === 'number' && !resolved.includes(sizeValueId)) {
      resolved.push(sizeValueId)
    }
  }

  return resolved
}

function sanitizeExistingAttributeValueIds(
  existingIds: number[] = [],
  validValueIds?: Set<number>,
): number[] {
  if (!Array.isArray(existingIds) || existingIds.length === 0) return []
  if (!validValueIds || validValueIds.size === 0) {
    return Array.from(new Set(existingIds.filter((id) => Number.isInteger(id) && id > 0)))
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
  measurementTableId?: string
  weightGrams?: number | null
  isActive: boolean
  categoryId: string
  categoryIds?: string[]
  basePrice: number
  cost: number | null
  images: string[]
  colors: SubmittedColor[]
  variants: SubmittedVariant[]
  tags: string[]
  meta?: Record<string, unknown>
  imageGroupingRule?: SubmittedImageGroupingRule
  videoGroupingRule?: SubmittedVideoGroupingRule
  erpIntegrated?: boolean
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

  const videoGroupingRule = (() => {
    const selectedType = data.videoGroupingRule?.type
    const selectedAttributes = Array.isArray(data.videoGroupingRule?.attribute_ids)
      ? data.videoGroupingRule!.attribute_ids!.filter((id) => Number.isInteger(id) && id > 0)
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

    if (selectedType === 'product') {
      return { type: 'product' as const }
    }

    return imageGroupingRule
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

  const variantLookupContext = buildVariantAttributeLookupContext(storeAttributes ?? undefined)

  const variantPayloadByCombination = new Map<string, {
    sku: string
    price_cents: number
    cost_cents: number
    promo_cents: number
    ncm: string | null
    weight_grams: number | null
    stock_qty: number
    barcode: string | null
    active: boolean
    is_highlighted: boolean
    meta: Record<string, unknown>
    attribute_values: number[]
    tags: string[]
    images: string[]
  }>()

  for (const variant of variantsToSync) {
    const sanitizedExistingAttributeValues = sanitizeExistingAttributeValueIds(
      Array.isArray(variant.attribute_values) ? variant.attribute_values : [],
      variantLookupContext.validValueIds,
    )

    const resolvedAttributeValues = resolveVariantAttributeValueIds(
      variant,
      sanitizedExistingAttributeValues,
      {
        colorValueByNorm: variantLookupContext.colorValueByNorm,
        sizeValueByNorm: variantLookupContext.sizeValueByNorm,
      },
    )

    const normalizedAttributeValues = Array.from(new Set(resolvedAttributeValues)).sort((a, b) => a - b)
    const combinationKey = normalizedAttributeValues.join(',')

    const nextVariantPayload = {
      meta: (() => {
        const preferredSellableLocationIds = Array.isArray(variant.preferredSellableLocationIds)
          ? variant.preferredSellableLocationIds
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0)
          : []
        if (preferredSellableLocationIds.length > 0) {
          return { preferred_sellable_location_ids: preferredSellableLocationIds }
        }
        return {}
      })(),
      sku: (() => {
        const trimmedSku = typeof variant.variantSku === 'string' ? variant.variantSku.trim() : ''
        if (trimmedSku) return trimmedSku
        if (data.erpIntegrated) return null
        return data.sku
      })(),
      price_cents: toCents(variant.basePrice ?? data.basePrice),
      cost_cents: toCents(variant.cost ?? data.cost),
      promo_cents: toCents(variant.priceOverride),
      ncm: typeof variant.ncm === 'string' ? (variant.ncm.trim() || null) : null,
      barcode: typeof variant.barcode === 'string' ? (variant.barcode.trim() || null) : null,
      weight_grams: typeof variant.weightGrams === 'number' ? variant.weightGrams : null,
      stock_qty: typeof variant.stock === 'number' ? variant.stock : 0,
      active: variant.active !== false,
      is_highlighted: variant.isHighlighted === true,
      attribute_values: normalizedAttributeValues,
      tags: data.tags,
      images: imageGroupingRule.type === 'product'
        ? fallbackImages
        : normalizedAttributeValues.length === 0
          ? resolveVariantImages(variant, fallbackImages)
          : resolveVariantImagesNoFallback(variant),
    }

    const currentPayload = variantPayloadByCombination.get(combinationKey)
    if (!currentPayload) {
      variantPayloadByCombination.set(combinationKey, nextVariantPayload)
      continue
    }

    // If the same normalized combination appears more than once,
    // never allow an inactive entry to override an active one.
    if (currentPayload.active && !nextVariantPayload.active) {
      continue
    }

    variantPayloadByCombination.set(combinationKey, nextVariantPayload)
  }

  const variantPayloads = Array.from(variantPayloadByCombination.values())
  const parsedMeasurementTableId = Number(data.measurementTableId)
  const measurementTableId = Number.isInteger(parsedMeasurementTableId) && parsedMeasurementTableId > 0
    ? parsedMeasurementTableId
    : null

  const payload = {
    id: data.rustProductId,
    store_id: storeId ?? undefined,
    code: data.sku,
    slug: data.slug,
    name: data.name,
    description: data.description || null,
    weight_grams: data.weightGrams ?? null,
    active: data.isActive,
    ncm: null,
    barcode: null,
    composition: data.materials || null,
    location: data.measures || null,
    measurement_table_id: measurementTableId,
    category_ids: numericCategoryIds,
    tags: data.tags,
    image_grouping_rule: JSON.stringify(imageGroupingRule),
    video_grouping_rule: JSON.stringify(videoGroupingRule),
    meta: data.meta ?? undefined,
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
    const normalizedError = normalizeBackendErrorMessage(errorText, 'Falha ao sincronizar produto no backend')
    const slugConflict =
      Boolean(data.rustProductId) &&
      Boolean(data.slug) &&
      /slug/i.test(normalizedError) &&
      /(já|jÃ¡|existe|exists|duplic)/i.test(normalizedError)

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
      const normalizedRetryError = normalizeBackendErrorMessage(
        retryErrorText || errorText,
        'Falha ao sincronizar produto no backend',
      )
      throw new Error(normalizedRetryError)
    }

    throw new Error(normalizedError)
  }
}

async function syncCreateProductToRust(data: {
  sku: string
  slug?: string
  name: string
  description?: string
  materials?: string
  measures?: string
  measurementTableId?: string
  isActive: boolean
  categoryId: string
  categoryIds?: string[]
  basePrice: number
  cost: number | null
  images: string[]
  colors: SubmittedColor[]
  variants: SubmittedVariant[]
  tags: string[]
  meta?: Record<string, unknown>
  imageGroupingRule?: SubmittedImageGroupingRule
  videoGroupingRule?: SubmittedVideoGroupingRule
}) {
  await syncProductBundleToRust({
    sku: data.sku,
    slug: data.slug,
    name: data.name,
    description: data.description,
    materials: data.materials,
    measures: data.measures,
    measurementTableId: data.measurementTableId,
    isActive: data.isActive,
    categoryId: data.categoryId,
    categoryIds: data.categoryIds,
    basePrice: data.basePrice,
    cost: data.cost,
    images: data.images,
    colors: data.colors,
    variants: data.variants,
    tags: data.tags,
    meta: data.meta,
    imageGroupingRule: data.imageGroupingRule,
    videoGroupingRule: data.videoGroupingRule,
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
  measurementTableId?: string
  isActive: boolean
  categoryId: string
  categoryIds?: string[]
  basePrice?: number
  cost?: number | null
  images?: string[]
  colors?: SubmittedColor[]
  variants?: SubmittedVariant[]
  tags: string[]
  meta?: Record<string, unknown>
  imageGroupingRule?: SubmittedImageGroupingRule
  videoGroupingRule?: SubmittedVideoGroupingRule
  erpIntegrated?: boolean
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
    measurementTableId: data.measurementTableId,
    isActive: data.isActive,
    categoryId: data.categoryId,
    categoryIds: data.categoryIds,
    basePrice: data.basePrice ?? 0,
    cost: data.cost ?? null,
    images: data.images || [],
    colors: data.colors || [],
    variants: data.variants || [],
    tags: data.tags,
    meta: data.meta,
    imageGroupingRule: data.imageGroupingRule,
    videoGroupingRule: data.videoGroupingRule,
    erpIntegrated: data.erpIntegrated,
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
  if (Array.isArray(filters?.ids) && filters.ids.length > 0) {
    const uniqueIds = Array.from(new Set(filters.ids.map((id) => String(id).trim()).filter(Boolean)))

    const settled = await Promise.allSettled(
      uniqueIds.map(async (id) => {
        const numericId = Number.parseInt(id, 10)
        if (!Number.isInteger(numericId) || numericId <= 0) {
          return null
        }

        const byIdResult = await getStoreProductWithVariantsAction(String(numericId))
        if (!byIdResult.success || !byIdResult.data) {
          return null
        }

        return byIdResult.data as Product
      })
    )

    const products: Product[] = []
    for (const item of settled) {
      if (item.status === 'fulfilled' && item.value) {
        products.push(item.value)
      }
    }

    let filtered = products

    if (filters?.categoryId) {
      const selectedCategoryId = filters.categoryId
      filtered = filtered.filter((product) => {
        const categoryIds = Array.isArray(product.categoryIds) ? product.categoryIds : []
        return product.categoryId === selectedCategoryId || categoryIds.includes(selectedCategoryId)
      })
    }

    if (typeof filters?.isFeatured === 'boolean') {
      filtered = filtered.filter((product) => product.isFeatured === filters.isFeatured)
    }

    if (typeof filters?.isActive === 'boolean') {
      filtered = filtered.filter((product) => product.isActive === filters.isActive)
    }

    const searchTerm = String(filters?.search || '').trim().toLowerCase()
    if (searchTerm) {
      filtered = filtered.filter((product) => {
        return (
          product.name.toLowerCase().includes(searchTerm) ||
          product.sku.toLowerCase().includes(searchTerm)
        )
      })
    }

    return { success: true, data: filtered }
  }

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
  measurement_table_id?: number | null
  active?: boolean
  tags?: string[] | null
  meta?: Record<string, unknown> | null
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
    measurement_table_id?: number | null
    active?: boolean
    tags?: string[] | null
    meta?: Record<string, unknown> | null
    category_ids?: number[]
  }
  variants?: Array<{
    id?: number
    product_id?: number
    sku?: string | null
    price_cents?: number
    cost_cents?: number
    promo_cents?: number
    stock_qty?: number
    reserved_qty?: number
    combination_key?: string | null
    active?: boolean
    is_highlighted?: boolean
    ncm?: string | null
    barcode?: string | null
    weight_grams?: number | null
    meta?: Record<string, unknown> | null
    attribute_values?: Array<{
      value_id?: number
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
    measurementTableId: item.measurement_table?.id
      ? String(item.measurement_table.id)
      : (Number.isInteger(item.measurement_table_id) ? String(item.measurement_table_id) : null),
    measurementTableName: item.measurement_table?.name
      ? String(item.measurement_table.name)
      : null,
    basePrice: (minPriceCents > 0 ? minPriceCents : 0) / 100,
    cost: null,
    isActive: item.active !== false,
    isFeatured: false,
    categoryId: String(item.category_ids?.[0] || ''),
    categoryIds: Array.isArray(item.category_ids) ? item.category_ids.map((value) => String(value)) : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    meta: item.meta && typeof item.meta === 'object' ? item.meta : null,
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

    const headers = {
      'Content-Type': 'application/json',
      ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
    }

    const limitPerPage = 200
    let page = 1
    let totalCount = 0
    const items: RustProductListItem[] = []

    do {
      const url = new URL('/products', base)
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', String(limitPerPage))

      if (storeId) {
        url.searchParams.set('store_id', String(storeId))
      }

      const response = await fetch(url.toString(), {
        headers,
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return { success: false, error: errorText || 'Erro ao listar produtos da loja' }
      }

      const payload = (await response.json()) as RustProductListItem[]
      const pageItems = Array.isArray(payload) ? payload : []
      items.push(...pageItems)

      const totalHeader = response.headers.get('x-total-count')
      const parsedTotal = Number(totalHeader)
      totalCount = Number.isFinite(parsedTotal) && parsedTotal > 0
        ? parsedTotal
        : items.length

      if (pageItems.length === 0) {
        break
      }

      page += 1
    } while (items.length < totalCount)

    let mapped = items.map(toStoreProduct)

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

export async function getStoreProductsPageAction(filters?: {
  page?: number
  limit?: number
  isActive?: boolean
  search?: string
}): Promise<ApiResponse<PaginatedResponse<Product>>> {
  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const storeId = await getRustStoreId(base)

    const page = Math.max(1, Number(filters?.page ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(filters?.limit ?? 30) || 30))

    const url = new URL('/products', base)
    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(pageSize))

    if (storeId) {
      url.searchParams.set('store_id', String(storeId))
    }

    const searchTerm = String(filters?.search || '').trim()
    if (searchTerm) {
      url.searchParams.set('search', searchTerm)
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
    let items = Array.isArray(payload) ? payload.map(toStoreProduct) : []

    if (filters?.isActive === true) {
      items = items.filter((product) => product.isActive)
    } else if (filters?.isActive === false) {
      items = items.filter((product) => !product.isActive)
    }

    const totalHeader = response.headers.get('x-total-count')
    const parsedTotal = Number(totalHeader)
    const total = Number.isFinite(parsedTotal) && parsedTotal >= 0
      ? parsedTotal
      : ((page - 1) * pageSize) + items.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao listar produtos da loja',
    }
  }
}

type RustPaginatedProductListResponse = {
  total?: number
  page?: number
  limit?: number
  items?: RustProductListItem[]
}

export async function getPaginatedStoreProductsAction(filters?: {
  page?: number
  limit?: number
  isActive?: boolean
  search?: string
  categoryId?: string
}): Promise<ApiResponse<PaginatedResponse<Product>>> {
  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const storeId = await getRustStoreId(base)
    const page = Math.max(1, Number(filters?.page ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(filters?.limit ?? 24) || 24))

    const url = new URL('/products-paginated', base)
    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(pageSize))
    url.searchParams.set('summary', 'false')

    if (storeId) {
      url.searchParams.set('store_id', String(storeId))
    }

    if (filters?.isActive === true) {
      url.searchParams.set('status', 'active')
    } else if (filters?.isActive === false) {
      url.searchParams.set('status', 'inactive')
    }

    const search = String(filters?.search || '').trim()
    if (search) {
      url.searchParams.set('search', search)
    }

    const categoryId = String(filters?.categoryId || '').trim()
    if (categoryId && categoryId !== 'all') {
      url.searchParams.set('category_id', categoryId)
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

    const payload = (await response.json()) as RustPaginatedProductListResponse
    const items = Array.isArray(payload.items) ? payload.items.map(toStoreProduct) : []
    const total = Number.isFinite(Number(payload.total)) ? Number(payload.total) : items.length

    return {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
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

    let stockMode: StockMode = 'FANTASY'
    let variantMaxQty = 999
    try {
      const settingsResult = await getSiteSettingsAction()
      if (settingsResult.success && settingsResult.data) {
        stockMode = settingsResult.data.stockMode || 'FANTASY'
        variantMaxQty = Math.max(1, Number(settingsResult.data.variantMaxQty || 999))
      }
    } catch {
      // keep defaults
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
      const stockQty = Number(entry.stock_qty || 0)
      const reservedQty = Number(entry.reserved_qty || 0)

      return {
        id: String(entry.id || ''),
        productId: String(entry.product_id || productPayload.id),
        color: String(colorAttr?.value_name || ''),
        size: String(sizeAttr?.value_name || ''),
        variantSku: String(entry.sku || ''),
        combinationKey: typeof entry.combination_key === 'string' ? entry.combination_key : null,
        attributeValueIds: attrs
          .map((attr) => Number(attr?.value_id))
          .filter((valueId) => Number.isInteger(valueId) && valueId > 0),
        isSimpleProduct:
          attrs.length === 0
          || (typeof entry.combination_key === 'string' && entry.combination_key.trim().toLowerCase() === '_default'),
        isHighlighted: entry.is_highlighted === true,
        preferredSellableLocationIds: Array.isArray(entry.meta?.preferred_sellable_location_ids)
          ? entry.meta.preferred_sellable_location_ids
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0)
          : [],
        attribute_value_hexa: attributeValueHexa,
        stock: resolveAvailableQtyByStockMode({
          stockMode,
          variantMaxQty,
          stockQty,
          reservedQty,
        }),
        priceOverride:
          typeof entry.promo_cents === 'number' && entry.promo_cents > 0
            ? Number(entry.promo_cents) / 100
            : typeof entry.price_cents === 'number'
            ? Number(entry.price_cents) / 100
            : null,
        ncm: typeof entry.ncm === 'string' ? entry.ncm : null,
        barcode: typeof entry.barcode === 'string' ? entry.barcode : null,
        weightGrams: typeof entry.weight_grams === 'number' ? entry.weight_grams : null,
        createdAt: new Date(),
      }
    })

    const baseProduct = toStoreProduct({
      id: Number(productPayload.id),
      code: String(productPayload.code || ''),
      slug: productPayload.slug || null,
      name: String(productPayload.name || ''),
      description: productPayload.description || null,
      measurement_table_id: productPayload.measurement_table_id ?? null,
      active: productPayload.active !== false,
      tags: productPayload.tags || [],
      meta: productPayload.meta ?? null,
      variants: [],
      category_ids: Array.isArray(productPayload.category_ids) ? productPayload.category_ids : [],
    })

    return {
      success: true,
      data: {
        ...baseProduct,
        measurementTableName: payload.measurement_table_name
          ? String(payload.measurement_table_name)
          : baseProduct.measurementTableName,
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
  if (!(await hasProductPermission('products.create'))) {
    return { success: false, error: 'Não autorizado' }
  }

  const erpGuard = await assertManualProductCreationAllowed()
  if (!erpGuard.allowed) {
    return { success: false, error: erpGuard.error }
  }

  const actorUserId = session?.id || 'store-session'

  const normalizedAttributeValuesByAttribute = normalizeAttributeValuesByAttributeMap(
    getFormJson<Record<string, unknown>>(formData, 'attributeValuesByAttribute', {}),
  )

  const data = {
    name: getFormField(formData, 'name') ?? '',
    sku: getFormField(formData, 'sku') ?? '',
    slug: buildProductSlug(getFormField(formData, 'sku'), getFormField(formData, 'name')),
    description: getFormField(formData, 'description') || undefined,
    materials: getFormField(formData, 'materials') || undefined,
    measures: getFormField(formData, 'measures') || undefined,
    measurementTableId: getFormField(formData, 'measurementTableId') || undefined,
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
    meta: mergeMetaWithAttributeSelectionOrder(
      getFormJson<Record<string, unknown>>(formData, 'meta', {}),
      normalizedAttributeValuesByAttribute,
    ),
    imageGroupingType: (getFormField(formData, 'imageGroupingType') as ImageGroupingType | null) || 'attributes',
    imageGroupingAttributeIds: getFormJson<number[]>(formData, 'imageGroupingAttributeIds', []),
    videoGroupingType: (getFormField(formData, 'videoGroupingType') as ImageGroupingType | null) || 'attributes',
    videoGroupingAttributeIds: getFormJson<number[]>(formData, 'videoGroupingAttributeIds', []),
  }

  const validation = productSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: formatProductValidationError(validation.error) }
  }

  try {
    await syncCreateProductToRust({
      sku: data.sku,
      slug: data.slug,
      name: data.name,
      description: data.description,
      materials: data.materials,
      measures: data.measures,
      measurementTableId: data.measurementTableId,
      isActive: data.isActive,
      categoryId: data.categoryId,
      categoryIds: data.categoryIds,
      basePrice: data.basePrice,
      cost: data.cost,
      images: data.images,
      colors: data.colors,
      variants: data.variants,
      tags: data.tags,
      meta: data.meta,
      imageGroupingRule: {
        type: data.imageGroupingType,
        attribute_ids: data.imageGroupingType === 'attributes'
          ? data.imageGroupingAttributeIds
          : undefined,
      },
      videoGroupingRule: {
        type: data.videoGroupingType,
        attribute_ids: data.videoGroupingType === 'attributes'
          ? data.videoGroupingAttributeIds
          : undefined,
      },
    })
  } catch (error) {
    console.error('Rust sync (create) failed:', error)
    return { success: false, error: formatThrownError(error, 'Falha ao sincronizar com backend') }
  }

  revalidatePath('/products')
  revalidatePath('/app/products')

  return {
    success: true,
    data: {
      id: data.sku,
      name: validation.data.name,
      slug: validation.data.slug,
      sku: validation.data.sku,
      description: validation.data.description ?? null,
      materials: validation.data.materials ?? null,
      measures: validation.data.measures ?? null,
      measurementTableId: data.measurementTableId ?? null,
      basePrice: validation.data.basePrice,
      cost: validation.data.cost ?? null,
      isActive: validation.data.isActive,
      isFeatured: validation.data.isFeatured,
      categoryId: validation.data.categoryId ?? '',
      categoryIds: data.categoryIds,
      tags: validation.data.tags,
      meta: data.meta,
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
  if (!(await hasProductPermission('products.edit'))) {
    return { success: false, error: 'Não autorizado' }
  }
  const _actorUserId = session?.id || 'store-session'

  const normalizedAttributeValuesByAttribute = normalizeAttributeValuesByAttributeMap(
    getFormJson<Record<string, unknown>>(formData, 'attributeValuesByAttribute', {}),
  )

  const data = {
    name: getFormField(formData, 'name') ?? '',
    sku: getFormField(formData, 'sku') ?? '',
    slug: buildProductSlug(getFormField(formData, 'sku'), getFormField(formData, 'name')),
    description: getFormField(formData, 'description') || undefined,
    materials: getFormField(formData, 'materials') || undefined,
    measures: getFormField(formData, 'measures') || undefined,
    measurementTableId: getFormField(formData, 'measurementTableId') || undefined,
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
    meta: mergeMetaWithAttributeSelectionOrder(
      getFormJson<Record<string, unknown>>(formData, 'meta', {}),
      normalizedAttributeValuesByAttribute,
    ),
    imageGroupingType: (getFormField(formData, 'imageGroupingType') as ImageGroupingType | null) || 'attributes',
    imageGroupingAttributeIds: getFormJson<number[]>(formData, 'imageGroupingAttributeIds', []),
    videoGroupingType: (getFormField(formData, 'videoGroupingType') as ImageGroupingType | null) || 'attributes',
    videoGroupingAttributeIds: getFormJson<number[]>(formData, 'videoGroupingAttributeIds', []),
  }

  const existingResult = await getStoreProductWithVariantsAction(id)
  const existing = existingResult.success ? existingResult.data : undefined

  const erpStatus = await getStoreErpIntegrationStatus()
  if (erpStatus.integrated && existing) {
    data.sku = existing.sku
    data.variants = preserveErpSkusOnUpdate(data.variants, existing)
  }

  const validation = productSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: formatProductValidationError(validation.error) }
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
      measurementTableId: data.measurementTableId,
      isActive: data.isActive,
      categoryId: data.categoryId,
      categoryIds: data.categoryIds,
      basePrice: data.basePrice,
      cost: data.cost,
      images: data.images,
      colors: data.colors,
      variants: data.variants,
      tags: data.tags,
      meta: data.meta,
      erpIntegrated: erpStatus.integrated,
      imageGroupingRule: {
        type: data.imageGroupingType,
        attribute_ids: data.imageGroupingType === 'attributes'
          ? data.imageGroupingAttributeIds
          : undefined,
      },
      videoGroupingRule: {
        type: data.videoGroupingType,
        attribute_ids: data.videoGroupingType === 'attributes'
          ? data.videoGroupingAttributeIds
          : undefined,
      },
    })
  } catch (error) {
    console.error('Rust sync (update) failed:', error)
    return { success: false, error: formatThrownError(error, 'Falha ao sincronizar com backend') }
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
      measurementTableId: data.measurementTableId ?? null,
      basePrice: validation.data.basePrice,
      cost: validation.data.cost ?? null,
      isActive: validation.data.isActive,
      isFeatured: validation.data.isFeatured,
      categoryId: validation.data.categoryId ?? '',
      categoryIds: data.categoryIds,
      tags: validation.data.tags,
      meta: data.meta,
      images: validation.data.images,
      sizes: validation.data.sizes,
      colors: validation.data.colors,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

export async function deleteProductAction(id: string): Promise<ApiResponse<void>> {
  const session = await getSession()
  if (!(await hasProductPermission('products.delete'))) {
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
    return { success: false, error: formatThrownError(error, 'Falha ao sincronizar com backend') }
  }

  revalidatePath('/products')
  revalidatePath('/app/products')

  return { success: true }
}

export async function bulkUpdateProductsAction(
  payload: BulkUpdateProductsPayload,
): Promise<ApiResponse<BulkUpdateProductsResponse>> {
  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  if (!(await hasProductPermission('products.edit'))) {
    return { success: false, error: 'Não autorizado' }
  }

  if (!Array.isArray(payload.product_ids) || payload.product_ids.length === 0) {
    return { success: false, error: 'product_ids é obrigatório' }
  }

  const cookieHeader = await buildAdminCookieHeader()
  if (!cookieHeader) {
    return { success: false, error: 'admin auth token inválido ou ausente' }
  }

  const adminAuthToken = cookieHeader.replace(/^adminAuthToken=/, '')

  try {
    const response = await fetch(new URL('/products/bulk-update', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
        Authorization: `Bearer ${adminAuthToken}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const rawText = await response.text()
    let result: BulkUpdateProductsResponse | null = null
    if (rawText.trim()) {
      try {
        result = JSON.parse(rawText) as BulkUpdateProductsResponse
      } catch {
        result = { message: rawText }
      }
    }

    if (!response.ok) {
      const message = result?.message || rawText || 'Falha ao aplicar atualização em lote'
      return { success: false, error: message }
    }

    revalidatePath('/products')
    revalidatePath('/app/products')

    return {
      success: true,
      data: result || {},
    }
  } catch (error) {
    return { success: false, error: formatThrownError(error, 'Falha ao aplicar atualização em lote') }
  }
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
    return { success: false, error: formatProductValidationError(validation.error) }
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

    let adminToken: string | undefined
    try {
      const cookieStore = await cookies()
      adminToken = cookieStore.get('adminAuthToken')?.value
    } catch {
      adminToken = undefined
    }

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
    const categories: Category[] = (Array.isArray(payload) ? payload : [])
      .filter((category) => Number.isInteger(category.id) && Number(category.id) > 0)
      .map((category) => ({
        id: String(category.id),
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
    const isHangingPrerender =
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      (error as { digest?: string }).digest === 'HANGING_PROMISE_REJECTION'

    if (!isHangingPrerender) {
      console.error('Error in getCategoriesAction:', error)
    }

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
    url.searchParams.set('include_unavailable', 'true')
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
