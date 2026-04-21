import { getProductsAction, getCategoriesAction } from '@/lib/actions/products'
import { NewCustomLinkForm } from '@/components/admin/new-custom-link-form'

export const metadata = {
  title: 'Novo Link Personalizado | Admin',
}

export default async function NewCustomLinkPage() {
  const [productsResult, categoriesResult] = await Promise.all([
    getProductsAction({ isActive: true }),
    getCategoriesAction(),
  ])

  const products = productsResult.success && productsResult.data ? productsResult.data : []
  const categories = categoriesResult.success && categoriesResult.data ? categoriesResult.data : []

  return (
    <NewCustomLinkForm
      products={products}
      categories={categories}
    />
  )
}
