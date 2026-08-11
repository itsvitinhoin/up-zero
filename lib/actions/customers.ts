'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { checkUserPermission } from '@/lib/actions/permissions'
import type { ApiResponse, Customer, MessageChannel, MessageTriggerType, PaymentMethod } from '@/lib/types'

interface ClientPayload {
  customer_type?: string
  store_id?: number | null
  contact_name?: string
  email?: string
  phone?: string
  company_name?: string
  trade_name?: string
  cnpj?: string
  gender?: string | null
  birth_date?: string | null
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

export type CustomerWebhookEvent =
  | 'customer.created'
  | 'customer.updated'
  | 'customer.approved'
  | 'customer.rejected'

interface CustomerWebhookDispatchResult {
  success: boolean
  message: string
  event: string
  customerId: number
  storeId: number
  payload?: unknown
}

export type CustomerMessageTrigger = Extract<
  MessageTriggerType,
  'CUSTOMER_REGISTERED' | 'CUSTOMER_APPROVED' | 'CUSTOMER_REJECTED' | 'CUSTOMER_PASSWORD_RESET'
>

interface CustomerMessageDispatchResult {
  success: boolean
  message: string
  channel: string
  recipient: string
  renderedMessage: string
  whatsappUrl?: string | null
}

function resolveBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function hasCustomerPermission(permissionCode: string): Promise<boolean> {
  try {
    const result = await checkUserPermission(permissionCode)
    return result?.has_permission === true
  } catch {
    return false
  }
}

async function canViewCustomers(): Promise<boolean> {
  return hasCustomerPermission('customers.view')
}

async function canViewAssignedCustomersOnly(): Promise<boolean> {
  try {
    const result = await checkUserPermission('customers.view_assigned_only')
    if (result?.source === 'system_role') return false
    return result?.has_permission === true
  } catch {
    return false
  }
}

async function canCreateCustomers(): Promise<boolean> {
  return hasCustomerPermission('customers.create')
}

async function canEditCustomers(): Promise<boolean> {
  return hasCustomerPermission('customers.edit')
}

async function canAssignSellerToCustomer(): Promise<boolean> {
  return hasCustomerPermission('customers.assign_seller')
}

function formDataChangesAssignedSeller(formData: FormData): boolean {
  return formData.has('assignedSellerId')
}

function isAssignedSellerOnlyUpdate(formData: FormData): boolean {
  const keys = Array.from(formData.keys())
  return keys.length === 1 && keys[0] === 'assignedSellerId'
}

async function canDeleteCustomers(): Promise<boolean> {
  return hasCustomerPermission('customers.delete')
}

async function canSendMessages(): Promise<boolean> {
  return hasCustomerPermission('messaging.send')
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

async function resolveAuthenticatedAdminId(baseUrl: string, adminToken?: string): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/admin/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) return null

    const payload = (await response.json()) as { id?: number | string }
    const id = payload?.id
    if (typeof id === 'number' && Number.isInteger(id) && id > 0) return String(id)
    if (typeof id === 'string' && id.trim().length > 0) return id.trim()
    return null
  } catch {
    return null
  }
}

function buildCustomerPayloadFromFormData(formData: FormData): ClientPayload {
  const payload: ClientPayload = {}

  if (formData.has('customerType')) {
    const value = ((formData.get('customerType') as string) || '').trim().toUpperCase()
    if (value === 'RETAIL' || value === 'WHOLESALE') {
      payload.customer_type = value
    }
  }
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
  if (formData.has('retailGender')) {
    const value = (formData.get('retailGender') as string) || ''
    payload.gender = value || null
  }
  if (formData.has('retailBirthDate')) {
    const value = (formData.get('retailBirthDate') as string) || ''
    payload.birth_date = value || null
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
    if (value && value !== 'default') {
      payload.assigned_seller_id = Number(value)
    } else {
      payload.clear_assigned_seller_id = true
    }
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

  return payload
}

function readWholesaleProfile(client: Record<string, unknown>): Record<string, unknown> | null {
  const profile = client.wholesale_profile
  return profile && typeof profile === 'object' ? (profile as Record<string, unknown>) : null
}

function readReceitawsData(meta: Record<string, unknown>): Record<string, unknown> | null {
  const receitaws = meta.receitaws
  if (!receitaws || typeof receitaws !== 'object') return null
  const data = (receitaws as Record<string, unknown>).data
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
}

function pickNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

const RESERVED_CUSTOMER_FIELD_IDS = new Set([
  'companyName',
  'razaoSocial',
  'tradeName',
  'nomeFantasia',
  'stateRegistration',
  'segment',
  'address',
  'addressZip',
  'addressStreet',
  'addressNumber',
  'addressComplement',
  'addressNeighborhood',
  'addressCity',
  'addressState',
])

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
    .filter(([id]) => !RESERVED_CUSTOMER_FIELD_IDS.has(id))
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

  const rawCustomerType = typeof client.customer_type === 'string'
    ? client.customer_type.toUpperCase()
    : typeof client.customerType === 'string'
      ? client.customerType.toUpperCase()
      : null
  const normalizedDocument = String(client.cnpj || client.cpf_cnpj || '').replace(/\D/g, '')
  const customerType = rawCustomerType === 'RETAIL' || rawCustomerType === 'WHOLESALE'
    ? rawCustomerType
    : normalizedDocument.length === 11
      ? 'RETAIL'
      : 'WHOLESALE'
  const isWholesale = customerType === 'WHOLESALE'
  const wholesaleProfile = readWholesaleProfile(client)
  const receitawsData = readReceitawsData(meta)
  const companyName = isWholesale
    ? pickNonEmptyString(
        client.company_name,
        wholesaleProfile?.company_name,
        receitawsData?.nome,
      )
    : pickNonEmptyString(client.name)
  const tradeName = isWholesale
    ? pickNonEmptyString(
        client.trade_name,
        wholesaleProfile?.trade_name,
        receitawsData?.fantasia,
        receitawsData?.nome,
      )
    : pickNonEmptyString(client.name)
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
  const whatsappContactedAtRaw = meta.whatsapp_contacted_at
  const whatsappContactedAt = typeof whatsappContactedAtRaw === 'string' && whatsappContactedAtRaw.trim().length > 0
    ? whatsappContactedAtRaw
    : null
  const whatsappContacted = whatsappContactedAt !== null || meta.whatsapp_contacted === true
  const rawId =
    client.id ??
    client.customer_id ??
    client.client_id ??
    client.user_id ??
    client.customerId ??
    client.clientId ??
    null
  const normalizedId = rawId === null || rawId === undefined ? '' : String(rawId).trim()

  // Map B2bCustomer fields to Customer
  return {
    id: normalizedId,
    userId: normalizedId,
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
    receitawsMeta:
      meta.receitaws && typeof meta.receitaws === 'object'
        ? {
            consultedAt: String((meta.receitaws as Record<string, unknown>).consulted_at || ''),
            data:
              ((meta.receitaws as Record<string, unknown>).data as Record<string, unknown>) || {},
          }
        : null,
    whatsappContacted,
    whatsappContactedAt,
    customFields,
    createdAt: client.created_at ? new Date(String(client.created_at)) : new Date(0),
    updatedAt: client.updated_at ? new Date(String(client.updated_at)) : new Date(0),
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
  withoutSeller?: boolean
  q?: string
  search?: string
  customerType?: string
}): Promise<ApiResponse<Customer[]>> {
  if (!(await canViewCustomers())) {
    return { success: false, error: 'Você não tem permissão para visualizar clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const scopedStoreId = await getAdminStoreIdFromToken()
    const enforceAssignedOnlyScope = await canViewAssignedCustomersOnly()
    const scopedAssignedSellerId = enforceAssignedOnlyScope
      ? await resolveAuthenticatedAdminId(baseUrl, adminToken)
      : null

    if (!scopedStoreId) {
      return { success: false, error: 'Não foi possível resolver a loja do administrador autenticado' }
    }

    if (enforceAssignedOnlyScope && !scopedAssignedSellerId) {
      return { success: false, error: 'Não foi possível resolver o vendedor autenticado' }
    }

    let customersUrl = `${baseUrl}/customers`

    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (scopedAssignedSellerId) {
      params.append('assigned_seller_id', scopedAssignedSellerId)
    } else if (filters?.withoutSeller) {
      params.append('without_seller', 'true')
    } else if (filters?.assignedSellerId) {
      params.append('assigned_seller_id', filters.assignedSellerId)
    }
    params.append('limit', '50')

    if (scopedStoreId) {
      params.append('store_id', String(scopedStoreId))
    }

    const queryTerm = (filters?.q || filters?.search || '').trim()
    if (queryTerm) params.append('q', queryTerm)
    if (filters?.customerType?.trim()) params.append('customer_type', filters.customerType.trim())

    if (params.toString()) {
      customersUrl += `?${params.toString()}`
    }

    const response = await fetch(customersUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(
        response,
        `HTTP ${response.status}: Erro ao buscar clientes`
      )
      return { success: false, error }
    }

    let customers = ((await response.json()) as Record<string, unknown>[]).map(transformClientToCustomer)

    customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return { success: true, data: customers }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao listar clientes',
    }
  }
}

export async function getCustomersPaginatedAction(filters?: {
  status?: string
  assignedSellerId?: string
  withoutSeller?: boolean
  q?: string
  search?: string
  customerType?: string
  page?: number
  limit?: number
  from?: string
  to?: string
}): Promise<ApiResponse<{
  items: Customer[]
  total: number
  page: number
  limit: number
  totalPages: number
}>> {
  if (!(await canViewCustomers())) {
    return { success: false, error: 'Você não tem permissão para visualizar clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const scopedStoreId = await getAdminStoreIdFromToken()
    const enforceAssignedOnlyScope = await canViewAssignedCustomersOnly()
    const scopedAssignedSellerId = enforceAssignedOnlyScope
      ? await resolveAuthenticatedAdminId(baseUrl, adminToken)
      : null

    if (!scopedStoreId) {
      return { success: false, error: 'Não foi possível resolver a loja do administrador autenticado' }
    }

    if (enforceAssignedOnlyScope && !scopedAssignedSellerId) {
      return { success: false, error: 'Não foi possível resolver o vendedor autenticado' }
    }

    const page = Math.max(1, Number(filters?.page) || 1)
    const limit = Math.max(1, Number(filters?.limit) || 20)
    const params = new URLSearchParams()

    if (filters?.status) params.append('status', filters.status)
    if (scopedAssignedSellerId) {
      params.append('assigned_seller_id', scopedAssignedSellerId)
    } else if (filters?.withoutSeller) {
      params.append('without_seller', 'true')
    } else if (filters?.assignedSellerId) {
      params.append('assigned_seller_id', filters.assignedSellerId)
    }
    params.append('page', String(page))
    params.append('limit', String(limit))
    params.append('store_id', String(scopedStoreId))

    const queryTerm = (filters?.q || filters?.search || '').trim()
    if (queryTerm) params.append('q', queryTerm)
    if (filters?.customerType?.trim()) params.append('customer_type', filters.customerType.trim())
    if (filters?.from?.trim()) params.append('from', filters.from.trim())
    if (filters?.to?.trim()) params.append('to', filters.to.trim())

    const response = await fetch(`${baseUrl}/customers/paginated?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(
        response,
        `HTTP ${response.status}: Erro ao buscar clientes`
      )
      return { success: false, error }
    }

    const payload = (await response.json()) as {
      items?: Record<string, unknown>[]
      total?: unknown
      page?: unknown
      limit?: unknown
      totalPages?: unknown
      total_pages?: unknown
    }

    const items = (Array.isArray(payload.items) ? payload.items : []).map(transformClientToCustomer)
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const parsedTotal = Number(payload.total)
    const parsedPage = Number(payload.page)
    const parsedLimit = Number(payload.limit)
    const rawTotalPages = payload.totalPages ?? payload.total_pages
    const parsedTotalPages = Number(rawTotalPages)

    const data = {
      items,
      total: Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0,
      page: Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : page,
      limit: Number.isFinite(parsedLimit) && parsedLimit >= 1 ? parsedLimit : limit,
      totalPages:
        Number.isFinite(parsedTotalPages) && parsedTotalPages >= 1
          ? parsedTotalPages
          : Math.max(1, Math.ceil((Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0) / limit)),
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao listar clientes',
    }
  }
}

export async function getCustomersSummaryAction(filters?: {
  status?: string
  q?: string
  search?: string
  customerType?: string
  from?: string
  to?: string
  assignedSellerId?: string
  withoutSeller?: boolean
}): Promise<ApiResponse<{
  total: number
  pending: number
  approved: number
  rejected: number
  wholesale: number
  retail: number
}>> {
  if (!(await canViewCustomers())) {
    return { success: false, error: 'Você não tem permissão para visualizar clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const scopedStoreId = await getAdminStoreIdFromToken()
    const enforceAssignedOnlyScope = await canViewAssignedCustomersOnly()
    const scopedAssignedSellerId = enforceAssignedOnlyScope
      ? await resolveAuthenticatedAdminId(baseUrl, adminToken)
      : null

    if (!scopedStoreId) {
      return { success: false, error: 'Não foi possível resolver a loja do administrador autenticado' }
    }

    if (enforceAssignedOnlyScope && !scopedAssignedSellerId) {
      return { success: false, error: 'Não foi possível resolver o vendedor autenticado' }
    }

    const params = new URLSearchParams()
    params.append('store_id', String(scopedStoreId))
    if (filters?.status?.trim()) params.append('status', filters.status.trim())
    const queryTerm = (filters?.q || filters?.search || '').trim()
    if (queryTerm) params.append('q', queryTerm)
    if (filters?.customerType?.trim()) params.append('customer_type', filters.customerType.trim())
    if (filters?.from?.trim()) params.append('from', filters.from.trim())
    if (filters?.to?.trim()) params.append('to', filters.to.trim())
    if (scopedAssignedSellerId) {
      params.append('assigned_seller_id', scopedAssignedSellerId)
    } else if (filters?.withoutSeller) {
      params.append('without_seller', 'true')
    } else if (filters?.assignedSellerId?.trim()) {
      params.append('assigned_seller_id', filters.assignedSellerId.trim())
    }

    const response = await fetch(`${baseUrl}/customers/summary?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(
        response,
        `HTTP ${response.status}: Erro ao buscar resumo de clientes`
      )
      return { success: false, error }
    }

    const summary = (await response.json()) as Record<string, unknown>

    const toNumber = (value: unknown): number => {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    const data = {
      total: toNumber(summary.total),
      pending: toNumber(summary.pending),
      approved: toNumber(summary.approved),
      rejected: toNumber(summary.rejected),
      wholesale: toNumber(summary.wholesale),
      retail: toNumber(summary.retail),
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
  if (!(await canViewCustomers())) {
    return { success: false, error: 'Você não tem permissão para visualizar clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/customers/${id}`, {
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
  const changesAssignedSeller = formDataChangesAssignedSeller(formData)
  const assignedSellerOnlyUpdate = isAssignedSellerOnlyUpdate(formData)

  if (assignedSellerOnlyUpdate) {
    if (!(await canAssignSellerToCustomer())) {
      return { success: false, error: 'Você não tem permissão para atribuir vendedora ao cliente' }
    }
  } else {
    if (!(await canEditCustomers())) {
      return { success: false, error: 'Você não tem permissão para editar clientes' }
    }
    if (changesAssignedSeller && !(await canAssignSellerToCustomer())) {
      return { success: false, error: 'Você não tem permissão para atribuir vendedora ao cliente' }
    }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const payload = buildCustomerPayloadFromFormData(formData)

    const response = await fetch(`${baseUrl}/customers/${id}`, {
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
      if (formData.has('assignedSellerId')) {
        const value = (formData.get('assignedSellerId') as string) || ''
        if (value && value !== 'default') {
          retailPayload.assigned_seller_id = Number(value)
        } else {
          retailPayload.clear_assigned_seller_id = true
        }
      }
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

export async function convertCustomerTypeAction(
  id: string,
  formData: FormData
): Promise<ApiResponse<Customer>> {
  if (!(await canEditCustomers())) {
    return { success: false, error: 'Você não tem permissão para editar clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const payload = buildCustomerPayloadFromFormData(formData)
    payload.store_id = await getAdminStoreIdFromToken()

    const response = await fetch(`${baseUrl}/customers/${id}/convert-type`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(
        response,
        `HTTP ${response.status}: Erro ao converter tipo do cliente`
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
      error: error instanceof Error ? error.message : 'Erro desconhecido ao converter cliente',
    }
  }
}

export async function approveCustomerAction(id: string): Promise<ApiResponse<Customer>> {
  if (!(await canEditCustomers())) {
    return { success: false, error: 'Você não tem permissão para editar clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/customers/${id}`, {
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
  if (!(await canEditCustomers())) {
    return { success: false, error: 'Você não tem permissão para editar clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/customers/${id}`, {
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

export async function approveClientAction(id: string): Promise<ApiResponse<Customer>> {
  if (!(await canEditCustomers())) {
    return { success: false, error: 'Você não tem permissão para editar clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/clients/${id}`, {
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
        `HTTP ${response.status}: Erro ao aprovar cliente retail`
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
      error: error instanceof Error ? error.message : 'Erro desconhecido ao aprovar cliente retail',
    }
  }
}

export async function rejectClientAction(id: string): Promise<ApiResponse<Customer>> {
  if (!(await canEditCustomers())) {
    return { success: false, error: 'Você não tem permissão para editar clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/clients/${id}`, {
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
        `HTTP ${response.status}: Erro ao rejeitar cliente retail`
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
      error: error instanceof Error ? error.message : 'Erro desconhecido ao rejeitar cliente retail',
    }
  }
}

export async function dispatchCustomerWebhookAction(
  id: string,
  event: CustomerWebhookEvent,
): Promise<ApiResponse<CustomerWebhookDispatchResult>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const headers = {
      'Content-Type': 'application/json',
      ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
    }

    const wholesaleResponse = await fetch(`${baseUrl}/customers/${id}/webhooks/dispatch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event }),
    })

    if (!wholesaleResponse.ok) {
      const retailResponse = await fetch(`${baseUrl}/clients/${id}/webhooks/dispatch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ event }),
      })

      if (!retailResponse.ok) {
        const error = await readBackendErrorMessage(
          wholesaleResponse,
          `HTTP ${wholesaleResponse.status}: Erro ao disparar webhook`,
        )
        return { success: false, error }
      }

      const data = (await retailResponse.json()) as CustomerWebhookDispatchResult
      return { success: true, data }
    }

    const data = (await wholesaleResponse.json()) as CustomerWebhookDispatchResult
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao disparar webhook',
    }
  }
}

export async function dispatchCustomerMessageAction(
  id: string,
  input: { trigger: CustomerMessageTrigger; channel: Extract<MessageChannel, 'WHATSAPP' | 'EMAIL'> },
): Promise<ApiResponse<CustomerMessageDispatchResult>> {
  if (!(await canSendMessages())) {
    return { success: false, error: 'Você não tem permissão para enviar mensagens' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const response = await fetch(`${baseUrl}/messaging/customers/${id}/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({
        trigger: input.trigger,
        channel: input.channel,
      }),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(
        response,
        `HTTP ${response.status}: Erro ao disparar mensagem do cliente`,
      )
      return { success: false, error }
    }

    const payload = (await response.json()) as Record<string, unknown>
    return {
      success: true,
      data: {
        success: Boolean(payload.success),
        message: String(payload.message || ''),
        channel: String(payload.channel || ''),
        recipient: String(payload.recipient || ''),
        renderedMessage: String(payload.renderedMessage || ''),
        whatsappUrl: payload.whatsappUrl ? String(payload.whatsappUrl) : null,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao disparar mensagem do cliente',
    }
  }
}

export async function markCustomerWhatsappContactAction(
  id: string,
): Promise<ApiResponse<{ whatsappContacted: boolean; whatsappContactedAt: string }>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const whatsappContactedAt = new Date().toISOString()
    const metaPayload = {
      whatsapp_contacted: true,
      whatsapp_contacted_at: whatsappContactedAt,
    }

    const wholesaleResponse = await fetch(`${baseUrl}/customers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({ meta: metaPayload }),
    })

    let updatedClient: Record<string, unknown> | null = null

    if (!wholesaleResponse.ok) {
      const retailResponse = await fetch(`${baseUrl}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
        },
        body: JSON.stringify({ meta: metaPayload }),
      })

      if (!retailResponse.ok) {
        const error = await readBackendErrorMessage(
          wholesaleResponse,
          `HTTP ${wholesaleResponse.status}: Erro ao registrar contato por WhatsApp`,
        )
        return { success: false, error }
      }

      try {
        updatedClient = (await retailResponse.json()) as Record<string, unknown>
      } catch {
        updatedClient = null
      }
    } else {
      try {
        updatedClient = (await wholesaleResponse.json()) as Record<string, unknown>
      } catch {
        updatedClient = null
      }
    }

    revalidatePath('/customers')
    revalidatePath(`/customers/${id}`)

    const updatedMeta =
      updatedClient?.meta && typeof updatedClient.meta === 'object'
        ? (updatedClient.meta as Record<string, unknown>)
        : null

    const persistedWhatsappContactedAtRaw = updatedMeta?.whatsapp_contacted_at
    const persistedWhatsappContactedAt =
      typeof persistedWhatsappContactedAtRaw === 'string' && persistedWhatsappContactedAtRaw.trim().length > 0
        ? persistedWhatsappContactedAtRaw
        : whatsappContactedAt

    return {
      success: true,
      data: {
        whatsappContacted: true,
        whatsappContactedAt: persistedWhatsappContactedAt,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao registrar contato por WhatsApp',
    }
  }
}

export async function deleteCustomerAction(id: string): Promise<ApiResponse<{ id: string }>> {
  if (!(await canDeleteCustomers())) {
    return { success: false, error: 'Você não tem permissão para excluir clientes' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const wholesaleResponse = await fetch(`${baseUrl}/customers/${id}`, {
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

    const response = await fetch(`${baseUrl}/customers/wholesale?user_id=${userId}`, {
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
      ? `${baseUrl}/customers/me?store_id=${requestedStoreId}`
      : `${baseUrl}/customers/me`

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
  if (!(await canCreateCustomers())) {
    return { success: false, error: 'Você não tem permissão para criar clientes' }
  }

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

    const registerRes = await fetch(`${baseUrl}/customers/register`, {
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
      if (!(await canAssignSellerToCustomer())) {
        return { success: false, error: 'Você não tem permissão para atribuir vendedora ao cliente' }
      }
      const n = Number(cleanSellerId)
      if (Number.isFinite(n) && n > 0) updatePayload.assigned_seller_id = n
    }

    const metaUpdate: Record<string, unknown> = {}
    if (fd.customer_type) metaUpdate.customer_type = fd.customer_type
    if (fd.payment_terms?.length) metaUpdate.payment_terms = fd.payment_terms
    if (Object.keys(rfData).length)
      metaUpdate.receitaws = { consulted_at: new Date().toISOString(), data: rfData }
    if (Object.keys(metaUpdate).length) updatePayload.meta = metaUpdate

    const updateRes = await fetch(`${baseUrl}/customers/${newId}`, {
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
