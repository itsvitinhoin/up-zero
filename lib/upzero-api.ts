import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'

// Dashboard adapter backed by next-upzero Rust API (session-scoped).

// -- Response types -----------------------------------------------------------

export type ApiOrderStatus =
  | 'RESERVED' | 'CONFIRMED' | 'PROCESSING' | 'INVOICED' | 'SHIPPED' | 'CANCELED'

export interface ApiAddress {
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

export interface ApiOrderItem {
  id: string
  variant_id: string
  sku: string
  qty: number
  unit_price: string
  status?: string
}

export interface ApiOrderCustomer {
  id: string
  name: string
  email?: string
  phone?: string
  customer_type?: 'RETAIL' | 'WHOLESALE'
  wholesale_profile?: { segment?: string; address_city?: string | null; address_state?: string | null }
  retail_profile?: { address_city?: string | null; address_state?: string | null }
}

export interface ApiOrder {
  id: string
  order_status: ApiOrderStatus
  payment_status?: string
  customer: ApiOrderCustomer
  shipping_address?: ApiAddress
  subtotal?: string
  discount?: string
  shipping?: string
  total: string
  total_items_qty?: number
  items_count?: number
  items?: ApiOrderItem[]
  created_at: string
  updated_at: string
}

interface ApiCustomerAddress {
  address_zip?: string | null
  address_street?: string | null
  address_number?: string | null
  address_complement?: string | null
  address_neighborhood?: string | null
  address_city?: string | null
  address_state?: string | null
}

export interface ApiCustomer {
  id: string
  name: string
  email?: string
  phone?: string
  customer_type?: 'RETAIL' | 'WHOLESALE'
  retail_profile?: ApiCustomerAddress & { cpf?: string; gender?: string | null; birth_date?: string | null }
  wholesale_profile?: ApiCustomerAddress & {
    contact_name?: string
    company_name?: string
    trade_name?: string
    cnpj?: string
    state_registration?: string | null
    segment?: string | null
  }
  created_at?: string
  updated_at?: string
}

export interface ApiVariantAttribute {
  attribute: { id: string; name: string; code: string }
  term: { name: string; code: string }
}

export interface ApiVariant {
  id: string
  sku: string
  price: string
  active?: boolean
  status?: string
  attributes?: ApiVariantAttribute[]
}

export interface ApiProduct {
  id: string
  name: string
  code?: string
  status?: string
  categories?: { id: string; name: string }[]
  variants: ApiVariant[]
}

export interface ApiInventoryItem {
  variant_id: string
  qty_total: number
  qty_reserved: number
  qty_available: number
}

// -- Fetch helpers ------------------------------------------------------------

const PRODUCT_PAGE_LIMIT = 100
const ORDER_PAGE_LIMIT = 100
const MAX_ORDERS = 5000
const MAX_PRODUCTS = 3000

let inventoryCache = new Map<string, ApiInventoryItem>()

function resolveBackendBase(): string {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) throw new Error('NEXT_PUBLIC_RUST_URL not configured')
  return base.replace(/\/$/, '')
}

async function resolveSessionHeaders(): Promise<{ cookieHeader?: string; storeId?: string }> {
  const cookieStore = await cookies()
  const adminAuthToken = cookieStore.get('adminAuthToken')?.value
  const storeId = await getAdminStoreIdFromToken()

  return {
    cookieHeader: adminAuthToken ? `adminAuthToken=${adminAuthToken}` : undefined,
    storeId: storeId ? String(storeId) : undefined,
  }
}

async function backendFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const base = resolveBackendBase()
  const { cookieHeader } = await resolveSessionHeaders()

  const url = new URL(path, base)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    })
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Backend ${res.status} ${path}: ${body.slice(0, 300)}`)
  }

  return res.json() as Promise<T>
}

function toMoneyString(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0.00'
  return num.toFixed(2)
}

function normalizeOrderStatus(status: unknown): ApiOrderStatus {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'CANCELLED') return 'CANCELED'
  if (['RESERVED', 'CONFIRMED', 'PROCESSING', 'INVOICED', 'SHIPPED', 'CANCELED'].includes(normalized)) {
    return normalized as ApiOrderStatus
  }
  return 'RESERVED'
}

type BackendOrderListItem = {
  id: number
  customer_id?: number | null
  status?: string
  payment_status?: string | null
  total?: number
  order_fulfilled_subtotal_cents?: number | null
  order_total_items?: number | null
  customer_name?: string | null
  customer_company_name?: string | null
  customer_trade_name?: string | null
  customer_phone?: string | null
  shipping_city?: string | null
  shipping_state?: string | null
  created_at: string
  updated_at: string
  meta?: {
    checkout?: {
      payment?: { code?: string | null; status?: string | null }
      address?: { city?: string | null; state?: string | null }
    }
  }
}

type BackendOrderDetailItem = {
  id: number
  variant_id?: number | null
  variant_sku?: string | null
  quantity?: number
  unit_price_cents?: number
  status?: string | null
}

type BackendOrderDetailObject = {
  order?: BackendOrderListItem
  items?: BackendOrderDetailItem[]
  customer?: {
    id?: number
    email?: string | null
    phone?: string | null
    company_name?: string | null
    trade_name?: string | null
    contact_name?: string | null
    segment?: string | null
    address_city?: string | null
    address_state?: string | null
  } | null
}

function parseOrderDetailPayload(payload: unknown): {
  order: BackendOrderListItem | null
  items: BackendOrderDetailItem[]
  customer: BackendOrderDetailObject['customer']
} {
  if (Array.isArray(payload)) {
    const order = (payload[0] as BackendOrderListItem | undefined) || null
    const items = Array.isArray(payload[1]) ? (payload[1] as BackendOrderDetailItem[]) : []
    return { order, items, customer: null }
  }

  if (payload && typeof payload === 'object') {
    const typed = payload as BackendOrderDetailObject
    return {
      order: typed.order || null,
      items: Array.isArray(typed.items) ? typed.items : [],
      customer: typed.customer || null,
    }
  }

  return { order: null, items: [], customer: null }
}

function mapBackendOrderToApiOrder(
  order: BackendOrderListItem,
  items: BackendOrderDetailItem[],
  customer: BackendOrderDetailObject['customer']
): ApiOrder {
  const customerName = String(
    customer?.company_name
      || customer?.trade_name
      || customer?.contact_name
      || order.customer_company_name
      || order.customer_trade_name
      || order.customer_name
      || ''
  ).trim()

  const paymentCode = String(order.meta?.checkout?.payment?.code || '').trim().toUpperCase()
  const paymentStatus = String(order.payment_status || order.meta?.checkout?.payment?.status || paymentCode || '').trim()

  const shippingState = String(order.meta?.checkout?.address?.state || order.shipping_state || customer?.address_state || '').trim()
  const shippingCity = String(order.meta?.checkout?.address?.city || order.shipping_city || customer?.address_city || '').trim()

  const mappedItems: ApiOrderItem[] = (items || []).map((item) => ({
    id: String(item.id),
    variant_id: String(item.variant_id || ''),
    sku: String(item.variant_sku || ''),
    qty: Number(item.quantity || 0),
    unit_price: toMoneyString(Number(item.unit_price_cents || 0) / 100),
    status: item.status || undefined,
  }))

  return {
    id: String(order.id),
    order_status: normalizeOrderStatus(order.status),
    payment_status: paymentStatus || undefined,
    customer: {
      id: String(customer?.id || order.customer_id || ''),
      name: customerName || `Cliente #${order.customer_id ?? order.id}`,
      email: customer?.email || undefined,
      phone: customer?.phone || order.customer_phone || undefined,
      customer_type: 'WHOLESALE',
      wholesale_profile: {
        segment: customer?.segment || undefined,
        address_city: customer?.address_city || shippingCity || undefined,
        address_state: customer?.address_state || shippingState || undefined,
      },
      retail_profile: {
        address_city: shippingCity || undefined,
        address_state: shippingState || undefined,
      },
    },
    shipping_address: {
      city: shippingCity || undefined,
      state: shippingState || undefined,
    },
    total: toMoneyString(order.total),
    total_items_qty: Number(order.order_total_items || 0),
    items_count: Number(order.order_total_items || 0),
    items: mappedItems,
    created_at: order.created_at,
    updated_at: order.updated_at,
  }
}

// -- Public fetch functions ---------------------------------------------------

export async function fetchAllOrders(startDate: string, endDate: string): Promise<ApiOrder[]> {
  const { storeId } = await resolveSessionHeaders()
  const all: BackendOrderListItem[] = []
  let page = 1

  while (all.length < MAX_ORDERS) {
    const res = await backendFetch<BackendOrderListItem[]>('/orders', {
      from: startDate,
      to: endDate,
      page: String(page),
      limit: String(ORDER_PAGE_LIMIT),
      ...(storeId ? { store_id: storeId } : {}),
    })

    const pageItems = Array.isArray(res) ? res : []
    if (pageItems.length === 0) break
    all.push(...pageItems)
    if (pageItems.length < ORDER_PAGE_LIMIT) break
    page++
  }

  const orders = all.slice(0, MAX_ORDERS)
  const details = await Promise.allSettled(
    orders.map((order) => backendFetch<unknown>(`/orders/${order.id}`))
  )

  return orders.map((order, index) => {
    const detail = details[index]
    if (detail.status !== 'fulfilled') {
      return mapBackendOrderToApiOrder(order, [], null)
    }

    const parsed = parseOrderDetailPayload(detail.value)
    return mapBackendOrderToApiOrder(parsed.order || order, parsed.items, parsed.customer)
  })
}

type BackendCustomer = {
  id: number
  email?: string | null
  phone?: string | null
  created_at?: string
  updated_at?: string
  wholesale_profile?: {
    contact_name?: string | null
    company_name?: string | null
    trade_name?: string | null
    cnpj?: string | null
    state_registration?: string | null
    segment?: string | null
    address_zip?: string | null
    address_street?: string | null
    address_number?: string | null
    address_complement?: string | null
    address_neighborhood?: string | null
    address_city?: string | null
    address_state?: string | null
  } | null
  retail_profile?: {
    cpf?: string | null
    birth_date?: string | null
    gender?: string | null
    address_zip?: string | null
    address_street?: string | null
    address_number?: string | null
    address_complement?: string | null
    address_neighborhood?: string | null
    address_city?: string | null
    address_state?: string | null
  } | null
}

export async function fetchAllCustomers(): Promise<ApiCustomer[]> {
  const { storeId } = await resolveSessionHeaders()
  const res = await backendFetch<BackendCustomer[]>('/customers', {
    limit: '1000',
    ...(storeId ? { store_id: storeId } : {}),
  })

  return (Array.isArray(res) ? res : []).map((customer) => ({
    id: String(customer.id),
    name: String(
      customer.wholesale_profile?.company_name
        || customer.wholesale_profile?.trade_name
        || customer.wholesale_profile?.contact_name
        || `Cliente #${customer.id}`
    ),
    email: customer.email || undefined,
    phone: customer.phone || undefined,
    customer_type: customer.wholesale_profile ? 'WHOLESALE' : 'RETAIL',
    retail_profile: customer.retail_profile ? {
      cpf: customer.retail_profile.cpf || undefined,
      birth_date: customer.retail_profile.birth_date || undefined,
      gender: customer.retail_profile.gender || undefined,
      address_zip: customer.retail_profile.address_zip || undefined,
      address_street: customer.retail_profile.address_street || undefined,
      address_number: customer.retail_profile.address_number || undefined,
      address_complement: customer.retail_profile.address_complement || undefined,
      address_neighborhood: customer.retail_profile.address_neighborhood || undefined,
      address_city: customer.retail_profile.address_city || undefined,
      address_state: customer.retail_profile.address_state || undefined,
    } : undefined,
    wholesale_profile: customer.wholesale_profile ? {
      contact_name: customer.wholesale_profile.contact_name || undefined,
      company_name: customer.wholesale_profile.company_name || undefined,
      trade_name: customer.wholesale_profile.trade_name || undefined,
      cnpj: customer.wholesale_profile.cnpj || undefined,
      state_registration: customer.wholesale_profile.state_registration || undefined,
      segment: customer.wholesale_profile.segment || undefined,
      address_zip: customer.wholesale_profile.address_zip || undefined,
      address_street: customer.wholesale_profile.address_street || undefined,
      address_number: customer.wholesale_profile.address_number || undefined,
      address_complement: customer.wholesale_profile.address_complement || undefined,
      address_neighborhood: customer.wholesale_profile.address_neighborhood || undefined,
      address_city: customer.wholesale_profile.address_city || undefined,
      address_state: customer.wholesale_profile.address_state || undefined,
    } : undefined,
    created_at: customer.created_at || undefined,
    updated_at: customer.updated_at || undefined,
  }))
}

type BackendProductVariant = {
  id?: number
  sku?: string | null
  price_cents?: number
  stock_qty?: number
  active?: boolean
  attribute_values?: Array<{
    attribute_code?: string
    value_name?: string
    value_meta?: Record<string, unknown> | null
  }>
}

type BackendProductItem = {
  id?: number
  code?: string | null
  name?: string | null
  active?: boolean
  category_ids?: number[]
  variants?: BackendProductVariant[]
}

type BackendPaginatedProducts = {
  total?: number
  items?: BackendProductItem[]
}

export async function fetchAllProducts(): Promise<ApiProduct[]> {
  const { storeId } = await resolveSessionHeaders()
  const all: BackendProductItem[] = []
  inventoryCache = new Map<string, ApiInventoryItem>()

  let page = 1
  while (all.length < MAX_PRODUCTS) {
    const response = await backendFetch<BackendPaginatedProducts>('/products-paginated', {
      page: String(page),
      limit: String(PRODUCT_PAGE_LIMIT),
      summary: 'false',
      ...(storeId ? { store_id: storeId } : {}),
    })

    const items = Array.isArray(response.items) ? response.items : []
    if (items.length === 0) break
    all.push(...items)

    const total = Number(response.total || 0)
    if (total > 0 && all.length >= total) break
    if (items.length < PRODUCT_PAGE_LIMIT) break
    page++
  }

  return all.slice(0, MAX_PRODUCTS).map((product) => {
    const variants = Array.isArray(product.variants) ? product.variants : []

    const mappedVariants: ApiVariant[] = variants.map((variant) => {
      const variantId = String(variant.id || '')
      const stock = Number(variant.stock_qty || 0)
      if (variantId) {
        inventoryCache.set(variantId, {
          variant_id: variantId,
          qty_total: stock,
          qty_reserved: 0,
          qty_available: stock,
        })
      }

      const attributes: ApiVariantAttribute[] = (variant.attribute_values || [])
        .map((attr) => {
          const code = String(attr.attribute_code || '').trim().toLowerCase()
          const name = String(attr.value_name || '').trim()
          if (!code || !name) return null
          return {
            attribute: {
              id: code,
              name: code,
              code,
            },
            term: {
              name,
              code: name.toLowerCase().replace(/\s+/g, '-'),
            },
          }
        })
        .filter((item): item is ApiVariantAttribute => Boolean(item))

      return {
        id: variantId,
        sku: String(variant.sku || ''),
        price: toMoneyString(Number(variant.price_cents || 0) / 100),
        active: variant.active !== false,
        attributes,
      }
    })

    return {
      id: String(product.id || ''),
      name: String(product.name || ''),
      code: String(product.code || ''),
      status: product.active === false ? 'inactive' : 'active',
      categories: (product.category_ids || []).map((id) => ({ id: String(id), name: `Categoria #${id}` })),
      variants: mappedVariants,
    }
  })
}

interface ApiInventoryResponse {
  variant_id: string
  totals: { qty_total: number; qty_reserved: number; qty_available: number }
}

export async function fetchInventory(variantIds: string[]): Promise<ApiInventoryItem[]> {
  if (variantIds.length === 0) return []

  const missing = variantIds.filter((id) => !inventoryCache.has(String(id)))
  if (missing.length > 0) {
    const results = await Promise.allSettled(
      missing.map((id) => backendFetch<ApiInventoryResponse>('/inventory/availability', { variant_id: id }))
    )

    results
      .filter((result): result is PromiseFulfilledResult<ApiInventoryResponse> => result.status === 'fulfilled')
      .forEach((result) => {
        inventoryCache.set(result.value.variant_id, {
          variant_id: result.value.variant_id,
          qty_total: result.value.totals.qty_total,
          qty_reserved: result.value.totals.qty_reserved,
          qty_available: result.value.totals.qty_available,
        })
      })
  }

  return variantIds
    .map((id) => inventoryCache.get(String(id)))
    .filter((entry): entry is ApiInventoryItem => Boolean(entry))
}
