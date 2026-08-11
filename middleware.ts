import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const ADMIN_AUTH_COOKIE = 'adminAuthToken'
const PUBLIC_PATHS = new Set(['/login', '/privacy', '/no-access'])

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null

    const base64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')

    const json = atob(base64)
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function isExpiredToken(token: string): boolean {
  const payload = decodeJwtPayload(token)
  const exp = Number(payload?.exp)

  if (!Number.isFinite(exp) || exp <= 0) {
    return true
  }

  return exp <= Math.floor(Date.now() / 1000)
}

function buildLoginRedirect(request: NextRequest, clearCookie: boolean): NextResponse {
  const loginUrl = new URL('/login', request.url)
  const redirectTo = `${request.nextUrl.pathname}${request.nextUrl.search}`

  if (redirectTo && redirectTo !== '/login') {
    loginUrl.searchParams.set('redirectTo', redirectTo)
  }

  const response = NextResponse.redirect(loginUrl)

  if (clearCookie) {
    response.cookies.delete(ADMIN_AUTH_COOKIE)
  }

  return response
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPath = PUBLIC_PATHS.has(pathname)
  const adminToken = request.cookies.get(ADMIN_AUTH_COOKIE)?.value?.trim() || ''
  const hasValidAdminToken = Boolean(adminToken) && !isExpiredToken(adminToken)

  if (isPublicPath) {
    if (pathname === '/login' && adminToken && !hasValidAdminToken) {
      const response = NextResponse.next()
      response.cookies.delete(ADMIN_AUTH_COOKIE)
      return response
    }

    return NextResponse.next()
  }

  if (!adminToken) {
    return buildLoginRedirect(request, false)
  }

  if (!hasValidAdminToken) {
    return buildLoginRedirect(request, true)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2)$).*)',
  ],
}