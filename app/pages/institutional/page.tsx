import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getAdminSession } from '@/lib/actions/auth'
import { getInstitutionalPagesAction } from '@/lib/actions/pages'
import AdminInstitutionalPagesClient from '@/components/admin/admin-institutional-pages-client'
import { tAdmin } from '@/lib/i18n/admin'

export async function generateMetadata() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('ADMIN_LOCALE')?.value || 'pt-BR'

  return {
    title: `${tAdmin(locale, 'admin.institutionalPages.title', 'Institutional Pages')} | Admin`,
    description: tAdmin(locale, 'admin.institutionalPages.subtitle', 'Manage the store institutional pages'),
  }
}

export default async function AdminInstitutionalPagesPage() {
  const session = await getAdminSession()
  const cookieStore = await cookies()
  const locale = cookieStore.get('ADMIN_LOCALE')?.value || 'pt-BR'

  if (!session) {
    redirect('/login')
  }

  const pages = await getInstitutionalPagesAction(session.storeId)

  return <AdminInstitutionalPagesClient storeId={session.storeId} initialPages={pages} locale={locale} />
}
