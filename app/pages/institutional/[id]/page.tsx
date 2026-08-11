import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getAdminSession } from '@/lib/actions/auth'
import { getInstitutionalPageAction } from '@/lib/actions/pages'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'
import AdminPagesBuilderClient from '@/components/admin/admin-pages-builder-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: 'Construtor de Páginas | Admin',
  description: 'Editor visual de páginas institucionais',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AdminPagesBuilderPage({ params }: PageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminPagesBuilderPageContent params={params} />
    </Suspense>
  )
}

async function AdminPagesBuilderPageContent({ params }: PageProps) {
  await ensureAdminPermission('pages.edit', '/pages/institutional')

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

  const fallbackStoreId = await getAdminStoreIdFromToken()
  const sessionStoreId = Number(session.storeId)
  const resolvedStoreId = Number.isInteger(sessionStoreId) && sessionStoreId > 0
    ? sessionStoreId
    : (fallbackStoreId ?? null)

  if (!resolvedStoreId) {
    console.log("[AdminPagesBuilderPage] Store scope unresolved", {
      pageId,
      sessionStoreId,
      fallbackStoreId,
    })
    return notFound()
  }

  const page = await getInstitutionalPageAction(pageId, resolvedStoreId)
  const pageStoreId = Number((page as any)?.store_id ?? (page as any)?.storeId ?? 0)

  if (!page || !Number.isInteger(pageStoreId) || pageStoreId <= 0 || pageStoreId !== resolvedStoreId) {
    console.log("[AdminPagesBuilderPage] Not found:", {
      pageId,
      pageExists: !!page,
      pageStoreId,
      resolvedStoreId,
    });
    return notFound()
  }

  return <AdminPagesBuilderClient storeId={resolvedStoreId} page={page} />
}
