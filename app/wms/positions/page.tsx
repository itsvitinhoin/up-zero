import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/actions/auth'
import {
  getWmsConsolidatedPositionsPageAction,
  getWmsLocationsAction,
  getWmsPositionsPageAction,
  getWmsWarehousesAction,
} from '@/lib/actions/wms'
import AdminWmsPositionsClient from '@/components/admin/admin-wms-positions-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = { title: 'WMS - Tabela de Estoque | Admin' }

export const instant = false

type WmsPositionsPageProps = {
  searchParams?: Promise<{
    warehouse?: string
    location?: string
    q?: string
    view?: string
    quick?: string
  }>
}

export default function WmsPositionsPage({ searchParams }: WmsPositionsPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <WmsPositionsPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function WmsPositionsPageContent({ searchParams }: WmsPositionsPageProps) {
  const session = await getAdminSession()
  if (!session) redirect('/login')

  const resolvedSearchParams = (await searchParams) ?? {}

  const requestedWarehouseId = Number(resolvedSearchParams.warehouse)
  const requestedLocationId = Number(resolvedSearchParams.location)
  const initialSearchTerm = (resolvedSearchParams.q ?? '').trim()
  const initialViewMode = ['cards', 'table', 'heatmap'].includes(resolvedSearchParams.view ?? '')
    ? (resolvedSearchParams.view as 'cards' | 'table' | 'heatmap')
    : 'cards'
  const initialQuickFilter = ['all', 'critical', 'rupture', 'high_reserve', 'spread', 'picking_excess'].includes(
    resolvedSearchParams.quick ?? ''
  )
    ? (resolvedSearchParams.quick as 'all' | 'critical' | 'rupture' | 'high_reserve' | 'spread' | 'picking_excess')
    : 'all'

  const numericSearchVariantId = /^\d+$/.test(initialSearchTerm)
    ? Number(initialSearchTerm)
    : undefined

  const [warehousesResult, locationsResult] = await Promise.all([
    getWmsWarehousesAction(),
    getWmsLocationsAction(),
  ])

  const warehouses = warehousesResult.success ? warehousesResult.data : []
  const locations = locationsResult.success ? locationsResult.data : []

  const warehouseId = warehouses.some((warehouse) => warehouse.id === requestedWarehouseId)
    ? requestedWarehouseId
    : undefined
  const locationId = locations.some((location) => {
    if (location.id !== requestedLocationId) return false
    if (!warehouseId) return true
    return location.warehouse_id === warehouseId
  })
    ? requestedLocationId
    : undefined

  const [positionsResult, consolidatedResult] = await Promise.all([
    getWmsPositionsPageAction({
      warehouseId,
      locationId,
      variantId: numericSearchVariantId,
      limit: 120,
      offset: 0,
    }),
    getWmsConsolidatedPositionsPageAction({
      warehouseId,
      locationId,
      variantId: numericSearchVariantId,
      search: initialSearchTerm,
      limit: 60,
      offset: 0,
    }),
  ])

  const positions = positionsResult.success ? positionsResult.data.items : []
  const initialTotal = positionsResult.success ? positionsResult.data.total : 0
  const initialHasMore = positionsResult.success ? positionsResult.data.hasMore : false
  const initialLimit = positionsResult.success ? positionsResult.data.limit : 120
  const initialConsolidated = consolidatedResult.success ? consolidatedResult.data.items : []
  const initialConsolidatedTotal = consolidatedResult.success ? consolidatedResult.data.total : 0
  const initialConsolidatedHasMore = consolidatedResult.success ? consolidatedResult.data.hasMore : false
  const initialConsolidatedLimit = consolidatedResult.success ? consolidatedResult.data.limit : 60
  const loadError = !positionsResult.success
    ? positionsResult.error
    : !warehousesResult.success
      ? warehousesResult.error
      : !locationsResult.success
        ? locationsResult.error
        : !consolidatedResult.success
          ? consolidatedResult.error
        : null

  return (
    <AdminWmsPositionsClient
      initialPositions={positions}
      initialTotal={initialTotal}
      initialHasMore={initialHasMore}
      initialLimit={initialLimit}
      initialConsolidated={initialConsolidated}
      initialConsolidatedTotal={initialConsolidatedTotal}
      initialConsolidatedHasMore={initialConsolidatedHasMore}
      initialConsolidatedLimit={initialConsolidatedLimit}
      initialWarehouseId={warehouseId ? String(warehouseId) : 'all'}
      initialLocationId={locationId ? String(locationId) : 'all'}
      initialSearchTerm={initialSearchTerm}
      initialViewMode={initialViewMode}
      initialQuickFilter={initialQuickFilter}
      warehouses={warehouses}
      locations={locations}
      loadError={loadError}
    />
  )
}
