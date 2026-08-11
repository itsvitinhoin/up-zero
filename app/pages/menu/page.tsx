import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/actions/auth'
import { getMenusAction } from '@/lib/actions/menus'
import AdminMenusListClient from '@/components/admin/admin-menus-list-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: 'Menus | Admin',
  description: 'Gerencie os menus da loja',
}

export const instant = false

export default function AdminMenusPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminMenusPageContent />
    </Suspense>
  )
}

async function AdminMenusPageContent() {
  const session = await getAdminSession()

  if (!session) {
    redirect('/login')
  }

  const { menus } = await getMenusAction(session.storeId)

  return <AdminMenusListClient menus={menus} />
}
