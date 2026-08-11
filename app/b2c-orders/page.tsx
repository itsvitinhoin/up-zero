import { AdminB2CPage } from '@/components/admin/admin-b2c-page'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { Suspense } from 'react'

export const metadata = {
  title: 'Pedidos B2C | Admin',
  description: 'Distribua as solicitações de produtos B2C para revendedores.',
}

export default function B2COrdersPage() {
  return <Suspense fallback={<AdminRouteSkeleton />}><AdminB2CPage view="orders" /></Suspense>
}
