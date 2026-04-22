'use server'

import { redirect } from 'next/navigation'
import { authenticateUser, destroySession, getSession } from '@/lib/auth'
import { loginSchema, registerB2BSchema } from '@/lib/validations'
import type { ApiResponse, SessionUser } from '@/lib/types'
import { cookies, headers } from 'next/headers'
import { getCurrentB2bCustomerAction } from './customers'

function normalizeStoreId(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function extractRouteStoreId(pathname: string | null | undefined): number | null {
  if (!pathname) return null
  const first = pathname.split('/').filter(Boolean)[0] ?? ''
  return normalizeStoreId(first)
}

async function resolveStoreIdForLogout(): Promise<number | null> {
  try {
    const h = await headers()
    const fromNextUrl = extractRouteStoreId(h.get('x-next-url') || h.get('next-url'))
    if (fromNextUrl) return fromNextUrl

    const referer = h.get('referer')
    if (referer) {
      try {
        const fromReferer = extractRouteStoreId(new URL(referer).pathname)
        if (fromReferer) return fromReferer
      } catch {
        const fromRawReferer = extractRouteStoreId(referer)
        if (fromRawReferer) return fromRawReferer
      }
    }
  } catch {
    // no-op: fallback de ambiente abaixo
  }

  return normalizeStoreId(process.env.STORE_ID)
}

export async function buildAdminCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const adminAuthToken = cookieStore.get('adminAuthToken')?.value
  if (!adminAuthToken) return undefined
  return `adminAuthToken=${adminAuthToken}`
}

export async function getAdminSession(): Promise<{ id: string; name: string; email: string; role: string; storeId?: number } | null> {
  const cookieStore = await cookies()
  const adminAuthToken = cookieStore.get('adminAuthToken')?.value
  if (!adminAuthToken) return null

  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) {
    const envStoreId = Number(process.env.STORE_ID)
    const storeId = Number.isFinite(envStoreId) && envStoreId > 0 ? envStoreId : undefined
    return { id: 'admin-session', name: 'Admin', email: 'admin@local', role: 'ADMIN', storeId }
  }

  try {
    const response = await fetch(new URL('/admin/me', base), {
      headers: {
        cookie: `adminAuthToken=${adminAuthToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) return null

    const admin = await response.json()
    const parsedStoreId = Number(admin?.store_id ?? admin?.storeId)
    const storeId = Number.isInteger(parsedStoreId) && parsedStoreId > 0 ? parsedStoreId : undefined
    const normalizedRole = String(admin?.role || '').trim().toUpperCase()

    return {
      id: String(admin?.id || 'admin-session'),
      name: String(admin?.name || 'Admin'),
      email: String(admin?.email || 'admin@local'),
      role: normalizedRole || 'ADMIN',
      storeId,
    }
  } catch {
    return null
  }
}

function resolveB2BBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null

  return base.replace(/\/$/, '')
}

async function readBackendErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const rawText = (await response.text()).trim()
    if (!rawText) return fallback

    try {
      const payload = JSON.parse(rawText) as { message?: string; error?: string }
      if (payload?.message && typeof payload.message === 'string') return payload.message
      if (payload?.error && typeof payload.error === 'string') return payload.error
    } catch {
      return rawText
    }

    return rawText
  } catch {
    return fallback
  }
}

function getActionFormValue(formData: FormData, key: string): string {
  const direct = formData.get(key)
  if (typeof direct === 'string') return direct

  for (const [formKey, value] of formData.entries()) {
    if (formKey.endsWith(`_${key}`) && typeof value === 'string') {
      return value
    }
  }

  return ''
}

async function isLocalhostRequest(): Promise<boolean> {
  try {
    const h = await headers()
    const host = String(h.get('x-forwarded-host') || h.get('host') || '').toLowerCase().trim()
    if (!host) return false

    const hostname = host.split(':')[0]
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export async function loginAction(
  _prevState: ApiResponse<SessionUser> | null,
  formData: FormData
): Promise<ApiResponse<SessionUser>> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string | null

  const validation = loginSchema.safeParse({ email, password })
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  const user = await authenticateUser(email, password)
  if (!user) {
    return { success: false, error: 'E-mail ou senha inválidos' }
  }

  // Determine redirect based on role
  let redirectPath = redirectTo || '/app'
  if (user.role === 'ADMIN' || user.role === 'SALES_MANAGER') {
    redirectPath = redirectTo || '/'
  } else if (user.role === 'SELLER') {
    redirectPath = redirectTo || '/seller'
  }

  redirect(redirectPath)
}

export async function adminLoginAction(
  _prevState: ApiResponse<SessionUser> | null,
  formData: FormData
): Promise<ApiResponse<SessionUser>> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const validation = loginSchema.safeParse({ email, password })
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  const user = await authenticateUser(email, password)
  if (!user) {
    return { success: false, error: 'E-mail ou senha inválidos' }
  }

  if (user.role !== 'ADMIN' && user.role !== 'SALES_MANAGER') {
    await destroySession()
    return { success: false, error: 'Acesso não autorizado' }
  }

  redirect('/')
}

export async function adminStoreLoginAction(
  _prevState: ApiResponse<{ token: string }> | null,
  formData: FormData
): Promise<ApiResponse<{ token: string }>> {
  const email = getActionFormValue(formData, 'email')
  const password = getActionFormValue(formData, 'password')

  const validation = loginSchema.safeParse({ email, password })
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL

  // Fallback: credenciais locais quando backend não está configurado
  if (!base) {
    const localEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
    const localPassword = process.env.LOCAL_ADMIN_PASSWORD?.trim()
    if (!localEmail || !localPassword || email !== localEmail || password !== localPassword) {
      return { success: false, error: 'E-mail ou senha inválidos' }
    }

    const localToken = Buffer.from(JSON.stringify({ id: 'local-admin', email, role: 'ADMIN', createdAt: Date.now() })).toString('base64')
    const cookieStore = await cookies()
    cookieStore.set('adminAuthToken', localToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 604800,
      path: '/',
    })
    return { success: true, data: { token: localToken } }
  }

  const response = await fetch(new URL('/admin/login', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'E-mail ou senha inválidos' }
  }

  const data = (await response.json()) as { token?: string; admin?: { id?: number; store_id?: number } }

  const setCookieHeader = response.headers.get('set-cookie') || ''
  const cookieToken = setCookieHeader
    .split(';')
    .find(part => part.trim().startsWith('adminAuthToken='))
    ?.trim()
    .replace(/^adminAuthToken=/, '')

  const token = data?.token || cookieToken
  if (!token) {
    return { success: false, error: 'Token não retornado pela API de admin' }
  }

  const cookieStore = await cookies()

  const expiresIn = Number(process.env.JWT_EXP_SECONDS || 604800)
  const cookieDomain = process.env.COOKIE_DOMAIN?.trim()
  const isProd = (process.env.APP_ENV || '').toLowerCase() === 'production'

  cookieStore.set('adminAuthToken', token, {
    httpOnly: true,
    secure: isProd || Boolean(cookieDomain),
    sameSite: cookieDomain ? 'none' : 'lax',
    maxAge: expiresIn,
    path: '/',
    domain: cookieDomain || undefined,
  })

  // Retorna sucesso sem redirect, deixa o client fazer a navegação
  return { success: true, data: { token } }
}

export async function sellerLoginAction(
  _prevState: ApiResponse<SessionUser> | null,
  formData: FormData
): Promise<ApiResponse<SessionUser>> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const validation = loginSchema.safeParse({ email, password })
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  const user = await authenticateUser(email, password)
  if (!user) {
    return { success: false, error: 'E-mail ou senha inválidos' }
  }

  if (user.role !== 'SELLER') {
    await destroySession()
    return { success: false, error: 'Acesso não autorizado. Use o portal de vendedoras.' }
  }

  redirect('/seller')
}

export async function logoutAction(): Promise<void> {
  const session = await getSession()
  const storeId = await resolveStoreIdForLogout()
  await destroySession()
  
  // Redirect based on where they were
  if (session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER') {
    redirect('/login')
  } else if (session?.role === 'SELLER') {
    redirect('/seller/login')
  } else {
    // B2B customer or unauthenticated - redirect to storefront home.
    redirect('/')
  }
}

export async function registerB2BAction(
  _prevState: ApiResponse<{ customerId: string }> | null,
  formData: FormData
): Promise<ApiResponse<{ customerId: string }>> {
  const parsedStoreId = Number(formData.get('storeId'))
  const requireCnpjValue = formData.get('requireCnpj')

  const data = {
    storeId: Number.isInteger(parsedStoreId) && parsedStoreId > 0 ? parsedStoreId : undefined,
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    requireCnpj: requireCnpjValue === null ? undefined : String(requireCnpjValue).toLowerCase() !== 'false',
    companyName: formData.get('companyName') as string,
    tradeName: formData.get('tradeName') as string,
    cnpj: formData.get('cnpj') as string,
    stateRegistration: formData.get('stateRegistration') as string || undefined,
    contactName: formData.get('contactName') as string,
    phone: formData.get('phone') as string,
    street: formData.get('street') as string,
    number: formData.get('number') as string,
    complement: formData.get('complement') as string || undefined,
    neighborhood: formData.get('neighborhood') as string,
    city: formData.get('city') as string,
    state: formData.get('state') as string,
    zipCode: formData.get('zipCode') as string,
    segment: formData.get('segment') as string || undefined,
  }

  const validation = registerB2BSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  const result = await registerB2B({
    storeId: data.storeId,
    requireCnpj: data.requireCnpj,
    companyName: data.companyName,
    tradeName: data.tradeName,
    cnpj: data.cnpj,
    stateRegistration: data.stateRegistration,
    segment: data.segment,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone,
    password: data.password,
    addressZip: data.zipCode,
    addressStreet: data.street,
    addressNumber: data.number,
    addressComplement: data.complement,
    addressNeighborhood: data.neighborhood,
    addressCity: data.city,
    addressState: data.state,
  })

  if (!result.success) {
    return { success: false, error: result.error || 'Erro ao cadastrar cliente B2B' }
  }

  return { success: true, data: result.data }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return getSession()
}

// Admin creates internal users
export async function createInternalUserAction(formData: FormData): Promise<ApiResponse<{ userId: string }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'Não autorizado' }
  }

  return { success: false, error: 'Criação interna via banco local foi removida. Use o backend administrativo.' }
}

// Simple login function that accepts email and password directly
export async function login(email: string, password: string): Promise<ApiResponse<SessionUser>> {
  const validation = loginSchema.safeParse({ email, password })
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  const user = await authenticateUser(email, password)
  if (user) {
    return { success: true, data: user }
  }

  const b2bLogin = await loginB2B(email, password)
  if (!b2bLogin.success) {
    return { success: false, error: b2bLogin.error || 'E-mail ou senha inválidos' }
  }

  const currentB2b = await getCurrentB2bCustomerAction()
  if (currentB2b.success && currentB2b.data) {
    const normalizedStatus = String(currentB2b.data.status || '').toUpperCase()
    return {
      success: true,
      data: {
        id: String(currentB2b.data.id),
        name: currentB2b.data.contactName || currentB2b.data.companyName,
        email: currentB2b.data.email,
        role: normalizedStatus === 'APPROVED' ? 'B2B_CUSTOMER' : 'PENDING',
        customerId: String(currentB2b.data.id),
      },
    }
  }

  return {
    success: true,
    data: {
      id: b2bLogin.data?.customerId || 'b2b-session',
      name: 'Cliente B2B',
      email,
      role: 'B2B_CUSTOMER',
      customerId: b2bLogin.data?.customerId,
    },
  }
}

// Aliases for backward compatibility
export const logout = logoutAction

// Simple registerB2B function that accepts an object directly
export async function registerB2B(data: {
  storeId?: number
  requireCnpj?: boolean
  companyName?: string
  tradeName?: string
  cnpj: string
  stateRegistration?: string
  segment?: string
  contactName: string
  email: string
  phone: string
  password: string
  addressZip: string
  addressStreet: string
  addressNumber: string
  addressComplement?: string
  addressNeighborhood: string
  addressCity: string
  addressState: string
  extraFields?: Record<string, unknown>
}): Promise<ApiResponse<{ customerId: string }>> {
  const envStoreId = Number(process.env.STORE_ID)
  const resolvedStoreId = Number.isInteger(data.storeId) && data.storeId > 0
    ? data.storeId
    : Number.isInteger(envStoreId) && envStoreId > 0
      ? envStoreId
      : undefined

  console.log('[registerB2B] start', {
    storeId: resolvedStoreId,
    requireCnpj: data.requireCnpj,
    email: data.email,
    companyName: data.companyName,
    hasStateRegistration: Boolean(data.stateRegistration),
    hasAddressComplement: Boolean(data.addressComplement),
  })

  const documentDigits = data.cnpj.replace(/\D/g, '')
  const isRetailRegistration = data.requireCnpj === false && documentDigits.length === 11

  const validationData = {
    name: data.contactName,
    email: data.email,
    password: data.password,
    confirmPassword: data.password,
    requireCnpj: data.requireCnpj,
    companyName: data.companyName,
    tradeName: data.tradeName,
    cnpj: data.cnpj,
    stateRegistration: data.stateRegistration,
    contactName: data.contactName,
    phone: data.phone,
    street: data.addressStreet,
    number: data.addressNumber,
    complement: data.addressComplement,
    neighborhood: data.addressNeighborhood,
    city: data.addressCity,
    state: data.addressState,
    zipCode: data.addressZip,
    segment: data.segment,
    extraFields: data.extraFields,
  }

  const validation = registerB2BSchema.safeParse(validationData)
  if (!validation.success) {
    const firstError = validation.error?.errors?.[0]
    const errorMessage = firstError
      ? `${firstError.path?.join('.') || 'form'}: ${firstError.message}`
      : validation.error?.message || 'Dados inválidos'
    console.log('[registerB2B] validation:error', errorMessage)
    return { success: false, error: errorMessage }
  }

  try {
    // Chamar o backend Rust
    const backendUrl = resolveB2BBackendBaseUrl()
    if (!backendUrl) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    if (isRetailRegistration) {
      const response = await fetch(`${backendUrl}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_id: resolvedStoreId,
          name: data.contactName,
          email: data.email,
          cpf: documentDigits,
          phone: data.phone,
          password: data.password,
          address_zip: data.addressZip,
          address_street: data.addressStreet,
          address_number: data.addressNumber,
          address_complement: data.addressComplement,
          address_neighborhood: data.addressNeighborhood,
          address_city: data.addressCity,
          address_state: data.addressState,
          extra_fields: data.extraFields || {},
        }),
      })

      console.log('[registerB2B] retail:backend:status', response.status)

      if (!response.ok) {
        const errorMessage = await readBackendErrorMessage(response, 'Erro ao registrar cliente retail')
        console.log('[registerB2B] retail:backend:error', errorMessage)
        return { success: false, error: errorMessage }
      }

      const result = await response.json()
      return { success: true, data: { customerId: String(result?.id || '') } }
    }
    
    const response = await fetch(`${backendUrl}/b2b/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        store_id: resolvedStoreId,
        company_name: data.companyName,
        trade_name: data.tradeName,
        cnpj: documentDigits,
        state_registration: data.stateRegistration,
        segment: data.segment,
        contact_name: data.contactName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        address_zip: data.addressZip,
        address_street: data.addressStreet,
        address_number: data.addressNumber,
        address_complement: data.addressComplement,
        address_neighborhood: data.addressNeighborhood,
        address_city: data.addressCity,
        address_state: data.addressState,
        extra_fields: data.extraFields || {},
      }),
    })

    console.log('[registerB2B] backend:status', response.status)

    if (!response.ok) {
      const errorMessage = await readBackendErrorMessage(response, 'Erro ao registrar B2B')
      console.log('[registerB2B] backend:error', errorMessage)
      return { success: false, error: errorMessage }
    }

    const result = await response.json()
    console.log('[registerB2B] backend:success', { hasToken: Boolean(result?.token), customerId: result?.data?.id })
    
    // Armazenar token B2B no cookie
    const cookieStore = await cookies()
    if (result.token) {
      const cookieDomain = process.env.COOKIE_DOMAIN?.trim()
      const isLocalhostDomain = cookieDomain === 'localhost' || cookieDomain === '127.0.0.1'
      const isLocalhostHost = await isLocalhostRequest()
      const isProd = (process.env.APP_ENV || '').toLowerCase() === 'production'
      const allowSecureCookie = isProd && !isLocalhostDomain && !isLocalhostHost

      cookieStore.set('b2bAuthToken', result.token, {
        httpOnly: true,
        secure: allowSecureCookie,
        sameSite: allowSecureCookie ? 'none' : 'lax',
        maxAge: 604800, // 7 dias
        path: '/',
        domain: cookieDomain && !isLocalhostDomain ? cookieDomain : undefined,
      })
    }

    return { success: true, data: { customerId: result.data.id.toString() } }
  } catch (error) {
    console.error('Erro ao registrar B2B:', error)
    const backendUrl = resolveB2BBackendBaseUrl() || 'NEXT_PUBLIC_RUST_URL'
    const backendPath = isRetailRegistration ? '/clients' : '/b2b/register'
    return {
      success: false,
      error: `Erro ao conectar com o servidor (${backendUrl}${backendPath})`,
    }
  }
}

export async function loginB2B(email: string, password: string, storeId?: number): Promise<ApiResponse<{ customerId: string }>> {
  if (!email || !password) {
    return { success: false, error: 'Email e senha são obrigatórios' }
  }

  try {
    const backendUrl = resolveB2BBackendBaseUrl()
    if (!backendUrl) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }
    
    const response = await fetch(`${backendUrl}/b2b/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        store_id: Number.isInteger(storeId) && (storeId as number) > 0 ? storeId : undefined,
      }),
      credentials: 'include', // Include cookies in request
    })

    if (!response.ok) {
      const errorMessage = await readBackendErrorMessage(response, 'Email ou senha inválidos')
      return { success: false, error: errorMessage }
    }

    const result = (await response.json()) as { data?: { id?: number }; token?: string }
    
    // Extract token from Set-Cookie header if available
    const setCookieHeader = response.headers.get('set-cookie')
    const jsonToken = result?.token
    let tokenFromHeader: string | null = null
    if (setCookieHeader) {
      // Parse b2bAuthToken from Set-Cookie header
      const tokenMatch = setCookieHeader.match(/b2bAuthToken=([^;]+)/)
      if (tokenMatch) {
        tokenFromHeader = tokenMatch[1]
      }
    }

    const token = tokenFromHeader || jsonToken
    if (token) {
      const cookieStore = await cookies()

      // Limpa sessão legada local para não conflitar com autenticação B2B real
      cookieStore.delete('b2b_session')

      const expiresIn = Number(process.env.JWT_EXP_SECONDS || 604800)
      const cookieDomain = process.env.COOKIE_DOMAIN?.trim()
      const isLocalhostDomain = cookieDomain === 'localhost' || cookieDomain === '127.0.0.1'
      const isLocalhostHost = await isLocalhostRequest()
      const isProd = (process.env.APP_ENV || '').toLowerCase() === 'production'
      const allowSecureCookie = isProd && !isLocalhostDomain && !isLocalhostHost

      cookieStore.set('b2bAuthToken', token, {
        httpOnly: true,
        secure: allowSecureCookie,
        sameSite: allowSecureCookie ? 'none' : 'lax',
        maxAge: expiresIn,
        path: '/',
        domain: cookieDomain && !isLocalhostDomain ? cookieDomain : undefined,
      })
    }

    // Verify response has customer data
    if (!result?.data?.id) {
      return { success: false, error: 'Dados do cliente não retornados' }
    }

    return { success: true, data: { customerId: result.data.id.toString() } }
  } catch (error) {
    console.error('Erro ao fazer login B2B:', error)
    const backendUrl = resolveB2BBackendBaseUrl() || 'NEXT_PUBLIC_RUST_URL'
    return {
      success: false,
      error: `Erro ao conectar com o servidor (${backendUrl}/b2b/login)`,
    }
  }
}

export async function updateProfile(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Não autorizado' }
  }

  return { success: false, error: 'Atualização de perfil local foi removida. Use o endpoint de perfil no backend.' }
}

export async function updatePassword(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Não autorizado' }
  }

  return { success: false, error: 'Alteração de senha local foi removida. Use o endpoint de senha no backend.' }
}
