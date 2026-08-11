import { AdminB2CPage } from '@/components/admin/admin-b2c-page'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { Suspense } from 'react'

export const metadata = {
  title: 'Clientes B2C | Admin',
  description: 'Acompanhe os consumidores cadastrados na vitrine.',
}

export default function B2CCustomersPage() {
  return <Suspense fallback={<AdminRouteSkeleton />}><AdminB2CPage view="customers" /></Suspense>
}
