'use server'

import { cookies } from 'next/headers'
import { canManageProducts, getAdminStoreIdFromToken, getSession } from '@/lib/auth'
import type { ApiResponse } from '@/lib/types'

async function isProductsAuthorized(session: Awaited<ReturnType<typeof getSession>>): Promise<boolean> {
  if (session && canManageProducts(session.role)) {
    return true
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  return Boolean(adminToken)
}

type MeasurementTableRecord = {
  id: string
  storeId: number
  name: string
  meta: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

type MeasurementTableApiRow = {
  id?: number
  store_id?: number
  name?: string
  meta?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

function resolveBackendBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

function mapMeasurementTableRow(row: MeasurementTableApiRow): MeasurementTableRecord {
  return {
    id: String(row.id || ''),
    storeId: Number(row.store_id || 0),
    name: String(row.name || ''),
    meta: typeof row.meta === 'object' && row.meta !== null ? row.meta : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getMeasurementTablesAction(input?: {
  query?: string
  limit?: number
}): Promise<ApiResponse<MeasurementTableRecord[]>> {
  const session = await getSession()
  if (!(await isProductsAuthorized(session))) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  const storeId = await getAdminStoreIdFromToken()
  if (!storeId) {
    return { success: false, error: 'Loja não identificada' }
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  const query = String(input?.query || '').trim()
  const limit = Math.max(1, Math.min(50, Number(input?.limit || 10) || 10))

  const searchParams = new URLSearchParams()
  searchParams.set('store_id', String(storeId))
  searchParams.set('limit', String(limit))
  if (query) {
    searchParams.set('q', query)
  }

  const response = await fetch(`${base}/measurement-tables?${searchParams.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao listar tabelas de medidas' }
  }

  const payload = (await response.json()) as MeasurementTableApiRow[]
  const items = Array.isArray(payload) ? payload.map(mapMeasurementTableRow) : []
  return { success: true, data: items }
}

export async function createMeasurementTableAction(input: {
  name: string
  meta: Record<string, unknown>
}): Promise<ApiResponse<MeasurementTableRecord>> {
  const session = await getSession()
  if (!(await isProductsAuthorized(session))) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  const storeId = await getAdminStoreIdFromToken()
  if (!storeId) {
    return { success: false, error: 'Loja não identificada' }
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  const response = await fetch(`${base}/measurement-tables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
    },
    cache: 'no-store',
    body: JSON.stringify({
      store_id: storeId,
      name: String(input.name || '').trim(),
      meta: input.meta || {},
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao criar tabela de medidas' }
  }

  const payload = (await response.json()) as MeasurementTableApiRow
  return { success: true, data: mapMeasurementTableRow(payload) }
}

export async function updateMeasurementTableAction(input: {
  id: string
  name: string
  meta: Record<string, unknown>
}): Promise<ApiResponse<MeasurementTableRecord>> {
  const session = await getSession()
  if (!(await isProductsAuthorized(session))) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  const storeId = await getAdminStoreIdFromToken()
  if (!storeId) {
    return { success: false, error: 'Loja não identificada' }
  }

  const tableId = String(input.id || '').trim()
  if (!tableId) {
    return { success: false, error: 'ID da tabela é obrigatório' }
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  const response = await fetch(`${base}/measurement-tables/${encodeURIComponent(tableId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
    },
    cache: 'no-store',
    body: JSON.stringify({
      name: String(input.name || '').trim(),
      meta: input.meta || {},
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao atualizar tabela de medidas' }
  }

  const payload = (await response.json()) as MeasurementTableApiRow
  return { success: true, data: mapMeasurementTableRow(payload) }
}
