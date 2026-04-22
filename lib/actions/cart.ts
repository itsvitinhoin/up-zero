'use server'

import { revalidatePath } from 'next/cache'
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { canPurchase, getSession } from '@/lib/auth'
import { getSiteSettingsAction } from '@/lib/actions/settings'
import { normalizeQuantityByStockMode, type StockModeConfig } from '@/lib/stock-mode'
import { resolveStorefrontApiKeyFromRequest } from '@/lib/actions/storefront-scope'
import type { ApiResponse, Cart, PriceCalculation, StockMode } from '@/lib/types'

export interface CartWithCalculation extends Cart {
  subtotal: number
  discountAmount: number
  couponDiscountAmount: number
  tierDiscountAmount: number
  total: number
  shippingAmount?: number
  shippingMethodId?: string | null
  shippingOptionCode?: string | null
  paymentMethodId?: string | null
  paymentOptionCode?: string | null
  checkoutNotes?: string | null
  manualDiscountAmount?: number
  appliedCoupon: {
    code: string
    discountType: 'PERCENTAGE' | 'FIXED'
    discountValue: number
  } | null
}

interface BackendCartAttribute {
  attribute_code?: string
  value_name?: string
}

interface BackendCartItem {
  id: number
  product_variant_id: number
  quantity: number
  price_cents_snapshot: number
  price_table_discount_cents?: number
  extra_discount_cents?: number
  coupon_discount_cents?: number
  tier_discount_cents?: number
  payment_method_discount_cents?: number
  manual_discount_cents?: number
  product_name: string
  product_code: string
  variant_sku?: string | null
  image_url?: string | null
  attributes?: BackendCartAttribute[]
}

interface BackendCart {
  id: number
  total_items: number
  total_price_cents: number
  coupon_code?: string | null
  coupon_discount_cents: number
  tier_discount_cents: number
  payment_method_id?: number | null
  shipping_method_id?: number | null
  shipping_price_cents: number
  meta?: {
    shipping_option?: {
      code?: string
      name?: string
    }
    payment_option?: {
      code?: string
      name?: string
      type?: string
    }
    checkout?: {
      notes?: string | null
      manual_discount_cents?: number | null
    }
  }
  items: BackendCartItem[]
}

interface UpdateCartShippingInput {
  methodId?: number
  code: string
  name: string
  priceCents: number
  deliveryDays: number
}

interface UpdateCartPaymentInput {
  methodId: number
  code: string
  name: string
  paymentType?: string
}

interface UpdateCartNotesInput {
  notes?: string
}

interface UpdateCartCheckoutAddressInput {
  zipCode: string
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
}

interface UpdateCartCheckoutInput {
  address: UpdateCartCheckoutAddressInput
  shipping: {
    methodId: number
    code: string
    name: string
    priceCents: number
    deliveryDays: number
  }
  payment: {
    methodId: number
    code: string
    name: string
    paymentType?: string
  }
  card?: {
    holderName?: string
    document?: string
    number?: string
    expiry?: string
    cvv?: string
    installments?: number
  }
  notes?: string
}

interface ShippingMethodLookup {
  id: number
  name: string
  active: boolean
  type?: string
  priority?: number
}

// Stock Mode Helpers
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

function resolveBackendBase(): string | null {
  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function resolveCartStorefrontApiKey(preferredStoreId?: number | string | null): Promise<string> {
  return resolveStorefrontApiKeyFromRequest(preferredStoreId)
}

function extractFirstPathSegment(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const segment = pathname.split('/').filter(Boolean)[0] ?? ''
  const normalized = segment.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return normalized || null
}

async function resolveRouteScopeToken(): Promise<string | null> {
  try {
    const headerStore = await headers()
    const nextUrlHeader = headerStore.get('x-next-url') || headerStore.get('next-url')
    const refererHeader = headerStore.get('referer')

    const fromNextUrl = extractFirstPathSegment(nextUrlHeader)
    if (fromNextUrl) return fromNextUrl

    if (refererHeader) {
      try {
        const refererPath = new URL(refererHeader).pathname
        const fromReferer = extractFirstPathSegment(refererPath)
        if (fromReferer) return fromReferer
      } catch {
        const fromRawReferer = extractFirstPathSegment(refererHeader)
        if (fromRawReferer) return fromRawReferer
      }
    }
  } catch {
    // Sem acesso a headers, segue com escopo por api-key apenas.
  }

  return null
}

async function resolveStorefrontScopeKey(preferredStoreId?: number | string | null): Promise<string | null> {
  const apiKey = await resolveCartStorefrontApiKey(preferredStoreId)
  const routeScope = await resolveRouteScopeToken()

  // Normaliza o storeId: preferredStoreId tem prioridade, depois routeScope (primeiro segmento da URL)
  const storeIdNum = preferredStoreId != null ? Number(preferredStoreId) : null
  const validStoreId =
    storeIdNum !== null && Number.isInteger(storeIdNum) && storeIdNum > 0
      ? String(storeIdNum)
      : routeScope  // ex.: "1" ou "2" extraído do referer/x-next-url

  if (apiKey) {
    // Inclui sempre o storeId para evitar colisão entre lojas com a mesma API key
    const scopeSource = validStoreId ? `${apiKey}|${validStoreId}` : apiKey
    return createHash('sha1').update(scopeSource).digest('hex').slice(0, 16)
  }

  if (validStoreId) {
    // Sem API key, escopo é baseado puramente no storeId
    return createHash('sha1').update(`store:${validStoreId}`).digest('hex').slice(0, 16)
  }

  return null
}

function parseActionStoreId(formData: FormData, fieldName = 'storeId'): number | null {
  const raw = formData.get(fieldName)
  if (typeof raw !== 'string') return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function buildCartCookieHeader(preferredStoreId?: number | string | null): Promise<string | undefined> {
  const cookieStore = await cookies()
  const parts: string[] = []

  const scopeKey = await resolveStorefrontScopeKey(preferredStoreId)
  const scopedSessionCookieName =
    scopeKey
      ? `sessionID_scope_${scopeKey}`
      : null
  const sessionId = scopedSessionCookieName
    ? cookieStore.get(scopedSessionCookieName)?.value
    : undefined
  const clientAuthToken =
    cookieStore.get('clientAuthToken')?.value ?? cookieStore.get('b2bAuthToken')?.value

  if (sessionId) parts.push(`sessionID=${sessionId}`)
  if (clientAuthToken) parts.push(`clientAuthToken=${clientAuthToken}`)

  return parts.length > 0 ? parts.join('; ') : undefined
}

async function persistCartResponseCookies(
  response: Response,
  preferredStoreId?: number | string | null,
): Promise<void> {
  const cookieStore = await cookies()

  const scopeKey = await resolveStorefrontScopeKey(preferredStoreId)
  const scopedSessionCookieName =
    scopeKey
      ? `sessionID_scope_${scopeKey}`
      : null

  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const rawSetCookies =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(response.headers)
      : (() => {
          const single = response.headers.get('set-cookie')
          return single ? [single] : []
        })()

  for (const rawCookie of rawSetCookies) {
    const sessionMatch = rawCookie.match(/(?:^|,\s*)sessionID=([^;]+)/i)
    if (!sessionMatch?.[1]) continue

    const sessionId = sessionMatch[1]
    const maxAgeMatch = rawCookie.match(/max-age=(\d+)/i)
    const maxAge = maxAgeMatch?.[1] ? Number(maxAgeMatch[1]) : undefined

    try {
      if (scopedSessionCookieName) {
        cookieStore.set(scopedSessionCookieName, sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          ...(Number.isFinite(maxAge) ? { maxAge } : {}),
        })
      }
    } catch {
      // Ignora em contextos de renderização server-side onde cookies são somente leitura.
    }
  }
}

function mapBackendCartToFrontend(cart: BackendCart | null | undefined): CartWithCalculation {
  if (!cart) {
    return {
      items: [],
      couponCode: null,
      subtotal: 0,
      discountAmount: 0,
      couponDiscountAmount: 0,
      tierDiscountAmount: 0,
      total: 0,
      appliedCoupon: null,
    }
  }

  const items = (cart.items || []).map((item) => {
    const attrs = Array.isArray(item.attributes) ? item.attributes : []
    const color =
      attrs.find((attr) => {
        const code = String(attr?.attribute_code || '').toLowerCase()
        return code === 'color' || code === 'cor'
      })?.value_name || ''
    const size =
      attrs.find((attr) => {
        const code = String(attr?.attribute_code || '').toLowerCase()
        return code === 'size' || code === 'tamanho'
      })?.value_name || ''

    const unitPrice = (item.price_cents_snapshot || 0) / 100

    return {
      id: String(item.id),
      productId: item.product_code || '',
      variantId: String(item.product_variant_id),
      quantity: item.quantity || 0,
      unitPrice,
      priceTableDiscountCents: Number(item.price_table_discount_cents || 0),
      extraDiscountCents: Number(item.extra_discount_cents || 0),
      couponDiscountCents: Number(item.coupon_discount_cents || 0),
      tierDiscountCents: Number(item.tier_discount_cents || 0),
      paymentMethodDiscountCents: Number(item.payment_method_discount_cents || 0),
      manualDiscountCents: Number(item.manual_discount_cents || 0),
      variant: {
        id: String(item.product_variant_id),
        productId: item.product_code || '',
        color,
        size,
        variantSku: item.variant_sku || '',
        sku: item.variant_sku || '',
        stock: 0,
        priceOverride: unitPrice,
        price: unitPrice,
        createdAt: new Date(),
        product: {
          id: item.product_code || '',
          name: item.product_name || 'Produto',
          slug: '',
          sku: item.product_code || '',
          description: null,
          materials: null,
          measures: null,
          basePrice: unitPrice,
          cost: null,
          isActive: true,
          isFeatured: false,
          categoryId: '',
          tags: [],
          images: item.image_url ? [item.image_url] : [],
          sizes: size ? [size] : [],
          colors: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    }
  })

  const subtotal = (cart.total_price_cents || 0) / 100
  const couponDiscountAmount = Math.abs(cart.coupon_discount_cents || 0) / 100
  const tierDiscountAmount = Math.abs(cart.tier_discount_cents || 0) / 100
  const discountAmount = couponDiscountAmount + tierDiscountAmount
  const shippingAmount = (cart.shipping_price_cents || 0) / 100
  const total = Math.max(0, subtotal - discountAmount + shippingAmount)

  return {
    items,
    couponCode: cart.coupon_code || null,
    subtotal,
    discountAmount,
    couponDiscountAmount,
    tierDiscountAmount,
    total,
    shippingAmount,
    paymentMethodId:
      typeof cart.payment_method_id === 'number' ? String(cart.payment_method_id) : null,
    shippingMethodId:
      typeof cart.shipping_method_id === 'number' ? String(cart.shipping_method_id) : null,
    paymentOptionCode: cart.meta?.payment_option?.code || null,
    shippingOptionCode: cart.meta?.shipping_option?.code || null,
    checkoutNotes: cart.meta?.checkout?.notes || null,
    manualDiscountAmount: Number(cart.meta?.checkout?.manual_discount_cents || 0) / 100,
    appliedCoupon: cart.coupon_code
      ? {
          code: cart.coupon_code,
          discountType: 'FIXED',
          discountValue: couponDiscountAmount,
        }
      : null,
  }
}

async function fetchCartEndpoint(
  path: string,
  init?: RequestInit,
  preferredStoreId?: number | string | null,
): Promise<Response> {
  const base = resolveBackendBase()
  if (!base) {
    throw new Error('NEXT_PUBLIC_RUST_URL não configurado')
  }

  const cookieHeader = await buildCartCookieHeader(preferredStoreId)
  const apiKey = await resolveCartStorefrontApiKey(preferredStoreId)

  const url = new URL(`${base}${path}`)

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  await persistCartResponseCookies(response, preferredStoreId)
  return response
}

async function buildAdminCartCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const adminAuthToken = cookieStore.get('adminAuthToken')?.value

  return adminAuthToken ? `adminAuthToken=${adminAuthToken}` : undefined
}

async function buildAdminAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies()
  const adminAuthToken = cookieStore.get('adminAuthToken')?.value

  if (!adminAuthToken) {
    return {}
  }

  return {
    cookie: `adminAuthToken=${adminAuthToken}`,
    Authorization: `Bearer ${adminAuthToken}`,
  }
}

async function fetchAdminCustomerCartEndpoint(
  customerId: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = resolveBackendBase()
  if (!base) {
    throw new Error('NEXT_PUBLIC_RUST_URL não configurado')
  }

  const parsedCustomerId = Number(customerId)
  if (!Number.isFinite(parsedCustomerId) || parsedCustomerId <= 0) {
    throw new Error('Cliente inválido para operação de carrinho')
  }

  const authHeaders = await buildAdminAuthHeaders()
  if (!authHeaders.cookie && !authHeaders.Authorization) {
    throw new Error('Sessão admin não encontrada para acessar o carrinho do cliente')
  }

  const response = await fetch(
    `${base}/admin/customers/${Math.trunc(parsedCustomerId)}/cart${path}`,
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    }
  )

  return response
}

export async function getCartAction(
  storeId?: number | string | null,
): Promise<ApiResponse<CartWithCalculation>> {
  try {
    const response = await fetchCartEndpoint('/cart', { method: 'GET' }, storeId)
    if (!response.ok) {
      return { success: true, data: mapBackendCartToFrontend(null) }
    }

    const payload = (await response.json()) as BackendCart
    return { success: true, data: mapBackendCartToFrontend(payload) }
  } catch (error) {
    console.error('Erro ao buscar carrinho:', error)
    return { success: true, data: mapBackendCartToFrontend(null) }
  }
}

interface CartValidationError {
  error_type: string
  message: string
  item_id?: number | null
  product_variant_id?: number | null
}

interface CartValidationResult {
  valid: boolean
  errors: CartValidationError[]
}

export async function validateCartAction(
  storeId?: number | string | null,
): Promise<CartValidationResult> {
  try {
    const response = await fetchCartEndpoint('/v1/cart/validate', { method: 'GET' }, storeId)
    if (!response.ok) {
      return { valid: false, errors: [{ error_type: 'api_error', message: 'Erro ao validar carrinho' }] }
    }
    const payload = (await response.json()) as { valid?: boolean; errors?: CartValidationError[] }
    return {
      valid: payload.valid ?? true,
      errors: Array.isArray(payload.errors) ? payload.errors : [],
    }
  } catch {
    return { valid: false, errors: [{ error_type: 'network_error', message: 'Erro de rede ao validar carrinho' }] }
  }
}

export async function validateAndUpdateCartCheckoutAction(
  input: UpdateCartCheckoutInput,
  storeId?: number | string | null,
): Promise<ApiResponse<CartWithCalculation>> {
  const validation = await validateCartAction(storeId)

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0]?.message || 'Carrinho possui itens inválidos ou indisponíveis',
    }
  }

  const checkoutResult = await updateCartCheckoutAction(input, storeId)
  if (checkoutResult.success) {
    return checkoutResult
  }

  const normalizedError = String(checkoutResult.error || '').toLowerCase()
  if (!normalizedError.includes('método de frete inválido') && !normalizedError.includes('metodo de frete invalido')) {
    return checkoutResult
  }

  const methodsResponse = await fetchCartEndpoint('/shipping/methods', { method: 'GET' }, storeId)
  if (!methodsResponse.ok) {
    return checkoutResult
  }

  const methods = ((await methodsResponse.json()) as ShippingMethodLookup[])
    .filter((method) => method?.active)
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))

  if (methods.length === 0) {
    return checkoutResult
  }

  const normalizedCode = input.shipping.code.trim().toLowerCase()
  const normalizedName = input.shipping.name.trim().toLowerCase()
  const requestedMethodId = Number(input.shipping.methodId)

  const resolvedMethod =
    methods.find((method) => Number.isFinite(requestedMethodId) && method.id === requestedMethodId) ||
    methods.find((method) => {
      const methodName = String(method.name || '').trim().toLowerCase()
      return methodName === normalizedCode || methodName === normalizedName
    }) ||
    methods.find((method) => String(method.type || '').toUpperCase() === 'TABELA_FIXA') ||
    methods[0]

  if (!resolvedMethod || resolvedMethod.id === requestedMethodId) {
    return checkoutResult
  }

  return updateCartCheckoutAction({
    ...input,
    shipping: {
      ...input.shipping,
      methodId: resolvedMethod.id,
    },
  }, storeId)
}

export async function getAdminCustomerCartAction(
  customerId: string
): Promise<ApiResponse<CartWithCalculation>> {
  try {
    const response = await fetchAdminCustomerCartEndpoint(customerId, '', { method: 'GET' })
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao buscar carrinho do cliente' }
    }

    const payload = (await response.json()) as BackendCart
    return { success: true, data: mapBackendCartToFrontend(payload) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar carrinho do cliente',
    }
  }
}

export async function addToAdminCustomerCartBatchAction(
  customerId: string,
  items: Array<{ variantId: string; quantity: number }>
): Promise<ApiResponse<CartWithCalculation>> {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: 'Nenhum item selecionado para adicionar ao carrinho' }
  }

  const stockConfig = await getStockModeConfig()
  const parsedItems: Array<{ product_variant_id: number; quantity: number }> = []

  for (const item of items) {
    const parsedVariantId = Number(item.variantId)
    if (!Number.isFinite(parsedVariantId) || parsedVariantId <= 0) {
      return { success: false, error: 'Variação inválida para adicionar ao carrinho' }
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { success: false, error: 'Quantidade inválida' }
    }

    const normalizedQty = normalizeQuantityByStockMode(item.quantity, stockConfig)
    
    parsedItems.push({
      product_variant_id: parsedVariantId,
      quantity: normalizedQty,
    })
  }

  const response = await fetchAdminCustomerCartEndpoint(customerId, '/batch', {
    method: 'POST',
    body: JSON.stringify({ items: parsedItems }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao adicionar no carrinho do cliente' }
  }

  const payload = (await response.json()) as BackendCart
  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateAdminCustomerCartItemAction(
  customerId: string,
  itemId: string,
  quantity: number
): Promise<ApiResponse<CartWithCalculation>> {
  const parsedItemId = Number(itemId)
  if (!Number.isFinite(parsedItemId) || parsedItemId <= 0) {
    return { success: false, error: 'Item inválido' }
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, error: 'Quantidade inválida' }
  }

  const stockConfig = await getStockModeConfig()
  const normalizedQty = normalizeQuantityByStockMode(quantity, stockConfig)

  const response = await fetchAdminCustomerCartEndpoint(customerId, `/items/${Math.trunc(parsedItemId)}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity: normalizedQty }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao atualizar item do carrinho do cliente' }
  }

  const payload = (await response.json()) as BackendCart
  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function removeAdminCustomerCartItemAction(
  customerId: string,
  itemId: string
): Promise<ApiResponse<CartWithCalculation>> {
  const parsedItemId = Number(itemId)
  if (!Number.isFinite(parsedItemId) || parsedItemId <= 0) {
    return { success: false, error: 'Item inválido' }
  }

  const response = await fetchAdminCustomerCartEndpoint(customerId, `/items/${Math.trunc(parsedItemId)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao remover item do carrinho do cliente' }
  }

  const payload = (await response.json()) as BackendCart
  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateAdminCustomerCartShippingAction(
  customerId: string,
  input: UpdateCartShippingInput
): Promise<ApiResponse<CartWithCalculation>> {
  if (!input.code || !input.name) {
    return { success: false, error: 'Dados de frete inválidos' }
  }

  const methodsResponse = await fetchCartEndpoint('/shipping/methods', { method: 'GET' })
  if (!methodsResponse.ok) {
    const errorText = await methodsResponse.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao buscar métodos de frete' }
  }

  const methods = ((await methodsResponse.json()) as ShippingMethodLookup[])
    .filter((method) => method?.active)
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))

  if (methods.length === 0) {
    return { success: false, error: 'Nenhum método de frete ativo encontrado no backend' }
  }

  const normalizedCode = input.code.trim().toLowerCase()
  const normalizedName = input.name.trim().toLowerCase()
  const requestedMethodId = Number(input.methodId)

  const resolvedMethod =
    methods.find((method) => Number.isFinite(requestedMethodId) && method.id === requestedMethodId) ||
    methods.find((method) => {
      const methodName = String(method.name || '').trim().toLowerCase()
      return methodName === normalizedCode || methodName === normalizedName
    }) ||
    methods.find((method) => String(method.type || '').toUpperCase() === 'TABELA_FIXA') ||
    methods[0]

  const makeRequest = async (methodId: number) =>
    fetchAdminCustomerCartEndpoint(customerId, '/shipping', {
      method: 'POST',
      body: JSON.stringify({
        method_id: methodId,
        code: input.code,
        name: input.name,
        price_cents: input.priceCents,
        delivery_days: input.deliveryDays,
      }),
    })

  let response = await makeRequest(resolvedMethod.id)

  if (!response.ok) {
    const firstError = await response.text().catch(() => '')
    const fallbackMethod = methods.find((method) => method.id !== resolvedMethod.id)

    if (
      fallbackMethod &&
      firstError.toLowerCase().includes('método de frete inválido')
    ) {
      response = await makeRequest(fallbackMethod.id)
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || firstError || 'Erro ao atualizar frete no carrinho do cliente' }
    }
  }

  const payload = (await response.json()) as BackendCart
  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateAdminCustomerCartPaymentAction(
  customerId: string,
  input: {
    code: string
    name: string
    paymentType?: string
  }
): Promise<ApiResponse<CartWithCalculation>> {
  const normalizedCode = String(input.code || '').trim().toUpperCase()
  const normalizedName = String(input.name || '').trim().toLowerCase()

  if (!normalizedCode) {
    return { success: false, error: 'Forma de pagamento inválida' }
  }

  const base = resolveBackendBase()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const cookieHeader = await buildAdminCartCookieHeader()
  const methodsResponse = await fetch(`${base}/payment-methods`, {
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    cache: 'no-store',
  })

  if (!methodsResponse.ok) {
    const errorText = await methodsResponse.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao buscar métodos de pagamento' }
  }

  const methods = (await methodsResponse.json()) as Array<{
    id: number
    name?: string
    method_type?: string
  }>

  const resolvedMethod =
    methods.find((method) => String(method.method_type || '').trim().toUpperCase() === normalizedCode) ||
    methods.find((method) => String(method.name || '').trim().toLowerCase() === normalizedName) ||
    methods[0]

  if (!resolvedMethod || !Number.isFinite(resolvedMethod.id) || resolvedMethod.id <= 0) {
    return { success: false, error: 'Método de pagamento não encontrado no backend' }
  }

  const response = await fetchAdminCustomerCartEndpoint(customerId, '/payment', {
    method: 'POST',
    body: JSON.stringify({
      method_id: resolvedMethod.id,
      code: normalizedCode,
      name: input.name,
      payment_type: input.paymentType || normalizedCode,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao atualizar forma de pagamento no carrinho do cliente' }
  }

  const payload = (await response.json()) as BackendCart
  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateAdminCustomerCartNotesAction(
  customerId: string,
  input: UpdateCartNotesInput
): Promise<ApiResponse<CartWithCalculation>> {
  const response = await fetchAdminCustomerCartEndpoint(customerId, '/notes', {
    method: 'POST',
    body: JSON.stringify({
      notes: input.notes?.trim() || null,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao atualizar observações do carrinho do cliente' }
  }

  const payload = (await response.json()) as BackendCart
  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateAdminCustomerCartManualDiscountAction(
  customerId: string,
  manualDiscount: number
): Promise<ApiResponse<CartWithCalculation>> {
  const MAX_MANUAL_DISCOUNT_CENTS = 2_147_483_647
  const normalizedDiscount = Number.isFinite(manualDiscount)
    ? Math.max(0, manualDiscount)
    : 0
  const normalizedCents = Math.min(
    MAX_MANUAL_DISCOUNT_CENTS,
    Math.max(0, Math.round(normalizedDiscount * 100))
  )

  const response = await fetchAdminCustomerCartEndpoint(customerId, '/manual-discount', {
    method: 'POST',
    body: JSON.stringify({
      manual_discount_cents: normalizedCents,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return {
      success: false,
      error: errorText || 'Erro ao atualizar desconto manual no carrinho do cliente',
    }
  }

  const payload = (await response.json()) as BackendCart
  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function addToCartAction(
  productId: string,
  variantId: string,
  quantity: number
): Promise<ApiResponse<Cart>> {
  return addToCartBatchAction(
    productId,
    [{ variantId, quantity }],
  )
}

export async function addToCartBatchAction(
  productId: string,
  items: Array<{ variantId: string; quantity: number }>,
  storeId?: number | string | null,
): Promise<ApiResponse<Cart>> {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: 'Nenhum item selecionado para adicionar ao carrinho' }
  }

  const stockConfig = await getStockModeConfig()
  const parsedItems: Array<{ product_variant_id: number; quantity: number }> = []

  for (const item of items) {
    const parsedVariantId = Number(item.variantId)
    if (!Number.isFinite(parsedVariantId) || parsedVariantId <= 0) {
      return { success: false, error: 'Variação inválida para adicionar ao carrinho' }
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { success: false, error: 'Quantidade inválida' }
    }

    const normalizedQty = normalizeQuantityByStockMode(item.quantity, stockConfig)
    
    parsedItems.push({
      product_variant_id: parsedVariantId,
      quantity: normalizedQty,
    })
  }

  void productId

  const response = await fetchCartEndpoint('/cart/batch', {
    method: 'POST',
    body: JSON.stringify({
      items: parsedItems,
    }),
  }, storeId)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao adicionar no carrinho' }
  }

  const payload = (await response.json()) as BackendCart

  revalidatePath('/cart')
  revalidatePath('/checkout')
  
  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateCartItemAction(
  _prevState: ApiResponse<CartWithCalculation> | null,
  formData: FormData
): Promise<ApiResponse<CartWithCalculation>> {
  const itemId = formData.get('itemId') as string
  const quantity = parseInt(formData.get('quantity') as string, 10)
  const scopedStoreId = parseActionStoreId(formData)

  if (!itemId) {
    return { success: false, error: 'Item inválido' }
  }

  if (quantity <= 0) {
    const response = await fetchCartEndpoint(`/cart/items/${itemId}`, { method: 'DELETE' }, scopedStoreId)
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao remover item do carrinho' }
    }
  } else {
    const stockConfig = await getStockModeConfig()
    const normalizedQty = normalizeQuantityByStockMode(quantity, stockConfig)
    
    const response = await fetchCartEndpoint(`/cart/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity: normalizedQty }),
    }, scopedStoreId)
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || 'Erro ao atualizar item do carrinho' }
    }
  }

  revalidatePath('/cart')
  revalidatePath('/checkout')
  
  return getCartAction(scopedStoreId)
}

export async function removeFromCartAction(
  _prevState: ApiResponse<CartWithCalculation> | null,
  formData: FormData
): Promise<ApiResponse<CartWithCalculation>> {
  const itemId = formData.get('itemId') as string
  const variantId = (formData.get('variantId') as string | null)?.trim() || null
  const scopedStoreId = parseActionStoreId(formData)
  if (!itemId) {
    return { success: false, error: 'Item inválido' }
  }

  const deleteByItemId = async (id: string): Promise<{ ok: boolean; errorText: string }> => {
    const response = await fetchCartEndpoint(`/cart/items/${id}`, { method: 'DELETE' }, scopedStoreId)
    if (response.ok) {
      return { ok: true, errorText: '' }
    }

    const errorText = await response.text().catch(() => '')
    return { ok: false, errorText }
  }

  let deletion = await deleteByItemId(itemId)

  if (!deletion.ok && deletion.errorText.includes('Cart item not found') && variantId) {
    const latestCart = await getCartAction(scopedStoreId)
    if (latestCart.success && latestCart.data) {
      const fallbackItem = latestCart.data.items.find(
        (item) => String(item.variantId) === variantId
      )

      if (fallbackItem?.id && String(fallbackItem.id) !== itemId) {
        deletion = await deleteByItemId(String(fallbackItem.id))
      }
    }
  }

  if (!deletion.ok) {
    return {
      success: false,
      error: deletion.errorText || 'Erro ao remover item do carrinho',
    }
  }

  revalidatePath('/cart')
  revalidatePath('/checkout')
  
  return getCartAction(scopedStoreId)
}

export async function applyCouponAction(
  _prevState: ApiResponse<CartWithCalculation> | null,
  formData: FormData
): Promise<ApiResponse<CartWithCalculation>> {
  const code = (formData.get('couponCode') as string)?.toUpperCase()
  const scopedStoreId = parseActionStoreId(formData)
  
  if (!code) {
    return { success: false, error: 'Código do cupom é obrigatório' }
  }

  const response = await fetchCartEndpoint('/v1/cart/apply-coupon', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }, scopedStoreId)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao aplicar cupom' }
  }

  revalidatePath('/cart')
  revalidatePath('/checkout')
  
  return getCartAction(scopedStoreId)
}

export async function removeCouponAction(
  storeId?: number | string | null,
): Promise<ApiResponse<Cart>> {
  const response = await fetchCartEndpoint('/v1/cart/remove-coupon', {
    method: 'POST',
  }, storeId)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao remover cupom' }
  }

  const payload = (await response.json()) as BackendCart
  revalidatePath('/cart')
  revalidatePath('/checkout')
  
  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateCartShippingAction(
  input: UpdateCartShippingInput,
  storeId?: number | string | null,
): Promise<ApiResponse<CartWithCalculation>> {
  if (!input.code || !input.name) {
    return { success: false, error: 'Dados de frete inválidos' }
  }

  const methodsResponse = await fetchCartEndpoint('/shipping/methods', { method: 'GET' }, storeId)
  if (!methodsResponse.ok) {
    const errorText = await methodsResponse.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao buscar métodos de frete' }
  }

  const methods = ((await methodsResponse.json()) as ShippingMethodLookup[])
    .filter((method) => method?.active)
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))

  if (methods.length === 0) {
    return { success: false, error: 'Nenhum método de frete ativo encontrado no backend' }
  }

  const normalizedCode = input.code.trim().toLowerCase()
  const normalizedName = input.name.trim().toLowerCase()
  const requestedMethodId = Number(input.methodId)

  const resolvedMethod =
    methods.find((method) => Number.isFinite(requestedMethodId) && method.id === requestedMethodId) ||
    methods.find((method) => {
      const methodName = String(method.name || '').trim().toLowerCase()
      return methodName === normalizedCode || methodName === normalizedName
    }) ||
    methods.find((method) => String(method.type || '').toUpperCase() === 'TABELA_FIXA') ||
    methods[0]

  const makeRequest = async (methodId: number) =>
    fetchCartEndpoint('/cart/shipping', {
      method: 'POST',
      body: JSON.stringify({
        method_id: methodId,
        code: input.code,
        name: input.name,
        price_cents: input.priceCents,
        delivery_days: input.deliveryDays,
      }),
    }, storeId)

  let response = await makeRequest(resolvedMethod.id)

  if (!response.ok) {
    const firstError = await response.text().catch(() => '')
    const fallbackMethod = methods.find((method) => method.id !== resolvedMethod.id)

    if (
      fallbackMethod &&
      firstError.toLowerCase().includes('método de frete inválido')
    ) {
      response = await makeRequest(fallbackMethod.id)
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return { success: false, error: errorText || firstError || 'Erro ao atualizar frete no carrinho' }
    }
  }

  const payload = (await response.json()) as BackendCart

  revalidatePath('/cart')
  revalidatePath('/checkout')

  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateCartPaymentAction(
  input: UpdateCartPaymentInput,
  storeId?: number | string | null,
): Promise<ApiResponse<CartWithCalculation>> {
  if (!input.code || !input.name || !Number.isFinite(input.methodId) || input.methodId <= 0) {
    return { success: false, error: 'Dados de pagamento inválidos' }
  }

  const response = await fetchCartEndpoint('/cart/payment', {
    method: 'POST',
    body: JSON.stringify({
      method_id: input.methodId,
      code: input.code,
      name: input.name,
      payment_type: input.paymentType,
    }),
  }, storeId)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao atualizar pagamento no carrinho' }
  }

  const payload = (await response.json()) as BackendCart

  revalidatePath('/cart')
  revalidatePath('/checkout')

  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateCartNotesAction(
  input: UpdateCartNotesInput,
  storeId?: number | string | null,
): Promise<ApiResponse<CartWithCalculation>> {
  const response = await fetchCartEndpoint('/cart/notes', {
    method: 'POST',
    body: JSON.stringify({
      notes: input.notes?.trim() || null,
    }),
  }, storeId)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao atualizar observações do checkout' }
  }

  const payload = (await response.json()) as BackendCart

  revalidatePath('/checkout')

  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function updateCartCheckoutAction(
  input: UpdateCartCheckoutInput,
  storeId?: number | string | null,
): Promise<ApiResponse<CartWithCalculation>> {
  const response = await fetchCartEndpoint('/v1/cart/checkout', {
    method: 'POST',
    body: JSON.stringify({
      address: {
        zip_code: input.address.zipCode,
        street: input.address.street,
        number: input.address.number,
        complement: input.address.complement ?? null,
        neighborhood: input.address.neighborhood,
        city: input.address.city,
        state: input.address.state,
      },
      shipping: {
        method_id: input.shipping.methodId,
        code: input.shipping.code,
        name: input.shipping.name,
        price_cents: input.shipping.priceCents,
        delivery_days: input.shipping.deliveryDays,
      },
      payment: {
        method_id: input.payment.methodId,
        code: input.payment.code,
        name: input.payment.name,
        payment_type: input.payment.paymentType || null,
      },
      card: input.card
        ? {
            holder_name: input.card.holderName || null,
            document: input.card.document || null,
            number: input.card.number || null,
            expiry: input.card.expiry || null,
            cvv: input.card.cvv || null,
            installments: input.card.installments ?? null,
          }
        : null,
      notes: input.notes?.trim() || null,
    }),
  }, storeId)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao salvar checkout no carrinho' }
  }

  const payload = (await response.json()) as BackendCart

  revalidatePath('/checkout')

  return { success: true, data: mapBackendCartToFrontend(payload) }
}

export async function clearCartAction(
  storeId?: number | string | null,
): Promise<ApiResponse<void>> {
  const response = await fetchCartEndpoint('/cart/clear', {
    method: 'POST',
  }, storeId)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao limpar carrinho' }
  }

  revalidatePath('/cart')
  revalidatePath('/checkout')
  
  return { success: true }
}

// Aliases for backward compatibility
export const addToCart = addToCartAction
export const removeCartItemAction = removeFromCartAction

export async function getCartItemCount(): Promise<number> {
  try {
    const result = await getCartAction()
    if (!result.success || !result.data || !Array.isArray(result.data.items)) return 0
    return result.data.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  } catch (error) {
    console.error('Erro ao buscar contagem do carrinho:', error)
    return 0
  }
}
