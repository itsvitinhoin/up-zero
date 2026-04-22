import { notFound } from 'next/navigation'
import { getProductsAction, getCategoriesAction } from '@/lib/actions/products'
import { getCustomLinkAction } from '@/lib/actions/custom-links'
import { NewCustomLinkForm } from '@/components/admin/new-custom-link-form'

interface EditCustomLinkPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Editar Link Personalizado | Admin',
}

export default async function EditCustomLinkPage({ params }: EditCustomLinkPageProps) {
  const { id } = await params

  const [linkResult, productsResult, categoriesResult] = await Promise.all([
    getCustomLinkAction(id),
    getProductsAction({ isActive: true }),
    getCategoriesAction(),
  ])

  if (!linkResult.success || !linkResult.data) {
    notFound()
  }

  const products = productsResult.success && productsResult.data ? productsResult.data : []
  const categories = categoriesResult.success && categoriesResult.data ? categoriesResult.data : []

  return (
    <NewCustomLinkForm
      products={products}
      categories={categories}
      initialLink={linkResult.data}
    />
  )
}
