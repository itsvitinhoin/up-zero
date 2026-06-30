// UpZero External API client — server-side only (UPZERO_API_KEY must not reach the browser)

const BASE = 'https://api.upzero.com.br'

// ── Response types ────────────────────────────────────────────────────────────

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
  category_names?: string[]
  product_category_names?: string[]
  image_url?: string | null
  imageUrl?: string | null
  primary_image_url?: string | null
  images?: Array<string | { image_url?: string | null; imageUrl?: string | null }>
  variants: ApiVariant[]
}

export interface ApiInventoryItem {
  variant_id: string
  qty_total: number
  qty_reserved: number
  qty_available: number
}

export interface ApiAnalyticsProductRef {
  id: number
  name: string
  sku?: string | null
}

export interface ApiAnalyticsMetricItem {
  id: number
  period_start: string
  period_type: 'hour' | 'day' | 'week' | 'month'
  event_name: string
  product?: ApiAnalyticsProductRef | null
  product_variant?: { id: number; sku: string } | null
  category?: { id: number; name: string } | null
  order_id?: number | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  source?: string | null
  channel?: string | null
  device_type?: string | null
  total_events: number
  unique_users: number
  unique_sessions: number
  total_quantity: number
  total_value: number
  updated_at: string
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function upzeroFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const apiKey = process.env.UPZERO_API_KEY
  if (!apiKey) throw new Error('UPZERO_API_KEY not configured')

  const url = new URL(`${BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    })
  }

  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UpZero API ${res.status} ${path}: ${body.slice(0, 300)}`)
  }

  return res.json() as Promise<T>
}

interface PagedResponse<T> {
  data: T[]
  page?: number
  total_pages?: number
  total?: number
}

// ── Public fetch functions ────────────────────────────────────────────────────

export async function fetchAllOrders(startDate: string, endDate: string): Promise<ApiOrder[]> {
  const all: ApiOrder[] = []
  let page = 1
  let totalPages = 1

  do {
    const res = await upzeroFetch<PagedResponse<ApiOrder>>('/external/v1/orders', {
      start_date: startDate,
      end_date: endDate,
      page: String(page),
      limit: '100',
    })
    all.push(...(res.data ?? []))
    totalPages = res.total_pages ?? 1
    page++
  } while (page <= totalPages && all.length < 5000)

  return all
}

export async function fetchAllCustomers(): Promise<ApiCustomer[]> {
  const res = await upzeroFetch<PagedResponse<ApiCustomer> | ApiCustomer[]>(
    '/external/v1/customers',
    { limit: '1000' },
  )
  if (Array.isArray(res)) return res
  return (res as PagedResponse<ApiCustomer>).data ?? []
}

export async function fetchAllProducts(): Promise<ApiProduct[]> {
  const all: ApiProduct[] = []
  let cursor: string | undefined

  do {
    const params: Record<string, string> = { limit: '100' }
    if (cursor) params.cursor = cursor

    const res = await upzeroFetch<{ data?: ApiProduct[]; next_cursor?: string }>(
      '/external/v1/products',
      params,
    )
    all.push(...(res.data ?? []))
    cursor = res.next_cursor
  } while (cursor && all.length < 2000)

  return all
}

interface ApiInventoryResponse {
  variant_id: string
  totals: { qty_total: number; qty_reserved: number; qty_available: number }
}

export async function fetchInventory(variantIds: string[]): Promise<ApiInventoryItem[]> {
  if (variantIds.length === 0) return []

  const results = await Promise.allSettled(
    variantIds.map(id =>
      upzeroFetch<ApiInventoryResponse>('/external/v1/inventory/availability', { variant_id: id })
    )
  )

  return results
    .filter((r): r is PromiseFulfilledResult<ApiInventoryResponse> => r.status === 'fulfilled')
    .map(r => ({
      variant_id:    r.value.variant_id,
      qty_total:     r.value.totals.qty_total,
      qty_reserved:  r.value.totals.qty_reserved,
      qty_available: r.value.totals.qty_available,
    }))
}

export async function fetchAllAnalyticsMetrics(startDate: string, endDate: string): Promise<ApiAnalyticsMetricItem[]> {
  const all: ApiAnalyticsMetricItem[] = []
  let cursor: string | undefined

  do {
    const params: Record<string, string> = {
      from: `${startDate}T00:00:00Z`,
      to: `${endDate}T23:59:59Z`,
      period_type: 'day',
      sort_by: 'period_start',
      sort_dir: 'desc',
      limit: '1000',
    }
    if (cursor) params.cursor = cursor

    const res = await upzeroFetch<{ data?: ApiAnalyticsMetricItem[]; next_cursor?: string }>(
      '/external/v1/analytics/metrics',
      params,
    )
    all.push(...(res.data ?? []))
    cursor = res.next_cursor || undefined
  } while (cursor && all.length < 10000)

  return all
}

type ApiProductImageResponse = {
  image_url?: string | null
  imageUrl?: string | null
  is_primary?: boolean
  display_order?: number
}

export async function fetchProductPrimaryImages(productIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean))).slice(0, 80)
  if (uniqueIds.length === 0) return {}

  const results = await Promise.allSettled(
    uniqueIds.map(async (productId) => {
      const images = await upzeroFetch<ApiProductImageResponse[]>(
        `/external/v1/products/${encodeURIComponent(productId)}/images`,
      )
      const sorted = [...(images ?? [])].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        return (a.display_order ?? 999) - (b.display_order ?? 999)
      })
      const imageUrl = sorted
        .map((image) => image.image_url || image.imageUrl || null)
        .find((url): url is string => typeof url === 'string' && url.trim().length > 0)

      return imageUrl ? [productId, imageUrl] as const : null
    }),
  )

  return Object.fromEntries(
    results
      .filter((result): result is PromiseFulfilledResult<readonly [string, string] | null> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  )
}
