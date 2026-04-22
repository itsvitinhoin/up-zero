'use server'

import { cookies } from 'next/headers'
import { appendStoreScopeParam, resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from '@/lib/actions/storefront-scope'
import type { ApiResponse } from '@/lib/types'

type ShippingQuote = {
  methodId: number
  methodName: string
  methodType: string
  priceCents: number
  minDeliveryDays: number | null
  maxDeliveryDays: number | null
  isFree: boolean
}

type ShippingQuoteResult = {
  zipCode: string
  quotes: ShippingQuote[]
}

type CalculateShippingByZipCodeInput = {
  zipCode: string
  storeId?: number
  cartTotalCents?: number
  totalWeightGrams?: number
}

function resolveBackendBase(): string | null {
  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function buildClientCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const parts: string[] = []

  const sessionId = cookieStore.get('sessionID')?.value
  const clientAuthToken =
    cookieStore.get('clientAuthToken')?.value ?? cookieStore.get('b2bAuthToken')?.value

  if (sessionId) parts.push(`sessionID=${sessionId}`)
  if (clientAuthToken) parts.push(`clientAuthToken=${clientAuthToken}`)

  return parts.length > 0 ? parts.join('; ') : undefined
}

type RawShippingQuote = {
  method_id: number
  method_name: string
  method_type: string
  price_cents: number
  min_delivery_days?: number | null
  max_delivery_days?: number | null
  is_free: boolean
}

type RawShippingQuoteResponse = {
  zip_code: string
  quotes: RawShippingQuote[]
}

export async function calculateShippingByZipCodeAction(
  input: CalculateShippingByZipCodeInput,
): Promise<ApiResponse<ShippingQuoteResult>> {
  const base = resolveBackendBase()
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const zipCode = String(input.zipCode || '').replace(/\D/g, '')
  if (zipCode.length !== 8) {
    return { success: false, error: 'CEP inválido' }
  }

  const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(input.storeId)
  const quoteUrl = new URL('/v1/shipping/quote', base)
  const params = quoteUrl.searchParams
  params.set('zip_code', zipCode)
  if (Number.isFinite(input.cartTotalCents) && Number(input.cartTotalCents) >= 0) {
    params.set('cart_total_cents', String(Math.trunc(Number(input.cartTotalCents))))
  }
  if (Number.isFinite(input.totalWeightGrams) && Number(input.totalWeightGrams) > 0) {
    params.set('total_weight_grams', String(Math.trunc(Number(input.totalWeightGrams))))
  }
  appendStoreScopeParam(quoteUrl, { apiKey: storefrontApiKey, storeId: input.storeId })

  const cookieHeader = await buildClientCookieHeader()
  const response = await fetch(quoteUrl, {
    method: 'GET',
    headers: withStorefrontScopeHeaders({
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    }, storefrontApiKey),
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao calcular frete' }
  }

  const payload = (await response.json()) as RawShippingQuoteResponse
  const quotes = Array.isArray(payload.quotes)
    ? payload.quotes
        .map((quote) => ({
          methodId: Number(quote.method_id || 0),
          methodName: String(quote.method_name || ''),
          methodType: String(quote.method_type || ''),
          priceCents: Number(quote.price_cents || 0),
          minDeliveryDays:
            typeof quote.min_delivery_days === 'number' ? quote.min_delivery_days : null,
          maxDeliveryDays:
            typeof quote.max_delivery_days === 'number' ? quote.max_delivery_days : null,
          isFree: Boolean(quote.is_free),
        }))
        .filter((quote) => quote.methodId > 0)
        .sort((left, right) => left.priceCents - right.priceCents)
    : []

  return {
    success: true,
    data: {
      zipCode: payload.zip_code || zipCode,
      quotes,
    },
  }
}