'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import type { ApiResponse, Customer, PaymentMethod } from '@/lib/types'

interface ClientPayload {
  contact_name?: string
  email?: string
  phone?: string
  company_name?: string
  trade_name?: string
  cnpj?: string
  state_registration?: string | null
  segment?: string
  address_zip?: string
  address_street?: string
  address_number?: string
  address_complement?: string | null
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  price_table_id?: number | null
  clear_price_table_id?: boolean
  min_pieces_override?: number | null
  clear_min_pieces_override?: boolean
  extra_discount_bps?: number | null
  assigned_seller_id?: number | null
  meta?: Record<string, unknown>
  password?: string
  [key: string]: unknown
}

const PAYMENT_METHODS: PaymentMethod[] = ['PIX', 'BOLETO', 'FATURADO', 'CARTAO_EXTERNO']

function resolveBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function readBackendErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text()
    if (!text) return fallback
    try {
      const payload = JSON.parse(text) as { message?: string; error?: string }
      if (payload?.message && typeof payload.message === 'string') return payload.message
      if (payload?.error && typeof payload.error === 'string') return payload.error
    } catch {
      // plain text response
    }
    return text
  } catch {
    return fallback
  }
}

function transformClientToCustomer(client: Record<string, unknown>): Customer {
  const meta = (client.meta && typeof client.meta === 'object') ? (client.meta as Record<string, unknown>) : {}
  const paymentTermsRaw = Array.isArray(meta.payment_terms) ? meta.payment_terms : []
  const paymentTerms = paymentTermsRaw
    .map((value) => String(value || '').toUpperCase())
    .filter((value): value is PaymentMethod => PAYMENT_METHODS.includes(value as PaymentMethod))
  const customFieldsRaw = (meta.custom_fields && typeof meta.custom_fields === 'object')
    ? (meta.custom_fields as Record<string, unknown>)
    : {}
  const customFields = Object.entries(customFieldsRaw)
    .map(([id, entry]) => {
      if (entry && typeof entry === 'object') {
        const payload = entry as Record<string, unknown>
        const value = Object.prototype.hasOwnProperty.call(payload, 'value') ? payload.value : entry
        const label = typeof payload.label === 'string' && payload.label.trim().length > 0
          ? payload.label
          : id
        const type = typeof payload.type === 'string' ? payload.type : undefined
        if (value === null || value === undefined || String(value).trim() === '') return null
        return { id, label, type, value }
      }

      if (entry === null || entry === undefined || String(entry).trim() === '') return null
      return { id, label: id, value: entry }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  const isWholesale = !!client.company_name
  const customerType = isWholesale ? 'WHOLESALE' : 'RETAIL'
  const companyName = isWholesale
    ? String(client.company_name || '')
    : String(client.name || '')
  const tradeName = isWholesale
    ? String(client.trade_name || '')
    : String(client.name || '')
  const document = isWholesale
    ? String(client.cnpj || '')
    : String(client.cpf_cnpj || '')
  const contactName = isWholesale
    ? String(client.contact_name || '')
    : String(client.name || '')
  const street = isWholesale
    ? String(client.address_street || '')
    : String(client.address_street || '')
  const number = isWholesale
    ? String(client.address_number || '')
    : String(client.address_number || '')
  const neighborhood = isWholesale
    ? String(client.address_neighborhood || '')
    : String(client.address_neighborhood || '')
  const city = isWholesale
    ? String(client.address_city || '')
    : String(client.address_city || '')
  const state = isWholesale
    ? String(client.address_state || '')
    : String(client.address_state || '')
  const zipCode = isWholesale
    ? String(client.address_zip || '')
    : String(client.address_zip || '')
  const status = (client.status as 'PENDING' | 'APPROVED' | 'REJECTED') || (isWholesale ? 'PENDING' : 'APPROVED')

  // Map B2bCustomer fields to Customer
  return {
    id: String(client.id || ''),
    userId: String(client.id || ''),
    customerType,
    companyName,
    tradeName,
    cnpj: document,
    stateRegistration: client.state_registration ? String(client.state_registration) : null,
    contactName,
    phone: String(client.phone || ''),
    email: String(client.email || ''),
    street,
    number,
    complement: client.address_complement ? String(client.address_complement) : null,
    neighborhood,
    city,
    state,
    zipCode,
    segment: String(client.segment || ''),
    status,
    priceTableId: client.price_table_id ? String(client.price_table_id) : null,
    minPiecesOverride:
      typeof client.min_pieces_override === 'number'
        ? Number(client.min_pieces_override)
        : null,
    extraDiscountPct:
      typeof client.extra_discount_bps === 'number'
        ? Number(client.extra_discount_bps) / 100
        : null,
    paymentTerms,
    assignedSellerId: client.assigned_seller_id ? String(client.assigned_seller_id) : null,
    assignedSellerName: client.assigned_seller_name ? String(client.assigned_seller_name) : null,
    cnae: (() => {
      const direct = meta.cnae ? String(meta.cnae) : null
      if (direct) return direct
      const rws = meta.receitaws && typeof meta.receitaws === 'object' ? (meta.receitaws as Record<string, unknown>) : {}
      const rwsData = rws.data && typeof rws.data === 'object' ? (rws.data as Record<string, unknown>) : {}
      return rwsData.cnae ? String(rwsData.cnae) : null
    })(),
    cnaeDescription: (() => {
      const direct = meta.cnae_description ? String(meta.cnae_description) : null
      if (direct) return direct
      const rws = meta.receitaws && typeof meta.receitaws === 'object' ? (meta.receitaws as Record<string, unknown>) : {}
      const rwsData = rws.data && typeof rws.data === 'object' ? (rws.data as Record<string, unknown>) : {}
      return rwsData.cnae_description ? String(rwsData.cnae_description) : null
    })(),
    registrationOrigin: client.origin ? String(client.origin) : (client.registration_origin ? String(client.registration_origin) : null),
    branchId: client.branch_id ? String(client.branch_id) : (client.branchId ? String(client.branchId) : null),
    branchSlug: client.branch_slug ? String(client.branch_slug) : (client.branchSlug ? String(client.branchSlug) : null),
    receitawsMeta:
      meta.receitaws && typeof meta.receitaws === 'object'
        ? {
            consultedAt: String((meta.receitaws as Record<string, unknown>).consulted_at || ''),
            data:
              ((meta.receitaws as Record<string, unknown>).data as Record<string, unknown>) || {},
          }
        : null,
    customFields,
    createdAt: new Date(client.created_at as string || new Date()),
    updatedAt: new Date(client.updated_at as string || new Date()),
  }
}

function extractStoreId(client: Record<string, unknown>): number | null {
  const parsed = Number(client.store_id ?? client.storeId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizeStoreId(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function extractRouteStoreId(pathname: string | null | undefined): number | null {
  if (!pathname) return null
  const firstPathSegment = pathname.split('/').filter(Boolean)[0] ?? null
  return normalizeStoreId(firstPathSegment)
}

async function resolveRequestedStoreId(storeId?: number | string | null): Promise<number | null> {
  const explicitStoreId = normalizeStoreId(storeId)
  if (explicitStoreId) return explicitStoreId

  try {
    const requestHeaders = await headers()
    const nextUrlStoreId = extractRouteStoreId(
      requestHeaders.get('x-next-url')
      ?? requestHeaders.get('next-url')
    )
    if (nextUrlStoreId) return nextUrlStoreId

    const referer = requestHeaders.get('referer')
    if (referer) {
      const refererStoreId = extractRouteStoreId(new URL(referer).pathname)
      if (refererStoreId) return refererStoreId
    }
  } catch {
    return null
  }

  return null
}

export async function getCustomersAction(filters?: {
  status?: string
  assignedSellerId?: string
  q?: string
  search?: string
}): Promise<ApiResponse<Customer[]>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const scopedStoreId = await getAdminStoreIdFromToken()

    if (!scopedStoreId) {
      return { success: false, error: 'Não foi possível resolver a loja do administrador autenticado' }
    }

    let wholesaleUrl = `${baseUrl}/b2b`
    let retailUrl = `${baseUrl}/clients`

    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)

    if (scopedStoreId) {
      params.append('store_id', String(scopedStoreId))
    }

    const queryTerm = (filters?.q || filters?.search || '').trim()
    if (queryTerm) params.append('q', queryTerm)

    if (params.toString()) {
      const searchParams = params.toString()
      wholesaleUrl += `?${searchParams}`
      retailUrl += `?${searchParams}`
    }

    const [wholesaleRes, retailRes] = await Promise.all([
      fetch(wholesaleUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
        cache: 'no-store',
      }),
      fetch(retailUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
        cache: 'no-store',
      }),
    ])

    if (!wholesaleRes.ok && !retailRes.ok) {
      const error = await readBackendErrorMessage(
        wholesaleRes,
        `HTTP ${wholesaleRes.status}: Erro ao buscar clientes`
      )
      return { success: false, error }
    }

    let wholesaleClients = wholesaleRes.ok
      ? ((await wholesaleRes.json()) as Record<string, unknown>[])
      : []
    let retailClients = retailRes.ok
      ? ((await retailRes.json()) as Record<string, unknown>[])
      : []

    let customers = [...wholesaleClients, ...retailClients].map(transformClientToCustomer)

    customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return { success: true, data: customers }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao listar clientes',
    }
  }
}

export async function getCustomersSummaryAction(): Promise<ApiResponse<{
  total: number
  pending: number
  approved: number
  rejected: number
}>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const scopedStoreId = await getAdminStoreIdFromToken()

    if (!scopedStoreId) {
      return { success: false, error: 'Não foi possível resolver a loja do administrador autenticado' }
    }

    const params = new URLSearchParams()
    params.append('store_id', String(scopedStoreId))

    const wholesaleUrl = `${baseUrl}/b2b/summary?${params.toString()}`
    const retailUrl = `${baseUrl}/clients/summary?${params.toString()}`

    const [wholesaleRes, retailRes] = await Promise.all([
      fetch(wholesaleUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
        cache: 'no-store',
      }),
      fetch(retailUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
        cache: 'no-store',
      }),
    ])

    if (!wholesaleRes.ok && !retailRes.ok) {
      const error = await readBackendErrorMessage(
        wholesaleRes,
        `HTTP ${wholesaleRes.status}: Erro ao buscar resumo de clientes`
      )
      return { success: false, error }
    }

    const wholesaleSummary = wholesaleRes.ok
      ? (await wholesaleRes.json()) as Record<string, unknown>
      : {}
    const retailSummary = retailRes.ok
      ? (await retailRes.json()) as Record<string, unknown>
      : {}

    const toNumber = (value: unknown): number => {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    const data = {
      total: toNumber(wholesaleSummary.total) + toNumber(retailSummary.total),
      pending: toNumber(wholesaleSummary.pending) + toNumber(retailSummary.pending),
      approved: toNumber(wholesaleSummary.approved) + toNumber(retailSummary.approved),
      rejected: toNumber(wholesaleSummary.rejected) + toNumber(retailSummary.rejected),
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao buscar resumo de clientes',
    }
  }
}

export async function getCustomerDetailAction(id: string): Promise<ApiResponse<Customer>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/b2b/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const retailResponse = await fetch(`${baseUrl}/clients/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
        cache: 'no-store',
      })

      if (!retailResponse.ok) {
        const error = await readBackendErrorMessage(response, `HTTP ${response.status}: Cliente não encontrado`)
        return { success: false, error }
      }

      const retailClient = (await retailResponse.json()) as Record<string, unknown>
      const customer = transformClientToCustomer(retailClient)
      return { success: true, data: customer }
    }

    const client = (await response.json()) as Record<string, unknown>
    const customer = transformClientToCustomer(client)
    
    return { success: true, data: customer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao buscar cliente',
    }
  }
}

export async function updateCustomerAction(
  id: string,
  formData: FormData
): Promise<ApiResponse<Customer>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const payload: ClientPayload = {}

    // Map form fields to API fields
    if (formData.has('contactName')) {
      payload.contact_name = formData.get('contactName') as string
    }
    if (formData.has('email')) {
      payload.email = formData.get('email') as string
    }
    if (formData.has('phone')) {
      payload.phone = formData.get('phone') as string
    }
    if (formData.has('companyName')) {
      payload.company_name = formData.get('companyName') as string
    }
    if (formData.has('tradeName')) {
      payload.trade_name = formData.get('tradeName') as string
    }
    if (formData.has('cnpj')) {
      payload.cnpj = formData.get('cnpj') as string
    }
    if (formData.has('stateRegistration')) {
      const val = formData.get('stateRegistration') as string
      payload.state_registration = val || null
    }
    if (formData.has('segment')) {
      payload.segment = formData.get('segment') as string
    }
    if (formData.has('zipCode')) {
      payload.address_zip = formData.get('zipCode') as string
    }
    if (formData.has('street')) {
      payload.address_street = formData.get('street') as string
    }
    if (formData.has('number')) {
      payload.address_number = formData.get('number') as string
    }
    if (formData.has('complement')) {
      const val = formData.get('complement') as string
      payload.address_complement = val || null
    }
    if (formData.has('neighborhood')) {
      payload.address_neighborhood = formData.get('neighborhood') as string
    }
    if (formData.has('city')) {
      payload.address_city = formData.get('city') as string
    }
    if (formData.has('state')) {
      payload.address_state = formData.get('state') as string
    }
    if (formData.has('priceTableId')) {
      const value = (formData.get('priceTableId') as string) || ''
      const numeric = Number(value)
      const hasValidValue = value !== '' && value !== 'default' && Number.isFinite(numeric) && numeric > 0
      payload.price_table_id = hasValidValue ? numeric : null
      payload.clear_price_table_id = !hasValidValue
    }
    if (formData.has('minPiecesOverride')) {
      const raw = (formData.get('minPiecesOverride') as string) || ''
      const numeric = raw ? Number(raw) : NaN
      const hasValidValue = Number.isFinite(numeric) && numeric >= 0
      payload.min_pieces_override = hasValidValue ? Math.round(numeric) : null
      payload.clear_min_pieces_override = !hasValidValue
    }
    if (formData.has('extraDiscountPct')) {
      const raw = (formData.get('extraDiscountPct') as string) || ''
      const numeric = raw ? Number(raw) : NaN
      payload.extra_discount_bps = Number.isFinite(numeric)
        ? Math.max(0, Math.min(10000, Math.round(numeric * 100)))
        : null
    }
    if (formData.has('assignedSellerId')) {
      const value = (formData.get('assignedSellerId') as string) || ''
      payload.assigned_seller_id = value && value !== 'default' ? Number(value) : null
    }
    if (formData.has('password')) {
      const password = ((formData.get('password') as string) || '').trim()
      if (password) {
        payload.password = password
      }
    }
    if (formData.has('paymentTerms')) {
      const raw = (formData.get('paymentTerms') as string) || '[]'
      let parsed: unknown = []
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = []
      }

      const normalized = Array.isArray(parsed)
        ? parsed
            .map((value) => String(value || '').toUpperCase())
            .filter((value): value is PaymentMethod => PAYMENT_METHODS.includes(value as PaymentMethod))
        : []

      payload.meta = {
        payment_terms: normalized,
      }
    }

    const response = await fetch(`${baseUrl}/b2b/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const retailPayload: Record<string, unknown> = {}
      if (formData.has('companyName')) retailPayload.name = formData.get('companyName') as string
      if (formData.has('email')) retailPayload.email = formData.get('email') as string
      if (formData.has('cnpj')) retailPayload.cpf_cnpj = formData.get('cnpj') as string
      if (formData.has('phone')) retailPayload.phone = formData.get('phone') as string
      if (formData.has('zipCode')) retailPayload.address_zip = formData.get('zipCode') as string
      if (formData.has('street')) retailPayload.address_street = formData.get('street') as string
      if (formData.has('number')) retailPayload.address_number = formData.get('number') as string
      if (formData.has('complement')) retailPayload.address_complement = formData.get('complement') as string
      if (formData.has('neighborhood')) retailPayload.address_neighborhood = formData.get('neighborhood') as string
      if (formData.has('city')) retailPayload.address_city = formData.get('city') as string
      if (formData.has('state')) retailPayload.address_state = formData.get('state') as string
      if (formData.has('password')) {
        const password = ((formData.get('password') as string) || '').trim()
        if (password) retailPayload.password = password
      }

      const retailResponse = await fetch(`${baseUrl}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
        body: JSON.stringify(retailPayload),
      })

      if (!retailResponse.ok) {
        const error = await readBackendErrorMessage(
          response,
          `HTTP ${response.status}: Erro ao atualizar cliente`
        )
        return { success: false, error }
      }

      const updatedRetail = (await retailResponse.json()) as Record<string, unknown>
      const customer = transformClientToCustomer(updatedRetail)

      revalidatePath('/customers')
      revalidatePath(`/customers/${id}`)

      return { success: true, data: customer }
    }

    const updated = (await response.json()) as Record<string, unknown>
    const customer = transformClientToCustomer(updated)

    revalidatePath('/customers')
    revalidatePath(`/customers/${id}`)

    return { success: true, data: customer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar cliente',
    }
  }
}

export async function approveCustomerAction(id: string): Promise<ApiResponse<Customer>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/b2b/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(
        response,
        `HTTP ${response.status}: Erro ao aprovar cliente`
      )
      return { success: false, error }
    }

    const updated = (await response.json()) as Record<string, unknown>
    const customer = transformClientToCustomer(updated)

    revalidatePath('/customers')
    revalidatePath(`/customers/${id}`)

    return { success: true, data: customer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao aprovar cliente',
    }
  }
}

export async function rejectCustomerAction(id: string): Promise<ApiResponse<Customer>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/b2b/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({ status: 'REJECTED' }),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(
        response,
        `HTTP ${response.status}: Erro ao rejeitar cliente`
      )
      return { success: false, error }
    }

    const updated = (await response.json()) as Record<string, unknown>
    const customer = transformClientToCustomer(updated)

    revalidatePath('/customers')
    revalidatePath(`/customers/${id}`)

    return { success: true, data: customer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao rejeitar cliente',
    }
  }
}

export async function deleteCustomerAction(id: string): Promise<ApiResponse<{ id: string }>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const wholesaleResponse = await fetch(`${baseUrl}/b2b/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
    })

    if (!wholesaleResponse.ok && wholesaleResponse.status !== 404) {
      const error = await readBackendErrorMessage(
        wholesaleResponse,
        `HTTP ${wholesaleResponse.status}: Erro ao remover cliente`,
      )
      return { success: false, error }
    }

    if (!wholesaleResponse.ok) {
      const retailResponse = await fetch(`${baseUrl}/clients/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
      })

      if (!retailResponse.ok) {
        const error = await readBackendErrorMessage(
          retailResponse,
          `HTTP ${retailResponse.status}: Erro ao remover cliente`,
        )
        return { success: false, error }
      }
    }

    revalidatePath('/customers')
    revalidatePath(`/customers/${id}`)

    return { success: true, data: { id } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao remover cliente',
    }
  }
}

export async function getCustomerByUserIdAction(userId: string): Promise<ApiResponse<Customer | null>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/b2b?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
    })

    if (!response.ok) {
      return { success: true, data: null }
    }

    const clients = (await response.json()) as Record<string, unknown>[]
    if (clients.length === 0) {
      return { success: true, data: null }
    }

    const customer = transformClientToCustomer(clients[0])
    return { success: true, data: customer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

export async function getCurrentB2bCustomerAction(storeId?: number | string | null): Promise<ApiResponse<Customer>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const b2bToken = cookieStore.get('b2bAuthToken')?.value

    // Only attempt to fetch if we have a B2B auth token
    if (!b2bToken) {
      return { success: false, error: 'Nenhum token B2B encontrado' }
    }

    const requestedStoreId = await resolveRequestedStoreId(storeId)
    const endpoint = requestedStoreId
      ? `${baseUrl}/b2b/me?store_id=${requestedStoreId}`
      : `${baseUrl}/b2b/me`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        cookie: `b2bAuthToken=${b2bToken}`,
      },
    })

    if (!response.ok) {
      return { success: false, error: 'Erro ao buscar perfil do cliente' }
    }

    const client = (await response.json()) as Record<string, unknown>
    const customer = transformClientToCustomer(client)
    return { success: true, data: customer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar perfil do cliente',
    }
  }
}

function sanitizeUndef(val: string | undefined | null): string | undefined {
  return val === '$undefined' || val === '' ? undefined : (val ?? undefined)
}

export async function createCustomerAdminAction(formData: {
  customer_type?: 'RETAIL' | 'WHOLESALE'
  retail_name?: string
  retail_cpf?: string
  retail_gender?: string
  retail_birth_date?: string
  retail_address_zip?: string
  retail_address_street?: string
  retail_address_number?: string
  retail_address_complement?: string
  retail_address_neighborhood?: string
  retail_address_city?: string
  retail_address_state?: string
  company_name?: string
  trade_name?: string
  cnpj?: string
  state_registration?: string
  segment?: string
  contact_name?: string
  email: string
  phone?: string
  address_zip?: string
  address_street?: string
  address_number?: string
  address_complement?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  price_table_id?: string
  assigned_seller_id?: string
  payment_terms?: string[]
  // RF manual
  cnae?: string
  cnae_description?: string
  natureza_juridica?: string
  capital_social?: string
  porte?: string
  data_abertura?: string
  optante_simples?: boolean
}): Promise<ApiResponse<{ id: string }>> {
  // Sanitize Next.js serialized undefined ("$undefined") values
  const fd = Object.fromEntries(
    Object.entries(formData).map(([k, v]) =>
      [k, Array.isArray(v) ? v : (typeof v === 'string' && v === '$undefined' ? undefined : v)]
    )
  ) as typeof formData

  try {
    const baseUrl = resolveBackendBaseUrl()
    if (!baseUrl) return { success: false, error: 'URL do backend não configurada' }

    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const scopedStoreId = await getAdminStoreIdFromToken()

    if (!scopedStoreId) {
      return { success: false, error: 'Não foi possível resolver a loja do administrador autenticado' }
    }

    // Senha temporária aleatória (admin criou o cliente, não precisa de senha real)
    const tempPassword =
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 6).toUpperCase() +
      '!2'

    if (fd.customer_type === 'RETAIL') {
      const createRetailRes = await fetch(`${baseUrl}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
        body: JSON.stringify({
          store_id: scopedStoreId,
          name: fd.retail_name || fd.company_name || '',
          email: fd.email,
          cpf_cnpj: sanitizeUndef(fd.retail_cpf) || sanitizeUndef(fd.cnpj) || null,
          gender: sanitizeUndef(fd.retail_gender) ?? null,
          birth_date: sanitizeUndef(fd.retail_birth_date) ?? null,
          phone: sanitizeUndef(fd.phone) ?? null,
          address_zip: sanitizeUndef(fd.retail_address_zip) ?? null,
          address_street: sanitizeUndef(fd.retail_address_street) ?? null,
          address_number: sanitizeUndef(fd.retail_address_number) ?? null,
          address_complement: sanitizeUndef(fd.retail_address_complement) ?? null,
          address_neighborhood: sanitizeUndef(fd.retail_address_neighborhood) ?? null,
          address_city: sanitizeUndef(fd.retail_address_city) ?? null,
          address_state: sanitizeUndef(fd.retail_address_state) ?? null,
          password: tempPassword,
        }),
      })

      if (!createRetailRes.ok) {
        const msg = await readBackendErrorMessage(
          createRetailRes,
          `Erro ao criar cliente retail (HTTP ${createRetailRes.status})`,
        )
        return { success: false, error: msg }
      }

      const retailCustomer = (await createRetailRes.json()) as { id?: number | string }
      const newRetailId = retailCustomer?.id
      if (!newRetailId) return { success: false, error: 'ID não retornado pelo backend (retail)' }

      revalidatePath('/customers')
      return { success: true, data: { id: String(newRetailId) } }
    }

    const registerRes = await fetch(`${baseUrl}/b2b/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({
        store_id: scopedStoreId,
        company_name: fd.company_name,
        trade_name: fd.trade_name || fd.company_name,
        cnpj: fd.cnpj,
        state_registration: sanitizeUndef(fd.state_registration) ?? null,
        segment: sanitizeUndef(fd.segment) ?? null,
        contact_name: fd.contact_name,
        email: fd.email,
        phone: sanitizeUndef(fd.phone) ?? null,
        password: tempPassword,
        address_zip: sanitizeUndef(fd.address_zip) ?? null,
        address_street: sanitizeUndef(fd.address_street) ?? null,
        address_number: sanitizeUndef(fd.address_number) ?? null,
        address_complement: sanitizeUndef(fd.address_complement) ?? null,
        address_neighborhood: sanitizeUndef(fd.address_neighborhood) ?? null,
        address_city: sanitizeUndef(fd.address_city) ?? null,
        address_state: sanitizeUndef(fd.address_state) ?? null,
      }),
    })

    if (!registerRes.ok) {
      const msg = await readBackendErrorMessage(
        registerRes,
        `Erro ao criar cliente (HTTP ${registerRes.status})`,
      )
      return { success: false, error: msg }
    }

    const registered = (await registerRes.json()) as { data?: { id?: number } }
    const newId = registered?.data?.id
    if (!newId) return { success: false, error: 'ID não retornado pelo backend' }

    // Monta meta com dados manuais da RF e payment_terms
    const rfData: Record<string, unknown> = {}
    if (fd.cnae) rfData.cnae = fd.cnae
    if (fd.cnae_description) rfData.cnae_description = fd.cnae_description
    if (fd.natureza_juridica) rfData.natureza_juridica = fd.natureza_juridica
    if (fd.capital_social) rfData.capital_social = fd.capital_social
    if (fd.porte) rfData.porte = fd.porte
    if (fd.data_abertura) rfData.abertura = fd.data_abertura
    if (fd.optante_simples !== undefined)
      rfData.simples = { optante: fd.optante_simples }

    const updatePayload: Record<string, unknown> = { status: 'APPROVED' }
    const cleanPriceTableId = sanitizeUndef(fd.price_table_id)
    if (cleanPriceTableId) {
      const n = Number(cleanPriceTableId)
      if (Number.isFinite(n) && n > 0) updatePayload.price_table_id = n
    }
    const cleanSellerId = sanitizeUndef(fd.assigned_seller_id)
    if (cleanSellerId) {
      const n = Number(cleanSellerId)
      if (Number.isFinite(n) && n > 0) updatePayload.assigned_seller_id = n
    }

    const metaUpdate: Record<string, unknown> = {}
    if (fd.customer_type) metaUpdate.customer_type = fd.customer_type
    if (fd.payment_terms?.length) metaUpdate.payment_terms = fd.payment_terms
    if (Object.keys(rfData).length)
      metaUpdate.receitaws = { consulted_at: new Date().toISOString(), data: rfData }
    if (Object.keys(metaUpdate).length) updatePayload.meta = metaUpdate

    const updateRes = await fetch(`${baseUrl}/b2b/${newId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(updatePayload),
    })

    if (!updateRes.ok) {
      const msg = await readBackendErrorMessage(
        updateRes,
        `Cliente criado, mas falhou ao atualizar dados comerciais (HTTP ${updateRes.status})`,
      )
      return { success: false, error: msg }
    }

    revalidatePath('/customers')
    return { success: true, data: { id: String(newId) } }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? `Falha ao criar cliente: ${error.message}`
          : 'Falha ao criar cliente: erro desconhecido',
    }
  }
}
