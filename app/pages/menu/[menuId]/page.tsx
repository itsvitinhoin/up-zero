import { redirect } from 'next/navigation'
import AdminMenuPage from '@/components/admin/admin-pages-menu-client'
import { getAdminSession } from '@/lib/actions/auth'
import { getMenuAction, getMenuItemsAction } from '@/lib/actions/menus'
import { getCategoriesAction } from '@/lib/actions/categories'
import { getInstitutionalPagesAction } from '@/lib/actions/pages'

export const metadata = {
  title: 'Menu Items | Admin',
  description: 'Configure os itens do menu de navegação da loja',
}

interface AdminMenuDetailPageProps {
  params: Promise<{ menuId: string }>
}

export default async function AdminMenuDetailPage({ params }: AdminMenuDetailPageProps) {
  const session = await getAdminSession()

  if (!session) {
    redirect('/login')
  }

  const { menuId: menuIdParam } = await params
  const menuId = Number(menuIdParam)

  if (!menuId || Number.isNaN(menuId)) {
    redirect('/pages/menu')
  }

  const [menuResult, menuItemsResult, categoriesResult, pagesResult] = await Promise.all([
    getMenuAction(menuId),
    getMenuItemsAction(menuId),
    getCategoriesAction(),
    getInstitutionalPagesAction(session.storeId),
  ])

  if (!menuResult.success || !menuResult.menu) {
    redirect('/pages/menu')
  }

  const initialItems = (menuItemsResult.items || []).map((item) => ({
    id: String(item.id),
    parentId: item.parent_id ? String(item.parent_id) : null,
    label: item.label,
    type: item.type as 'category' | 'page' | 'external',
    href: item.href,
    categoryId: item.category_id ? String(item.category_id) : undefined,
    pageId: item.page_slug || undefined,
    order: item.sort_order,
    isActive: item.is_active,
  }))

  const initialCategories = categoriesResult.success && categoriesResult.data
    ? categoriesResult.data
    : []

  const initialInstitutionalPages = Array.isArray(pagesResult)
    ? pagesResult
    : []

  return (
    <AdminMenuPage
      menuId={menuId}
      storeId={session.storeId}
      menuName={menuResult.menu.name}
      menuType={menuResult.menu.type}
      initialItems={initialItems}
      initialCategories={initialCategories}
      initialInstitutionalPages={initialInstitutionalPages}
    />
  )
}
