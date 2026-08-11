import { AdminB2CPage } from '@/components/admin/admin-b2c-page'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { Suspense } from 'react'

export const metadata = {
  title: 'Dashboard B2C | Admin',
  description: 'Acompanhe consumidores, solicitações e a distribuição B2C.',
}

export default function B2CDashboardPage() {
  return <Suspense fallback={<AdminRouteSkeleton />}><AdminB2CPage view="dashboard" /></Suspense>
}
