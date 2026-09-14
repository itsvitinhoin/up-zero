import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import AdminLoginForm from '@/components/admin/admin-login-form'
import { resolveAdminLoginRedirect } from '@/lib/admin-login-redirect'

export const instant = false

type LoginPageProps = { searchParams: Promise<{ redirectTo?: string | string[] }> }

export default function AdminLoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense fallback={<AdminLoginForm />}>
      <AdminLoginPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminLoginPageContent({ searchParams }: LoginPageProps) {
  const destination = resolveAdminLoginRedirect((await searchParams).redirectTo)
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  const base = process.env.NEXT_PUBLIC_RUST_URL

  if (adminToken && base) {
    let res: Response
    try {
      res = await fetch(new URL('/admin/me', base), {
        headers: { cookie: `adminAuthToken=${adminToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      return <AdminLoginForm destination={destination} serviceError="O serviço de login está indisponível. Tente novamente em alguns instantes." />
    }

    if (res.ok) {
      redirect(destination)
    }
  }

  return <AdminLoginForm destination={destination} />
}
