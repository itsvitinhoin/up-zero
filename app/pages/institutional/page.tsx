import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getAdminSession } from '@/lib/actions/auth'
import { getInstitutionalPagesAction } from '@/lib/actions/pages'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import AdminInstitutionalPagesClient from '@/components/admin/admin-institutional-pages-client'
import { tAdmin } from '@/lib/i18n/admin'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export async function generateMetadata() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('ADMIN_LOCALE')?.value || 'pt-BR'

  return {
    title: `${tAdmin(locale, 'admin.institutionalPages.title', 'Institutional Pages')} | Admin`,
    description: tAdmin(locale, 'admin.institutionalPages.subtitle', 'Manage the store institutional pages'),
  }
}

export const instant = false

export default function AdminInstitutionalPagesPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminInstitutionalPagesPageContent />
    </Suspense>
  )
}

async function AdminInstitutionalPagesPageContent() {
  const session = await getAdminSession()
  const cookieStore = await cookies()
  const locale = cookieStore.get('ADMIN_LOCALE')?.value || 'pt-BR'

  if (!session) {
    redirect('/login')
  }

  const fallbackStoreId = await getAdminStoreIdFromToken()
  const sessionStoreId = Number(session.storeId)
  const resolvedStoreId = Number.isInteger(sessionStoreId) && sessionStoreId > 0
    ? sessionStoreId
    : (fallbackStoreId ?? null)

  if (!resolvedStoreId) {
    redirect('/login')
  }

  const pages = await getInstitutionalPagesAction(resolvedStoreId)

  return <AdminInstitutionalPagesClient storeId={resolvedStoreId} initialPages={pages} locale={locale} />
}
