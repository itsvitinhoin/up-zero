import React from 'react'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { connection } from 'next/server'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession, getAdminStoreIdFromToken } from '@/lib/auth'
import { getSiteSettingsAction } from '@/lib/actions/settings'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import AdminMobileHeader from '@/components/admin/admin-mobile-header'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import AdminBottomNav from '@/components/admin/admin-bottom-nav'
import AdminAuthGuard from '@/components/admin/admin-auth-guard'
import AdminSessionKeepalive from '@/components/admin/admin-session-keepalive'
import { AdminStoreProvider, type AdminStoreInfo } from '@/contexts/admin-store-context'
import { AdminBranchProvider } from '@/contexts/admin-branch-context'
import { getBranchesAction } from '@/lib/actions/branches'
import type { Branch, SessionUser, UserRole } from '@/lib/types'
import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Admin | B2B Store',
  description: 'Painel administrativo da loja B2B',
  applicationName: 'Admin B2B',
  appleWebApp: {
    capable: true,
    title: 'Admin',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/v2.png', type: 'image/png' },
    ],
    apple: [
      { url: '/v2.png', type: 'image/png' },
    ],
    shortcut: ['/v2.png'],
  },
}

export const instant = false

const ADMIN_OPEN_MENUS_COOKIE_KEY = 'admin-open-menus'
const ADMIN_SIDEBAR_COLLAPSED_COOKIE_KEY = 'admin-sidebar-collapsed'

function formatStoreDisplayName(name?: string | null, slug?: string | null): string {
  const rawName = String(name || '').trim()
  const rawSlug = String(slug || '').trim()

  const looksLikeMarketingText =
    rawName.length > 28 ||
    /\bb2b\b/i.test(rawName) ||
    /\blojistas?\b/i.test(rawName) ||
    /\bpara\b/i.test(rawName)

  if (rawName && !looksLikeMarketingText) {
    return rawName
  }

  if (rawSlug) {
    return rawSlug
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  return rawName || 'Nome da loja'
}

function resolveStorefrontUrl(params: {
  customDomain?: string | null
  storeId?: number
}): string {
  const customDomain = String(params.customDomain || '').trim()

  if (customDomain) {
    if (/^https?:\/\//i.test(customDomain)) {
      return customDomain
    }

    return `https://${customDomain}`
  }

  if (params.storeId && Number.isInteger(params.storeId) && params.storeId > 0) {
    return `/${params.storeId}`
  }

  return '/'
}

function parseOpenMenusCookie(value?: string): string[] {
  if (!value) return []

  try {
    const parsedValue = JSON.parse(decodeURIComponent(value))
    if (!Array.isArray(parsedValue)) return []
    return parsedValue.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

function parseBooleanCookie(value?: string): boolean {
  return value === 'true'
}

function parseMaintenanceModeFromMeta(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false

  const record = meta as Record<string, unknown>
  const rawValue = record.maintenanceMode ?? record.maintenance_mode

  if (typeof rawValue === 'boolean') return rawValue
  if (typeof rawValue === 'number') return rawValue === 1
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }

  return false
}

function normalizePermissionCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function inferIsSystemRole(summary: unknown): boolean {
  if (!summary || typeof summary !== 'object') return false
  return (summary as { is_system_role?: boolean }).is_system_role === true
}

function resolveEffectivePermissionCodes(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []

  const summary = payload as {
    permissions_from_role?: Array<{ code?: unknown }>
    permission_overrides?: Array<unknown>
  }

  const fromRole = Array.isArray(summary.permissions_from_role)
    ? summary.permissions_from_role
    : []
  const overrides = Array.isArray(summary.permission_overrides)
    ? summary.permission_overrides
    : []

  const effective = new Set<string>()

  for (const permission of fromRole) {
    const code = normalizePermissionCode(permission?.code)
    if (code) {
      effective.add(code)
    }
  }

  for (const entry of overrides) {
    if (!Array.isArray(entry) || entry.length < 2) continue

    const permission = entry[0] as { code?: unknown } | undefined
    const granted = Boolean(entry[1])
    const code = normalizePermissionCode(permission?.code)
    if (!code) continue

    if (granted) {
      effective.add(code)
    } else {
      effective.delete(code)
    }
  }

  return Array.from(effective)
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()

  const requestHeaders = await headers()
  const requestPath = String(requestHeaders.get('x-next-url') || requestHeaders.get('next-url') || '')
  const isPublicRequestPath =
    requestPath.startsWith('/login')
    || requestPath.startsWith('/privacy')
    || requestPath.startsWith('/terms')
    || requestPath.startsWith('/data-deletion')
  const isSettingsRoute = requestPath.startsWith('/settings')

  // Paraleliza session, cookies e storeId
  const [session, cookieStore, storeId] = await Promise.all([
    getSession(),
    cookies(),
    getAdminStoreIdFromToken(),
  ])
  let effectiveSession: SessionUser | null = session

  const adminToken = cookieStore.get('adminAuthToken')?.value
  const base = process.env.NEXT_PUBLIC_RUST_URL

  let store: AdminStoreInfo | null = null
  let isLoggedIn = false
  let storefrontUrl = resolveStorefrontUrl({ storeId: storeId ?? undefined })
  const initialOpenMenus = parseOpenMenusCookie(cookieStore.get(ADMIN_OPEN_MENUS_COOKIE_KEY)?.value)
  const initialSidebarCollapsed = parseBooleanCookie(cookieStore.get(ADMIN_SIDEBAR_COLLAPSED_COOKIE_KEY)?.value)
  const activeBranchId = cookieStore.get('ADMIN_BRANCH_ID')?.value ?? null
  let branches: Branch[] = []

  const normalizeAdminRole = (rawRole: unknown): UserRole => {
    const normalized = String(rawRole || '').trim().toUpperCase()
    if (normalized === 'ADMIN') return 'ADMIN'
    if (normalized === 'SALES_MANAGER') return 'SALES_MANAGER'
    if (normalized === 'MANAGER') return 'SALES_MANAGER'
    return 'ADMIN'
  }

  if (adminToken) {
    isLoggedIn = true

    if (base) {
      try {
        const adminRes = await fetch(new URL('/admin/me', base), {
          headers: {
            cookie: `adminAuthToken=${adminToken}`,
          },
          cache: 'no-store',
        })

        if (adminRes.ok) {
          const admin = await adminRes.json()
          const adminStoreId = Number(admin?.store_id ?? admin?.storeId)
          const resolvedStoreId = Number.isInteger(adminStoreId) && adminStoreId > 0
            ? adminStoreId
            : storeId

          if (admin?.id && admin?.email) {
            effectiveSession = {
              id: String(admin.id),
              name: String(admin.name || 'Admin'),
              email: String(admin.email),
              role: normalizeAdminRole(admin.role),
              storeId: resolvedStoreId || undefined,
            }

            try {
              const permissionsRes = await fetch(new URL(`/permissions/user/${admin.id}/permissions`, base), {
                headers: {
                  cookie: `adminAuthToken=${adminToken}`,
                },
                cache: 'no-store',
              })

              let permissionCodes: string[] | undefined
              let isSystemRole = false

              if (permissionsRes.ok) {
                const permissionSummary = await permissionsRes.json() as {
                  is_system_role?: boolean
                  permissions_from_role?: Array<{ code?: unknown }>
                  permission_overrides?: Array<unknown>
                }
                permissionCodes = resolveEffectivePermissionCodes(permissionSummary)
                isSystemRole = inferIsSystemRole(permissionSummary)
              }

              effectiveSession = {
                ...effectiveSession,
                permissionCodes,
                isSystemRole,
              }
            } catch {
              // Falha de permissões não deve impedir carregamento do admin.
            }
          }

          const settingsResult = isSettingsRoute
            ? null
            : await getSiteSettingsAction(storeId, {
                include: {
                  shippingFixed: false,
                  b2b: false,
                  stock: false,
                  shipping: false,
                  theme: false,
                  product: false,
                  payment: false,
                  marketing: false,
                  domain: true,
                },
              })

          if (resolvedStoreId) {
            const storeRes = await fetch(new URL(`/stores/${resolvedStoreId}`, base), {
              headers: {
                cookie: `adminAuthToken=${adminToken}`,
              },
              cache: 'no-store',
            })

            if (storeRes.ok) {
              const data = await storeRes.json()
              store = {
                id: data?.id,
                name: data?.name,
                slug: data?.slug,
                email: data?.email,
                maintenanceMode: parseMaintenanceModeFromMeta(data?.meta),
              }
            }
          }

          if (settingsResult) {
            storefrontUrl = resolveStorefrontUrl({
              customDomain: settingsResult.data?.domainSettings?.customDomain,
              storeId: effectiveSession?.storeId ?? storeId ?? undefined,
            })
          } else {
            storefrontUrl = resolveStorefrontUrl({
              storeId: effectiveSession?.storeId ?? storeId ?? undefined,
            })
          }
        } else if (adminRes.status === 401 || adminRes.status === 403) {
          isLoggedIn = false

          if (!isPublicRequestPath) {
            redirect('/login')
          }
        } else {
          storefrontUrl = resolveStorefrontUrl({
            storeId: effectiveSession?.storeId ?? storeId ?? undefined,
          })
        }
      } catch {
        // Keep cookie-based session on transient backend/network failures.
        isLoggedIn = Boolean(adminToken)
        // Fallback simples em caso de erro
        storefrontUrl = resolveStorefrontUrl({ storeId: storeId ?? undefined })
      }
    }
  }

  if (isLoggedIn) {
    try {
      const branchesResult = await getBranchesAction()
      branches = branchesResult.success && branchesResult.data ? branchesResult.data : []
    } catch {
      branches = []
    }
  }

  const displayStoreName = formatStoreDisplayName(store?.name, store?.slug)

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="admin-theme">
          <AdminAuthGuard isLoggedIn={isLoggedIn}>
            <AdminBranchProvider initialBranches={branches} initialBranchId={activeBranchId}>
            <AdminStoreProvider
              session={effectiveSession}
              store={store}
              isLoggedIn={isLoggedIn}
              storefrontUrl={storefrontUrl}
            >
              <AdminSessionKeepalive enabled={isLoggedIn} />
              {isLoggedIn ? (
                <div className="flex h-screen bg-muted text-sm">
                  <div className="hidden md:block">
                    <AdminSidebar
                      session={effectiveSession}
                      storeName={displayStoreName}
                      initialOpenMenus={initialOpenMenus}
                      initialCollapsed={initialSidebarCollapsed}
                    />
                  </div>
                  <main className="w-full flex-1 overflow-auto pb-16 md:pb-0">
                    <AdminMobileHeader
                      session={effectiveSession}
                      storeName={displayStoreName}
                      initialOpenMenus={initialOpenMenus}
                    />
                    {children}
                  </main>
                  <AdminBottomNav session={effectiveSession} storeName={displayStoreName} />
                </div>
              ) : (
                children
              )}
              <Toaster />
            </AdminStoreProvider>
            </AdminBranchProvider>
          </AdminAuthGuard>
        </ThemeProvider>
      </body>
    </html>
  )
}
