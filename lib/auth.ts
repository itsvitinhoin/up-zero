import { cookies, headers } from 'next/headers'
import type { SessionUser, UserRole } from './types'
import { getCurrentB2bCustomerAction } from './actions/customers'

const SESSION_COOKIE = 'b2b_session'

function normalizeStoreId(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null

    const base64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')

    const json = Buffer.from(base64, 'base64').toString('utf-8')
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function extractRouteStoreId(pathname: string | null | undefined): number | null {
  if (!pathname) return null
  const firstPathSegment = pathname.split('/').filter(Boolean)[0] ?? null
  return normalizeStoreId(firstPathSegment)
}

async function resolveCurrentStoreId(storeId?: number | string | null): Promise<number | null> {
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

export async function getAdminStoreIdFromToken(): Promise<number | null> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  if (!adminToken) {
    return normalizeStoreId(process.env.STORE_ID)
  }

  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (base) {
    try {
      const response = await fetch(new URL('/admin/me', base), {
        headers: {
          cookie: `adminAuthToken=${adminToken}`,
        },
        cache: 'no-store',
      })

      if (response.ok) {
        const admin = await response.json()
        const fromAdmin = normalizeStoreId(admin?.store_id ?? admin?.storeId)
        if (fromAdmin) return fromAdmin
      }
    } catch {
      // ignore and fallback to env
    }
  }

  const decodedPayload = decodeJwtPayload(adminToken)
  const fromToken = normalizeStoreId(
    decodedPayload?.store_id
    ?? decodedPayload?.storeId
    ?? decodedPayload?.store
    ?? decodedPayload?.storeID
  )
  if (fromToken) return fromToken

  return null
}

// Simple hash for demo - in production use bcrypt
function simpleHash(password: string): string {
  return `hashed_${password}`
}

function verifyPassword(password: string, hash: string): boolean {
  return simpleHash(password) === hash
}

export async function createSession(userId: string): Promise<string> {
  // In production, use JWT or secure session tokens
  const token = Buffer.from(JSON.stringify({ userId, createdAt: Date.now() })).toString('base64')
  
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
  
  return token
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete('b2bAuthToken')
  cookieStore.delete('adminAuthToken')
}

export async function getSession(storeId?: number | string | null): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const b2bToken = cookieStore.get('b2bAuthToken')?.value
    const requestedStoreId = await resolveCurrentStoreId(storeId)

    const resolveB2bFromToken = async (): Promise<SessionUser | null> => {
      if (!b2bToken) return null

      const decodedPayload = decodeJwtPayload(b2bToken)
      const tokenStoreId = normalizeStoreId(
        decodedPayload?.store_id
        ?? decodedPayload?.storeId
        ?? decodedPayload?.storeID
      )

      if (requestedStoreId && tokenStoreId && tokenStoreId !== requestedStoreId) {
        return null
      }

      try {
        const result = await getCurrentB2bCustomerAction(requestedStoreId)
        if (!result.success || !result.data) return null

        const normalizedStatus = String(result.data.status || '').toUpperCase()
        const role: UserRole = normalizedStatus === 'APPROVED' ? 'B2B_CUSTOMER' : 'PENDING'

        return {
          id: String(result.data.id),
          name: result.data.contactName || result.data.companyName,
          email: result.data.email,
          role,
          customerId: String(result.data.id),
        }
      } catch {
        return null
      }
    }
    
    // Fallback: se não tem sessão local, prioriza b2bAuthToken para storefront e depois adminAuthToken
    if (!token) {
      const b2bSession = await resolveB2bFromToken()
      if (b2bSession) return b2bSession

      if (adminToken) {
        return {
          id: 'admin-session',
          name: 'Admin',
          email: 'admin@local',
          role: 'ADMIN' as UserRole,
        }
      }
      
      // Fallback em desenvolvimento: retorna um admin se nenhuma sessão foi encontrada
      // Comentado: Preferir mostrar null em vez de fallback fictício
      // if (process.env.NODE_ENV === 'development') {
      //   return {
      //     id: 'dev-admin',
      //     name: 'Admin Dev',
      //     email: 'admin@dev.com',
      //     role: 'ADMIN' as UserRole,
      //   }
      // }
      
      return null
    }
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8')) as Record<string, unknown>
      const roleRaw = String(decoded.role || decoded.userRole || '').toUpperCase()
      const role = (roleRaw || '') as UserRole
      const email = typeof decoded.email === 'string' ? decoded.email : ''
      const name = typeof decoded.name === 'string' ? decoded.name : ''
      const id = typeof decoded.userId === 'string'
        ? decoded.userId
        : typeof decoded.id === 'string'
        ? decoded.id
        : ''

      if (id && role && email) {
        return {
          id,
          name: name || email,
          email,
          role,
          customerId: typeof decoded.customerId === 'string' ? decoded.customerId : undefined,
          sellerId: typeof decoded.sellerId === 'string' ? decoded.sellerId : undefined,
        }
      }
    } catch {
      const b2bSession = await resolveB2bFromToken()
      if (b2bSession) return b2bSession

      if (adminToken) {
        return {
          id: 'admin-session',
          name: 'Admin',
          email: 'admin@local',
          role: 'ADMIN' as UserRole,
        }
      }
    }

    const b2bSession = await resolveB2bFromToken()
    if (b2bSession) return b2bSession

    if (adminToken) {
      return {
        id: 'admin-session',
        name: 'Admin',
        email: 'admin@local',
        role: 'ADMIN' as UserRole,
      }
    }

    return null
  } catch {
    // Se houver erro ao acessar cookies, retorna admin em dev
    if (process.env.NODE_ENV === 'development') {
      return {
        id: 'dev-admin',
        name: 'Admin Dev',
        email: 'admin@dev.com',
        role: 'ADMIN' as UserRole,
      }
    }
    return null
  }
}

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null

  try {
    const response = await fetch(new URL('/admin/login', base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    })

    if (!response.ok) return null

    const data = (await response.json()) as { token?: string; admin?: { id?: number; name?: string; email?: string; role?: string } }
    const setCookieHeader = response.headers.get('set-cookie') || ''
    const cookieToken = setCookieHeader
      .split(';')
      .find(part => part.trim().startsWith('adminAuthToken='))
      ?.trim()
      .replace(/^adminAuthToken=/, '')

    const token = data?.token || cookieToken
    if (!token) return null

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

    return {
      id: String(data?.admin?.id || 'admin-session'),
      name: String(data?.admin?.name || 'Admin'),
      email: String(data?.admin?.email || email),
      role: (String(data?.admin?.role || 'ADMIN').toUpperCase() as UserRole),
    }
  } catch {
    return null
  }
}

export function hashPassword(password: string): string {
  return simpleHash(password)
}

// RBAC Permission Checks
export function canAccessAdmin(role: UserRole): boolean {
  return ['ADMIN', 'SALES_MANAGER'].includes(role)
}

export function canAccessSeller(role: UserRole): boolean {
  return role === 'SELLER'
}

export function canAccessStorefront(role: UserRole): boolean {
  return ['B2B_CUSTOMER', 'PENDING'].includes(role)
}

export function canViewCosts(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function canManageProducts(role: UserRole): boolean {
  return ['ADMIN', 'SALES_MANAGER'].includes(role)
}

export function canManageCategories(role: UserRole): boolean {
  return ['ADMIN', 'SALES_MANAGER'].includes(role)
}

export function canManageCoupons(role: UserRole): boolean {
  return ['ADMIN', 'SALES_MANAGER'].includes(role)
}

export function canManagePriceTables(role: UserRole): boolean {
  return ['ADMIN', 'SALES_MANAGER'].includes(role)
}

export function canManageCustomers(role: UserRole): boolean {
  return ['ADMIN', 'SALES_MANAGER'].includes(role)
}

export function canManageOrders(role: UserRole): boolean {
  return ['ADMIN', 'SALES_MANAGER'].includes(role)
}

export function canManageSettings(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function canPurchase(role: UserRole): boolean {
  return role === 'B2B_CUSTOMER'
}

export function canViewPrices(role: UserRole, priceVisibilityMode: 'LOGIN_REQUIRED' | 'PUBLIC'): boolean {
  if (role === 'B2B_CUSTOMER') return true
  if (role === 'PENDING') return false
  if (priceVisibilityMode === 'PUBLIC') return true
  return false
}
