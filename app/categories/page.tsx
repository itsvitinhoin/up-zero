import { Suspense } from "react"
import AdminCategoriesPageClient from "@/components/admin/admin-categories-page-client"
import { AdminRouteSkeleton } from "@/components/admin/admin-route-skeleton"
import { getCategoriesAction } from "@/lib/actions/categories"
import { connection } from "next/server"

export const metadata = {
  title: 'Categorias | Admin',
  description: 'Gerencie categorias da loja',
}

export const instant = false

export default function AdminCategoriesPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminCategoriesPageContent />
    </Suspense>
  )
}

async function AdminCategoriesPageContent() {
  await connection()

  const result = await getCategoriesAction()
  const initialCategories = result.success && result.data ? result.data : []

  return <AdminCategoriesPageClient initialCategories={initialCategories} />
}
