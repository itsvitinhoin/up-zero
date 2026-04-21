'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getSession, canManageProducts, getAdminStoreIdFromToken } from '@/lib/auth'
import type { Asset } from '@/lib/types'

type AssetMetaInput = {
  disabledVariantGroups?: string[]
  highlightedVariantGroups?: string[]
}

export type AssetSkuGroupInput = {
  sku: string
  productVariantId?: number | null
  combinationKey: string | null
  attributeValueIds: number[]
  images: string[]
}

type VariantResolutionResult = {
  byAttributeKey: Map<string, number>
  activeVariants: Array<{ id: number; attributeValueIds: number[] }>
  singleVariantId: number | null
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

async function isAuthorized(): Promise<boolean> {
  const session = await getSession()
  if (session && canManageProducts(session.role)) {
    return true
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  return Boolean(adminToken)
}

async function getStoreIdFromEnv(): Promise<number | null> {
  const adminStoreId = await getAdminStoreIdFromToken()
  if (adminStoreId) return adminStoreId

  const rawStoreId = process.env.STORE_ID
  if (!rawStoreId) return null

  const parsed = Number(rawStoreId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function resolveNumericCategoryIds(categoryId: string | null, categoryIds: string[] = []): number[] {
  const fromArray = Array.from(
    new Set(
      (Array.isArray(categoryIds) ? categoryIds : [])
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  )

  if (fromArray.length > 0) {
    return fromArray
  }

  const fallback = Number.parseInt(String(categoryId || ''), 10)
  if (Number.isInteger(fallback) && fallback > 0) {
    return [fallback]
  }

  return []
}

function normalizeGroups(groups: AssetSkuGroupInput[]): AssetSkuGroupInput[] {
  const normalized = groups
    .map((group) => {
      const sku = String(group?.sku || '').trim().toUpperCase()
      const productVariantId = Number.isInteger(Number(group?.productVariantId)) && Number(group?.productVariantId) > 0
        ? Number(group.productVariantId)
        : null
      const images = Array.isArray(group?.images)
        ? group.images
            .filter((image): image is string => typeof image === 'string')
            .map((image) => image.trim())
            .filter((image) => image.length > 0)
        : []
      const attributeValueIds = Array.isArray(group?.attributeValueIds)
        ? group.attributeValueIds
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
            .sort((a, b) => a - b)
        : []

      const combinationKey = attributeValueIds.length > 0 ? attributeValueIds.join(',') : null

      return {
        sku,
        productVariantId,
        combinationKey,
        attributeValueIds,
        images,
      }
    })
    .filter((group) => group.sku.length > 0 && group.images.length > 0)

  const deduped = new Map<string, AssetSkuGroupInput>()
  for (const group of normalized) {
    const dedupeKey = `${group.combinationKey || 'no-combination'}::${group.sku}`
    deduped.set(dedupeKey, group)
  }

  return Array.from(deduped.values())
}

function groupKeyFromAttributeValueIds(attributeValueIds: number[]): string {
  return [...attributeValueIds]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b)
    .join(',')
}

async function resolveVariantIdsByProduct(
  base: string,
  productId: number,
  adminToken?: string,
): Promise<VariantResolutionResult> {
  const response = await fetch(new URL(`/products/${productId}/full`, base), {
    method: 'GET',
    headers: {
      ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Não foi possível carregar variantes do produto para resolver product_variant_id')
  }

  const payload = await response.json()
  const variantsRaw = Array.isArray(payload?.variants)
    ? payload.variants
    : Array.isArray(payload?.data?.variants)
      ? payload.data.variants
      : []

  const byAttributeKey = new Map<string, number>()
  const activeVariants: Array<{ id: number; attributeValueIds: number[] }> = []
  const allVariantIds = new Set<number>()

  for (const entry of variantsRaw) {
    const variantNode = entry?.variant ?? entry
    const variantId = Number(variantNode?.id)
    if (!Number.isInteger(variantId) || variantId <= 0) continue

    const isActive = variantNode?.active !== false
    if (!isActive) continue

    allVariantIds.add(variantId)

    const attrsRaw = Array.isArray(entry?.attribute_values)
      ? entry.attribute_values
      : Array.isArray(variantNode?.attribute_values)
        ? variantNode.attribute_values
        : []

    const attributeValueIds = attrsRaw
      .map((attr: any) => Number(
        attr?.value_id
          ?? attr?.attribute_value_id
          ?? attr?.valueId
          ?? attr?.attributeValueId
          ?? attr?.id,
      ))
      .filter((value: number) => Number.isInteger(value) && value > 0)

    const key = groupKeyFromAttributeValueIds(attributeValueIds)
    if (!key) continue

    if (!byAttributeKey.has(key)) {
      byAttributeKey.set(key, variantId)
    }

    activeVariants.push({
      id: variantId,
      attributeValueIds,
    })
  }

  const singleVariantId = allVariantIds.size === 1 ? Array.from(allVariantIds)[0] : null

  return {
    byAttributeKey,
    activeVariants,
    singleVariantId,
  }
}

function resolveVariantIdForGroup(
  group: AssetSkuGroupInput,
  resolution: VariantResolutionResult,
): number | null {
  const explicitVariantId = Number(group?.productVariantId)
  if (Number.isInteger(explicitVariantId) && explicitVariantId > 0) {
    return explicitVariantId
  }

  const groupIds = [...(group.attributeValueIds || [])]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b)

  if (groupIds.length === 0) {
    if (resolution.singleVariantId) {
      return resolution.singleVariantId
    }

    return null
  }

  const exactKey = groupKeyFromAttributeValueIds(groupIds)
  const exactVariantId = resolution.byAttributeKey.get(exactKey)
  if (exactVariantId) {
    return exactVariantId
  }

  const groupSet = new Set(groupIds)
  const subsetMatches = resolution.activeVariants
    .filter((variant) => {
      const variantSet = new Set(variant.attributeValueIds)
      for (const groupId of groupSet) {
        if (!variantSet.has(groupId)) return false
      }
      return true
    })
    .sort((left, right) => {
      const leftExtra = left.attributeValueIds.length - groupIds.length
      const rightExtra = right.attributeValueIds.length - groupIds.length

      if (leftExtra !== rightExtra) {
        return leftExtra - rightExtra
      }

      return left.id - right.id
    })

  return subsetMatches.length > 0 ? subsetMatches[0].id : null
}

function buildExpandedGroupsWithVariantIds(
  groups: AssetSkuGroupInput[],
  resolution: VariantResolutionResult,
): Array<AssetSkuGroupInput & { productVariantId: number }> {
  const assigned = new Map<number, AssetSkuGroupInput>()

  for (const group of groups) {
    const resolvedVariantId = resolveVariantIdForGroup(group, resolution)
    if (!resolvedVariantId) {
      throw new Error(`Não foi possível resolver a variante para o grupo ${group.sku}`)
    }

    if (assigned.has(resolvedVariantId)) {
      throw new Error(`Duplicidade de variante resolvida para o grupo ${group.sku}`)
    }

    assigned.set(resolvedVariantId, group)
  }

  return Array.from(assigned.entries()).map(([variantId, group]) => ({
    ...group,
    productVariantId: variantId,
  }))
}

function normalizeImageGroupingRule(input: SubmittedImageGroupingRule | null | undefined): SubmittedImageGroupingRule {
  const type = input?.type
  if (type === 'attributes') {
    const attributeIds = Array.isArray(input?.attribute_ids)
      ? input.attribute_ids
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      : []

    if (attributeIds.length === 0) {
      return { type: 'product' }
    }

    return {
      type: 'attributes',
      attribute_ids: Array.from(new Set(attributeIds)),
    }
  }

  if (type === 'full_sku') {
    return { type: 'full_sku' }
  }

  return { type: 'product' }
}

function parseBackendImageGroupingRule(raw: unknown): SubmittedImageGroupingRule {
  if (!raw) return { type: 'product' }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return normalizeImageGroupingRule(parsed)
    } catch {
      return { type: 'product' }
    }
  }

  if (typeof raw === 'object') {
    return normalizeImageGroupingRule(raw as SubmittedImageGroupingRule)
  }

  return { type: 'product' }
}

function normalizeAssetMeta(input: AssetMetaInput | null | undefined): AssetMetaInput {
  const disabledVariantGroups = Array.isArray(input?.disabledVariantGroups)
    ? Array.from(
        new Set(
          input.disabledVariantGroups
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        ),
      )
    : []

  const highlightedVariantGroups = Array.isArray(input?.highlightedVariantGroups)
    ? Array.from(
        new Set(
          input.highlightedVariantGroups
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        ),
      )
    : []

  return {
    disabledVariantGroups,
    highlightedVariantGroups,
  }
}

function mapBackendAsset(item: any): Asset {
  const imageGroupingRule = parseBackendImageGroupingRule(item?.image_grouping_rule ?? item?.imageGroupingRule)

  const skuGroupsRaw = Array.isArray(item?.sku_groups)
    ? item.sku_groups
    : Array.isArray(item?.groups)
      ? item.groups
      : []

  const skuGroups = skuGroupsRaw
    .map((group: any) => {
      const images = Array.isArray(group?.images)
        ? group.images
            .map((img: any) => (typeof img === 'string' ? img : img?.image_url))
            .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
        : []

      const attributeValueIds = Array.isArray(group?.attribute_value_ids)
        ? group.attribute_value_ids
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isInteger(value) && value > 0)
        : Array.isArray(group?.attributeValueIds)
          ? group.attributeValueIds
              .map((value: unknown) => Number(value))
              .filter((value: number) => Number.isInteger(value) && value > 0)
          : []

      const combinationKey =
        typeof group?.combination_key === 'string'
          ? group.combination_key
          : typeof group?.combinationKey === 'string'
            ? group.combinationKey
            : (attributeValueIds.length > 0 ? attributeValueIds.join(',') : null)

      const productVariantIdRaw =
        group?.product_variant_id
        ?? group?.productVariantId
        ?? null
      const productVariantId = Number(productVariantIdRaw)

      return {
        sku: String(group?.sku || '').trim(),
        productVariantId: Number.isInteger(productVariantId) && productVariantId > 0 ? productVariantId : null,
        combinationKey,
        attributeValueIds,
        images,
      }
    })
    .filter((group: any) => group.sku.length > 0)

  return {
    id: String(item?.id || ''),
    productId: String(item?.product_id || item?.productId || ''),
    slug: typeof item?.slug === 'string' ? item.slug : undefined,
    productName: item?.product_name || item?.productName || undefined,
    code: String(item?.code || ''),
    title: item?.title ?? null,
    categoryIds: Array.isArray(item?.category_ids)
      ? item.category_ids
          .map((value: unknown) => String(value))
          .filter((value: string) => value.length > 0)
      : [],
    meta: normalizeAssetMeta(item?.meta),
    imageGroupingRule,
    skuGroups,
    createdAt: item?.created_at || item?.createdAt || new Date().toISOString(),
  }
}

export async function getAssetsAction(
  params?: { page?: number; limit?: number },
): Promise<{
  success: boolean
  data?: Asset[]
  total?: number
  page?: number
  limit?: number
  error?: string
}> {
  try {
    if (!(await isAuthorized())) {
      return { success: false, error: 'Não autorizado' }
    }

    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const storeId = await getStoreIdFromEnv()

    const url = new URL('/assets', base)
    if (storeId) {
      url.searchParams.set('store_id', String(storeId))
    }
    const page = Number.isFinite(params?.page) ? Math.max(1, Number(params?.page)) : 1
    const limit = Number.isFinite(params?.limit) ? Math.max(1, Number(params?.limit)) : 25
    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(limit))

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao buscar obras' }
    }

    const payload = await response.json()
    const rawItems = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []
    const assets = rawItems.map(mapBackendAsset)
    const total = typeof payload?.total === 'number' ? payload.total : assets.length
    const currentPage = typeof payload?.page === 'number' ? payload.page : page
    const currentLimit = typeof payload?.limit === 'number' ? payload.limit : limit

    return { success: true, data: assets, total, page: currentPage, limit: currentLimit }
  } catch (error) {
    console.error('Erro ao buscar assets:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao buscar obras' }
  }
}

export async function getAssetsSummaryAction(): Promise<{
  success: boolean
  data?: { assets: number; skus: number; images: number }
  error?: string
}> {
  try {
    if (!(await isAuthorized())) {
      return { success: false, error: 'Não autorizado' }
    }

    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const storeId = await getStoreIdFromEnv()

    const url = new URL('/assets/summary', base)
    if (storeId) {
      url.searchParams.set('store_id', String(storeId))
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao buscar resumo de obras' }
    }

    const payload = await response.json()
    return {
      success: true,
      data: {
        assets: Number(payload?.assets || 0),
        skus: Number(payload?.skus || 0),
        images: Number(payload?.images || 0),
      },
    }
  } catch (error) {
    console.error('Erro ao buscar resumo de assets:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao buscar resumo de obras' }
  }
}

export async function createAssetAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await isAuthorized())) {
      return { success: false, error: 'Não autorizado' }
    }

    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const productId = Number(getFormField(formData, 'productId'))
    const code = String(getFormField(formData, 'code') || '').trim().toUpperCase()
    const titleRaw = String(getFormField(formData, 'title') || '').trim()
    const title = titleRaw.length > 0 ? titleRaw : null
    const categoryId = getFormField(formData, 'categoryId')
    const categoryIds = getFormJson<string[]>(formData, 'categoryIds', [])
    const numericCategoryIds = resolveNumericCategoryIds(categoryId, categoryIds)
    const groups = normalizeGroups(getFormJson<AssetSkuGroupInput[]>(formData, 'groups', []))
    const meta = normalizeAssetMeta(getFormJson<AssetMetaInput | null>(formData, 'meta', null))
    const imageGroupingRule = normalizeImageGroupingRule(
      getFormJson<SubmittedImageGroupingRule | null>(formData, 'imageGroupingRule', null),
    )

    if (!Number.isInteger(productId) || productId <= 0) {
      return { success: false, error: 'Produto é obrigatório' }
    }

    if (!code) {
      return { success: false, error: 'Código da obra é obrigatório' }
    }

    if (groups.length === 0) {
      return { success: false, error: 'Adicione ao menos um SKU com imagens' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const variantResolution = await resolveVariantIdsByProduct(base, productId, adminToken)

    const groupsWithVariantIds = buildExpandedGroupsWithVariantIds(groups, variantResolution)

    const response = await fetch(new URL('/assets', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({
        product_id: productId,
        code,
        title,
        category_ids: numericCategoryIds,
        meta,
        image_grouping_rule: imageGroupingRule,
        sku_groups: groupsWithVariantIds.map((group) => ({
          sku: group.sku,
          product_variant_id: group.productVariantId,
          images: group.images.map((imageUrl, index) => ({
            image_url: imageUrl,
            sort_order: index,
          })),
        })),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      if (response.status === 404) {
        return { success: false, error: 'Endpoint /assets não encontrado no backend Rust. Implemente as rotas de assets antes de salvar.' }
      }
      return { success: false, error: errorText || 'Erro ao criar obra' }
    }

    revalidatePath('/assets')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar asset:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao criar obra' }
  }
}

export async function updateAssetAction(assetId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await isAuthorized())) {
      return { success: false, error: 'Não autorizado' }
    }

    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericAssetId = Number(assetId)
    if (!Number.isInteger(numericAssetId) || numericAssetId <= 0) {
      return { success: false, error: 'Asset inválida' }
    }

    const productId = Number(getFormField(formData, 'productId'))
    const code = String(getFormField(formData, 'code') || '').trim().toUpperCase()
    const titleRaw = String(getFormField(formData, 'title') || '').trim()
    const title = titleRaw.length > 0 ? titleRaw : null
    const categoryId = getFormField(formData, 'categoryId')
    const categoryIds = getFormJson<string[]>(formData, 'categoryIds', [])
    const numericCategoryIds = resolveNumericCategoryIds(categoryId, categoryIds)
    const groups = normalizeGroups(getFormJson<AssetSkuGroupInput[]>(formData, 'groups', []))
    const meta = normalizeAssetMeta(getFormJson<AssetMetaInput | null>(formData, 'meta', null))
    const imageGroupingRule = normalizeImageGroupingRule(
      getFormJson<SubmittedImageGroupingRule | null>(formData, 'imageGroupingRule', null),
    )

    if (!Number.isInteger(productId) || productId <= 0) {
      return { success: false, error: 'Produto é obrigatório' }
    }

    if (!code) {
      return { success: false, error: 'Código da obra é obrigatório' }
    }

    if (groups.length === 0) {
      return { success: false, error: 'Adicione ao menos um SKU com imagens' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const variantResolution = await resolveVariantIdsByProduct(base, productId, adminToken)

    const groupsWithVariantIds = buildExpandedGroupsWithVariantIds(groups, variantResolution)

    const response = await fetch(new URL(`/assets/${numericAssetId}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({
        product_id: productId,
        code,
        title,
        category_ids: numericCategoryIds,
        meta,
        image_grouping_rule: imageGroupingRule,
        sku_groups: groupsWithVariantIds.map((group) => ({
          sku: group.sku,
          product_variant_id: group.productVariantId,
          images: group.images.map((imageUrl, index) => ({
            image_url: imageUrl,
            sort_order: index,
          })),
        })),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      if (response.status === 404) {
        return { success: false, error: 'Endpoint /assets não encontrado no backend Rust. Implemente as rotas de assets antes de salvar.' }
      }
      return { success: false, error: errorText || 'Erro ao atualizar obra' }
    }

    revalidatePath('/assets')
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar asset:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar obra' }
  }
}

export async function deleteAssetAction(assetId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await isAuthorized())) {
      return { success: false, error: 'Não autorizado' }
    }

    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericAssetId = Number(assetId)
    if (!Number.isInteger(numericAssetId) || numericAssetId <= 0) {
      return { success: false, error: 'Asset inválida' }
    }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(new URL(`/assets/${numericAssetId}`, base), {
      method: 'DELETE',
      headers: {
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao excluir obra' }
    }

    revalidatePath('/assets')
    return { success: true }
  } catch (error) {
    console.error('Erro ao excluir asset:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao excluir obra' }
  }
}
