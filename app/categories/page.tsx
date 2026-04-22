import AdminCategoriesPageClient from "@/components/admin/admin-categories-page-client"
import { getCategoriesAction } from "@/lib/actions/categories"

export const metadata = {
  title: 'Categorias | Admin',
  description: 'Gerencie categorias da loja',
}

export default async function AdminCategoriesPage() {
  const result = await getCategoriesAction()
  const initialCategories = result.success && result.data ? result.data : []

  return <AdminCategoriesPageClient initialCategories={initialCategories} />
}
