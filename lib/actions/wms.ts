'use server'

import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { checkUserPermission } from '@/lib/actions/permissions'

const RUST_URL = (process.env.NEXT_PUBLIC_RUST_URL || process.env.RUST_URL || 'http://localhost:8080').replace(/\/$/, '')

export interface WmsWarehouse {
  id: number
  store_id: number
  code: string
  name: string
  active: boolean
  meta: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export interface WmsLocation {
  id: number
  store_id: number
  warehouse_id: number
  code: string
  type: string
  priority: number
  active: boolean
  created_at?: string
  updated_at?: string
}

export interface WmsInventoryPosition {
  id: number
  store_id: number
  product_variant_id: number
  variant_sku?: string
  product_name?: string
  warehouse_id: number
  location_id: number
  preferred_sellable_location_id?: number
  batch_id: number | null
  lot_code?: string
  expires_at?: string
  unit_cost_cents?: number
  qty_total: string | number
  qty_reserved: string | number
  qty_available?: string | number
  created_at?: string
  updated_at?: string
}

export interface WmsPositionsPage {
  items: WmsInventoryPosition[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface WmsConsolidatedLocation {
  location_id: number
  location_code?: string
  location_type?: string
  warehouse_id: number
  warehouse_code?: string
  warehouse_name?: string
  qty_total: string | number
  qty_reserved: string | number
  qty_available: string | number
}

export interface WmsConsolidatedPosition {
  product_variant_id: number
  variant_sku?: string
  product_name?: string
  qty_total: string | number
  qty_reserved: string | number
  qty_available: string | number
  locations_count: number
  lots_count: number
  last_movement_at?: string
  location_breakdown: WmsConsolidatedLocation[]
}

export interface WmsConsolidatedPositionsPage {
  items: WmsConsolidatedPosition[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ReceiveInventoryItemInput {
  product_variant_id: number
  quantity: number
  lot_code?: string
  expires_at?: string
  unit_cost_cents?: number
}

export interface ReceiveInventoryResult {
  warehouse_id: number
  location_id: number
  items_received: number
  reference?: string
}

export interface MoveInventoryResult {
  warehouse_id: number
  from_location_id: number
  to_location_id: number
  product_variant_id: number
  quantity_moved: string | number
  reference?: string
}

export interface UpdateInventoryBatchResult {
  id: number
  store_id: number
  product_variant_id: number
  lot_code: string
  expires_at?: string
  unit_cost_cents: number
  updated_at?: string
}

export interface WmsReceiptHistory {
  id: number
  store_id: number
  product_variant_id: number
  variant_sku?: string
  product_name?: string
  warehouse_id: number
  warehouse_code: string
  warehouse_name: string
  location_id: number
  location_code: string
  qty: string | number
  unit_cost_snapshot?: string | number
  lot_code?: string
  expires_at?: string
  reference?: string
  occurred_at?: string
}

export interface WmsInventoryMovement {
  id: number
  store_id: number
  product_variant_id: number
  variant_sku?: string
  product_name?: string
  warehouse_id: number
  warehouse_code: string
  warehouse_name: string
  location_id: number
  location_code: string
  movement_type: string
  qty: string | number
  reference_type?: string
  reference_id?: string
  created_by?: number
  note?: string
  occurred_at?: string
}

export interface WmsInventoryMovementsPage {
  items: WmsInventoryMovement[]
  limit: number
  hasMore: boolean
  nextCursor?: string
}

type Result<T> = { success: true; data: T } | { success: false; error: string }

async function hasInventoryPermission(permissionCode: string): Promise<boolean> {
  try {
    const result = await checkUserPermission(permissionCode)
    return result?.has_permission === true
  } catch {
    return false
  }
}

async function ensureInventoryPermission(permissionCode: string, error: string): Promise<Result<null> | null> {
  if (await hasInventoryPermission(permissionCode)) return null
  return { success: false, error }
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeDateLikeToIso(value?: string): string | undefined {
  const v = value?.trim()
  if (!v) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return `${v}T00:00:00Z`
  }
  return v
}

function normalizeWarehouse(raw: unknown): WmsWarehouse {
  const r = (raw || {}) as Record<string, unknown>
  const meta = (r.meta && typeof r.meta === 'object') ? (r.meta as Record<string, unknown>) : {}
  return {
    id: asNumber(r.id),
    store_id: asNumber(r.store_id),
    code: asString(r.code),
    name: asString(r.name),
    active: asBool(r.active, true),
    meta,
    created_at: typeof r.created_at === 'string' ? r.created_at : undefined,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  }
}

function normalizeLocation(raw: unknown): WmsLocation {
  const r = (raw || {}) as Record<string, unknown>
  return {
    id: asNumber(r.id),
    store_id: asNumber(r.store_id),
    warehouse_id: asNumber(r.warehouse_id),
    code: asString(r.code),
    type: asString(r.type),
    priority: asNumber(r.priority, 100),
    active: asBool(r.active, true),
    created_at: typeof r.created_at === 'string' ? r.created_at : undefined,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  }
}

function normalizePosition(raw: unknown): WmsInventoryPosition {
  const r = (raw || {}) as Record<string, unknown>
  return {
    id: asNumber(r.id),
    store_id: asNumber(r.store_id),
    product_variant_id: asNumber(r.product_variant_id),
    variant_sku: typeof r.variant_sku === 'string' ? r.variant_sku : undefined,
    product_name: typeof r.product_name === 'string' ? r.product_name : undefined,
    warehouse_id: asNumber(r.warehouse_id),
    location_id: asNumber(r.location_id),
    preferred_sellable_location_id: typeof r.preferred_sellable_location_id === 'number' ? r.preferred_sellable_location_id : undefined,
    batch_id: r.batch_id == null ? null : asNumber(r.batch_id),
    lot_code: typeof r.lot_code === 'string' ? r.lot_code : undefined,
    expires_at: typeof r.expires_at === 'string' ? r.expires_at : undefined,
    unit_cost_cents: typeof r.unit_cost_cents === 'number' ? r.unit_cost_cents : undefined,
    qty_total: (typeof r.qty_total === 'string' || typeof r.qty_total === 'number') ? r.qty_total : 0,
    qty_reserved: (typeof r.qty_reserved === 'string' || typeof r.qty_reserved === 'number') ? r.qty_reserved : 0,
    qty_available: (typeof r.qty_available === 'string' || typeof r.qty_available === 'number') ? r.qty_available : undefined,
    created_at: typeof r.created_at === 'string' ? r.created_at : undefined,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  }
}

function normalizeConsolidatedPosition(raw: unknown): WmsConsolidatedPosition {
  const r = (raw || {}) as Record<string, unknown>
  const rawBreakdown = Array.isArray(r.location_breakdown) ? r.location_breakdown : []

  const breakdown: WmsConsolidatedLocation[] = rawBreakdown.map((entry) => {
    const e = (entry || {}) as Record<string, unknown>
    return {
      location_id: asNumber(e.location_id),
      location_code: typeof e.location_code === 'string' ? e.location_code : undefined,
      location_type: typeof e.location_type === 'string' ? e.location_type : undefined,
      warehouse_id: asNumber(e.warehouse_id),
      warehouse_code: typeof e.warehouse_code === 'string' ? e.warehouse_code : undefined,
      warehouse_name: typeof e.warehouse_name === 'string' ? e.warehouse_name : undefined,
      qty_total: (typeof e.qty_total === 'string' || typeof e.qty_total === 'number') ? e.qty_total : 0,
      qty_reserved: (typeof e.qty_reserved === 'string' || typeof e.qty_reserved === 'number') ? e.qty_reserved : 0,
      qty_available: (typeof e.qty_available === 'string' || typeof e.qty_available === 'number') ? e.qty_available : 0,
    }
  })

  return {
    product_variant_id: asNumber(r.product_variant_id),
    variant_sku: typeof r.variant_sku === 'string' ? r.variant_sku : undefined,
    product_name: typeof r.product_name === 'string' ? r.product_name : undefined,
    qty_total: (typeof r.qty_total === 'string' || typeof r.qty_total === 'number') ? r.qty_total : 0,
    qty_reserved: (typeof r.qty_reserved === 'string' || typeof r.qty_reserved === 'number') ? r.qty_reserved : 0,
    qty_available: (typeof r.qty_available === 'string' || typeof r.qty_available === 'number') ? r.qty_available : 0,
    locations_count: asNumber(r.locations_count),
    lots_count: asNumber(r.lots_count),
    last_movement_at: typeof r.last_movement_at === 'string' ? r.last_movement_at : undefined,
    location_breakdown: breakdown,
  }
}

function normalizeBatchUpdate(raw: unknown): UpdateInventoryBatchResult {
  const r = (raw || {}) as Record<string, unknown>
  return {
    id: asNumber(r.id),
    store_id: asNumber(r.store_id),
    product_variant_id: asNumber(r.product_variant_id),
    lot_code: asString(r.lot_code),
    expires_at: typeof r.expires_at === 'string' ? r.expires_at : undefined,
    unit_cost_cents: asNumber(r.unit_cost_cents),
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  }
}

function normalizeReceipt(raw: unknown): WmsReceiptHistory {
  const r = (raw || {}) as Record<string, unknown>
  return {
    id: asNumber(r.id),
    store_id: asNumber(r.store_id),
    product_variant_id: asNumber(r.product_variant_id),
    variant_sku: typeof r.variant_sku === 'string' ? r.variant_sku : undefined,
    product_name: typeof r.product_name === 'string' ? r.product_name : undefined,
    warehouse_id: asNumber(r.warehouse_id),
    warehouse_code: asString(r.warehouse_code),
    warehouse_name: asString(r.warehouse_name),
    location_id: asNumber(r.location_id),
    location_code: asString(r.location_code),
    qty: (typeof r.qty === 'string' || typeof r.qty === 'number') ? r.qty : 0,
    unit_cost_snapshot: (typeof r.unit_cost_snapshot === 'string' || typeof r.unit_cost_snapshot === 'number') ? r.unit_cost_snapshot : undefined,
    lot_code: typeof r.lot_code === 'string' ? r.lot_code : undefined,
    expires_at: typeof r.expires_at === 'string' ? r.expires_at : undefined,
    reference: typeof r.reference === 'string' ? r.reference : undefined,
    occurred_at: typeof r.occurred_at === 'string' ? r.occurred_at : undefined,
  }
}

function normalizeMovement(raw: unknown): WmsInventoryMovement {
  const r = (raw || {}) as Record<string, unknown>
  return {
    id: asNumber(r.id),
    store_id: asNumber(r.store_id),
    product_variant_id: asNumber(r.product_variant_id),
    variant_sku: typeof r.variant_sku === 'string' ? r.variant_sku : undefined,
    product_name: typeof r.product_name === 'string' ? r.product_name : undefined,
    warehouse_id: asNumber(r.warehouse_id),
    warehouse_code: asString(r.warehouse_code),
    warehouse_name: asString(r.warehouse_name),
    location_id: asNumber(r.location_id),
    location_code: asString(r.location_code),
    movement_type: asString(r.movement_type),
    qty: (typeof r.qty === 'string' || typeof r.qty === 'number') ? r.qty : 0,
    reference_type: typeof r.reference_type === 'string' ? r.reference_type : undefined,
    reference_id: typeof r.reference_id === 'string' ? r.reference_id : undefined,
    created_by: Number.isFinite(Number(r.created_by)) ? Number(r.created_by) : undefined,
    note: typeof r.note === 'string' ? r.note : undefined,
    occurred_at: typeof r.occurred_at === 'string' ? r.occurred_at : undefined,
  }
}

async function getAdminHeaders(): Promise<Result<HeadersInit>> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  if (!adminToken) {
    return { success: false, error: 'Nao autenticado' }
  }

  const storeId = await getAdminStoreIdFromToken()
  if (!storeId) {
    return { success: false, error: 'Loja do admin nao identificada' }
  }

  return {
    success: true,
    data: {
      'Content-Type': 'application/json',
      cookie: `adminAuthToken=${adminToken}`,
      'x-store-id': String(storeId),
    },
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const text = (await res.text()).trim()
    if (!text) return fallback
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string }
      if (parsed?.message) return parsed.message
      if (parsed?.error) return parsed.error
    } catch {
      return text
    }
    return text
  } catch {
    return fallback
  }
}

export async function getWmsWarehousesAction(): Promise<Result<WmsWarehouse[]>> {
  const permissionError = await ensureInventoryPermission('inventory.view', 'Você não tem permissão para visualizar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const url = `${RUST_URL}/warehouses`
    const reqHeaders = headersResult.data as Record<string, string>
    console.log('[WMS_DEBUG] getWmsWarehousesAction -> request', {
      url,
      rustUrl: RUST_URL,
      storeId: reqHeaders['x-store-id'] || null,
      hasCookie: Boolean(reqHeaders.cookie),
    })

    const res = await fetch(url, { headers: headersResult.data, cache: 'no-store' })
    const rawText = await res.text()

    if (!res.ok) {
      console.error('[WMS_DEBUG] getWmsWarehousesAction -> non-2xx response', {
        status: res.status,
        statusText: res.statusText,
        body: rawText,
      })
      const fallback = 'Falha ao carregar warehouses'
      if (!rawText.trim()) return { success: false, error: fallback }
      try {
        const parsed = JSON.parse(rawText) as { message?: string; error?: string }
        return { success: false, error: parsed?.message || parsed?.error || rawText }
      } catch {
        return { success: false, error: rawText }
      }
    }

    let payload: unknown
    try {
      payload = rawText ? JSON.parse(rawText) : []
    } catch (parseError) {
      console.error('[WMS_DEBUG] getWmsWarehousesAction -> JSON parse error', {
        parseError: String(parseError),
        body: rawText,
      })
      return { success: false, error: `Erro ao interpretar resposta de warehouses: ${String(parseError)}` }
    }

    const data = Array.isArray(payload) ? payload.map(normalizeWarehouse) : []
    console.log('[WMS_DEBUG] getWmsWarehousesAction -> success', { count: data.length })
    return { success: true, data }
  } catch (error) {
    console.error('[WMS_DEBUG] getWmsWarehousesAction -> fetch exception', {
      error: String(error),
    })
    return { success: false, error: String(error) }
  }
}

export async function createWmsWarehouseAction(input: {
  code: string
  name: string
  active?: boolean
  meta?: Record<string, unknown>
}): Promise<Result<WmsWarehouse>> {
  const permissionError = await ensureInventoryPermission('inventory.edit', 'Você não tem permissão para editar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const res = await fetch(`${RUST_URL}/warehouses`, {
      method: 'POST',
      headers: headersResult.data,
      body: JSON.stringify({
        code: input.code,
        name: input.name,
        active: input.active ?? true,
        meta: input.meta ?? {},
      }),
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao criar warehouse') }
    return { success: true, data: normalizeWarehouse(await res.json()) }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function updateWmsWarehouseAction(
  id: number,
  input: Partial<{ code: string; name: string; active: boolean; meta: Record<string, unknown> }>,
): Promise<Result<WmsWarehouse>> {
  const permissionError = await ensureInventoryPermission('inventory.edit', 'Você não tem permissão para editar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const res = await fetch(`${RUST_URL}/warehouses/${id}`, {
      method: 'PUT',
      headers: headersResult.data,
      body: JSON.stringify(input),
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao atualizar warehouse') }
    return { success: true, data: normalizeWarehouse(await res.json()) }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function deleteWmsWarehouseAction(id: number): Promise<Result<null>> {
  const permissionError = await ensureInventoryPermission('inventory.edit', 'Você não tem permissão para editar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const res = await fetch(`${RUST_URL}/warehouses/${id}`, {
      method: 'DELETE',
      headers: headersResult.data,
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao remover warehouse') }
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function getWmsLocationsAction(): Promise<Result<WmsLocation[]>> {
  const permissionError = await ensureInventoryPermission('inventory.view', 'Você não tem permissão para visualizar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const res = await fetch(`${RUST_URL}/warehouse-locations`, { headers: headersResult.data, cache: 'no-store' })
    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao carregar localizacoes') }
    const payload = await res.json()
    const data = Array.isArray(payload) ? payload.map(normalizeLocation) : []
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function createWmsLocationAction(input: {
  warehouse_id: number
  code: string
  type: string
  priority?: number
  active?: boolean
}): Promise<Result<WmsLocation>> {
  const permissionError = await ensureInventoryPermission('inventory.edit', 'Você não tem permissão para editar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const res = await fetch(`${RUST_URL}/warehouse-locations`, {
      method: 'POST',
      headers: headersResult.data,
      body: JSON.stringify({
        warehouse_id: input.warehouse_id,
        code: input.code,
        type: input.type,
        priority: input.priority ?? 100,
        active: input.active ?? true,
      }),
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao criar localizacao') }
    return { success: true, data: normalizeLocation(await res.json()) }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function updateWmsLocationAction(
  id: number,
  input: Partial<{ code: string; type: string; priority: number; active: boolean }>,
): Promise<Result<WmsLocation>> {
  const permissionError = await ensureInventoryPermission('inventory.edit', 'Você não tem permissão para editar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const res = await fetch(`${RUST_URL}/warehouse-locations/${id}`, {
      method: 'PUT',
      headers: headersResult.data,
      body: JSON.stringify(input),
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao atualizar localizacao') }
    return { success: true, data: normalizeLocation(await res.json()) }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function deleteWmsLocationAction(id: number): Promise<Result<null>> {
  const permissionError = await ensureInventoryPermission('inventory.edit', 'Você não tem permissão para editar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const res = await fetch(`${RUST_URL}/warehouse-locations/${id}`, {
      method: 'DELETE',
      headers: headersResult.data,
    })
    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao remover localizacao') }
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function getWmsPositionsAction(filters?: {
  warehouseId?: number
  locationId?: number
  variantId?: number
  availableOnly?: boolean
  limit?: number
  offset?: number
}): Promise<Result<WmsInventoryPosition[]>> {
  // Keep explicit pagination behavior when caller passes limit/offset.
  if ((filters?.limit && filters.limit > 0) || typeof filters?.offset === 'number') {
    const pageResult = await getWmsPositionsPageAction(filters)
    if (!pageResult.success) return pageResult
    return { success: true, data: pageResult.data.items }
  }

  const pageSize = 100
  let offset = 0
  const items: WmsInventoryPosition[] = []

  while (true) {
    const pageResult = await getWmsPositionsPageAction({
      ...filters,
      limit: pageSize,
      offset,
    })
    if (!pageResult.success) return pageResult

    items.push(...pageResult.data.items)

    if (!pageResult.data.hasMore || pageResult.data.items.length === 0) {
      break
    }

    offset += pageResult.data.items.length
  }

  return { success: true, data: items }
}

export async function getWmsPositionsPageAction(filters?: {
  warehouseId?: number
  locationId?: number
  variantId?: number
  availableOnly?: boolean
  limit?: number
  offset?: number
}): Promise<Result<WmsPositionsPage>> {
  const permissionError = await ensureInventoryPermission('inventory.view', 'Você não tem permissão para visualizar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const params = new URLSearchParams()
    if (filters?.warehouseId) params.set('warehouse_id', String(filters.warehouseId))
    if (filters?.locationId) params.set('location_id', String(filters.locationId))
    if (filters?.variantId) params.set('product_variant_id', String(filters.variantId))
    if (filters?.availableOnly) params.set('available_only', 'true')
    if (filters?.limit && filters.limit > 0) params.set('limit', String(filters.limit))
    if (typeof filters?.offset === 'number' && filters.offset >= 0) params.set('offset', String(filters.offset))

    const query = params.toString()
    const res = await fetch(`${RUST_URL}/inventory-positions${query ? `?${query}` : ''}`, {
      headers: headersResult.data,
      cache: 'no-store',
    })

    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao carregar posicoes') }

    const payload = await res.json()
    const data = Array.isArray(payload) ? payload.map(normalizePosition) : []

    const total = Number(res.headers.get('x-total-count') || data.length)
    const limitHeader = Number(res.headers.get('x-limit') || filters?.limit || data.length || 0)
    const offsetHeader = Number(res.headers.get('x-offset') || filters?.offset || 0)
    const hasMoreHeader = (res.headers.get('x-has-more') || '').toLowerCase()
    const hasMore = hasMoreHeader === 'true' || (offsetHeader + data.length < total)

    return {
      success: true,
      data: {
        items: data,
        total: Number.isFinite(total) ? total : data.length,
        limit: Number.isFinite(limitHeader) ? limitHeader : data.length,
        offset: Number.isFinite(offsetHeader) ? offsetHeader : 0,
        hasMore,
      },
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function getWmsConsolidatedPositionsPageAction(filters?: {
  warehouseId?: number
  locationId?: number
  variantId?: number
  search?: string
  limit?: number
  offset?: number
}): Promise<Result<WmsConsolidatedPositionsPage>> {
  const permissionError = await ensureInventoryPermission('inventory.view', 'Você não tem permissão para visualizar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const params = new URLSearchParams()
    if (filters?.warehouseId) params.set('warehouse_id', String(filters.warehouseId))
    if (filters?.locationId) params.set('location_id', String(filters.locationId))
    if (filters?.variantId) params.set('product_variant_id', String(filters.variantId))
    if (filters?.search?.trim()) params.set('q', filters.search.trim())
    if (filters?.limit && filters.limit > 0) params.set('limit', String(filters.limit))
    if (typeof filters?.offset === 'number' && filters.offset >= 0) params.set('offset', String(filters.offset))

    const query = params.toString()
    const res = await fetch(`${RUST_URL}/inventory-positions-consolidated${query ? `?${query}` : ''}`, {
      headers: headersResult.data,
      cache: 'no-store',
    })

    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao carregar posicoes consolidadas') }

    const payload = await res.json()
    const data = Array.isArray(payload) ? payload.map(normalizeConsolidatedPosition) : []

    const total = Number(res.headers.get('x-total-count') || data.length)
    const limitHeader = Number(res.headers.get('x-limit') || filters?.limit || data.length || 0)
    const offsetHeader = Number(res.headers.get('x-offset') || filters?.offset || 0)
    const hasMoreHeader = (res.headers.get('x-has-more') || '').toLowerCase()
    const hasMore = hasMoreHeader === 'true' || (offsetHeader + data.length < total)

    return {
      success: true,
      data: {
        items: data,
        total: Number.isFinite(total) ? total : data.length,
        limit: Number.isFinite(limitHeader) ? limitHeader : data.length,
        offset: Number.isFinite(offsetHeader) ? offsetHeader : 0,
        hasMore,
      },
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function getWmsReceiptsAction(filters?: {
  warehouseId?: number
  limit?: number
}): Promise<Result<WmsReceiptHistory[]>> {
  const permissionError = await ensureInventoryPermission('inventory.view', 'Você não tem permissão para visualizar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const params = new URLSearchParams()
    if (filters?.warehouseId) params.set('warehouse_id', String(filters.warehouseId))
    if (filters?.limit) params.set('limit', String(filters.limit))

    const query = params.toString()
    const url = `${RUST_URL}/inventory-receipts${query ? `?${query}` : ''}`
    console.log('[WMS_DEBUG] getWmsReceiptsAction -> request', { url })

    const res = await fetch(url, {
      headers: headersResult.data,
      cache: 'no-store',
    })

    if (!res.ok) {
      const errorText = await readError(res, 'Falha ao carregar recebimentos')
      console.error('[WMS_DEBUG] getWmsReceiptsAction -> non-2xx response', {
        url,
        status: res.status,
        statusText: res.statusText,
        error: errorText,
      })
      return { success: false, error: errorText }
    }

    const payload = await res.json()
    const data = Array.isArray(payload) ? payload.map(normalizeReceipt) : []
    console.log('[WMS_DEBUG] getWmsReceiptsAction -> success', { count: data.length })
    return { success: true, data }
  } catch (error) {
    console.error('[WMS_DEBUG] getWmsReceiptsAction -> exception', {
      error: String(error),
    })
    return { success: false, error: String(error) }
  }
}

export async function getWmsInventoryMovementsPageAction(filters?: {
  warehouseId?: number
  movementType?: string
  limit?: number
  cursorTs?: string
  cursorId?: number
}): Promise<Result<WmsInventoryMovementsPage>> {
  const permissionError = await ensureInventoryPermission('inventory.view', 'Você não tem permissão para visualizar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const params = new URLSearchParams()
    if (filters?.warehouseId) params.set('warehouse_id', String(filters.warehouseId))
    if (filters?.movementType?.trim()) params.set('movement_type', filters.movementType.trim())
    if (filters?.limit) params.set('limit', String(filters.limit))
    if (filters?.cursorTs?.trim()) params.set('cursor_ts', filters.cursorTs.trim())
    if (Number.isFinite(filters?.cursorId)) params.set('cursor_id', String(filters?.cursorId))

    const query = params.toString()
    const res = await fetch(`${RUST_URL}/inventory-movements${query ? `?${query}` : ''}`, {
      headers: headersResult.data,
      cache: 'no-store',
    })

    if (!res.ok) return { success: false, error: await readError(res, 'Falha ao carregar movimentacoes') }

    const payload = await res.json()
    const items = Array.isArray(payload) ? payload.map(normalizeMovement) : []
    const limit = Number(res.headers.get('x-limit') || filters?.limit || items.length || 0)
    const hasMore = (res.headers.get('x-has-more') || '').toLowerCase() === 'true'
    const nextCursor = res.headers.get('x-next-cursor') || undefined

    return {
      success: true,
      data: {
        items,
        limit: Number.isFinite(limit) ? limit : items.length,
        hasMore,
        nextCursor,
      },
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function getWmsInventoryMovementsAction(filters?: {
  warehouseId?: number
  movementType?: string
  limit?: number
  cursorTs?: string
  cursorId?: number
}): Promise<Result<WmsInventoryMovement[]>> {
  const pageResult = await getWmsInventoryMovementsPageAction(filters)
  if (!pageResult.success) return pageResult
  return { success: true, data: pageResult.data.items }
}

export async function receiveWmsInventoryAction(input: {
  warehouse_id: number
  reference?: string
  items: ReceiveInventoryItemInput[]
}): Promise<Result<ReceiveInventoryResult>> {
  const permissionError = await ensureInventoryPermission('inventory.manage_movements', 'Você não tem permissão para gerenciar movimentações de estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  const items = input.items
    .map((item) => ({
      product_variant_id: Number(item.product_variant_id),
      quantity: Number(item.quantity),
      lot_code: item.lot_code?.trim() || undefined,
      expires_at: normalizeDateLikeToIso(item.expires_at),
      unit_cost_cents: Number.isFinite(Number(item.unit_cost_cents)) ? Math.max(0, Math.round(Number(item.unit_cost_cents))) : 0,
    }))
    .filter((item) => Number.isFinite(item.product_variant_id) && item.product_variant_id > 0 && Number.isFinite(item.quantity) && item.quantity > 0)

  if (!Number.isFinite(input.warehouse_id) || input.warehouse_id <= 0) {
    return { success: false, error: 'Warehouse invalido' }
  }

  if (items.length === 0) {
    return { success: false, error: 'Informe ao menos um item valido' }
  }

  try {
    const url = `${RUST_URL}/warehouses/${input.warehouse_id}/receive`
    const requestBody = {
      reference: input.reference?.trim() || undefined,
      items,
    }
    console.log('[WMS_DEBUG] receiveWmsInventoryAction -> request', {
      url,
      warehouse_id: input.warehouse_id,
      items_count: items.length,
      requestBody,
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: headersResult.data,
      body: JSON.stringify(requestBody),
    })

    if (!res.ok) {
      const errorText = await readError(res, 'Falha ao receber estoque')
      console.error('[WMS_DEBUG] receiveWmsInventoryAction -> non-2xx response', {
        url,
        status: res.status,
        statusText: res.statusText,
        error: errorText,
      })
      return { success: false, error: errorText }
    }

    const payload = (await res.json()) as Partial<ReceiveInventoryResult>
    console.log('[WMS_DEBUG] receiveWmsInventoryAction -> success', {
      url,
      payload,
    })
    return {
      success: true,
      data: {
        warehouse_id: asNumber(payload.warehouse_id),
        location_id: asNumber(payload.location_id),
        items_received: asNumber(payload.items_received),
        reference: typeof payload.reference === 'string' ? payload.reference : undefined,
      },
    }
  } catch (error) {
    console.error('[WMS_DEBUG] receiveWmsInventoryAction -> exception', {
      error: String(error),
    })
    return { success: false, error: String(error) }
  }
}

export async function moveWmsInventoryAction(input: {
  warehouse_id: number
  product_variant_id: number
  from_location_id: number
  to_location_id: number
  quantity: number
  batch_id?: number | null
  reference?: string
}): Promise<Result<MoveInventoryResult>> {
  const permissionError = await ensureInventoryPermission('inventory.manage_movements', 'Você não tem permissão para gerenciar movimentações de estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  const warehouseId = Number(input.warehouse_id)
  const variantId = Number(input.product_variant_id)
  const fromLocationId = Number(input.from_location_id)
  const toLocationId = Number(input.to_location_id)
  const quantity = Number(input.quantity)

  if (!Number.isFinite(warehouseId) || warehouseId <= 0) {
    return { success: false, error: 'Warehouse invalido' }
  }
  if (!Number.isFinite(variantId) || variantId <= 0) {
    return { success: false, error: 'Variant invalido' }
  }
  if (!Number.isFinite(fromLocationId) || fromLocationId <= 0) {
    return { success: false, error: 'Localizacao de origem invalida' }
  }
  if (!Number.isFinite(toLocationId) || toLocationId <= 0) {
    return { success: false, error: 'Localizacao de destino invalida' }
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, error: 'Quantidade deve ser maior que zero' }
  }

  try {
    const res = await fetch(`${RUST_URL}/warehouses/${warehouseId}/move`, {
      method: 'POST',
      headers: headersResult.data,
      body: JSON.stringify({
        product_variant_id: variantId,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        batch_id: input.batch_id ?? undefined,
        quantity,
        reference: input.reference?.trim() || undefined,
      }),
    })

    if (!res.ok) {
      return { success: false, error: await readError(res, 'Falha ao mover estoque') }
    }

    const payload = (await res.json()) as Partial<MoveInventoryResult>
    return {
      success: true,
      data: {
        warehouse_id: asNumber(payload.warehouse_id),
        from_location_id: asNumber(payload.from_location_id),
        to_location_id: asNumber(payload.to_location_id),
        product_variant_id: asNumber(payload.product_variant_id),
        quantity_moved: (typeof payload.quantity_moved === 'string' || typeof payload.quantity_moved === 'number') ? payload.quantity_moved : 0,
        reference: typeof payload.reference === 'string' ? payload.reference : undefined,
      },
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function updateWmsInventoryBatchAction(
  batchId: number,
  input: {
    lot_code?: string
    expires_at?: string
    unit_cost_cents?: number
  }
): Promise<Result<UpdateInventoryBatchResult>> {
  const permissionError = await ensureInventoryPermission('inventory.edit', 'Você não tem permissão para editar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  if (!Number.isFinite(batchId) || batchId <= 0) {
    return { success: false, error: 'Batch ID inválido' }
  }

  if (input.unit_cost_cents != null && (!Number.isFinite(input.unit_cost_cents) || input.unit_cost_cents < 0)) {
    return { success: false, error: 'Custo unitário inválido' }
  }

  try {
    const res = await fetch(`${RUST_URL}/inventory-batches/${batchId}`, {
      method: 'PUT',
      headers: headersResult.data,
      body: JSON.stringify({
        lot_code: input.lot_code?.trim() || undefined,
        expires_at: normalizeDateLikeToIso(input.expires_at),
        unit_cost_cents: input.unit_cost_cents == null ? undefined : Math.max(0, Math.round(input.unit_cost_cents)),
      }),
    })

    if (!res.ok) {
      return { success: false, error: await readError(res, 'Falha ao atualizar lote') }
    }

    const payload = await res.json()
    return { success: true, data: normalizeBatchUpdate(payload) }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function updateWmsInventoryPositionAction(
  positionId: number,
  input: {
    qty_total: number
    note?: string
  }
): Promise<Result<WmsInventoryPosition>> {
  const permissionError = await ensureInventoryPermission('inventory.edit', 'Você não tem permissão para editar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  if (!Number.isFinite(positionId) || positionId <= 0) {
    return { success: false, error: 'Position ID inválido' }
  }

  if (!Number.isFinite(input.qty_total) || input.qty_total < 0) {
    return { success: false, error: 'Quantidade deve ser um número não-negativo' }
  }

  try {
    const res = await fetch(`${RUST_URL}/inventory-positions/${positionId}`, {
      method: 'PUT',
      headers: headersResult.data,
      body: JSON.stringify({
        qty_total: input.qty_total,
        note: input.note?.trim() || undefined,
      }),
    })

    if (!res.ok) {
      return { success: false, error: await readError(res, 'Falha ao atualizar posição') }
    }

    const payload = (await res.json()) as Partial<WmsInventoryPosition>
    const data = normalizePosition(payload)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// ── Fulfillment Queue ──────────────────────────────────────────────────────

export interface WmsFulfillmentOrder {
  id: number
  code: string | null
  status: string
  stage: 'RECEIVED' | 'PICKING' | 'CHECKING' | 'PACKING' | 'SHIPPING' | 'SENT' | string
  customer_name: string
  customer_email: string
  item_count: number
  total_amount_cents: number
  sales_channel: string
  marketplace: string | null
  carrier_name: string | null
  operator_email: string | null
  last_scan_at: string | null
  pending_allocations: number
  committed_allocations: number
  scan_completion_ratio: number
  shipping_city: string | null
  shipping_state: string | null
  created_at: string
  updated_at: string
}

export interface WmsFulfillmentScanItem {
  order_item_id: number
  product_variant_id: number
  product_name: string
  sku: string
  barcode: string
  required_qty: number
  scanned_qty: number
  missing_qty: number
}

export interface WmsFulfillmentScanSummary {
  order_id: number
  order_status: string
  total_required_qty: number
  total_scanned_qty: number
  total_missing_qty: number
  is_complete: boolean
  items: WmsFulfillmentScanItem[]
}

function normalizeFulfillmentOrder(raw: unknown): WmsFulfillmentOrder {
  const r = (raw || {}) as Record<string, unknown>
  return {
    id: asNumber(r.id),
    code: typeof r.code === 'string' ? r.code : null,
    status: asString(r.status),
    stage: asString(r.stage),
    customer_name: asString(r.customer_name),
    customer_email: asString(r.customer_email),
    item_count: asNumber(r.item_count),
    total_amount_cents: asNumber(r.total_amount_cents),
    sales_channel: asString(r.sales_channel, 'site'),
    marketplace: typeof r.marketplace === 'string' ? r.marketplace : null,
    carrier_name: typeof r.carrier_name === 'string' ? r.carrier_name : null,
    operator_email: typeof r.operator_email === 'string' ? r.operator_email : null,
    last_scan_at: typeof r.last_scan_at === 'string' ? r.last_scan_at : null,
    pending_allocations: asNumber(r.pending_allocations),
    committed_allocations: asNumber(r.committed_allocations),
    scan_completion_ratio: asNumber(r.scan_completion_ratio),
    shipping_city: typeof r.shipping_city === 'string' ? r.shipping_city : null,
    shipping_state: typeof r.shipping_state === 'string' ? r.shipping_state : null,
    created_at: asString(r.created_at),
    updated_at: asString(r.updated_at),
  }
}

function normalizeFulfillmentScanItem(raw: unknown): WmsFulfillmentScanItem {
  const r = (raw || {}) as Record<string, unknown>
  return {
    order_item_id: asNumber(r.order_item_id),
    product_variant_id: asNumber(r.product_variant_id),
    product_name: asString(r.product_name),
    sku: asString(r.sku),
    barcode: asString(r.barcode),
    required_qty: asNumber(r.required_qty),
    scanned_qty: asNumber(r.scanned_qty),
    missing_qty: asNumber(r.missing_qty),
  }
}

function normalizeFulfillmentScanSummary(raw: unknown): WmsFulfillmentScanSummary {
  const r = (raw || {}) as Record<string, unknown>
  const items = Array.isArray(r.items) ? r.items.map(normalizeFulfillmentScanItem) : []
  return {
    order_id: asNumber(r.order_id),
    order_status: asString(r.order_status),
    total_required_qty: asNumber(r.total_required_qty),
    total_scanned_qty: asNumber(r.total_scanned_qty),
    total_missing_qty: asNumber(r.total_missing_qty),
    is_complete: asBool(r.is_complete),
    items,
  }
}

export async function getWmsFulfillmentAction(): Promise<Result<WmsFulfillmentOrder[]>> {
  const permissionError = await ensureInventoryPermission('inventory.view', 'Você não tem permissão para visualizar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const res = await fetch(`${RUST_URL}/fulfillment`, {
      method: 'GET',
      headers: headersResult.data,
    })

    if (!res.ok) {
      return { success: false, error: await readError(res, 'Falha ao carregar fila de fulfillment') }
    }

    const payload = (await res.json()) as unknown[]
    return { success: true, data: Array.isArray(payload) ? payload.map(normalizeFulfillmentOrder) : [] }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function getWmsFulfillmentScanSummaryAction(orderId: number): Promise<Result<WmsFulfillmentScanSummary>> {
  const permissionError = await ensureInventoryPermission('inventory.view', 'Você não tem permissão para visualizar estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  try {
    const res = await fetch(`${RUST_URL}/fulfillment/${orderId}/scan-summary`, {
      method: 'GET',
      headers: headersResult.data,
      cache: 'no-store',
    })

    if (!res.ok) {
      return { success: false, error: await readError(res, 'Falha ao carregar resumo da conferência') }
    }

    const payload = await res.json()
    return { success: true, data: normalizeFulfillmentScanSummary(payload) }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function registerWmsFulfillmentScanAction(
  orderId: number,
  input: { barcode: string; qty?: number }
): Promise<Result<WmsFulfillmentScanSummary>> {
  const permissionError = await ensureInventoryPermission('inventory.manage_movements', 'Você não tem permissão para gerenciar movimentações de estoque')
  if (permissionError) return permissionError

  const headersResult = await getAdminHeaders()
  if (!headersResult.success) return headersResult

  const barcode = input.barcode.trim()
  if (!barcode) {
    return { success: false, error: 'Informe um barcode ou SKU' }
  }

  const qty = Number.isFinite(input.qty) ? Number(input.qty) : 1

  try {
    const res = await fetch(`${RUST_URL}/fulfillment/${orderId}/scan`, {
      method: 'POST',
      headers: headersResult.data,
      body: JSON.stringify({
        barcode,
        qty: Math.max(1, Math.round(qty || 1)),
      }),
    })

    if (!res.ok) {
      return { success: false, error: await readError(res, 'Falha ao registrar conferência') }
    }

    const payload = (await res.json()) as { summary?: unknown }
    return {
      success: true,
      data: normalizeFulfillmentScanSummary(payload?.summary ?? payload),
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
