import { redirect, notFound } from 'next/navigation'
import { getAdminSession } from '@/lib/actions/auth'
import { getInstitutionalPageAction } from '@/lib/actions/pages'
import AdminPagesBuilderClient from '@/components/admin/admin-pages-builder-client'

export const metadata = {
  title: 'Construtor de Páginas | Admin',
  description: 'Editor visual de páginas institucionais',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminPagesBuilderPage({ params }: PageProps) {
  const session = await getAdminSession()

  if (!session) {
    redirect('/login')
  }

  const { id } = await params
  const pageId = parseInt(id, 10)
  if (isNaN(pageId)) {
    console.log("[AdminPagesBuilderPage] NaN pageId:", id);
    return notFound()
  }

  const page = await getInstitutionalPageAction(pageId)

  if (!page || page.store_id !== session.storeId) {
    console.log("[AdminPagesBuilderPage] Not found:", { pageId, pageExists: !!page, pageStoreId: page?.store_id, sessionStoreId: session.storeId });
    return notFound()
  }

  return <AdminPagesBuilderClient storeId={session.storeId} page={page} />
}
