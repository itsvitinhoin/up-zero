import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/actions/auth'
import { getMenusAction } from '@/lib/actions/menus'
import AdminMenusListClient from '@/components/admin/admin-menus-list-client'

export const metadata = {
  title: 'Menus | Admin',
  description: 'Gerencie os menus da loja',
}

export default async function AdminMenusPage() {
  const session = await getAdminSession()

  if (!session) {
    redirect('/login')
  }

  const { menus } = await getMenusAction(session.storeId)

  return <AdminMenusListClient menus={menus} />
}
