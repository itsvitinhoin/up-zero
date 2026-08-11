import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/actions/auth'
import { getWmsInventoryMovementsPageAction, getWmsWarehousesAction } from '@/lib/actions/wms'
import AdminWmsMovementsClient from '@/components/admin/admin-wms-movements-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = { title: 'WMS - Movimentacao de Estoque | Admin' }

export const instant = false

export default function WmsMovementsPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <WmsMovementsPageContent />
    </Suspense>
  )
}

async function WmsMovementsPageContent() {
  const session = await getAdminSession()
  if (!session) redirect('/login')

  const [warehousesResult, movementsResult] = await Promise.all([
    getWmsWarehousesAction(),
    getWmsInventoryMovementsPageAction({ limit: 200 }),
  ])

  const warehouses = warehousesResult.success ? warehousesResult.data : []
  const movements = movementsResult.success ? movementsResult.data.items : []
  const initialHasMore = movementsResult.success ? movementsResult.data.hasMore : false
  const initialNextCursor = movementsResult.success ? movementsResult.data.nextCursor : undefined
  const loadError = !warehousesResult.success
    ? warehousesResult.error
    : !movementsResult.success
      ? movementsResult.error
      : null

  return (
    <AdminWmsMovementsClient
      warehouses={warehouses}
      initialMovements={movements}
      initialHasMore={initialHasMore}
      initialNextCursor={initialNextCursor}
      loadError={loadError}
    />
  )
}
