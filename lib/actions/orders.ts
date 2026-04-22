'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getSession, canManageOrders, canPurchase, getAdminStoreIdFromToken } from '@/lib/auth'
import { clearCartAction, getCartAction, updateCartNotesAction } from '@/lib/actions/cart'
import { getCurrentB2bCustomerAction, getCustomerDetailAction, getCustomersAction } from '@/lib/actions/customers'
import { getSellerPermissionsAction, getSiteSettingsAction } from '@/lib/actions/settings'
import { resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from '@/lib/actions/storefront-scope'
import { normalizeQuantityByStockMode, type StockModeConfig } from '@/lib/stock-mode'
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  getOrderItems,
  createOrderItem,
  getCart,
  clearCart,
  getProductById,
  getVariantById,
  updateVariant,
  getCustomerById,
  getSiteSettings,
  getCouponByCode,
  updateCoupon,
  createAuditLog,
} from '@/lib/backend-data'
import { calculateCartPrice } from '@/lib/pricing'
import { checkoutSchema, assistedOrderSchema } from '@/lib/validations'
import type { ApiResponse, Customer, Order, OrderInvoice, OrderLabel, OrderItem, OrderWithItems, OrderStatus, StockMode } from '@/lib/types'

type StorefrontOrderItem = {
  id: string
  quantity: number
  unitPrice: number
  totalPrice: number
  variant: {
    sku: string
    color?: string
    size?: string
    product?: {
      name?: string
    }
  }
}

type StorefrontOrder = {
  id: string
  orderNumber: string
  status: string
  createdAt: string
  totalAmount: number
  subtotal: number
  discountAmount: number
  shippingCost: number
  paymentMethod: string
  paymentStatus: string
  notes: string | null
  shippingStreet: string
  shippingNumber: string
  shippingComplement: string | null
  shippingNeighborhood: string
  shippingCity: string
  shippingState: string
  shippingZipCode: string
  items: StorefrontOrderItem[]
}

type BackendOrder = {
  id: number
  customer_id: number
  status: string
  payment_status?: string | null
  shipping_method_source?: string | null
  shipping_method_id?: number | null
  shipping_method_ref?: string | null
  shipping_method_code?: string | null
  shipping_method_name?: string | null
  note?: string | null
  coupon_discount_cents?: number
  tier_discount_cents?: number
  manual_discount_cents?: number
  shipping_price_cents?: number
  shipping_delivery_days?: number | null
  order_subtotal_cents?: number | null
  order_total_items?: number | null
  order_fulfilled_items?: number | null
  order_payment_method_discount_cents?: number | null
  meta?: {
    checkout?: {
      notes?: string | null
      payment?: {
        code?: string | null
        name?: string | null
        status?: string | null
      }
      shipping?: {
        option_id?: string | null
        code?: string | null
        name?: string | null
        price_cents?: number | null
      }
      address?: {
        street?: string | null
        number?: string | null
        complement?: string | null
        neighborhood?: string | null
        city?: string | null
        state?: string | null
        zip_code?: string | null
      }
    }
    backoffice?: {
      internal_notes?: string | null
      tracking?: {
        code?: string | null
        url?: string | null
      }
    }
  }
  created_at: string
  updated_at: string
}

type BackendOrderInvoice = {
  id: number
  store_id: number
  order_id: number
  status: string
  payload?: Record<string, unknown> | null
  meta?: Record<string, unknown> | null
  nf_number?: string | null
  pdf_url?: string | null
  xml_url?: string | null
  access_key?: string | null
  integration_name?: string | null
  integration_reference_id?: string | null
  error_message?: string | null
  issued_at?: string | null
  created_at: string
  updated_at: string
}

type BackendOrderLabel = {
  id: number
  store_id: number
  order_id: number
  status: string
  tracking_code?: string | null
  carrier?: string | null
  pdf_url?: string | null
  integration_name?: string | null
  integration_reference_id?: string | null
  error_message?: string | null
  issued_at?: string | null
  created_at: string
  updated_at: string
}

type BackendOrderItem = {
  id: number
  order_id: number
  product_id: number
  variant_id: number
  asset_id?: number | null
  asset_name?: string | null
  asset_image_url?: string | null
  image_url?: string | null
  quantity: number
  original_quantity?: number
  unit_price_cents: number
  extra_discount_cents?: number
  payment_method_discount_cents?: number
  status?: 'active' | 'attended' | 'removed' | string
  origin?: 'customer' | 'manager_added' | 'replacement' | 'gift' | string
  product_name?: string
  variant_sku?: string | null
  variant_combination_key?: string | null
  variant_stock_qty?: number
  variant_reserved_qty?: number
}

type BackendStorefrontOrderDetailResponse = {
  order?: BackendOrder
  items?: BackendOrderItem[]
}

type BackendB2BCustomer = {
  id: number
  status?: string
  assigned_seller_id?: number | null
  price_table_id?: number | null
  min_pieces_override?: number | null
  extra_discount_bps?: number | null
  company_name?: string | null
  trade_name?: string | null
  cnpj?: string | null
  state_registration?: string | null
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  address_street?: string | null
  address_number?: string | null
  address_complement?: string | null
  address_neighborhood?: string | null
  address_city?: string | null
  address_state?: string | null
  address_zip?: string | null
  segment?: string | null
  meta?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
}

function parseStorefrontOrderDetailPayload(
  payload: unknown,
  fallbackOrder?: BackendOrder
): { order: BackendOrder | null; items: BackendOrderItem[] } {
  if (Array.isArray(payload)) {
    const order = (payload[0] as BackendOrder | undefined) || fallbackOrder || null
    const items = Array.isArray(payload[1]) ? (payload[1] as BackendOrderItem[]) : []
    return { order, items }
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as BackendStorefrontOrderDetailResponse
    const order = objectPayload.order || fallbackOrder || null
    const items = Array.isArray(objectPayload.items) ? objectPayload.items : []
    return { order, items }
  }

  return { order: fallbackOrder || null, items: [] }
}

type OrderPaymentEventResponse = {
  id: number
  event_type: string
  event_source: string | null
  payload_json: Record<string, unknown> | null
  occurred_at: string | null
  created_at: string
}

type OrderPaymentResponse = {
  id: number
  order_id: number
  store_id: number | null
  provider: string | null
  status: string
  amount_cents: number
  gateway_transaction_id: string | null
  gateway_reference: string | null
  payment_code: string | null
  payment_label: string | null
  authorized_at: string | null
  paid_at: string | null
  failed_at: string | null
  created_at: string
  updated_at: string
  events: OrderPaymentEventResponse[]
}

function normalizeOrderItemOrigin(
  value?: string | null
): 'customer' | 'manager_added' | 'replacement' | 'gift' {
  const normalized = String(value || '').trim().toLowerCase()
  if (['customer', 'manager_added', 'replacement', 'gift'].includes(normalized)) {
    return normalized as 'customer' | 'manager_added' | 'replacement' | 'gift'
  }
  return 'customer'
}

function parseVariantCombinationKey(
  value?: string | null
): { colorSnapshot: string | null; sizeSnapshot: string | null } {
  const raw = String(value || '').trim()
  if (!raw) return { colorSnapshot: null, sizeSnapshot: null }

  const keyValueMatches = Array.from(raw.matchAll(/([^|,;]+):([^|,;]+)/g))
  if (keyValueMatches.length > 0) {
    let colorSnapshot: string | null = null
    let sizeSnapshot: string | null = null

    for (const match of keyValueMatches) {
      const key = String(match[1] || '').trim().toLowerCase()
      const parsedValue = String(match[2] || '').trim()

      if (!parsedValue) continue

      if (!colorSnapshot && ['cor', 'color', 'col'].includes(key)) {
        colorSnapshot = parsedValue
      }

      if (!sizeSnapshot && ['tam', 'tamanho', 'size'].includes(key)) {
        sizeSnapshot = parsedValue
      }
    }

    if (colorSnapshot || sizeSnapshot) {
      return { colorSnapshot, sizeSnapshot }
    }
  }

  const separators = [' / ', '/', '|', ' - ', '-', ',']
  for (const separator of separators) {
    if (!raw.includes(separator)) continue
    const parts = raw
      .split(separator)
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (parts.length >= 2) {
      const fallbackParts = parts.length > 2 ? parts.slice(-2) : parts
      return {
        colorSnapshot: fallbackParts[0] || null,
        sizeSnapshot: fallbackParts[1] || null,
      }
    }
  }

  return { colorSnapshot: raw, sizeSnapshot: null }
}

function resolveBackendBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null

    const base64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')

    const parsed = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function maskToken(token: string | null | undefined): string {
  if (!token) return 'missing'
  const trimmed = token.trim()
  if (!trimmed) return 'empty'
  if (trimmed.length <= 16) return `${trimmed.slice(0, 4)}...${trimmed.slice(-2)}`
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`
}

function normalizePositiveInteger(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function resolveDefaultStoreId(): Promise<string | null> {
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  const adminStoreId = await getAdminStoreIdFromToken()
  if (adminStoreId) return String(adminStoreId)

  if (hasAdminToken) {
    return null
  }

  const raw = process.env.STORE_ID?.trim()
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return String(Math.trunc(parsed))
}

async function buildStorefrontCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('sessionID')?.value
  const clientAuthToken = cookieStore.get('clientAuthToken')?.value
  const b2bAuthToken = cookieStore.get('b2bAuthToken')?.value

  const parts = [
    sessionId ? `sessionID=${sessionId}` : null,
    clientAuthToken ? `clientAuthToken=${clientAuthToken}` : null,
    b2bAuthToken ? `b2bAuthToken=${b2bAuthToken}` : null,
  ].filter(Boolean) as string[]

  return parts.length > 0 ? parts.join('; ') : undefined
}

async function buildBackofficeCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const adminAuthToken = cookieStore.get('adminAuthToken')?.value

  const parts = [
    adminAuthToken ? `adminAuthToken=${adminAuthToken}` : null,
  ].filter(Boolean) as string[]

  return parts.length > 0 ? parts.join('; ') : undefined
}

async function buildOrderReadCookieHeader(): Promise<string | undefined> {
  const storefrontCookieHeader = await buildStorefrontCookieHeader()
  if (storefrontCookieHeader) return storefrontCookieHeader

  // Fallback only when there is no storefront auth at all.
  return buildBackofficeCookieHeader()
}

function mapBackendB2BCustomerToCustomer(raw: BackendB2BCustomer): Customer {
  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {}
  const paymentTermsRaw = Array.isArray((meta as Record<string, unknown>).payment_terms)
    ? (meta as Record<string, unknown>).payment_terms as unknown[]
    : []

  const paymentTerms = paymentTermsRaw
    .map((value) => String(value || '').toUpperCase())
    .filter((value): value is Customer['paymentTerms'][number] =>
      ['PIX', 'BOLETO', 'FATURADO', 'CARTAO_EXTERNO'].includes(value)
    )

  return {
    id: String(raw.id),
    userId: String(raw.id),
    companyName: String(raw.company_name || ''),
    tradeName: String(raw.trade_name || ''),
    cnpj: String(raw.cnpj || ''),
    stateRegistration: raw.state_registration ? String(raw.state_registration) : null,
    contactName: String(raw.contact_name || ''),
    phone: String(raw.phone || ''),
    email: String(raw.email || ''),
    street: String(raw.address_street || ''),
    number: String(raw.address_number || ''),
    complement: raw.address_complement ? String(raw.address_complement) : null,
    neighborhood: String(raw.address_neighborhood || ''),
    city: String(raw.address_city || ''),
    state: String(raw.address_state || ''),
    zipCode: String(raw.address_zip || ''),
    segment: raw.segment ? String(raw.segment) : null,
    status: (String(raw.status || 'PENDING').toUpperCase() as Customer['status']) || 'PENDING',
    priceTableId: typeof raw.price_table_id === 'number' ? String(raw.price_table_id) : null,
    minPiecesOverride:
      typeof raw.min_pieces_override === 'number' ? Number(raw.min_pieces_override) : null,
    extraDiscountPct:
      typeof raw.extra_discount_bps === 'number' ? Number(raw.extra_discount_bps) / 100 : null,
    paymentTerms: paymentTerms.length > 0 ? paymentTerms : ['PIX'],
    assignedSellerId:
      typeof raw.assigned_seller_id === 'number' ? String(raw.assigned_seller_id) : null,
    assignedSellerName: null,
    receitawsMeta: null,
    createdAt: new Date(raw.created_at || new Date()),
    updatedAt: new Date(raw.updated_at || new Date()),
  }
}

function mapBackendOrderInvoice(raw: BackendOrderInvoice): OrderInvoice {
  const normalizedStatus = String(raw.status || 'PENDING').toUpperCase()
  const status = ['PENDING', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELLED', 'ERROR'].includes(normalizedStatus)
    ? normalizedStatus as OrderInvoice['status']
    : 'PENDING'

  return {
    id: String(raw.id),
    storeId: String(raw.store_id),
    orderId: String(raw.order_id),
    status,
    payload: raw.payload && typeof raw.payload === 'object' ? raw.payload : {},
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
    nfNumber: raw.nf_number ? String(raw.nf_number) : null,
    pdfUrl: raw.pdf_url ? String(raw.pdf_url) : null,
    xmlUrl: raw.xml_url ? String(raw.xml_url) : null,
    accessKey: raw.access_key ? String(raw.access_key) : null,
    integrationName: raw.integration_name ? String(raw.integration_name) : null,
    integrationReferenceId: raw.integration_reference_id ? String(raw.integration_reference_id) : null,
    errorMessage: raw.error_message ? String(raw.error_message) : null,
    issuedAt: raw.issued_at ? new Date(raw.issued_at) : null,
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  }
}

function mapBackendOrderLabel(raw: BackendOrderLabel): OrderLabel {
  const normalizedStatus = String(raw.status || 'ISSUED').toUpperCase()
  const status = ['ISSUED', 'ERROR'].includes(normalizedStatus)
    ? normalizedStatus as OrderLabel['status']
    : 'ISSUED'

  return {
    id: String(raw.id),
    storeId: String(raw.store_id),
    orderId: String(raw.order_id),
    status,
    trackingCode: raw.tracking_code ? String(raw.tracking_code) : null,
    carrier: raw.carrier ? String(raw.carrier) : null,
    pdfUrl: raw.pdf_url ? String(raw.pdf_url) : null,
    integrationName: raw.integration_name ? String(raw.integration_name) : null,
    integrationReferenceId: raw.integration_reference_id ? String(raw.integration_reference_id) : null,
    errorMessage: raw.error_message ? String(raw.error_message) : null,
    issuedAt: raw.issued_at ? new Date(raw.issued_at) : null,
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  }
}

async function resolveAssistedCustomerById(customerId: string): Promise<Customer | null> {
  const response = await getCustomerDetailAction(customerId)
  if (!response.success || !response.data) {
    return null
  }
  return response.data
}

function mapBackendOrderDetailToAdminOrder(
  order: BackendOrder,
  items: BackendOrderItem[]
): Order {
  const hasItems = Array.isArray(items) && items.length > 0
  const totalsByItemStatus = (items || []).reduce(
    (acc, item) => {
      const status = String(item.status || 'active').toLowerCase()
      const qty = Number(item.quantity || 0)
      if (status === 'removed') return acc
      acc.totalItems += qty
      if (status === 'attended') {
        acc.fulfilledItems += qty
      }
      return acc
    },
    { totalItems: 0, fulfilledItems: 0 }
  )

  const subtotal = hasItems
    ? (items || []).reduce(
        (sum, item) => {
          const status = String(item.status || 'active').toLowerCase()
          if (status === 'removed') return sum
          return sum + (Number(item.unit_price_cents || 0) / 100) * Number(item.quantity || 0)
        },
        0
      )
    : Math.max(0, Number(order.order_subtotal_cents ?? 0)) / 100

  const rawCouponDiscount = Number(order.coupon_discount_cents ?? 0) / 100
  const rawTierDiscount = Number(order.tier_discount_cents ?? 0) / 100
  const rawPaymentMethodDiscount = hasItems
    ? (items || []).reduce(
        (sum, item) => sum + (Number(item.payment_method_discount_cents ?? 0) / 100),
        0
      )
    : Number(order.order_payment_method_discount_cents ?? 0) / 100
  const discountTotal =
    Math.abs(rawCouponDiscount) +
    Math.abs(rawTierDiscount) +
    Math.abs(rawPaymentMethodDiscount)
  const rawDiscount = rawCouponDiscount + rawTierDiscount + rawPaymentMethodDiscount
  const shippingPrice = Math.max(
    0,
    Number(order.shipping_price_cents ?? order.meta?.checkout?.shipping?.price_cents ?? 0)
  ) / 100
  const manualDiscount = Math.max(0, Number(order.manual_discount_cents ?? 0)) / 100

  const paymentCode = String(order.meta?.checkout?.payment?.code || '').trim()
  const normalizedPayment = [
    'PIX',
    'BOLETO',
    'FATURADO',
    'CARTAO_EXTERNO',
  ].includes(paymentCode)
    ? paymentCode
    : 'PIX'

  const paymentStatusRaw = String(order.payment_status || order.meta?.checkout?.payment?.status || 'PENDING').toUpperCase()
  const paymentStatus = ['PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'CANCELLED'].includes(paymentStatusRaw)
    ? paymentStatusRaw
    : 'PENDING'
  const shippingName = order.shipping_method_name || order.meta?.checkout?.shipping?.name || null

  return {
    id: String(order.id),
    customerId: String(order.customer_id),
    createdByUserId: '',
    createdBySellerId: null,
    status: String(order.status || 'PENDING').toUpperCase() as OrderStatus,
    paymentStatus: paymentStatus as Order['paymentStatus'],
    subtotal,
    couponDiscount: Math.abs(rawCouponDiscount),
    tierDiscount: Math.abs(rawTierDiscount),
    discountTotal,
    manualDiscount,
    total: Math.max(0, subtotal + rawDiscount - manualDiscount + shippingPrice),
    fulfilledTotal: 0,
    totalItems: hasItems ? totalsByItemStatus.totalItems : Math.max(0, Number(order.order_total_items ?? 0)),
    fulfilledItems: hasItems ? totalsByItemStatus.fulfilledItems : Math.max(0, Number(order.order_fulfilled_items ?? 0)),
    shippingName,
    shippingPrice,
    paymentMethod: normalizedPayment as Order['paymentMethod'],
    notes: order.meta?.checkout?.notes ?? order.note ?? null,
    internalNotes: order.meta?.backoffice?.internal_notes ?? null,
    trackingCode: order.meta?.backoffice?.tracking?.code ?? null,
    trackingUrl: order.meta?.backoffice?.tracking?.url ?? null,
    shippingStreet: order.meta?.checkout?.address?.street || '-',
    shippingNumber: order.meta?.checkout?.address?.number || '-',
    shippingComplement: order.meta?.checkout?.address?.complement || null,
    shippingNeighborhood: order.meta?.checkout?.address?.neighborhood || '-',
    shippingCity: order.meta?.checkout?.address?.city || '-',
    shippingState: order.meta?.checkout?.address?.state || '-',
    shippingZipCode: order.meta?.checkout?.address?.zip_code || '-',
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at),
  }
}

function mapBackendOrderDetailToStorefront(
  order: BackendOrder,
  items: BackendOrderItem[]
): StorefrontOrder {
  const mappedItems: StorefrontOrderItem[] = (items || []).map((item) => {
    const quantity = Number(item.quantity || 0)
    const unitPrice = Number(item.unit_price_cents || 0) / 100
    const totalPrice = unitPrice * quantity

    return {
      id: String(item.id),
      quantity,
      unitPrice,
      totalPrice,
      variant: {
        sku: String(item.variant_sku || `VAR-${item.variant_id}`),
        product: {
          name: String(item.product_name || `Produto #${item.product_id}`),
        },
      },
    }
  })

  const subtotal = mappedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  const checkoutMeta = order.meta?.checkout
  const rawCouponDiscount = Number(order.coupon_discount_cents ?? 0) / 100
  const rawTierDiscount = Number(order.tier_discount_cents ?? 0) / 100
  const rawPaymentMethodDiscount = (items || []).reduce(
    (sum, item) => sum + (Number(item.payment_method_discount_cents ?? 0) / 100),
    0
  )
  const rawDiscount = rawCouponDiscount + rawTierDiscount + rawPaymentMethodDiscount
  const discountAmount =
    Math.abs(rawCouponDiscount) +
    Math.abs(rawTierDiscount) +
    Math.abs(rawPaymentMethodDiscount)
  const shippingCost = Math.max(
    0,
    Number(order.shipping_price_cents ?? checkoutMeta?.shipping?.price_cents ?? 0)
  ) / 100
  const totalAmount = Math.max(0, subtotal + rawDiscount + shippingCost)
  const paymentStatusRaw = String(order.payment_status || checkoutMeta?.payment?.status || 'PENDING').toUpperCase()
  const paymentStatus = ['PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'CANCELLED'].includes(paymentStatusRaw)
    ? paymentStatusRaw
    : 'PENDING'

  return {
    id: String(order.id),
    orderNumber: String(order.id),
    status: String(order.status || 'PENDING').toUpperCase(),
    createdAt: order.created_at,
    totalAmount,
    subtotal,
    discountAmount,
    shippingCost,
    paymentMethod:
      String(checkoutMeta?.payment?.name || '').trim() ||
      String(checkoutMeta?.payment?.code || '').trim() ||
      'Não informado',
    paymentStatus,
    notes: checkoutMeta?.notes ?? order.note ?? null,
    shippingStreet: checkoutMeta?.address?.street || '-',
    shippingNumber: checkoutMeta?.address?.number || '-',
    shippingComplement: checkoutMeta?.address?.complement || null,
    shippingNeighborhood: checkoutMeta?.address?.neighborhood || '-',
    shippingCity: checkoutMeta?.address?.city || '-',
    shippingState: checkoutMeta?.address?.state || '-',
    shippingZipCode: checkoutMeta?.address?.zip_code || '-',
    items: mappedItems,
  }
}

export async function getMyOrdersAction(storeId?: number | string): Promise<ApiResponse<StorefrontOrder[]>> {
  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)
  if (!storefrontApiKey) {
    return { success: false, error: 'Escopo da loja ausente: configure X-API-Key da storefront' }
  }

  const cookieStore = await cookies()
  const b2bToken = cookieStore.get('b2bAuthToken')?.value
  const clientToken = cookieStore.get('clientAuthToken')?.value
  const sessionId = cookieStore.get('sessionID')?.value
  if (!b2bToken && !clientToken) return { success: false, error: 'Não autorizado' }

  const authToken = clientToken || b2bToken

  if (!authToken) {
    return { success: false, error: 'Não autorizado' }
  }

  const authCookieName = 'clientAuthToken'
  const authTokenPayload = decodeJwtPayload(authToken)

  console.log('[orders:getMyOrdersAction] auth-debug', {
    storeId,
    base,
    hasStorefrontApiKey: Boolean(storefrontApiKey),
    hasSessionId: Boolean(sessionId),
    hasClientToken: Boolean(clientToken),
    hasB2bToken: Boolean(b2bToken),
    selectedCookieName: authCookieName,
    selectedTokenMasked: maskToken(authToken),
    tokenSub: authTokenPayload?.sub ?? null,
    tokenStoreId: authTokenPayload?.store_id ?? authTokenPayload?.storeId ?? null,
  })

  const cookieParts = [
    sessionId ? `sessionID=${sessionId}` : null,
    `${authCookieName}=${authToken}`,
  ].filter(Boolean) as string[]
  const cookieHeader = cookieParts.join('; ')

  const requestHeaders = withStorefrontScopeHeaders({
    cookie: cookieHeader,
    authorization: `Bearer ${authToken}`,
  }, storefrontApiKey)

  try {
    const listUrl = new URL('/storefront/orders', base)
    console.log('[orders:getMyOrdersAction] request', {
      url: listUrl.toString(),
      hasAuthorizationHeader: true,
      cookieHeaderPreview: cookieHeader.slice(0, 120),
    })

    const listResponse = await fetch(listUrl, {
      headers: requestHeaders,
      cache: 'no-store',
    })

    console.log('[orders:getMyOrdersAction] list-response', {
      status: listResponse.status,
      ok: listResponse.ok,
    })

    if (!listResponse.ok) {
      const errorText = await listResponse.text().catch(() => '')
      console.log('[orders:getMyOrdersAction] list-error', {
        status: listResponse.status,
        body: errorText.slice(0, 300),
      })
      return { success: false, error: errorText || 'Erro ao buscar pedidos' }
    }

    const orders = (await listResponse.json()) as BackendOrder[]

    const details = await Promise.all(
      (Array.isArray(orders) ? orders : []).map(async (order) => {
        const detailResponse = await fetch(new URL(`/storefront/orders/${order.id}`, base), {
          headers: requestHeaders,
          cache: 'no-store',
        })

        if (!detailResponse.ok) {
          return mapBackendOrderDetailToStorefront(order, [])
        }

        const payload = await detailResponse.json()
        const parsedPayload = parseStorefrontOrderDetailPayload(payload, order)
        const backendOrder = parsedPayload.order || order
        const backendItems = parsedPayload.items

        return mapBackendOrderDetailToStorefront(backendOrder, backendItems)
      })
    )

    return { success: true, data: details }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar pedidos',
    }
  }
}

export async function getMyOrderDetailAction(id: string, storeId?: number | string): Promise<ApiResponse<StorefrontOrder>> {
  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { success: false, error: 'Pedido inválido' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)
  if (!storefrontApiKey) {
    return { success: false, error: 'Escopo da loja ausente: configure X-API-Key da storefront' }
  }

  const cookieStore = await cookies()
  const b2bToken = cookieStore.get('b2bAuthToken')?.value
  const clientToken = cookieStore.get('clientAuthToken')?.value
  const sessionId = cookieStore.get('sessionID')?.value
  if (!b2bToken && !clientToken) return { success: false, error: 'Não autorizado' }

  const authToken = clientToken || b2bToken

  if (!authToken) {
    return { success: false, error: 'Não autorizado' }
  }

  const authCookieName = 'clientAuthToken'
  const authTokenPayload = decodeJwtPayload(authToken)

  console.log('[orders:getMyOrderDetailAction] auth-debug', {
    storeId,
    orderId: numericId,
    base,
    hasStorefrontApiKey: Boolean(storefrontApiKey),
    hasSessionId: Boolean(sessionId),
    hasClientToken: Boolean(clientToken),
    hasB2bToken: Boolean(b2bToken),
    selectedCookieName: authCookieName,
    selectedTokenMasked: maskToken(authToken),
    tokenSub: authTokenPayload?.sub ?? null,
    tokenStoreId: authTokenPayload?.store_id ?? authTokenPayload?.storeId ?? null,
  })

  const cookieParts = [
    sessionId ? `sessionID=${sessionId}` : null,
    `${authCookieName}=${authToken}`,
  ].filter(Boolean) as string[]
  const cookieHeader = cookieParts.join('; ')

  const requestHeaders = withStorefrontScopeHeaders({
    cookie: cookieHeader,
    authorization: `Bearer ${authToken}`,
  }, storefrontApiKey)

  try {
    const detailUrl = new URL(`/storefront/orders/${numericId}`, base)
    console.log('[orders:getMyOrderDetailAction] request', {
      url: detailUrl.toString(),
      hasAuthorizationHeader: true,
      cookieHeaderPreview: cookieHeader.slice(0, 120),
    })

    const response = await fetch(detailUrl, {
      headers: requestHeaders,
      cache: 'no-store',
    })

    console.log('[orders:getMyOrderDetailAction] response', {
      status: response.status,
      ok: response.ok,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.log('[orders:getMyOrderDetailAction] error', {
        status: response.status,
        body: errorText.slice(0, 300),
      })
      return { success: false, error: errorText || 'Pedido não encontrado' }
    }

    const payload = await response.json()
    const parsedPayload = parseStorefrontOrderDetailPayload(payload)
    const order = parsedPayload.order
    const items = parsedPayload.items

    if (!order) {
      return { success: false, error: 'Pedido não encontrado' }
    }

    return { success: true, data: mapBackendOrderDetailToStorefront(order, items) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar pedido',
    }
  }
}

export async function getOrdersAction(filters?: {
  customerId?: string
  status?: string
  assignedSellerId?: string
  storeId?: string
}): Promise<ApiResponse<Order[]>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  if (!session && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  if (hasAdminToken || session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER') {
    const base = resolveBackendBaseUrl()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const cookieHeader = await buildBackofficeCookieHeader()

    try {
      const listUrl = new URL('/orders', base)
      const scopedStoreId = String(filters?.storeId || '').trim() || (await resolveDefaultStoreId())
      if (scopedStoreId) {
        listUrl.searchParams.set('store_id', scopedStoreId)
      }
      if (filters?.customerId) {
        listUrl.searchParams.set('customer_id', String(filters.customerId))
      }
      if (filters?.status) {
        listUrl.searchParams.set('status', String(filters.status))
      }

      const listResponse = await fetch(listUrl, {
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      })

      if (!listResponse.ok) {
        const errorText = await listResponse.text().catch(() => '')
        return { success: false, error: errorText || 'Erro ao buscar pedidos' }
      }

      const orders = (await listResponse.json()) as BackendOrder[]
      const mappedOrders = (Array.isArray(orders) ? orders : []).map((order) =>
        mapBackendOrderDetailToAdminOrder(order, [])
      )

      return { success: true, data: mappedOrders }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar pedidos',
      }
    }
  }

  // Filter based on role
  if (session?.role === 'B2B_CUSTOMER' || session?.role === 'PENDING') {
    const customer = session.customerId ? await getCustomerById(session.customerId) : null
    if (!customer) {
      return { success: true, data: [] }
    }
    filters = { customerId: customer.id }
  } else if (session?.role === 'SELLER') {
    filters = { ...filters, assignedSellerId: session.id }
  }

  const orders = await getOrders(filters)
  return { success: true, data: orders }
}

export async function getCustomerOrderSummaryAction(filters?: {
  storeId?: string
}): Promise<ApiResponse<Record<string, { ordersCount: number; totalSpent: number }>>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  if (!session && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  if (!(hasAdminToken || session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER')) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const cookieHeader = await buildBackofficeCookieHeader()

  try {
    const summaryUrl = new URL('/orders/customers-summary', base)
    const scopedStoreId = String(filters?.storeId || '').trim() || (await resolveDefaultStoreId())
    if (scopedStoreId) {
      summaryUrl.searchParams.set('store_id', scopedStoreId)
    }

    const response = await fetch(summaryUrl, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao buscar resumo de pedidos' }
    }

    const rows = (await response.json()) as Array<{
      customer_id: number
      orders_count: number
      total_spent_cents: number
    }>

    const summary = (Array.isArray(rows) ? rows : []).reduce<Record<string, { ordersCount: number; totalSpent: number }>>(
      (acc, row) => {
        const customerId = String(row.customer_id || '')
        if (!customerId) return acc

        acc[customerId] = {
          ordersCount: Number(row.orders_count || 0),
          totalSpent: Number(row.total_spent_cents || 0) / 100,
        }

        return acc
      },
      {}
    )

    return { success: true, data: summary }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar resumo de pedidos',
    }
  }
}

export async function getOrderDetailAction(id: string): Promise<ApiResponse<OrderWithItems>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  if (!session && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  if (hasAdminToken || session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER') {
    const base = resolveBackendBaseUrl()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericId = Number(id)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return { success: false, error: 'Pedido inválido' }
    }

    const cookieHeader = await buildBackofficeCookieHeader()

    try {
      const response = await fetch(new URL(`/orders/${numericId}`, base), {
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return { success: false, error: errorText || 'Pedido não encontrado' }
      }

      const payload = (await response.json()) as [BackendOrder, BackendOrderItem[]]
      const backendOrder = payload?.[0]
      const backendItems = Array.isArray(payload?.[1]) ? payload[1] : []

      if (!backendOrder) {
        return { success: false, error: 'Pedido não encontrado' }
      }

      const mappedOrder = mapBackendOrderDetailToAdminOrder(backendOrder, backendItems)
      const mappedItems: OrderItem[] = backendItems.map((item) => {
        const unitPrice = Number(item.unit_price_cents || 0) / 100
        const qty = Number(item.quantity || 0)
        const originalQty = Number(item.original_quantity ?? item.quantity ?? 0)
        const combination = parseVariantCombinationKey(item.variant_combination_key)
        const status = ['active', 'attended', 'removed'].includes(String(item.status || '').toLowerCase())
          ? (String(item.status || '').toLowerCase() as 'active' | 'attended' | 'removed')
          : 'active'
        const variantStockQty = Number(item.variant_stock_qty ?? 0)
        const variantReservedQty = Number(item.variant_reserved_qty ?? 0)
        const variantAvailableQty = Math.max(0, variantStockQty - variantReservedQty)

        return {
          id: String(item.id),
          orderId: String(item.order_id),
          productId: String(item.product_id),
          variantId: String(item.variant_id),
          assetId: Number.isFinite(Number(item.asset_id)) && Number(item.asset_id) > 0
            ? String(item.asset_id)
            : null,
          assetName: item.asset_name ? String(item.asset_name) : null,
          assetImageUrl: item.asset_image_url ? String(item.asset_image_url) : null,
          imageUrl: item.image_url ? String(item.image_url) : null,
          nameSnapshot: String(item.asset_name || item.product_name || `Produto #${item.product_id}`),
          skuSnapshot: String(item.variant_sku || `VAR-${item.variant_id}`),
          variantCombinationKey: item.variant_combination_key ? String(item.variant_combination_key) : null,
          colorSnapshot: combination.colorSnapshot,
          sizeSnapshot: combination.sizeSnapshot,
          qty,
          originalQty,
          unitPrice,
          total: unitPrice * qty,
          fulfilled: status === 'attended',
          variantStockQty,
          variantReservedQty,
          variantAvailableQty,
          status,
          origin: normalizeOrderItemOrigin(item.origin),
        }
      })

      const customer = await getCustomerById(String(backendOrder.customer_id))

      return {
        success: true,
        data: {
          ...mappedOrder,
          items: mappedItems,
          customer: customer || undefined,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar pedido',
      }
    }
  }

  const order = await getOrderById(id)
  if (!order) {
    return { success: false, error: 'Pedido não encontrado' }
  }

  // Check access
  if (session.role === 'B2B_CUSTOMER' || session.role === 'PENDING') {
    const customer = session.customerId ? await getCustomerById(session.customerId) : null
    if (!customer || order.customerId !== customer.id) {
      return { success: false, error: 'Não autorizado' }
    }
  } else if (session.role === 'SELLER') {
    const orderCustomer = await getCustomerById(order.customerId)
    if (!orderCustomer || orderCustomer.assignedSellerId !== session.id) {
      return { success: false, error: 'Não autorizado' }
    }
  }

  const items = await getOrderItems(id)
  const customer = await getCustomerById(order.customerId)

  return {
    success: true,
    data: { ...order, items, customer: customer || undefined },
  }
}

export async function getOrderInvoiceAction(id: string): Promise<ApiResponse<OrderInvoice>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  if ((!session || !canManageOrders(session.role)) && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { success: false, error: 'Pedido inválido' }
  }

  const cookieHeader = await buildBackofficeCookieHeader()

  try {
    const response = await fetch(new URL(`/orders/${numericId}/invoice`, base), {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Invoice não encontrada' }
    }

    const payload = (await response.json()) as BackendOrderInvoice
    return { success: true, data: mapBackendOrderInvoice(payload) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar invoice do pedido',
    }
  }
}

export async function getOrderLabelAction(id: string): Promise<ApiResponse<OrderLabel>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  if ((!session || !canManageOrders(session.role)) && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { success: false, error: 'Pedido inválido' }
  }

  const cookieHeader = await buildBackofficeCookieHeader()

  try {
    const response = await fetch(new URL(`/orders/${numericId}/label`, base), {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Etiqueta não encontrada' }
    }

    const payload = (await response.json()) as BackendOrderLabel
    return { success: true, data: mapBackendOrderLabel(payload) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar etiqueta do pedido',
    }
  }
}

export async function upsertOrderInvoiceAction(
  id: string,
  data: {
    storeId?: string
    status?: OrderInvoice['status']
    payload?: Record<string, unknown>
    meta?: Record<string, unknown>
    nfNumber?: string | null
    pdfUrl?: string | null
    xmlUrl?: string | null
    accessKey?: string | null
    integrationName?: string | null
    integrationReferenceId?: string | null
    errorMessage?: string | null
    issuedAt?: Date | string | null
  }
): Promise<ApiResponse<OrderInvoice>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  if ((!session || !canManageOrders(session.role)) && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { success: false, error: 'Pedido inválido' }
  }

  const cookieHeader = await buildBackofficeCookieHeader()

  try {
    const response = await fetch(new URL(`/orders/${numericId}/invoice`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        ...(data.storeId ? { store_id: Number(data.storeId) } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.payload ? { payload: data.payload } : {}),
        ...(data.meta ? { meta: data.meta } : {}),
        ...(data.nfNumber !== undefined ? { nf_number: data.nfNumber } : {}),
        ...(data.pdfUrl !== undefined ? { pdf_url: data.pdfUrl } : {}),
        ...(data.xmlUrl !== undefined ? { xml_url: data.xmlUrl } : {}),
        ...(data.accessKey !== undefined ? { access_key: data.accessKey } : {}),
        ...(data.integrationName !== undefined ? { integration_name: data.integrationName } : {}),
        ...(data.integrationReferenceId !== undefined ? { integration_reference_id: data.integrationReferenceId } : {}),
        ...(data.errorMessage !== undefined ? { error_message: data.errorMessage } : {}),
        ...(data.issuedAt !== undefined
          ? { issued_at: data.issuedAt ? new Date(data.issuedAt).toISOString() : null }
          : {}),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao salvar invoice do pedido' }
    }

    const payload = (await response.json()) as BackendOrderInvoice

    revalidatePath('/orders')
    revalidatePath(`/orders/${id}`)

    return { success: true, data: mapBackendOrderInvoice(payload) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao salvar invoice do pedido',
    }
  }
}

export async function generateOrderInvoiceAction(id: string): Promise<ApiResponse<OrderInvoice>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  if ((!session || !canManageOrders(session.role)) && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { success: false, error: 'Pedido inválido' }
  }

  const cookieHeader = await buildBackofficeCookieHeader()

  try {
    const response = await fetch(new URL(`/orders/${numericId}/invoice`, base), {
      method: 'POST',
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao gerar invoice do pedido' }
    }

    const payload = (await response.json()) as BackendOrderInvoice

    revalidatePath('/orders')
    revalidatePath(`/orders/${id}`)

    return { success: true, data: mapBackendOrderInvoice(payload) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar invoice do pedido',
    }
  }
}

export async function createOrderAction(
  _prevState: ApiResponse<{ orderId: string }> | null,
  formData: FormData
): Promise<ApiResponse<{ orderId: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Não autorizado' }
  }

  if (!canPurchase(session.role)) {
    return { success: false, error: 'Seu cadastro precisa ser aprovado para fazer pedidos' }
  }

  const customerId = Number(session.customerId)
  if (!Number.isFinite(customerId) || customerId <= 0) {
    return { success: false, error: 'Cliente inválido para finalização do pedido' }
  }

  const currentB2bCustomerResult = await getCurrentB2bCustomerAction()
  const customer = currentB2bCustomerResult.success
    ? (currentB2bCustomerResult.data ?? null)
    : (session.customerId ? await getCustomerById(session.customerId) : null)
  if (!customer) {
    return { success: false, error: 'Cliente não encontrado' }
  }

  const settings = await getSiteSettings()
  const routeStoreIdRaw = String(formData.get('storeId') || '').trim()
  const routeStoreId = routeStoreIdRaw && Number.isFinite(Number(routeStoreIdRaw))
    ? String(Math.trunc(Number(routeStoreIdRaw)))
    : null

  const data = {
    shippingOptionId: formData.get('shippingOptionId') as string,
    paymentMethod: formData.get('paymentMethod') as 'PIX' | 'BOLETO' | 'FATURADO' | 'CARTAO_EXTERNO',
    notes: formData.get('notes') as string || undefined,
    shippingStreet: formData.get('shippingStreet') as string || undefined,
    shippingNumber: formData.get('shippingNumber') as string || undefined,
    shippingComplement: formData.get('shippingComplement') as string || undefined,
    shippingNeighborhood: formData.get('shippingNeighborhood') as string || undefined,
    shippingCity: formData.get('shippingCity') as string || undefined,
    shippingState: formData.get('shippingState') as string || undefined,
    shippingZipCode: formData.get('shippingZipCode') as string || undefined,
  }

  const validation = checkoutSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  const cartResult = await getCartAction()
  if (!cartResult.success || !cartResult.data || cartResult.data.items.length === 0) {
    return { success: false, error: 'Carrinho vazio' }
  }

  const totalPieces = cartResult.data.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  )
  const minPiecesRequired = Math.max(
    0,
    Math.trunc(
      Number(
        typeof customer.minPiecesOverride === 'number'
          ? customer.minPiecesOverride
          : settings.defaultMinPieces
      ) || 0
    )
  )

  if (minPiecesRequired > 0 && totalPieces < minPiecesRequired) {
    return {
      success: false,
      error: `Pedido mínimo de ${minPiecesRequired} peças. Seu carrinho possui ${totalPieces} peça${totalPieces === 1 ? '' : 's'}.`,
    }
  }

  const hasPaymentTerms = Array.isArray(customer.paymentTerms) && customer.paymentTerms.length > 0
  if (hasPaymentTerms && !customer.paymentTerms.includes(data.paymentMethod)) {
    return { success: false, error: 'Forma de pagamento não disponível para seu cadastro' }
  }

  const shippingOptions = Array.isArray(settings?.shippingOptions)
    ? settings.shippingOptions
    : []

  const shippingOption = shippingOptions.find((option) => option.id === data.shippingOptionId)
  if (shippingOptions.length > 0 && !shippingOption) {
    return { success: false, error: 'Opção de frete inválida' }
  }

  const resolvedShippingName =
    shippingOption?.name ||
    cartResult.data.shippingOptionCode ||
    data.shippingOptionId ||
    'Frete'

  const resolvedShippingEstimatedDays = Number.isFinite(Number(shippingOption?.estimatedDays))
    ? Number(shippingOption?.estimatedDays)
    : 0

  const notes = data.notes?.trim() || undefined
  if (notes) {
    const notesResult = await updateCartNotesAction({ notes })
    if (!notesResult.success) {
      return { success: false, error: notesResult.error || 'Erro ao salvar observações do pedido' }
    }
  }

  const backendBase = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!backendBase) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(routeStoreId)
  if (!storefrontApiKey) {
    return { success: false, error: 'Escopo da loja ausente: configure X-API-Key da storefront' }
  }

  const cookieStore = await cookies()
  const sessionId = cookieStore.get('sessionID')?.value
  const clientAuthToken = cookieStore.get('clientAuthToken')?.value ?? cookieStore.get('b2bAuthToken')?.value
  const cookieParts = [
    sessionId ? `sessionID=${sessionId}` : null,
    clientAuthToken ? `clientAuthToken=${clientAuthToken}` : null,
  ].filter(Boolean) as string[]
  const cookieHeader = cookieParts.length > 0 ? cookieParts.join('; ') : undefined

  const items = cartResult.data.items.map((item) => {
    const rawUnitPrice = Number((item as { unitPrice?: unknown }).unitPrice ?? 0)
    const rawPriceTableDiscountCents = Number(
      (item as { priceTableDiscountCents?: unknown }).priceTableDiscountCents ?? 0
    )
    const rawExtraDiscountCents = Number(
      (item as { extraDiscountCents?: unknown }).extraDiscountCents ?? 0
    )

    return {
      variant_id: Number(item.variantId),
      quantity: Number(item.quantity),
      unit_price_cents: Math.max(0, Math.round(rawUnitPrice * 100)),
      price_table_discount_cents: Math.max(0, Math.round(rawPriceTableDiscountCents)),
      extra_discount_cents: Math.max(0, Math.round(rawExtraDiscountCents)),
    }
  })

  const shippingAmount =
    typeof cartResult.data.shippingAmount === 'number'
      ? cartResult.data.shippingAmount
      : Number(shippingOption?.price || 0)

  const resolvedShippingMethodId = Number(cartResult.data.shippingMethodId)
  const validShippingMethodId = Number.isFinite(resolvedShippingMethodId) && resolvedShippingMethodId > 0
    ? resolvedShippingMethodId
    : null

  const rawCouponDiscountCents = Math.round((cartResult.data.couponDiscountAmount || 0) * 100)
  const couponDiscountCents = rawCouponDiscountCents > 0 ? -rawCouponDiscountCents : rawCouponDiscountCents
  const rawTierDiscountCents = Math.round((cartResult.data.tierDiscountAmount || 0) * 100)
  const tierDiscountCents = rawTierDiscountCents > 0 ? -rawTierDiscountCents : rawTierDiscountCents

  const checkoutMeta = {
    checkout: {
      notes: notes || null,
      coupon: {
        code: cartResult.data.couponCode || null,
        discount_cents: couponDiscountCents,
      },
      tier: {
        discount_cents: tierDiscountCents,
      },
      payment: {
        code: data.paymentMethod,
        name: data.paymentMethod,
      },
      shipping: {
        option_id: data.shippingOptionId,
        code: cartResult.data.shippingOptionCode || data.shippingOptionId,
        name: resolvedShippingName,
        price_cents: Math.max(0, Math.round(shippingAmount * 100)),
      },
      address: {
        street: data.shippingStreet || customer.street,
        number: data.shippingNumber || customer.number,
        complement: data.shippingComplement || customer.complement || null,
        neighborhood: data.shippingNeighborhood || customer.neighborhood,
        city: data.shippingCity || customer.city,
        state: data.shippingState || customer.state,
        zip_code: data.shippingZipCode || customer.zipCode,
      },
    },
  }

  if (items.some((item) => !Number.isFinite(item.variant_id) || item.variant_id <= 0 || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
    return { success: false, error: 'Itens inválidos para finalização do pedido' }
  }

  const response = await fetch(new URL('/orders', backendBase), {
    method: 'POST',
    headers: withStorefrontScopeHeaders({
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    }, storefrontApiKey),
    body: JSON.stringify({
      customer_id: customerId,
      note: notes || null,
      meta: checkoutMeta,
      coupon_discount_cents: couponDiscountCents,
      tier_discount_cents: tierDiscountCents,
      shipping_price_cents: Math.max(0, Math.round(shippingAmount * 100)),
      shipping_delivery_days: Number.isFinite(Number(shippingOption?.estimatedDays))
        ? Number(shippingOption?.estimatedDays)
        : resolvedShippingEstimatedDays,
      shipping_method_source: 'CHECKOUT',
      shipping_method_id: validShippingMethodId,
      shipping_method_ref: data.shippingOptionId,
      shipping_method_code: cartResult.data.shippingOptionCode || data.shippingOptionId,
      shipping_method_name: resolvedShippingName,
      items,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    let backendError = 'Erro ao finalizar pedido'
    try {
      const text = await response.text()
      if (text.trim()) backendError = text
    } catch {
      // fallback
    }
    return { success: false, error: backendError }
  }

  const payload = (await response.json()) as { id?: number }
  const orderId = payload?.id ? String(payload.id) : ''
  if (!orderId) {
    return { success: false, error: 'Pedido criado sem identificador válido' }
  }

  const clearResult = await clearCartAction()
  if (!clearResult.success) {
    return { success: false, error: clearResult.error || 'Pedido criado, mas não foi possível limpar o carrinho' }
  }

  revalidatePath('/account/orders')
  revalidatePath('/checkout')
  revalidatePath('/cart')

  return { success: true, data: { orderId } }
}

export async function updateOrderStatusAction(
  id: string,
  status: OrderStatus
): Promise<ApiResponse<Order>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)
  if ((!session || !canManageOrders(session.role)) && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  const order = await getOrderById(id)
  if (!order) {
    return { success: false, error: 'Pedido não encontrado' }
  }

  const beforeData = { ...order }
  const updated = await updateOrder(id, { status })
  if (!updated) {
    return { success: false, error: 'Erro ao atualizar pedido' }
  }

  await createAuditLog({
    actorUserId: session?.id || 'admin-session',
    action: 'ORDER_STATUS_UPDATED',
    entityType: 'Order',
    entityId: id,
    beforeJson: beforeData as unknown as Record<string, unknown>,
    afterJson: updated as unknown as Record<string, unknown>,
  })

  revalidatePath('/orders')
  revalidatePath(`/orders/${id}`)
  
  return { success: true, data: updated }
}

// Assisted order (seller creates order for customer)
export async function createAssistedOrderAction(formData: FormData): Promise<ApiResponse<Order>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Não autorizado' }
  }

  // Check if seller can create orders
  if (session.role === 'SELLER') {
    const { canCreateOrders } = await getSellerPermissionsAction()
    if (!canCreateOrders) {
      return { success: false, error: 'Você não tem permissão para criar pedidos' }
    }
  } else if (session.role !== 'ADMIN' && session.role !== 'SALES_MANAGER') {
    return { success: false, error: 'Não autorizado' }
  }

  const data = {
    customerId: formData.get('customerId') as string,
    items: JSON.parse(formData.get('items') as string),
    shippingOptionId: formData.get('shippingOptionId') as string,
    paymentMethod: formData.get('paymentMethod') as 'PIX' | 'BOLETO' | 'FATURADO' | 'CARTAO_EXTERNO',
    notes: formData.get('notes') as string || undefined,
  }
  const shippingPriceRaw = Number(formData.get('shippingPrice') ?? 0)
  const manualShippingPrice = Number.isFinite(shippingPriceRaw)
    ? Math.max(0, shippingPriceRaw)
    : 0
  const manualDiscountRaw = Number(formData.get('manualDiscount') ?? 0)
  const manualDiscount = Number.isFinite(manualDiscountRaw)
    ? Math.max(0, manualDiscountRaw)
    : 0

  const validation = assistedOrderSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  // Get customer
  const customer = await resolveAssistedCustomerById(data.customerId)
  if (!customer) {
    return { success: false, error: 'Cliente não encontrado' }
  }

  // If seller, check if customer is assigned to them
  if (session.role === 'SELLER' && customer.assignedSellerId !== session.id) {
    return { success: false, error: 'Cliente não está na sua carteira' }
  }

  // Check if customer is approved
  if (customer.status !== 'APPROVED') {
    return { success: false, error: 'Cliente não está aprovado' }
  }

  // Validate payment method only when customer has explicit payment terms
  const hasPaymentTerms = Array.isArray(customer.paymentTerms) && customer.paymentTerms.length > 0
  if (hasPaymentTerms && !customer.paymentTerms.includes(data.paymentMethod)) {
    return { success: false, error: 'Forma de pagamento não disponível para este cliente' }
  }

  const backendBase = resolveBackendBaseUrl()
  if (!backendBase) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const cookieHeader = await buildBackofficeCookieHeader()
  if (!cookieHeader) {
    return { success: false, error: 'Sessão admin não encontrada' }
  }

  const parsedCustomerId = Number(data.customerId)
  if (!Number.isFinite(parsedCustomerId) || parsedCustomerId <= 0) {
    return { success: false, error: 'Cliente inválido' }
  }

  const mappedItems: Array<{ variant_id: number; quantity: number }> = []
  for (const item of data.items) {
    const variantId = Number(item.variantId)
    if (!Number.isFinite(variantId) || variantId <= 0) {
      return { success: false, error: 'Variação inválida no pedido' }
    }

    const quantity = Number(item.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: 'Quantidade inválida no pedido' }
    }

    mappedItems.push({
      variant_id: Math.trunc(variantId),
      quantity: Math.trunc(quantity),
    })
  }

  const scopedStoreId = await resolveDefaultStoreId()
  const shippingPriceCents = Math.max(0, Math.round(manualShippingPrice * 100))
  const manualDiscountCents = Math.max(0, Math.round(manualDiscount * 100))
  const paymentLabel =
    data.paymentMethod === 'BOLETO'
      ? 'Boleto'
      : data.paymentMethod === 'FATURADO'
      ? 'Faturado'
      : data.paymentMethod === 'CARTAO_EXTERNO'
      ? 'Cartão (externo)'
      : 'PIX'

  const createPayload = {
    customer_id: Math.trunc(parsedCustomerId),
    ...(scopedStoreId ? { store_id: Number(scopedStoreId) } : {}),
    origin: session.role === 'SELLER' ? 'manager' : 'manager',
    note: data.notes || 'Pedido assistido',
    shipping_price_cents: shippingPriceCents,
    shipping_delivery_days: 0,
    manual_discount_cents: manualDiscountCents,
    meta: {
      checkout: {
        notes: data.notes || null,
        payment: {
          code: data.paymentMethod,
          name: paymentLabel,
          status: 'PENDING',
        },
        shipping: {
          option_id: data.shippingOptionId,
          code: data.shippingOptionId,
          name: data.shippingOptionId === 'manual' ? 'Frete Manual' : data.shippingOptionId,
          price_cents: shippingPriceCents,
        },
        address: {
          street: customer.street,
          number: customer.number,
          complement: customer.complement,
          neighborhood: customer.neighborhood,
          city: customer.city,
          state: customer.state,
          zip_code: customer.zipCode,
        },
      },
      backoffice: {
        internal_notes: null,
        tracking: {
          code: null,
          url: null,
        },
      },
    },
    items: mappedItems,
  }

  const createResponse = await fetch(new URL('/orders', backendBase), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieHeader,
    },
    body: JSON.stringify(createPayload),
    cache: 'no-store',
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao criar pedido' }
  }

  const createdOrder = (await createResponse.json()) as BackendOrder

  let mappedOrder: Order
  try {
    const detailResponse = await fetch(new URL(`/orders/${createdOrder.id}`, backendBase), {
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    })

    if (detailResponse.ok) {
      const detailPayload = (await detailResponse.json()) as [BackendOrder, BackendOrderItem[]]
      const backendOrder = detailPayload?.[0] || createdOrder
      const backendItems = Array.isArray(detailPayload?.[1]) ? detailPayload[1] : []
      mappedOrder = mapBackendOrderDetailToAdminOrder(backendOrder, backendItems)
    } else {
      mappedOrder = mapBackendOrderDetailToAdminOrder(createdOrder, [])
    }
  } catch {
    mappedOrder = mapBackendOrderDetailToAdminOrder(createdOrder, [])
  }

  revalidatePath('/seller/orders')
  revalidatePath('/orders')

  return { success: true, data: mappedOrder }
}

// Update full order (admin only)
export async function updateOrderAction(
  id: string,
  data: {
    status?: OrderStatus
    paymentStatus?: 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED' | 'CANCELLED'
    shippingPrice?: number
    manualDiscount?: number
    trackingCode?: string
    trackingUrl?: string
    notes?: string
    internalNotes?: string
    paymentMethod?: 'PIX' | 'BOLETO' | 'FATURADO' | 'CARTAO_EXTERNO'
  }
): Promise<ApiResponse<Order>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)
  if ((!session || !canManageOrders(session.role)) && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  if (hasAdminToken || session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER') {
    if (data.notes !== undefined) {
      return { success: false, error: 'Observação do cliente não pode ser editada no admin' }
    }

    const base = resolveBackendBaseUrl()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericId = Number(id)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return { success: false, error: 'Pedido inválido' }
    }

    const cookieHeader = await buildBackofficeCookieHeader()

    try {
      if (data.status !== undefined) {
        const statusResponse = await fetch(new URL(`/orders/${numericId}/status`, base), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({ status: data.status }),
        })

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text().catch(() => '')
          return { success: false, error: errorText || 'Erro ao atualizar status do pedido' }
        }
      }

      if (data.shippingPrice !== undefined || data.manualDiscount !== undefined) {
        const amountsResponse = await fetch(new URL(`/orders/${numericId}/amounts`, base), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            ...(data.shippingPrice !== undefined
              ? { shipping_price_cents: Math.max(0, Math.round(Number(data.shippingPrice || 0) * 100)) }
              : {}),
            ...(data.manualDiscount !== undefined
              ? { manual_discount_cents: Math.max(0, Math.round(Number(data.manualDiscount || 0) * 100)) }
              : {}),
          }),
        })

        if (!amountsResponse.ok) {
          const errorText = await amountsResponse.text().catch(() => '')
          return { success: false, error: errorText || 'Erro ao atualizar valores do pedido' }
        }
      }

      if (
        data.paymentStatus !== undefined ||
        data.paymentMethod !== undefined ||
        data.trackingCode !== undefined ||
        data.trackingUrl !== undefined ||
        data.internalNotes !== undefined
      ) {
        const metaResponse = await fetch(new URL(`/orders/${numericId}/meta`, base), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            ...(data.paymentStatus !== undefined
              ? { payment_status: data.paymentStatus }
              : {}),
            ...(data.paymentMethod !== undefined
              ? { payment_method: data.paymentMethod }
              : {}),
            ...(data.trackingCode !== undefined
              ? { tracking_code: data.trackingCode }
              : {}),
            ...(data.trackingUrl !== undefined
              ? { tracking_url: data.trackingUrl }
              : {}),
            ...(data.internalNotes !== undefined
              ? { internal_notes: data.internalNotes }
              : {}),
          }),
        })

        if (!metaResponse.ok) {
          const errorText = await metaResponse.text().catch(() => '')
          return { success: false, error: errorText || 'Erro ao atualizar metadados do pedido' }
        }
      }

      const detailResponse = await fetch(new URL(`/orders/${numericId}`, base), {
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      })

      if (!detailResponse.ok) {
        const errorText = await detailResponse.text().catch(() => '')
        return { success: false, error: errorText || 'Erro ao buscar pedido atualizado' }
      }

      const payload = (await detailResponse.json()) as [BackendOrder, BackendOrderItem[]]
      const backendOrder = payload?.[0]
      const backendItems = Array.isArray(payload?.[1]) ? payload[1] : []

      if (!backendOrder) {
        return { success: false, error: 'Pedido atualizado não encontrado' }
      }

      const mapped = mapBackendOrderDetailToAdminOrder(backendOrder, backendItems)

      revalidatePath('/orders')
      revalidatePath(`/orders/${id}`)

      return { success: true, data: mapped }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao atualizar pedido',
      }
    }
  }

  const order = await getOrderById(id)
  if (!order) {
    return { success: false, error: 'Pedido não encontrado' }
  }

  const beforeData = { ...order }
  
  // Calculate new total if shipping or discount changed
  let newTotal = order.total
  if (data.shippingPrice !== undefined || data.manualDiscount !== undefined) {
    const oldShipping = order.shippingPrice || 0
    const oldManualDiscount = (order as unknown as { manualDiscount?: number }).manualDiscount || 0
    const newShipping = data.shippingPrice ?? oldShipping
    const newManualDiscount = data.manualDiscount ?? oldManualDiscount
    
    // Recalculate: subtotal - discounts + shipping
    newTotal = order.subtotal - order.discountTotal - newManualDiscount + newShipping
  }

  const updated = await updateOrder(id, {
    ...data,
    total: newTotal,
  })
  
  if (!updated) {
    return { success: false, error: 'Erro ao atualizar pedido' }
  }

  await createAuditLog({
    actorUserId: session.id,
    action: 'ORDER_UPDATED',
    entityType: 'Order',
    entityId: id,
    beforeJson: beforeData as unknown as Record<string, unknown>,
    afterJson: updated as unknown as Record<string, unknown>,
  })

  revalidatePath('/orders')
  revalidatePath(`/orders/${id}`)
  
  return { success: true, data: updated }
}

// Stock Mode Helpers for Order Actions
async function getStockModeConfig(): Promise<StockModeConfig> {
  try {
    const result = await getSiteSettingsAction()
    if (result.success && result.data) {
      return {
        stockMode: (result.data.stockMode as StockMode) || 'FANTASY',
        variantMaxQty: Math.max(1, Number(result.data.variantMaxQty || 999)),
      }
    }
  } catch {
    // Silently fall back to defaults
  }
  return { stockMode: 'FANTASY', variantMaxQty: 999 }
}

// Add item to existing order
export async function addOrderItemAction(
  orderId: string,
  data: {
    productId: string
    variantId: string
    quantity: number
    unitPrice: number
    origin?: 'customer' | 'manager_added' | 'replacement' | 'gift'
  }
): Promise<ApiResponse<OrderItem>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)
  if ((!session || !canManageOrders(session.role)) && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  if (hasAdminToken || session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER') {
    const base = resolveBackendBaseUrl()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericOrderId = Number(orderId)
    const numericVariantId = Number(data.variantId)
    if (!Number.isFinite(numericOrderId) || numericOrderId <= 0 || !Number.isFinite(numericVariantId) || numericVariantId <= 0) {
      return { success: false, error: 'Pedido ou variação inválidos' }
    }

    const quantity = Number(data.quantity || 0)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: 'Quantidade inválida' }
    }

    const stockConfig = await getStockModeConfig()
    const normalizedQty = normalizeQuantityByStockMode(quantity, stockConfig)

    const unitPriceCents = Math.max(0, Math.round(Number(data.unitPrice || 0) * 100))
    const cookieHeader = await buildBackofficeCookieHeader()

    try {
      const response = await fetch(new URL(`/orders/${numericOrderId}/items`, base), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        body: JSON.stringify({
          variant_id: numericVariantId,
          quantity: normalizedQty,
          unit_price_cents: unitPriceCents,
          origin: data.origin || 'manager_added',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return { success: false, error: errorText || 'Erro ao adicionar item ao pedido' }
      }

      const createdItem = (await response.json()) as BackendOrderItem
      const unitPrice = Number(createdItem.unit_price_cents || 0) / 100
      const qty = Number(createdItem.quantity || 0)
      const originalQty = Number(createdItem.original_quantity ?? createdItem.quantity ?? 0)
      const combination = parseVariantCombinationKey(createdItem.variant_combination_key)
      const status = ['active', 'attended', 'removed'].includes(String(createdItem.status || '').toLowerCase())
        ? (String(createdItem.status || '').toLowerCase() as 'active' | 'attended' | 'removed')
        : 'active'
      const origin = normalizeOrderItemOrigin(createdItem.origin)
      const variantStockQty = Number(createdItem.variant_stock_qty ?? 0)
      const variantReservedQty = Number(createdItem.variant_reserved_qty ?? 0)
      const variantAvailableQty = Math.max(0, variantStockQty - variantReservedQty)

      revalidatePath(`/orders/${orderId}`)

      return {
        success: true,
        data: {
          id: String(createdItem.id),
          orderId: String(createdItem.order_id),
          productId: String(createdItem.product_id),
          variantId: String(createdItem.variant_id),
          assetId: Number.isFinite(Number(createdItem.asset_id)) && Number(createdItem.asset_id) > 0
            ? String(createdItem.asset_id)
            : null,
          assetName: createdItem.asset_name ? String(createdItem.asset_name) : null,
          assetImageUrl: createdItem.asset_image_url ? String(createdItem.asset_image_url) : null,
          imageUrl: createdItem.image_url ? String(createdItem.image_url) : null,
          nameSnapshot: String(createdItem.asset_name || createdItem.product_name || `Produto #${createdItem.product_id}`),
          skuSnapshot: String(createdItem.variant_sku || `VAR-${createdItem.variant_id}`),
          variantCombinationKey: createdItem.variant_combination_key ? String(createdItem.variant_combination_key) : null,
          colorSnapshot: combination.colorSnapshot,
          sizeSnapshot: combination.sizeSnapshot,
          qty,
          originalQty,
          unitPrice,
          total: unitPrice * qty,
          fulfilled: status === 'attended',
          variantStockQty,
          variantReservedQty,
          variantAvailableQty,
          status,
          origin,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao adicionar item ao pedido',
      }
    }
  }

  const order = await getOrderById(orderId)
  if (!order) {
    return { success: false, error: 'Pedido não encontrado' }
  }

  const product = await getProductById(data.productId)
  const variant = await getVariantById(data.variantId)
  
  if (!product || !variant) {
    return { success: false, error: 'Produto ou variação não encontrado' }
  }

  const itemTotal = data.unitPrice * data.quantity

  const item = await createOrderItem({
    orderId,
    productId: data.productId,
    variantId: data.variantId,
    nameSnapshot: product.name,
    skuSnapshot: variant.variantSku,
    colorSnapshot: variant.color,
    sizeSnapshot: variant.size,
    qty: data.quantity,
    unitPrice: data.unitPrice,
    total: itemTotal,
    fulfilled: false,
  })

  // Update order totals
  const newSubtotal = order.subtotal + itemTotal
  const manualDiscount = (order as unknown as { manualDiscount?: number }).manualDiscount || 0
  const newTotal = newSubtotal - order.discountTotal - manualDiscount + order.shippingPrice

  await updateOrder(orderId, {
    subtotal: newSubtotal,
    total: newTotal,
  })

  // Update stock
  await updateVariant(data.variantId, { stock: variant.stock - data.quantity })

  await createAuditLog({
    actorUserId: session.id,
    action: 'ORDER_ITEM_ADDED',
    entityType: 'OrderItem',
    entityId: item.id,
    beforeJson: null,
    afterJson: item as unknown as Record<string, unknown>,
  })

  revalidatePath(`/orders/${orderId}`)
  
  return { success: true, data: item }
}

// Remove item from order
export async function removeOrderItemAction(
  orderId: string,
  itemId: string,
  options?: {
    hardDelete?: boolean
  }
): Promise<ApiResponse<void>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)
  if ((!session || !canManageOrders(session.role)) && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  if (hasAdminToken || session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER') {
    const base = resolveBackendBaseUrl()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericOrderId = Number(orderId)
    const numericItemId = Number(itemId)
    if (!Number.isFinite(numericOrderId) || numericOrderId <= 0 || !Number.isFinite(numericItemId) || numericItemId <= 0) {
      return { success: false, error: 'Pedido ou item inválido' }
    }

    const cookieHeader = await buildBackofficeCookieHeader()

    try {
      const detailResponse = await fetch(new URL(`/orders/${numericOrderId}`, base), {
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      })

      if (!detailResponse.ok) {
        return { success: false, error: 'Erro ao buscar origem do item' }
      }

      const detailPayload = (await detailResponse.json()) as [BackendOrder, BackendOrderItem[]]
      const backendItems = Array.isArray(detailPayload?.[1]) ? detailPayload[1] : []
      const currentItem = backendItems.find((entry) => String(entry.id) === String(numericItemId))

      if (!currentItem) {
        return { success: false, error: 'Item não encontrado no pedido' }
      }

      const shouldHardDelete = normalizeOrderItemOrigin(currentItem.origin) === 'manager_added' || options?.hardDelete === true

      const response = shouldHardDelete
        ? await fetch(new URL(`/orders/${numericOrderId}/items/${numericItemId}`, base), {
            method: 'DELETE',
            headers: {
              ...(cookieHeader ? { cookie: cookieHeader } : {}),
            },
          })
        : await fetch(new URL(`/orders/${numericOrderId}/items/${numericItemId}/status`, base), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(cookieHeader ? { cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({ status: 'removed' }),
          })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return { success: false, error: errorText || 'Erro ao remover item' }
      }

      revalidatePath(`/orders/${orderId}`)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao remover item',
      }
    }
  }

  const order = await getOrderById(orderId)
  if (!order) {
    return { success: false, error: 'Pedido não encontrado' }
  }

  const items = await getOrderItems(orderId)
  const item = items.find(i => i.id === itemId)
  
  if (!item) {
    return { success: false, error: 'Item não encontrado' }
  }

  // Restore stock
  if (item.variantId) {
    const variant = await getVariantById(item.variantId)
    if (variant) {
      await updateVariant(item.variantId, { stock: variant.stock + item.qty })
    }
  }

  return { success: false, error: 'Fluxo local legado removido. Use sessão administrativa para editar itens.' }

  // Update order totals
  const newSubtotal = order.subtotal - item.total
  const manualDiscount = (order as unknown as { manualDiscount?: number }).manualDiscount || 0
  const newTotal = newSubtotal - order.discountTotal - manualDiscount + order.shippingPrice

  await updateOrder(orderId, {
    subtotal: newSubtotal,
    total: newTotal,
  })

  await createAuditLog({
    actorUserId: session.id,
    action: 'ORDER_ITEM_REMOVED',
    entityType: 'OrderItem',
    entityId: itemId,
    beforeJson: item as unknown as Record<string, unknown>,
    afterJson: null,
  })

  revalidatePath(`/orders/${orderId}`)
  
  return { success: true }
}

// Update order item quantity or fulfilled status
export async function updateOrderItemAction(
  orderId: string,
  itemId: string,
  data: { quantity?: number; unitPrice?: number; fulfilled?: boolean }
): Promise<ApiResponse<OrderItem>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)
  if ((!session || !canManageOrders(session.role)) && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  if (hasAdminToken || session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER') {
    const base = resolveBackendBaseUrl()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    if (data.fulfilled === undefined && data.quantity === undefined) {
      return { success: false, error: 'Nenhuma alteração informada para o item' }
    }

    const numericOrderId = Number(orderId)
    const numericItemId = Number(itemId)
    if (!Number.isFinite(numericOrderId) || numericOrderId <= 0 || !Number.isFinite(numericItemId) || numericItemId <= 0) {
      return { success: false, error: 'Pedido ou item inválido' }
    }

    const cookieHeader = await buildBackofficeCookieHeader()

    try {
      let response: Response

      if (data.quantity !== undefined) {
        const quantity = Number(data.quantity)
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return { success: false, error: 'Quantidade atendida inválida' }
        }

        const stockConfig = await getStockModeConfig()
        const normalizedQty = normalizeQuantityByStockMode(quantity, stockConfig)

        response = await fetch(new URL(`/orders/${numericOrderId}/items/${numericItemId}`, base), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({ quantity: normalizedQty }),
        })
      } else {
        const nextStatus = data.fulfilled ? 'attended' : 'active'

        response = await fetch(new URL(`/orders/${numericOrderId}/items/${numericItemId}/status`, base), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({ status: nextStatus }),
        })
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return { success: false, error: errorText || 'Erro ao atualizar item' }
      }

      const detailResponse = await fetch(new URL(`/orders/${numericOrderId}`, base), {
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      })

      if (!detailResponse.ok) {
        return { success: false, error: 'Erro ao buscar item atualizado' }
      }

      const payload = (await detailResponse.json()) as [BackendOrder, BackendOrderItem[]]
      const backendItems = Array.isArray(payload?.[1]) ? payload[1] : []
      const updatedItem = backendItems.find((entry) => String(entry.id) === String(numericItemId))

      if (!updatedItem) {
        return { success: false, error: 'Item atualizado não encontrado' }
      }

      const unitPrice = Number(updatedItem.unit_price_cents || 0) / 100
      const qty = Number(updatedItem.quantity || 0)
      const originalQty = Number(updatedItem.original_quantity ?? updatedItem.quantity ?? 0)
      const combination = parseVariantCombinationKey(updatedItem.variant_combination_key)
      const status = ['active', 'attended', 'removed'].includes(String(updatedItem.status || '').toLowerCase())
        ? (String(updatedItem.status || '').toLowerCase() as 'active' | 'attended' | 'removed')
        : 'active'
      const origin = normalizeOrderItemOrigin(updatedItem.origin)
      const variantStockQty = Number(updatedItem.variant_stock_qty ?? 0)
      const variantReservedQty = Number(updatedItem.variant_reserved_qty ?? 0)
      const variantAvailableQty = Math.max(0, variantStockQty - variantReservedQty)

      revalidatePath(`/orders/${orderId}`)

      return {
        success: true,
        data: {
          id: String(updatedItem.id),
          orderId: String(updatedItem.order_id),
          productId: String(updatedItem.product_id),
          variantId: String(updatedItem.variant_id),
          assetId: Number.isFinite(Number(updatedItem.asset_id)) && Number(updatedItem.asset_id) > 0
            ? String(updatedItem.asset_id)
            : null,
          assetName: updatedItem.asset_name ? String(updatedItem.asset_name) : null,
          assetImageUrl: updatedItem.asset_image_url ? String(updatedItem.asset_image_url) : null,
          imageUrl: updatedItem.image_url ? String(updatedItem.image_url) : null,
          nameSnapshot: String(updatedItem.asset_name || updatedItem.product_name || `Produto #${updatedItem.product_id}`),
          skuSnapshot: String(updatedItem.variant_sku || `VAR-${updatedItem.variant_id}`),
          variantCombinationKey: updatedItem.variant_combination_key ? String(updatedItem.variant_combination_key) : null,
          colorSnapshot: combination.colorSnapshot,
          sizeSnapshot: combination.sizeSnapshot,
          qty,
          originalQty,
          unitPrice,
          total: unitPrice * qty,
          fulfilled: status === 'attended',
          variantStockQty,
          variantReservedQty,
          variantAvailableQty,
          status,
          origin,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao atualizar item',
      }
    }
  }

  const order = await getOrderById(orderId)
  if (!order) {
    return { success: false, error: 'Pedido não encontrado' }
  }

  const items = await getOrderItems(orderId)
  const item = items.find(i => i.id === itemId)
  
  if (!item) {
    return { success: false, error: 'Item não encontrado' }
  }

  const newQty = data.quantity ?? item.qty
  const newUnitPrice = data.unitPrice ?? item.unitPrice
  const newItemTotal = newQty * newUnitPrice
  const oldItemTotal = item.total

  // Update stock difference
  if (data.quantity !== undefined && item.variantId) {
    const variant = await getVariantById(item.variantId)
    if (variant) {
      const qtyDiff = item.qty - newQty
      await updateVariant(item.variantId, { stock: variant.stock + qtyDiff })
    }
  }

  return { success: false, error: 'Fluxo local legado removido. Use sessão administrativa para editar itens.' }

  // Update order totals
  const newSubtotal = order.subtotal - oldItemTotal + newItemTotal
  const manualDiscount = (order as unknown as { manualDiscount?: number }).manualDiscount || 0
  const newTotal = newSubtotal - order.discountTotal - manualDiscount + order.shippingPrice

  // Calculate fulfilled total (sum of total for items marked as fulfilled)
  const allItems = await getOrderItems(orderId)
  const fulfilledTotal = allItems.reduce((sum, i) => {
    const isFulfilled = i.id === itemId ? data.fulfilled ?? i.fulfilled : i.fulfilled
    return sum + (isFulfilled ? i.total : 0)
  }, 0)

  await updateOrder(orderId, {
    subtotal: newSubtotal,
    total: newTotal,
    fulfilledTotal,
  })

  revalidatePath(`/orders/${orderId}`)
  
  return { success: true, data: updated }
}

// Seller-specific aliases
export async function getSellerCustomers() {
  const session = await getSession()
  if (!session || session.role !== 'SELLER') {
    return { success: false, error: 'Não autorizado', data: [] }
  }
  const result = await getCustomersAction({ assignedSellerId: session.id })
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao buscar clientes', data: [] }
  }
  return { success: true, data: result.data }
}

export async function getSellerOrders() {
  const session = await getSession()
  if (!session || session.role !== 'SELLER') {
    return { success: false, error: 'Não autorizado', data: [] }
  }
  const orders = await getOrders({ assignedSellerId: session.id })
  return { success: true, data: orders }
}

export async function getSellerStats() {
  const session = await getSession()
  if (!session || session.role !== 'SELLER') {
    return { success: false, error: 'Não autorizado' }
  }
  const customersResult = await getCustomersAction({ assignedSellerId: session.id })
  const customers = customersResult.success && customersResult.data ? customersResult.data : []
  const orders = await getOrders({ assignedSellerId: session.id })
  
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0)
  const pendingOrders = orders.filter(o => o.status === 'PENDING').length
  
  return { 
    success: true, 
    data: {
      totalCustomers: customers.length,
      totalOrders: orders.length,
      totalSales,
      pendingOrders,
    }
  }
}

export async function getOrderPaymentsAction(orderId: string): Promise<ApiResponse<OrderPaymentResponse[]>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  if (!session && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  if (hasAdminToken || session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER') {
    const base = resolveBackendBaseUrl()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericId = Number(orderId)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return { success: false, error: 'Pedido inválido' }
    }

    const cookieHeader = await buildBackofficeCookieHeader()

    try {
      const response = await fetch(new URL(`/orders/${numericId}/payments`, base), {
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return { success: false, error: errorText || 'Erro ao buscar pagamentos' }
      }

      const payments = (await response.json()) as OrderPaymentResponse[]
      return { success: true, data: payments }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar pagamentos',
      }
    }
  }

  return { success: false, error: 'Não autorizado' }
}

export async function retryOrderPaymentAction(orderId: string): Promise<ApiResponse<OrderPaymentResponse>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const hasAdminToken = Boolean(cookieStore.get('adminAuthToken')?.value)

  if (!session && !hasAdminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  if (hasAdminToken || session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER') {
    const base = resolveBackendBaseUrl()
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const numericId = Number(orderId)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return { success: false, error: 'Pedido inválido' }
    }

    const cookieHeader = await buildBackofficeCookieHeader()

    try {
      const response = await fetch(new URL(`/orders/${numericId}/payments/retry`, base), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return { success: false, error: errorText || 'Erro ao retentar pagamento' }
      }

      const payment = (await response.json()) as OrderPaymentResponse
      return { success: true, data: payment }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao retentar pagamento',
      }
    }
  }

  return { success: false, error: 'Não autorizado' }
}
