'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getSession, canManageCoupons, getAdminStoreIdFromToken } from '@/lib/auth'
import type { ApiResponse, Coupon, CouponType } from '@/lib/types'

async function buildCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  const values = [
    adminToken ? `adminAuthToken=${adminToken}` : null,
  ].filter(Boolean)

  if (values.length === 0) return undefined
  return values.join('; ')
}

function isCouponsAuthorized(session: Awaited<ReturnType<typeof getSession>>, cookieHeader?: string): boolean {
  if (session && canManageCoupons(session.role)) {
    return true
  }

  if (!cookieHeader) {
    return false
  }

  return cookieHeader.includes('adminAuthToken=')
}

async function getStoreIdFromBackend(_base: string, _cookieHeader?: string): Promise<number | null> {
  const adminStoreId = await getAdminStoreIdFromToken()
  if (adminStoreId) return adminStoreId

  const rawStoreId = process.env.STORE_ID
  if (!rawStoreId) return null

  const parsed = Number(rawStoreId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

type RustCoupon = {
  id: string | number
  name?: string | null
  code?: string | null
  discount_type?: string | null
  percentage_bps?: string | number | null
  value_cents?: string | number | null
  created_at?: string | null
  updated_at?: string | null
  expiration_date?: string | null
  max_uses?: number | null
  current_uses?: number | null
  minimum_purchase_value_cents?: number | null
  status?: boolean | null
}

function mapRustCouponToLocal(c: RustCoupon): Coupon {
  const percentageBps = c.percentage_bps != null ? Number(c.percentage_bps) : null
  const percentageValue = percentageBps != null ? percentageBps / 100 : null
  const fixedValueCents = c.value_cents != null ? Number(c.value_cents) : null
  const couponType: CouponType = c.discount_type === 'fixed' ? 'fixed' : 'percentage'
  const couponValueCents = couponType === 'percentage'
    ? (percentageValue ?? 0)  // Percentage não é centavos
    : (fixedValueCents ?? 0)  // Fixed is em centavos

  return {
    id: String(c.id),
    name: String(c.name || c.code || ''),
    code: String(c.code || ''),
    type: couponType,
    ruleType: 'coupon',
    discountType: couponType === 'percentage' ? 'percentage' : 'fixed_amount',
    valueCents: couponValueCents,
    startsAt: c.created_at ? new Date(c.created_at) : new Date(),
    endsAt: c.expiration_date ? new Date(c.expiration_date) : new Date(),
    maxUses: c.max_uses || null,
    currentUses: c.current_uses || 0,
    minOrderValueCents: c.minimum_purchase_value_cents || null,
    scope: {
      type: 'ALL',
      categoryIds: [],
      productIds: [],
    },
    isActive: c.status ?? true,
    createdAt: new Date(c.created_at || new Date()),
    updatedAt: c.updated_at ? new Date(c.updated_at) : undefined,
  }
}

// Accept both plain keys and keys prefixed by Next.js server actions (e.g., "1_code").
function getFormValue(formData: FormData, key: string): string | null {
  const direct = formData.get(key)
  if (typeof direct === 'string') return direct
  for (const [formKey, value] of formData.entries()) {
    if (formKey.endsWith(`_${key}`) && typeof value === 'string') {
      return value
    }
  }
  return null
}

function hasFormField(formData: FormData, key: string): boolean {
  if (formData.has(key)) return true
  for (const formKey of formData.keys()) {
    if (formKey.endsWith(`_${key}`)) {
      return true
    }
  }
  return false
}

export async function getCouponsAction(): Promise<ApiResponse<Coupon[]>> {
  const session = await getSession()
  const cookieHeader = await buildCookieHeader()
  if (!isCouponsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado no loja' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)

  try {
    const url = new URL('/coupons', base)
    if (storeId) {
      url.searchParams.set('store_id', String(storeId))
    }

    const response = await fetch(url, {
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { success: false, error: 'Erro ao buscar coupons' }
    }

    const rustCoupons = (await response.json()) as RustCoupon[]
    const coupons = rustCoupons.map(mapRustCouponToLocal)

    return { success: true, data: coupons }
  } catch (error) {
    console.error('Erro ao buscar coupons:', error)
    return { success: false, error: 'Erro ao buscar coupons' }
  }
}

export async function createCouponAction(formData: FormData): Promise<ApiResponse<Coupon>> {
  const session = await getSession()
  const cookieHeader = await buildCookieHeader()
  if (!isCouponsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado no loja' }
  }

  const storeId = await getStoreIdFromBackend(base, cookieHeader)

  const code = getFormValue(formData, 'code')
  const type = getFormValue(formData, 'type') as CouponType | null
  const value = getFormValue(formData, 'value')
  const startsAt = getFormValue(formData, 'startsAt')
  const endsAt = getFormValue(formData, 'endsAt')
  const maxUses = getFormValue(formData, 'maxUses')
  const isActive = getFormValue(formData, 'isActive') === 'true'

  if (!code || !type || !value) {
    return { success: false, error: 'Código, tipo e valor são obrigatórios' }
  }

  const normalizedCode = code.toUpperCase()
  const numericValue = parseFloat(value)

  const payload: Record<string, unknown> = {
    name: normalizedCode,
    code: normalizedCode,
    status: isActive,
    store_id: storeId,
  }

  payload.discount_type = type

  if (type === 'percentage') {
    payload.percentage_bps = Math.round(numericValue * 100)
    payload.value_cents = 0
  } else {
    payload.value_cents = numericValue
    payload.percentage_bps = 0
  }

  if (endsAt) payload.expiration_date = endsAt
  const maxUsesValue = maxUses ? parseInt(maxUses) : null
  payload.max_uses = maxUsesValue
  payload.max_uses_active = maxUsesValue != null && maxUsesValue > 0

  const minOrderValueRaw = getFormValue(formData, 'minOrderValue')
  const minOrderValue = minOrderValueRaw && minOrderValueRaw.trim() !== '' ? minOrderValueRaw : null
  const minOrderValueCents = minOrderValue ? parseInt(minOrderValue) : null
  payload.minimum_purchase_value_cents = minOrderValueCents
  payload.minimum_purchase_value_active = minOrderValueCents != null && minOrderValueCents > 0

  try {
    const response = await fetch(new URL('/coupons', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText || 'Erro ao criar cupom' }
    }

    const createdCoupon = (await response.json()) as RustCoupon

    return { success: true, data: mapRustCouponToLocal(createdCoupon) }
  } catch (error) {
    console.error('Erro ao criar cupom:', error)
    return { success: false, error: 'Erro ao criar cupom' }
  }
}

export async function updateCouponAction(id: string, formData: FormData): Promise<ApiResponse<Coupon>> {
  const session = await getSession()
  const cookieHeader = await buildCookieHeader()
  if (!isCouponsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado no loja' }
  }



  const payload: Record<string, unknown> = {}

  if (hasFormField(formData, 'code')) {
    const normalizedCode = (getFormValue(formData, 'code') || '').toUpperCase()
    payload.code = normalizedCode
    payload.name = normalizedCode
  }

  if (hasFormField(formData, 'type') && hasFormField(formData, 'value')) {
    const type = getFormValue(formData, 'type') as CouponType
    const valueRaw = getFormValue(formData, 'value')
    if (!valueRaw) {
      return { success: false, error: 'Valor é obrigatório' }
    }
    const numericValue = parseFloat(valueRaw)
    payload.discount_type = type

    if (type === 'percentage') {
      payload.percentage_bps = Math.round(numericValue * 100)
      payload.value_cents = 0
    } else {
      payload.value_cents = numericValue
      payload.percentage_bps = 0
    }
  }

  if (hasFormField(formData, 'startsAt')) {
    const startsAt = getFormValue(formData, 'startsAt') || ''
    if (startsAt) payload.expiration_date = startsAt
  }

  if (hasFormField(formData, 'endsAt')) {
    const endsAt = getFormValue(formData, 'endsAt') || ''
    if (endsAt) payload.expiration_date = endsAt
  }

  const maxUses = getFormValue(formData, 'maxUses') || ''
  const maxUsesValue = maxUses ? parseInt(maxUses) : null
  payload.max_uses = maxUsesValue
  payload.max_uses_active = maxUsesValue != null && maxUsesValue > 0

  const minOrderValueRaw = getFormValue(formData, 'minOrderValue')
  const minOrderValue = minOrderValueRaw && minOrderValueRaw.trim() !== '' ? minOrderValueRaw : null
  const minOrderValueCents = minOrderValue ? parseInt(minOrderValue) : null
  payload.minimum_purchase_value_cents = minOrderValueCents
  payload.minimum_purchase_value_active = minOrderValueCents != null && minOrderValueCents > 0

  if (hasFormField(formData, 'isActive')) {
    payload.status = getFormValue(formData, 'isActive') === 'true'
  }



  try {
    const response = await fetch(new URL(`/coupons/${id}`, base), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText || 'Cupom não encontrado' }
    }

    const updatedCoupon = (await response.json()) as RustCoupon

    return { success: true, data: mapRustCouponToLocal(updatedCoupon) }
  } catch (error) {
    console.error('Erro ao atualizar cupom:', error)
    return { success: false, error: 'Erro ao atualizar cupom' }
  }
}

export async function deleteCouponAction(id: string): Promise<ApiResponse<void>> {
  const session = await getSession()
  const cookieHeader = await buildCookieHeader()
  if (!isCouponsAuthorized(session, cookieHeader)) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  if (!cookieHeader) {
    return { success: false, error: 'Não autenticado no loja' }
  }

  try {
    const response = await fetch(new URL(`/coupons/${id}`, base), {
      method: 'DELETE',
      headers: {
        cookie: cookieHeader,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText || 'Erro ao deletar cupom' }
    }

    revalidatePath('/coupons')

    return { success: true }
  } catch (error) {
    console.error('Erro ao deletar cupom:', error)
    return { success: false, error: 'Erro ao deletar cupom' }
  }
}
