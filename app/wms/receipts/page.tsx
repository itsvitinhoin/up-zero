import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/actions/auth'
import {
  getWmsLocationsAction,
  getWmsPositionsPageAction,
  getWmsWarehousesAction,
} from '@/lib/actions/wms'
import AdminWmsReceiveClient from '@/components/admin/admin-wms-receive-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'

export const metadata = { title: 'WMS - Entrada de Estoque | Admin' }

export const instant = false

type WmsReceiptsPageProps = {
  searchParams?: Promise<{
    warehouse?: string
    page?: string
  }>
}

export default function WmsReceiptsPage({ searchParams }: WmsReceiptsPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <WmsReceiptsPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function WmsReceiptsPageContent({ searchParams }: WmsReceiptsPageProps) {
  await ensureAdminPermission('inventory.manage_movements', '/wms/positions')

  const resolvedSearchParams = (await searchParams) ?? {}

  const session = await getAdminSession()
  if (!session) redirect('/login')

  const [warehousesResult, locationsResult] = await Promise.all([
    getWmsWarehousesAction(),
    getWmsLocationsAction(),
  ])
  const warehouses = warehousesResult.success ? warehousesResult.data : []
  const locations = locationsResult.success ? locationsResult.data : []

  const requestedWarehouseId = Number(resolvedSearchParams.warehouse)
  const defaultWarehouseId = warehouses.some((warehouse) => warehouse.id === requestedWarehouseId)
    ? requestedWarehouseId
    : warehouses[0]?.id

  const requestedPage = Number(resolvedSearchParams.page)
  const initialPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const pageSize = 100

  const receivingLocationId = locations.find(
    (location) => location.warehouse_id === defaultWarehouseId && location.type === 'RECEIVING' && location.active
  )?.id

  const positionsPageResult = (!defaultWarehouseId || !receivingLocationId)
    ? { success: true as const, data: { items: [], total: 0, limit: pageSize, offset: 0, hasMore: false } }
    : await getWmsPositionsPageAction({
        warehouseId: defaultWarehouseId,
        locationId: receivingLocationId,
        availableOnly: true,
        limit: pageSize,
        offset: (initialPage - 1) * pageSize,
      })

  let positionsPageData = positionsPageResult.success
    ? positionsPageResult.data
    : { items: [], total: 0, limit: pageSize, offset: 0, hasMore: false }
  let effectivePage = initialPage

  if (
    positionsPageResult.success
    && initialPage > 1
    && positionsPageData.total > 0
    && positionsPageData.items.length === 0
  ) {
    const lastPage = Math.max(1, Math.ceil(positionsPageData.total / pageSize))
    if (lastPage !== initialPage) {
      const lastPageResult = await getWmsPositionsPageAction({
        warehouseId: defaultWarehouseId,
        locationId: receivingLocationId,
        availableOnly: true,
        limit: pageSize,
        offset: (lastPage - 1) * pageSize,
      })

      if (lastPageResult.success) {
        positionsPageData = lastPageResult.data
        effectivePage = lastPage
      }
    }
  }

  const positions = positionsPageData.items
  const totalPositions = positionsPageData.total
  const resolvedPageSize = positionsPageData.limit

  const loadError = !warehousesResult.success
    ? warehousesResult.error
    : !locationsResult.success
        ? locationsResult.error
        : !positionsPageResult.success
          ? positionsPageResult.error
          : null

  return (
    <AdminWmsReceiveClient
      warehouses={warehouses}
      locations={locations}
      initialPositions={positions}
      initialTotalPositions={totalPositions}
      initialPageSize={resolvedPageSize}
      initialHistoryWarehouseId={defaultWarehouseId ? String(defaultWarehouseId) : ''}
      initialCurrentPage={effectivePage}
      loadError={loadError}
    />
  )
}
