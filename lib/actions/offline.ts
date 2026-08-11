'use server'

import { cookies } from 'next/headers'
import type { ApiResponse } from '@/lib/types'

export interface OfflineSellerRow {
  id: number
  integration: string
  externalId: string
  name: string
  erpCode?: string | null
  active: boolean
  adminId?: number | null
  adminName?: string | null
  erpCreatedAt?: string | null
  syncedAt: string
}

export interface OfflineSellersSummary {
  total: number
  active: number
  inactive: number
  mapped: number
  unmapped: number
}

export interface OfflineCustomerRow {
  id: number
  integration: string
  externalId: string
  document?: string | null
  customerType?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  offlineSellerId?: number | null
  offlineSellerName?: string | null
  onlineCustomerId?: number | null
  onlineCustomerName?: string | null
  erpCreatedAt?: string | null
  syncedAt: string
}

export interface OfflineCustomersSummary {
  total: number
  wholesale: number
  retail: number
  withSeller: number
  withoutSeller: number
}

export interface OfflineOrderRow {
  id: number
  integration: string
  externalId: string
  status?: string | null
  totalCents: number
  orderDate: string
  offlineCustomerId?: number | null
  offlineCustomerName?: string | null
  offlineSellerId?: number | null
  offlineSellerName?: string | null
  commissionSellerId?: number | null
  commissionSellerName?: string | null
  itemsCount: number
  syncedAt: string
}

export interface OfflineOrdersSummary {
  total: number
  totalValueCents: number
  withSeller: number
  withoutSeller: number
}

export interface OfflineSellerConflictRow {
  offlineCustomerId: number
  offlineCustomerName?: string | null
  document?: string | null
  onlineCustomerId?: number | null
  onlineCustomerName?: string | null
  canonicalSellerId?: number | null
  canonicalSellerName?: string | null
  onlineSellerId?: number | null
  onlineSellerName?: string | null
  offlineSellerId?: number | null
  offlineSellerName?: string | null
  erpAdminId?: number | null
  conflictType: string
  linkedAt: string
}

export interface OfflineAttributionSellerRow {
  adminId: number
  adminName: string
  onlineTotalCents: number
  offlineTotalCents: number
  unifiedTotalCents: number
  onlineOrdersCount: number
  offlineOrdersCount: number
  influencedBySiteCount: number
  siteRegistrationsCount: number
}

export interface OfflineAttributionReport {
  sellers: OfflineAttributionSellerRow[]
  unassignedOfflineTotalCents: number
  unassignedOfflineOrdersCount: number
}

interface OfflineListResponse<T> {
  data: T[]
  page: number
  limit: number
  total: number
}

export interface OnlineCustomerOfflineLink {
  linkId: number
  offlineCustomerId: number
  offlineName?: string | null
  document?: string | null
  offlineSellerName?: string | null
  adminId?: number | null
}

export interface OfflineSellerPoolGapReport {
  mappedTotal: number
  unmappedTotal: number
  outsidePool: number
}

function resolveBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function adminAuthHeaders(): Promise<
  ApiResponse<{ base: string; headers: Record<string, string> }>
> {
  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'Backend URL não configurada' }
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  if (!adminToken) {
    return { success: false, error: 'Sessão admin não encontrada' }
  }

  return {
    success: true,
    data: {
      base,
      headers: {
        cookie: `adminAuthToken=${adminToken}`,
        Authorization: `Bearer ${adminToken}`,
      },
    },
  }
}

async function adminFetch<T>(path: string): Promise<ApiResponse<T>> {
  const auth = await adminAuthHeaders()
  if (!auth.success || !auth.data) return auth as ApiResponse<T>

  const response = await fetch(`${auth.data.base}${path}`, {
    headers: auth.data.headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text()
    return { success: false, error: message || `Erro ${response.status}` }
  }

  const payload = await response.json()
  return { success: true, data: payload as T }
}

async function adminPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const auth = await adminAuthHeaders()
  if (!auth.success || !auth.data) return auth as ApiResponse<T>

  const response = await fetch(`${auth.data.base}${path}`, {
    method: 'POST',
    headers: {
      ...auth.data.headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text()
    return { success: false, error: message || `Erro ${response.status}` }
  }

  const payload = await response.json()
  return { success: true, data: payload as T }
}

function mapSeller(row: Record<string, unknown>): OfflineSellerRow {
  return {
    id: Number(row.id),
    integration: String(row.integration ?? ''),
    externalId: String(row.external_id ?? row.externalId ?? ''),
    name: String(row.name ?? ''),
    erpCode: row.erp_code ? String(row.erp_code) : row.erpCode ? String(row.erpCode) : null,
    active: Boolean(row.active),
    adminId: row.admin_id != null ? Number(row.admin_id) : row.adminId != null ? Number(row.adminId) : null,
    adminName: row.admin_name ? String(row.admin_name) : row.adminName ? String(row.adminName) : null,
    erpCreatedAt: row.erp_created_at
      ? String(row.erp_created_at)
      : row.erpCreatedAt
        ? String(row.erpCreatedAt)
        : null,
    syncedAt: String(row.synced_at ?? row.syncedAt ?? ''),
  }
}

function mapCustomer(row: Record<string, unknown>): OfflineCustomerRow {
  return {
    id: Number(row.id),
    integration: String(row.integration ?? ''),
    externalId: String(row.external_id ?? row.externalId ?? ''),
    document: row.document ? String(row.document) : null,
    customerType: row.customer_type
      ? String(row.customer_type)
      : row.customerType
        ? String(row.customerType)
        : null,
    name: row.name ? String(row.name) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    offlineSellerId:
      row.offline_seller_id != null
        ? Number(row.offline_seller_id)
        : row.offlineSellerId != null
          ? Number(row.offlineSellerId)
          : null,
    offlineSellerName: row.offline_seller_name
      ? String(row.offline_seller_name)
      : row.offlineSellerName
        ? String(row.offlineSellerName)
        : null,
    onlineCustomerId:
      row.online_customer_id != null
        ? Number(row.online_customer_id)
        : row.onlineCustomerId != null
          ? Number(row.onlineCustomerId)
          : null,
    onlineCustomerName: row.online_customer_name
      ? String(row.online_customer_name)
      : row.onlineCustomerName
        ? String(row.onlineCustomerName)
        : null,
    erpCreatedAt: row.erp_created_at
      ? String(row.erp_created_at)
      : row.erpCreatedAt
        ? String(row.erpCreatedAt)
        : null,
    syncedAt: String(row.synced_at ?? row.syncedAt ?? ''),
  }
}

function mapOrder(row: Record<string, unknown>): OfflineOrderRow {
  return {
    id: Number(row.id),
    integration: String(row.integration ?? ''),
    externalId: String(row.external_id ?? row.externalId ?? ''),
    status: row.status ? String(row.status) : null,
    totalCents: Number(row.total_cents ?? row.totalCents ?? 0),
    orderDate: String(row.order_date ?? row.orderDate ?? ''),
    offlineCustomerId:
      row.offline_customer_id != null
        ? Number(row.offline_customer_id)
        : row.offlineCustomerId != null
          ? Number(row.offlineCustomerId)
          : null,
    offlineCustomerName: row.offline_customer_name
      ? String(row.offline_customer_name)
      : row.offlineCustomerName
        ? String(row.offlineCustomerName)
        : null,
    offlineSellerId:
      row.offline_seller_id != null
        ? Number(row.offline_seller_id)
        : row.offlineSellerId != null
          ? Number(row.offlineSellerId)
          : null,
    offlineSellerName: row.offline_seller_name
      ? String(row.offline_seller_name)
      : row.offlineSellerName
        ? String(row.offlineSellerName)
        : null,
    commissionSellerId:
      row.commission_seller_id != null
        ? Number(row.commission_seller_id)
        : row.commissionSellerId != null
          ? Number(row.commissionSellerId)
          : null,
    commissionSellerName: row.commission_seller_name
      ? String(row.commission_seller_name)
      : row.commissionSellerName
        ? String(row.commissionSellerName)
        : null,
    itemsCount: Number(row.items_count ?? row.itemsCount ?? 0),
    syncedAt: String(row.synced_at ?? row.syncedAt ?? ''),
  }
}

export async function getOfflineSellersAction(params?: {
  page?: number
  limit?: number
  search?: string
  active?: boolean
  mapping?: 'mapped' | 'unmapped'
  from?: string
  to?: string
}): Promise<ApiResponse<OfflineListResponse<OfflineSellerRow>>> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.search) query.set('search', params.search)
  if (typeof params?.active === 'boolean') query.set('active', String(params.active))
  if (params?.mapping) query.set('mapping', params.mapping)
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)

  const result = await adminFetch<Record<string, unknown>>(
    `/admin/offline/sellers?${query.toString()}`,
  )

  if (!result.success || !result.data) return result as ApiResponse<OfflineListResponse<OfflineSellerRow>>

  const raw = result.data
  const rows = Array.isArray(raw.data) ? raw.data : []
  return {
    success: true,
    data: {
      data: rows.map((row) => mapSeller(row as Record<string, unknown>)),
      page: Number(raw.page ?? 1),
      limit: Number(raw.limit ?? 50),
      total: Number(raw.total ?? rows.length),
    },
  }
}

export async function getOfflineSellersSummaryAction(params?: {
  search?: string
  active?: boolean
  mapping?: 'mapped' | 'unmapped'
  from?: string
  to?: string
}): Promise<ApiResponse<OfflineSellersSummary>> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (typeof params?.active === 'boolean') query.set('active', String(params.active))
  if (params?.mapping) query.set('mapping', params.mapping)
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)

  const result = await adminFetch<Record<string, unknown>>(
    `/admin/offline/sellers/summary?${query.toString()}`,
  )

  if (!result.success || !result.data) {
    return result as ApiResponse<OfflineSellersSummary>
  }

  const raw = result.data
  return {
    success: true,
    data: {
      total: Number(raw.total ?? 0),
      active: Number(raw.active ?? 0),
      inactive: Number(raw.inactive ?? 0),
      mapped: Number(raw.mapped ?? 0),
      unmapped: Number(raw.unmapped ?? 0),
    },
  }
}

export async function getOfflineCustomersAction(params?: {
  page?: number
  limit?: number
  search?: string
  customerType?: string
  offlineSellerId?: number
  withoutSeller?: boolean
  from?: string
  to?: string
}): Promise<ApiResponse<OfflineListResponse<OfflineCustomerRow>>> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.search) query.set('search', params.search)
  if (params?.customerType) query.set('customer_type', params.customerType)
  if (params?.withoutSeller) {
    query.set('without_seller', 'true')
  } else if (params?.offlineSellerId) {
    query.set('offline_seller_id', String(params.offlineSellerId))
  }
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)

  const result = await adminFetch<Record<string, unknown>>(
    `/admin/offline/customers?${query.toString()}`,
  )

  if (!result.success || !result.data) {
    return result as ApiResponse<OfflineListResponse<OfflineCustomerRow>>
  }

  const raw = result.data
  const rows = Array.isArray(raw.data) ? raw.data : []
  return {
    success: true,
    data: {
      data: rows.map((row) => mapCustomer(row as Record<string, unknown>)),
      page: Number(raw.page ?? 1),
      limit: Number(raw.limit ?? 50),
      total: Number(raw.total ?? rows.length),
    },
  }
}

export async function getOfflineCustomersSummaryAction(params?: {
  search?: string
  customerType?: string
  offlineSellerId?: number
  withoutSeller?: boolean
  from?: string
  to?: string
}): Promise<ApiResponse<OfflineCustomersSummary>> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.customerType) query.set('customer_type', params.customerType)
  if (params?.withoutSeller) {
    query.set('without_seller', 'true')
  } else if (params?.offlineSellerId) {
    query.set('offline_seller_id', String(params.offlineSellerId))
  }
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)

  const result = await adminFetch<Record<string, unknown>>(
    `/admin/offline/customers/summary?${query.toString()}`,
  )

  if (!result.success || !result.data) {
    return result as ApiResponse<OfflineCustomersSummary>
  }

  const raw = result.data
  return {
    success: true,
    data: {
      total: Number(raw.total ?? 0),
      wholesale: Number(raw.wholesale ?? 0),
      retail: Number(raw.retail ?? 0),
      withSeller: Number(raw.with_seller ?? raw.withSeller ?? 0),
      withoutSeller: Number(raw.without_seller ?? raw.withoutSeller ?? 0),
    },
  }
}

function mapOnlineCustomerOfflineLink(row: Record<string, unknown>): OnlineCustomerOfflineLink {
  return {
    linkId: Number(row.link_id ?? row.linkId ?? 0),
    offlineCustomerId: Number(row.offline_customer_id ?? row.offlineCustomerId ?? 0),
    offlineName: row.offline_name
      ? String(row.offline_name)
      : row.offlineName
        ? String(row.offlineName)
        : null,
    document: row.document ? String(row.document) : null,
    offlineSellerName: row.offline_seller_name
      ? String(row.offline_seller_name)
      : row.offlineSellerName
        ? String(row.offlineSellerName)
        : null,
    adminId:
      row.admin_id != null
        ? Number(row.admin_id)
        : row.adminId != null
          ? Number(row.adminId)
          : null,
  }
}

function mapOfflineSellerPoolGapReport(row: Record<string, unknown>): OfflineSellerPoolGapReport {
  return {
    mappedTotal: Number(row.mapped_total ?? row.mappedTotal ?? 0),
    unmappedTotal: Number(row.unmapped_total ?? row.unmappedTotal ?? 0),
    outsidePool: Number(row.outside_pool ?? row.outsidePool ?? 0),
  }
}

export async function linkOfflineSellerAdminAction(
  sellerId: number,
  adminId: number | null,
): Promise<ApiResponse<OfflineSellerRow>> {
  const result = await adminPost<Record<string, unknown>>(
    `/admin/offline/sellers/${sellerId}/link-admin`,
    { adminId },
  )

  if (!result.success || !result.data) return result as ApiResponse<OfflineSellerRow>

  return {
    success: true,
    data: mapSeller(result.data),
  }
}

export async function getOfflineSellerAssignmentStatsAction(): Promise<
  ApiResponse<OfflineSellerPoolGapReport>
> {
  const result = await adminFetch<Record<string, unknown>>('/admin/offline/seller-assignment-stats')
  if (!result.success || !result.data) {
    return result as ApiResponse<OfflineSellerPoolGapReport>
  }

  return {
    success: true,
    data: mapOfflineSellerPoolGapReport(result.data),
  }
}

export async function getOnlineCustomerOfflineLinkAction(
  customerId: string | number,
): Promise<ApiResponse<OnlineCustomerOfflineLink | null>> {
  const result = await adminFetch<Record<string, unknown> | null>(
    `/admin/offline/links/online-customer/${customerId}`,
  )

  if (!result.success) {
    return result as ApiResponse<OnlineCustomerOfflineLink | null>
  }

  if (!result.data) {
    return { success: true, data: null }
  }

  return {
    success: true,
    data: mapOnlineCustomerOfflineLink(result.data),
  }
}

export async function getOfflineOrdersAction(params?: {
  page?: number
  limit?: number
  search?: string
  status?: string
  offlineSellerId?: number
  from?: string
  to?: string
}): Promise<ApiResponse<OfflineListResponse<OfflineOrderRow>>> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.search) query.set('search', params.search)
  if (params?.status) query.set('status', params.status)
  if (params?.offlineSellerId) query.set('offline_seller_id', String(params.offlineSellerId))
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)

  const result = await adminFetch<Record<string, unknown>>(
    `/admin/offline/orders?${query.toString()}`,
  )

  if (!result.success || !result.data) return result as ApiResponse<OfflineListResponse<OfflineOrderRow>>

  const raw = result.data
  const rows = Array.isArray(raw.data) ? raw.data : []
  return {
    success: true,
    data: {
      data: rows.map((row) => mapOrder(row as Record<string, unknown>)),
      page: Number(raw.page ?? 1),
      limit: Number(raw.limit ?? 50),
      total: Number(raw.total ?? rows.length),
    },
  }
}

export async function getOfflineOrdersSummaryAction(params?: {
  search?: string
  status?: string
  offlineSellerId?: number
  from?: string
  to?: string
}): Promise<ApiResponse<OfflineOrdersSummary>> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.status) query.set('status', params.status)
  if (params?.offlineSellerId) query.set('offline_seller_id', String(params.offlineSellerId))
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)

  const result = await adminFetch<Record<string, unknown>>(
    `/admin/offline/orders/summary?${query.toString()}`,
  )

  if (!result.success || !result.data) {
    return result as ApiResponse<OfflineOrdersSummary>
  }

  const raw = result.data
  return {
    success: true,
    data: {
      total: Number(raw.total ?? 0),
      totalValueCents: Number(raw.total_value_cents ?? raw.totalValueCents ?? 0),
      withSeller: Number(raw.with_seller ?? raw.withSeller ?? 0),
      withoutSeller: Number(raw.without_seller ?? raw.withoutSeller ?? 0),
    },
  }
}

function mapConflict(row: Record<string, unknown>): OfflineSellerConflictRow {
  return {
    offlineCustomerId: Number(row.offline_customer_id ?? row.offlineCustomerId ?? 0),
    offlineCustomerName: row.offline_customer_name
      ? String(row.offline_customer_name)
      : row.offlineCustomerName
        ? String(row.offlineCustomerName)
        : null,
    document: row.document ? String(row.document) : null,
    onlineCustomerId:
      row.online_customer_id != null
        ? Number(row.online_customer_id)
        : row.onlineCustomerId != null
          ? Number(row.onlineCustomerId)
          : null,
    onlineCustomerName: row.online_customer_name
      ? String(row.online_customer_name)
      : row.onlineCustomerName
        ? String(row.onlineCustomerName)
        : null,
    canonicalSellerId:
      row.canonical_seller_id != null
        ? Number(row.canonical_seller_id)
        : row.canonicalSellerId != null
          ? Number(row.canonicalSellerId)
          : null,
    canonicalSellerName: row.canonical_seller_name
      ? String(row.canonical_seller_name)
      : row.canonicalSellerName
        ? String(row.canonicalSellerName)
        : null,
    onlineSellerId:
      row.online_seller_id != null
        ? Number(row.online_seller_id)
        : row.onlineSellerId != null
          ? Number(row.onlineSellerId)
          : null,
    onlineSellerName: row.online_seller_name
      ? String(row.online_seller_name)
      : row.onlineSellerName
        ? String(row.onlineSellerName)
        : null,
    offlineSellerId:
      row.offline_seller_id != null
        ? Number(row.offline_seller_id)
        : row.offlineSellerId != null
          ? Number(row.offlineSellerId)
          : null,
    offlineSellerName: row.offline_seller_name
      ? String(row.offline_seller_name)
      : row.offlineSellerName
        ? String(row.offlineSellerName)
        : null,
    erpAdminId:
      row.erp_admin_id != null
        ? Number(row.erp_admin_id)
        : row.erpAdminId != null
          ? Number(row.erpAdminId)
          : null,
    conflictType: String(row.conflict_type ?? row.conflictType ?? ''),
    linkedAt: String(row.linked_at ?? row.linkedAt ?? ''),
  }
}

function mapAttributionSeller(row: Record<string, unknown>): OfflineAttributionSellerRow {
  return {
    adminId: Number(row.admin_id ?? row.adminId ?? 0),
    adminName: String(row.admin_name ?? row.adminName ?? ''),
    onlineTotalCents: Number(row.online_total_cents ?? row.onlineTotalCents ?? 0),
    offlineTotalCents: Number(row.offline_total_cents ?? row.offlineTotalCents ?? 0),
    unifiedTotalCents: Number(row.unified_total_cents ?? row.unifiedTotalCents ?? 0),
    onlineOrdersCount: Number(row.online_orders_count ?? row.onlineOrdersCount ?? 0),
    offlineOrdersCount: Number(row.offline_orders_count ?? row.offlineOrdersCount ?? 0),
    influencedBySiteCount: Number(row.influenced_by_site_count ?? row.influencedBySiteCount ?? 0),
    siteRegistrationsCount: Number(row.site_registrations_count ?? row.siteRegistrationsCount ?? 0),
  }
}

export async function getOfflineSellerConflictsAction(params?: {
  page?: number
  limit?: number
}): Promise<ApiResponse<OfflineListResponse<OfflineSellerConflictRow>>> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))

  const result = await adminFetch<Record<string, unknown>>(
    `/admin/offline/conflicts?${query.toString()}`,
  )

  if (!result.success || !result.data) {
    return result as ApiResponse<OfflineListResponse<OfflineSellerConflictRow>>
  }

  const raw = result.data
  const rows = Array.isArray(raw.data) ? raw.data : []
  return {
    success: true,
    data: {
      data: rows.map((row) => mapConflict(row as Record<string, unknown>)),
      page: Number(raw.page ?? 1),
      limit: Number(raw.limit ?? 50),
      total: Number(raw.total ?? rows.length),
    },
  }
}

export async function getOfflineAttributionReportAction(params?: {
  from?: string
  to?: string
}): Promise<ApiResponse<OfflineAttributionReport>> {
  const query = new URLSearchParams()
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)

  const result = await adminFetch<Record<string, unknown>>(
    `/admin/offline/attribution?${query.toString()}`,
  )

  if (!result.success || !result.data) {
    return result as ApiResponse<OfflineAttributionReport>
  }

  const raw = result.data
  const sellers = Array.isArray(raw.sellers) ? raw.sellers : []
  return {
    success: true,
    data: {
      sellers: sellers.map((row) => mapAttributionSeller(row as Record<string, unknown>)),
      unassignedOfflineTotalCents: Number(
        raw.unassigned_offline_total_cents ?? raw.unassignedOfflineTotalCents ?? 0,
      ),
      unassignedOfflineOrdersCount: Number(
        raw.unassigned_offline_orders_count ?? raw.unassignedOfflineOrdersCount ?? 0,
      ),
    },
  }
}
