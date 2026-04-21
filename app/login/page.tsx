import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminLoginForm from '@/components/admin/admin-login-form'

export default async function AdminLoginPage() {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value
  const base = process.env.NEXT_PUBLIC_RUST_URL

  if (adminToken && base) {
    const res = await fetch(new URL('/admin/me', base), {
      headers: {
        cookie: `adminAuthToken=${adminToken}`,
      },
      cache: 'no-store',
    })

    if (res.ok) {
      redirect('/')
    }
  }

  return <AdminLoginForm />
}
