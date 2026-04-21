import React from 'react'
import Script from 'next/script'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'
import { getSession, getAdminStoreIdFromToken } from '@/lib/auth'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import AdminMobileHeader from '@/components/admin/admin-mobile-header'
import AdminBottomNav from '@/components/admin/admin-bottom-nav'
import AdminAuthGuard from '@/components/admin/admin-auth-guard'
import { AdminStoreProvider, type AdminStoreInfo } from '@/contexts/admin-store-context'
import { AdminBranchProvider } from '@/contexts/admin-branch-context'
import { getBranchesAction } from '@/lib/actions/branches'
import { withAdminMockBranches } from '@/lib/admin-mock-data'
import type { SessionUser, UserRole, Branch } from '@/lib/types'
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
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [session, cookieStore] = await Promise.all([getSession(), cookies()])
  let effectiveSession: SessionUser | null = session

  const adminToken = cookieStore.get('adminAuthToken')?.value
  const base = process.env.NEXT_PUBLIC_RUST_URL
  const storeId = await getAdminStoreIdFromToken()
  const activeBranchId = cookieStore.get('ADMIN_BRANCH_ID')?.value ?? null

  let store: AdminStoreInfo | null = null
  let isLoggedIn = false
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
          }

          if (resolvedStoreId) {
            const [storeRes, branchesResult] = await Promise.all([
              fetch(new URL(`/stores/${resolvedStoreId}`, base), {
                headers: { cookie: `adminAuthToken=${adminToken}` },
                cache: 'no-store',
              }),
              getBranchesAction(),
            ])

            if (storeRes.ok) {
              const data = await storeRes.json()
              store = {
                id: data?.id,
                name: data?.name,
                slug: data?.slug,
                email: data?.email,
              }
            }

            branches = withAdminMockBranches(
              branchesResult.success && branchesResult.data ? branchesResult.data : []
            )
          }
        } else {
          isLoggedIn = false
        }
      } catch {
        isLoggedIn = false
      }
    }
  }

  const displayStoreName = formatStoreDisplayName(store?.name, store?.slug)

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="admin-theme">
          <AdminAuthGuard isLoggedIn={isLoggedIn}>
            <AdminBranchProvider
              initialBranches={branches}
              initialBranchId={activeBranchId}
            >
            <AdminStoreProvider
              session={effectiveSession}
              store={store}
              isLoggedIn={isLoggedIn}
            >
              {isLoggedIn ? (
                <>
                  <div className="flex h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--muted))_0%,_transparent_45%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--muted)/0.35)_100%)] text-sm">
                    <div className="hidden md:block">
                      <AdminSidebar session={effectiveSession} storeName={displayStoreName} />
                    </div>
                    <main className="w-full flex-1 overflow-auto pb-20 md:pb-0">
                      <AdminMobileHeader session={effectiveSession} storeName={displayStoreName} />
                      {children}
                    </main>
                  </div>
                  <AdminBottomNav session={effectiveSession} storeName={displayStoreName} />
                </>
              ) : (
                children
              )}
              <Toaster />
            </AdminStoreProvider>
            </AdminBranchProvider>
          </AdminAuthGuard>
        </ThemeProvider>
        <Analytics />
        <Script
          id="facebook-sdk-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.fbAsyncInit = function() {
                FB.init({
                  appId: '${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? ''}',
                  cookie: true,
                  xfbml: false,
                  version: 'v19.0'
                });
                FB.AppEvents.logPageView();
              };
              (function(d, s, id) {
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) { return; }
                js = d.createElement(s); js.id = id;
                js.src = 'https://connect.facebook.net/pt_BR/sdk.js';
                fjs.parentNode.insertBefore(js, fjs);
              }(document, 'script', 'facebook-jssdk'));
            `,
          }}
        />
      </body>
    </html>
  )
}
