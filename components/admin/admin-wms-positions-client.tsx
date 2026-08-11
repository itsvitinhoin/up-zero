'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Boxes,
  RefreshCcw,
  Search,
  Edit2,
  Package,
  MapPin,
  AlertCircle,
  LayoutGrid,
  List,
  Layers3,
  Flame,
  Clock3,
  ChevronRight,
  Loader2,
  Warehouse,
  Filter,
} from 'lucide-react'
import {
  getWmsConsolidatedPositionsPageAction,
  getWmsPositionsPageAction,
  getWmsInventoryMovementsAction,
  type WmsConsolidatedPosition,
  updateWmsInventoryPositionAction,
  type WmsInventoryMovement,
  type WmsInventoryPosition,
  type WmsLocation,
  type WmsWarehouse,
} from '@/lib/actions/wms'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import NumberInput from '@/components/form/NumberInput'
import { useAdminStore } from '@/contexts/admin-store-context'

type Props = {
  initialPositions: WmsInventoryPosition[]
  initialTotal: number
  initialHasMore: boolean
  initialLimit: number
  initialConsolidated: WmsConsolidatedPosition[]
  initialConsolidatedTotal: number
  initialConsolidatedHasMore: boolean
  initialConsolidatedLimit: number
  initialWarehouseId: string
  initialLocationId: string
  initialSearchTerm: string
  initialViewMode: ViewMode
  initialQuickFilter: QuickFilter
  warehouses: WmsWarehouse[]
  locations: WmsLocation[]
  loadError?: string | null
}

type ViewMode = 'cards' | 'table' | 'heatmap'
type QuickFilter = 'all' | 'critical' | 'rupture' | 'high_reserve' | 'spread' | 'picking_excess'

type ConsolidatedLocation = {
  locationId: number
  locationCode: string
  locationType: string
  warehouseId: number
  warehouseLabel: string
  qtyTotal: number
  qtyReserved: number
  qtyAvailable: number
  positions: WmsInventoryPosition[]
}

type ProductStatusKey = 'normal' | 'low_stock' | 'spread' | 'picking_excess' | 'high_reserve' | 'rupture'

type ConsolidatedProduct = {
  variantId: number
  sku: string
  name: string
  total: number
  reserved: number
  available: number
  locationsCount: number
  lotsCount: number
  movementsToday: number
  lastMovementAt?: string
  locationBreakdown: ConsolidatedLocation[]
  positions: WmsInventoryPosition[]
  statuses: ProductStatusKey[]
}

function toNumber(value: string | number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatDateTime(value?: string): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  })
}

function getLocationTypeColor(type?: string): { bg: string; text: string; label: string } {
  switch (type?.toUpperCase()) {
    case 'SHIPPING':
      return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'SHIPPING' }
    case 'PICKING':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'PICKING' }
    case 'RECEIVING':
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'RECEIVING' }
    case 'SELLABLE':
      return { bg: 'bg-slate-100', text: 'text-slate-700', label: 'SELLABLE' }
    case 'PACKING':
      return { bg: 'bg-violet-100', text: 'text-violet-700', label: 'PACKING' }
    case 'QUARANTINE':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'QUARANTINE' }
    case 'DAMAGED':
      return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'DAMAGED' }
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: type || '-' }
  }
}

function getStatusBadge(status: ProductStatusKey): { label: string; className: string } {
  switch (status) {
    case 'rupture':
      return { label: 'Ruptura', className: 'bg-red-100 text-red-700 border-red-200' }
    case 'low_stock':
      return { label: 'Baixo estoque', className: 'bg-amber-100 text-amber-700 border-amber-200' }
    case 'spread':
      return { label: 'Estoque espalhado', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
    case 'picking_excess':
      return { label: 'Excesso em picking', className: 'bg-violet-100 text-violet-700 border-violet-200' }
    case 'high_reserve':
      return { label: 'Reserva alta', className: 'bg-orange-100 text-orange-700 border-orange-200' }
    default:
      return { label: 'Normal', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  }
}

function getPrimaryStatus(statuses: ProductStatusKey[]): ProductStatusKey {
  const priority: ProductStatusKey[] = ['rupture', 'low_stock', 'high_reserve', 'picking_excess', 'spread', 'normal']
  for (const key of priority) {
    if (statuses.includes(key)) {
      return key
    }
  }
  return 'normal'
}

export default function AdminWmsPositionsClient({
  initialPositions,
  initialTotal,
  initialHasMore,
  initialLimit,
  initialConsolidated,
  initialConsolidatedTotal,
  initialConsolidatedHasMore,
  initialConsolidatedLimit,
  initialWarehouseId,
  initialLocationId,
  initialSearchTerm,
  initialViewMode,
  initialQuickFilter,
  warehouses,
  locations,
  loadError,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session } = useAdminStore()
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null
  const canEditInventory = permissionCodes === null || permissionCodes.includes('inventory.edit')
  const [positions, setPositions] = useState<WmsInventoryPosition[]>(initialPositions)
  const [totalPositions, setTotalPositions] = useState<number>(initialTotal)
  const [hasMorePositions, setHasMorePositions] = useState<boolean>(initialHasMore)
  const [nextPositionOffset, setNextPositionOffset] = useState<number>(initialPositions.length)
  const [pageSize] = useState<number>(Math.max(1, initialLimit || 120))
  const [isLoadingMorePositions, setIsLoadingMorePositions] = useState(false)
  const [consolidatedRows, setConsolidatedRows] = useState<WmsConsolidatedPosition[]>(initialConsolidated)
  const [consolidatedTotal, setConsolidatedTotal] = useState<number>(initialConsolidatedTotal)
  const [consolidatedHasMore, setConsolidatedHasMore] = useState<boolean>(initialConsolidatedHasMore)
  const [nextConsolidatedOffset, setNextConsolidatedOffset] = useState<number>(initialConsolidated.length)
  const [consolidatedPageSize] = useState<number>(Math.max(1, initialConsolidatedLimit || 60))
  const [isLoadingMoreConsolidated, setIsLoadingMoreConsolidated] = useState(false)
  const [warehouseId, setWarehouseId] = useState<string>(initialWarehouseId)
  const [locationId, setLocationId] = useState<string>(initialLocationId)
  const [loading, setLoading] = useState(false)
  const [editingPosition, setEditingPosition] = useState<WmsInventoryPosition | null>(null)
  const [editQtyTotal, setEditQtyTotal] = useState<number | null>(null)
  const [editNote, setEditNote] = useState<string>('')
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [isEditLoading, setIsEditLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(initialQuickFilter)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [selectedProduct, setSelectedProduct] = useState<ConsolidatedProduct | null>(null)
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false)
  const [movements, setMovements] = useState<WmsInventoryMovement[]>([])
  const [isMovementsLoading, setIsMovementsLoading] = useState(false)
  const [visibleCards, setVisibleCards] = useState(24)
  const cardsSentinelRef = useRef<HTMLDivElement | null>(null)

  const requestedPositionOffset = useMemo(() => {
    const raw = searchParams.get('pOffset')
    const parsed = Number(raw)
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined
    return parsed
  }, [searchParams])

  const requestedConsolidatedOffset = useMemo(() => {
    const raw = searchParams.get('cOffset')
    const parsed = Number(raw)
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined
    return parsed
  }, [searchParams])

  const availableLocations = useMemo(() => {
    if (warehouseId === 'all') return locations
    const id = Number(warehouseId)
    return locations.filter((location) => location.warehouse_id === id)
  }, [locations, warehouseId])

  const summary = useMemo(() => {
    let total = 0
    let reserved = 0
    for (const position of positions) {
      total += toNumber(position.qty_total)
      reserved += toNumber(position.qty_reserved)
    }
    return {
      total,
      reserved,
      available: total - reserved,
    }
  }, [positions])

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => b.id - a.id)
  }, [positions])

  const numericSearchVariantId = useMemo(() => {
    const normalized = searchTerm.trim()
    if (!/^\d+$/.test(normalized)) return undefined
    const value = Number(normalized)
    return Number.isFinite(value) && value > 0 ? value : undefined
  }, [searchTerm])

  const consolidatedProducts = useMemo(() => {
    return consolidatedRows.map((row) => {
      const locationBreakdown: ConsolidatedLocation[] = row.location_breakdown.map((entry) => ({
        locationId: entry.location_id,
        locationCode: entry.location_code || `#${entry.location_id}`,
        locationType: entry.location_type || 'UNKNOWN',
        warehouseId: entry.warehouse_id,
        warehouseLabel: `${entry.warehouse_code || `#${entry.warehouse_id}`} - ${entry.warehouse_name || '-'}`,
        qtyTotal: toNumber(entry.qty_total),
        qtyReserved: toNumber(entry.qty_reserved),
        qtyAvailable: toNumber(entry.qty_available),
        positions: [],
      }))

      const total = toNumber(row.qty_total)
      const reserved = toNumber(row.qty_reserved)
      const available = toNumber(row.qty_available)
      const reserveRatio = total > 0 ? reserved / total : 0
      const spread = toNumber(row.locations_count) >= 4
      const lowStock = available > 0 && available < 10
      const rupture = available <= 0
      const highReserve = reserveRatio >= 0.4
      const pickingQty = locationBreakdown
        .filter((entry) => entry.locationType.toUpperCase() === 'PICKING')
        .reduce((sum, entry) => sum + entry.qtyAvailable, 0)
      const pickingExcess = available > 20 && pickingQty > available * 0.7

      const statuses: ProductStatusKey[] = []
      if (rupture) statuses.push('rupture')
      if (lowStock) statuses.push('low_stock')
      if (highReserve) statuses.push('high_reserve')
      if (pickingExcess) statuses.push('picking_excess')
      if (spread) statuses.push('spread')
      if (statuses.length === 0) statuses.push('normal')

      const lastMovementAt = row.last_movement_at
      const movementDate = lastMovementAt ? new Date(lastMovementAt) : null
      const now = new Date()
      const movementsToday = movementDate && !Number.isNaN(movementDate.getTime()) && movementDate.toDateString() === now.toDateString() ? 1 : 0

      return {
        variantId: row.product_variant_id,
        sku: row.variant_sku || `variant-${row.product_variant_id}`,
        name: row.product_name || 'Produto sem nome',
        total,
        reserved,
        available,
        locationsCount: toNumber(row.locations_count),
        lotsCount: toNumber(row.lots_count),
        movementsToday,
        lastMovementAt,
        locationBreakdown,
        positions: [],
        statuses,
      }
    })
  }, [consolidatedRows])

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const applyQuickFilter = (product: ConsolidatedProduct) => {
      const has = (status: ProductStatusKey) => product.statuses.includes(status)
      switch (quickFilter) {
        case 'critical':
          return has('rupture') || has('low_stock') || has('high_reserve')
        case 'rupture':
          return has('rupture')
        case 'high_reserve':
          return has('high_reserve')
        case 'spread':
          return has('spread')
        case 'picking_excess':
          return has('picking_excess')
        default:
          return true
      }
    }

    return consolidatedProducts.filter((product) => {
      if (!applyQuickFilter(product)) return false
      if (!query) return true
      return (
        product.sku.toLowerCase().includes(query)
        || product.name.toLowerCase().includes(query)
        || String(product.variantId).includes(query)
      )
    })
  }, [consolidatedProducts, quickFilter, searchTerm])

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCards), [filteredProducts, visibleCards])

  const statusCounters = useMemo(() => {
    const counters = {
      critical: 0,
      rupture: 0,
      highReserve: 0,
      spread: 0,
      pickingExcess: 0,
    }

    for (const product of consolidatedProducts) {
      const statuses = product.statuses
      if (statuses.includes('rupture') || statuses.includes('low_stock') || statuses.includes('high_reserve')) counters.critical += 1
      if (statuses.includes('rupture')) counters.rupture += 1
      if (statuses.includes('high_reserve')) counters.highReserve += 1
      if (statuses.includes('spread')) counters.spread += 1
      if (statuses.includes('picking_excess')) counters.pickingExcess += 1
    }

    return counters
  }, [consolidatedProducts])

  const heatmapData = useMemo(() => {
    const acc = new Map<string, { locationCode: string; qtyAvailable: number; products: number }>()
    for (const product of filteredProducts) {
      for (const location of product.locationBreakdown) {
        const key = `${location.locationCode}:${location.warehouseId}`
        const existing = acc.get(key)
        if (existing) {
          existing.qtyAvailable += location.qtyAvailable
          existing.products += 1
        } else {
          acc.set(key, {
            locationCode: location.locationCode,
            qtyAvailable: location.qtyAvailable,
            products: 1,
          })
        }
      }
    }

    return Array.from(acc.values()).sort((a, b) => b.qtyAvailable - a.qtyAvailable)
  }, [filteredProducts])

  function locationLabel(id: number): { code: string; location: WmsLocation | undefined } {
    const location = locations.find((item) => item.id === id)
    return { code: location ? location.code : `#${id}`, location }
  }

  function warehouseLabel(id: number): string {
    const warehouse = warehouses.find((item) => item.id === id)
    return warehouse ? `${warehouse.code} - ${warehouse.name}` : `#${id}`
  }

  function syncPositionsQuery(options?: {
    warehouseId?: string
    locationId?: string
    searchTerm?: string
    viewMode?: ViewMode
    quickFilter?: QuickFilter
    positionsOffset?: number
    consolidatedOffset?: number
    replace?: boolean
  }) {
    const nextWarehouseId = options?.warehouseId ?? warehouseId
    const nextLocationId = options?.locationId ?? locationId
    const nextSearchTerm = (options?.searchTerm ?? searchTerm).trim()
    const nextViewMode = options?.viewMode ?? viewMode
    const nextQuickFilter = options?.quickFilter ?? quickFilter
    const positionsOffsetForUrl = options?.positionsOffset ?? nextPositionOffset
    const consolidatedOffsetForUrl = options?.consolidatedOffset ?? nextConsolidatedOffset

    const params = new URLSearchParams(searchParams.toString())

    if (nextWarehouseId && nextWarehouseId !== 'all') params.set('warehouse', nextWarehouseId)
    else params.delete('warehouse')

    if (nextLocationId && nextLocationId !== 'all') params.set('location', nextLocationId)
    else params.delete('location')

    if (nextSearchTerm) params.set('q', nextSearchTerm)
    else params.delete('q')

    if (nextViewMode !== 'cards') params.set('view', nextViewMode)
    else params.delete('view')

    if (nextQuickFilter !== 'all') params.set('quick', nextQuickFilter)
    else params.delete('quick')

    if (positionsOffsetForUrl > pageSize) params.set('pOffset', String(positionsOffsetForUrl))
    else params.delete('pOffset')

    if (consolidatedOffsetForUrl > consolidatedPageSize) params.set('cOffset', String(consolidatedOffsetForUrl))
    else params.delete('cOffset')

    const nextQuery = params.toString()
    if (nextQuery === searchParams.toString()) return

    const href = nextQuery ? `?${nextQuery}` : '?'
    if (options?.replace) {
      router.replace(href, { scroll: false })
      return
    }
    router.push(href, { scroll: false })
  }

  async function handleSearch(options?: { syncUrl?: boolean; replaceUrl?: boolean }) {
    setLoading(true)
    const [positionsResult, consolidatedResult] = await Promise.all([
      getWmsPositionsPageAction({
        warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
        locationId: locationId === 'all' ? undefined : Number(locationId),
        variantId: numericSearchVariantId,
        limit: pageSize,
        offset: 0,
      }),
      getWmsConsolidatedPositionsPageAction({
        warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
        locationId: locationId === 'all' ? undefined : Number(locationId),
        variantId: numericSearchVariantId,
        search: searchTerm,
        limit: consolidatedPageSize,
        offset: 0,
      }),
    ])
    setLoading(false)

    if (!positionsResult.success) {
      toast.error(positionsResult.error)
      return
    }
    if (!consolidatedResult.success) {
      toast.error(consolidatedResult.error)
      return
    }

    setPositions(positionsResult.data.items)
    setTotalPositions(positionsResult.data.total)
    setHasMorePositions(positionsResult.data.hasMore)
    const resolvedNextPositionOffset = positionsResult.data.offset + positionsResult.data.items.length
    setNextPositionOffset(resolvedNextPositionOffset)

    setConsolidatedRows(consolidatedResult.data.items)
    setConsolidatedTotal(consolidatedResult.data.total)
    setConsolidatedHasMore(consolidatedResult.data.hasMore)
    const resolvedNextConsolidatedOffset = consolidatedResult.data.offset + consolidatedResult.data.items.length
    setNextConsolidatedOffset(resolvedNextConsolidatedOffset)

    if (options?.syncUrl) {
      syncPositionsQuery({
        warehouseId,
        locationId,
        searchTerm,
        viewMode,
        quickFilter,
        positionsOffset: resolvedNextPositionOffset,
        consolidatedOffset: resolvedNextConsolidatedOffset,
        replace: options.replaceUrl,
      })
    }
  }

  const handleLoadMorePositions = useCallback(async () => {
    if (isLoadingMorePositions || !hasMorePositions) return

    setIsLoadingMorePositions(true)
    const result = await getWmsPositionsPageAction({
      warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
      locationId: locationId === 'all' ? undefined : Number(locationId),
      variantId: numericSearchVariantId,
      limit: pageSize,
      offset: nextPositionOffset,
    })
    setIsLoadingMorePositions(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setPositions((prev) => [...prev, ...result.data.items])
    setTotalPositions(result.data.total)
    setHasMorePositions(result.data.hasMore)
    const resolvedNextPositionOffset = result.data.offset + result.data.items.length
    setNextPositionOffset(resolvedNextPositionOffset)

    syncPositionsQuery({
      positionsOffset: resolvedNextPositionOffset,
      replace: true,
    })
  }, [
    hasMorePositions,
    isLoadingMorePositions,
    locationId,
    nextPositionOffset,
    numericSearchVariantId,
    pageSize,
    warehouseId,
    searchTerm,
    viewMode,
    quickFilter,
  ])

  const handleLoadMoreConsolidated = useCallback(async () => {
    if (isLoadingMoreConsolidated || !consolidatedHasMore) return

    setIsLoadingMoreConsolidated(true)
    const result = await getWmsConsolidatedPositionsPageAction({
      warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
      locationId: locationId === 'all' ? undefined : Number(locationId),
      variantId: numericSearchVariantId,
      search: searchTerm,
      limit: consolidatedPageSize,
      offset: nextConsolidatedOffset,
    })
    setIsLoadingMoreConsolidated(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setConsolidatedRows((prev) => [...prev, ...result.data.items])
    setConsolidatedTotal(result.data.total)
    setConsolidatedHasMore(result.data.hasMore)
    const resolvedNextConsolidatedOffset = result.data.offset + result.data.items.length
    setNextConsolidatedOffset(resolvedNextConsolidatedOffset)

    syncPositionsQuery({
      consolidatedOffset: resolvedNextConsolidatedOffset,
      replace: true,
    })
  }, [
    consolidatedHasMore,
    consolidatedPageSize,
    isLoadingMoreConsolidated,
    locationId,
    nextConsolidatedOffset,
    numericSearchVariantId,
    searchTerm,
    warehouseId,
    locationId,
    viewMode,
    quickFilter,
    nextConsolidatedOffset,
  ])

  function openProductDrawer(product: ConsolidatedProduct) {
    setSelectedProduct(product)
    setMovements([])
    setIsProductDrawerOpen(true)
  }

  useEffect(() => {
    setVisibleCards(24)
  }, [consolidatedRows, quickFilter, searchTerm])

  useEffect(() => {
    if (viewMode !== 'cards') return
    if (!cardsSentinelRef.current) return

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (!entry?.isIntersecting) return
      if (visibleProducts.length < filteredProducts.length) {
        setVisibleCards((prev) => prev + 24)
        return
      }
      if (consolidatedHasMore && !isLoadingMoreConsolidated) {
        void handleLoadMoreConsolidated()
      }
    }, { rootMargin: '300px 0px' })

    observer.observe(cardsSentinelRef.current)
    return () => observer.disconnect()
  }, [
    filteredProducts.length,
    consolidatedHasMore,
    handleLoadMoreConsolidated,
    isLoadingMoreConsolidated,
    viewMode,
    visibleProducts.length,
  ])

  useEffect(() => {
    if (!isProductDrawerOpen || !selectedProduct) return

    let cancelled = false
    const loadMovements = async () => {
      setIsMovementsLoading(true)
      const result = await getWmsInventoryMovementsAction({
        warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
        limit: 120,
      })
      if (cancelled) return
      setIsMovementsLoading(false)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      const filtered = result.data
        .filter((item) => item.product_variant_id === selectedProduct.variantId)
        .sort((a, b) => {
          const at = a.occurred_at || ''
          const bt = b.occurred_at || ''
          return bt.localeCompare(at)
        })
      setMovements(filtered.slice(0, 12))
    }

    void loadMovements()

    return () => {
      cancelled = true
    }
  }, [isProductDrawerOpen, selectedProduct, warehouseId])

  useEffect(() => {
    syncPositionsQuery({ replace: true })
  }, [])

  useEffect(() => {
    syncPositionsQuery({ viewMode, quickFilter, replace: true })
  }, [viewMode, quickFilter])

  useEffect(() => {
    if (!requestedConsolidatedOffset) return
    if (nextConsolidatedOffset >= requestedConsolidatedOffset) return
    if (!consolidatedHasMore || isLoadingMoreConsolidated) return

    void handleLoadMoreConsolidated()
  }, [
    requestedConsolidatedOffset,
    nextConsolidatedOffset,
    consolidatedHasMore,
    isLoadingMoreConsolidated,
    handleLoadMoreConsolidated,
  ])

  useEffect(() => {
    if (!requestedPositionOffset) return
    if (nextPositionOffset >= requestedPositionOffset) return
    if (!hasMorePositions || isLoadingMorePositions) return

    void handleLoadMorePositions()
  }, [
    requestedPositionOffset,
    nextPositionOffset,
    hasMorePositions,
    isLoadingMorePositions,
    handleLoadMorePositions,
  ])

  function openEditDrawer(position: WmsInventoryPosition) {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    setEditingPosition(position)
    setEditQtyTotal(toNumber(position.qty_total))
    setEditNote('')
    setIsEditDrawerOpen(true)
  }

  function closeEditDrawer() {
    setIsEditDrawerOpen(false)
    setEditingPosition(null)
    setEditQtyTotal(null)
    setEditNote('')
  }

  async function handleSaveEdit() {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    if (!editingPosition || editQtyTotal === null) return

    if (editQtyTotal < 0) {
      toast.error('Quantidade não pode ser negativa')
      return
    }

    setIsEditLoading(true)
    const result = await updateWmsInventoryPositionAction(editingPosition.id, {
      qty_total: editQtyTotal,
      note: editNote.trim() || undefined,
    })
    setIsEditLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    // Atualizar a lista de positions
    setPositions((prev) =>
      prev.map((p) => (p.id === editingPosition.id ? result.data : p))
    )

    toast.success('Posição atualizada com sucesso')
    closeEditDrawer()
  }

  return (
    <div className='space-y-6 p-6 lg:p-8'>
      <div className='space-y-1'>
        <h1 className='flex items-center gap-2 text-lg font-medium text-foreground'>
          <Boxes className='h-5 w-5 text-primary' />
          WMS - Visao Inteligente de Estoque
        </h1>
        <p className='text-sm text-muted-foreground'>Consolidacao por SKU com foco operacional, distribuicao fisica e alertas rapidos.</p>
        {loadError ? <p className='text-sm text-destructive'>{loadError}</p> : null}
      </div>

      <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
        <div className='flex items-end gap-3 overflow-x-auto pb-1'>
          <div className='min-w-55 shrink-0'>
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={(value) => {
              setWarehouseId(value)
              setLocationId('all')
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                    {warehouse.code} - {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='min-w-55 shrink-0'>
            <Label>Localizacao</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas</SelectItem>
                {availableLocations.map((location) => {
                  const typeColor = getLocationTypeColor(location.type)
                  return (
                    <SelectItem key={location.id} value={String(location.id)}>
                      <div className='flex items-center gap-2'>
                        <span>{location.code}</span>
                        <Badge className={`${typeColor.bg} ${typeColor.text} text-xs`}>
                          {typeColor.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='min-w-90 shrink-0'>
            <Label>Busca unica</Label>
            <Input
              placeholder='SKU, nome ou variant id'
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleSearch({ syncUrl: true })
                }
              }}
            />
          </div>

          <div className='min-w-82.5 shrink-0'>
            <Label>Visualizacao</Label>
            <div className='mt-2 inline-flex gap-1 rounded-md border border-border/60 bg-background p-1'>
              <Button
                type='button'
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setViewMode('cards')}
                className='h-8 px-3'
              >
                <LayoutGrid className='mr-1 h-4 w-4' />
                Cards
              </Button>
              <Button
                type='button'
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setViewMode('table')}
                className='h-8 px-3'
              >
                <List className='mr-1 h-4 w-4' />
                Tabela
              </Button>
              <Button
                type='button'
                variant={viewMode === 'heatmap' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setViewMode('heatmap')}
                className='h-8 px-3'
              >
                <Warehouse className='mr-1 h-4 w-4' />
                Heatmap
              </Button>
            </div>
          </div>

          <div className='flex shrink-0 items-end gap-2'>
            <Button onClick={() => { void handleSearch({ syncUrl: true }) }} disabled={loading} className='min-w-36'>
              <Search className='mr-2 h-4 w-4' />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
            <Button variant='outline' onClick={() => { void handleSearch({ syncUrl: true, replaceUrl: true }) }} disabled={loading}>
              <RefreshCcw className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </Card>

      <div className='grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-8'>
        <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
          <p className='text-xs text-muted-foreground'>Qtd Total</p>
          <p className='text-2xl font-semibold'>{summary.total.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
          <p className='text-xs text-muted-foreground'>Qtd Reservada</p>
          <p className='text-2xl font-semibold'>{summary.reserved.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
          <p className='text-xs text-muted-foreground'>Qtd Disponivel</p>
          <p className='text-2xl font-semibold'>{summary.available.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-red-100 bg-red-50/70 p-4 shadow-none dark:border-red-900/30 dark:bg-red-950/20'>
          <p className='text-xs text-muted-foreground'>SKUs em ruptura</p>
          <p className='text-2xl font-semibold text-red-700 dark:text-red-300'>{statusCounters.rupture.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-orange-100 bg-orange-50/70 p-4 shadow-none dark:border-orange-900/30 dark:bg-orange-950/20'>
          <p className='text-xs text-muted-foreground'>Reserva alta</p>
          <p className='text-2xl font-semibold text-orange-700 dark:text-orange-300'>{statusCounters.highReserve.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-none dark:border-indigo-900/30 dark:bg-indigo-950/20'>
          <p className='text-xs text-muted-foreground'>Estoque espalhado</p>
          <p className='text-2xl font-semibold text-indigo-700 dark:text-indigo-300'>{statusCounters.spread.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-violet-100 bg-violet-50/70 p-4 shadow-none dark:border-violet-900/30 dark:bg-violet-950/20'>
          <p className='text-xs text-muted-foreground'>Excesso no picking</p>
          <p className='text-2xl font-semibold text-violet-700 dark:text-violet-300'>{statusCounters.pickingExcess.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-amber-100 bg-amber-50/70 p-4 shadow-none dark:border-amber-900/30 dark:bg-amber-950/20'>
          <p className='text-xs text-muted-foreground'>Criticos</p>
          <p className='text-2xl font-semibold text-amber-700 dark:text-amber-300'>{statusCounters.critical.toLocaleString('pt-BR')}</p>
        </Card>
      </div>

      <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
        <div className='mb-2 text-xs text-muted-foreground'>
          Exibindo {consolidatedRows.length.toLocaleString('pt-BR')} de {consolidatedTotal.toLocaleString('pt-BR')} SKUs consolidados
        </div>
        <div className='mb-3 flex flex-wrap items-center gap-2'>
          <Button
            size='sm'
            variant={quickFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setQuickFilter('all')}
          >
            <Layers3 className='mr-1 h-4 w-4' /> Todos
          </Button>
          <Button
            size='sm'
            variant={quickFilter === 'critical' ? 'default' : 'outline'}
            onClick={() => setQuickFilter('critical')}
          >
            <AlertCircle className='mr-1 h-4 w-4' /> Criticos
          </Button>
          <Button
            size='sm'
            variant={quickFilter === 'rupture' ? 'default' : 'outline'}
            onClick={() => setQuickFilter('rupture')}
          >
            <Flame className='mr-1 h-4 w-4' /> Ruptura
          </Button>
          <Button
            size='sm'
            variant={quickFilter === 'high_reserve' ? 'default' : 'outline'}
            onClick={() => setQuickFilter('high_reserve')}
          >
            <Package className='mr-1 h-4 w-4' /> Reserva alta
          </Button>
          <Button
            size='sm'
            variant={quickFilter === 'spread' ? 'default' : 'outline'}
            onClick={() => setQuickFilter('spread')}
          >
            <MapPin className='mr-1 h-4 w-4' /> Espalhados
          </Button>
          <Button
            size='sm'
            variant={quickFilter === 'picking_excess' ? 'default' : 'outline'}
            onClick={() => setQuickFilter('picking_excess')}
          >
            <Filter className='mr-1 h-4 w-4' /> Excesso picking
          </Button>
        </div>

        {viewMode === 'cards' ? (
          visibleProducts.length === 0 ? (
            <div className='flex h-40 items-center justify-center text-muted-foreground'>Nenhum produto encontrado</div>
          ) : (
            <>
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'>
                {visibleProducts.map((product) => {
                  const primaryStatus = getPrimaryStatus(product.statuses)
                  const primaryBadge = getStatusBadge(primaryStatus)
                  const pickingQty = product.locationBreakdown
                    .filter((entry) => entry.locationType.toUpperCase() === 'PICKING')
                    .reduce((sum, entry) => sum + entry.qtyAvailable, 0)
                  const lungsQty = product.locationBreakdown
                    .filter((entry) => entry.locationType.toUpperCase() !== 'PICKING')
                    .reduce((sum, entry) => sum + entry.qtyAvailable, 0)

                  return (
                    <Card
                      key={product.variantId}
                      className='group cursor-pointer rounded-xl border border-border/30 p-4 transition hover:border-primary/40 hover:shadow-sm'
                      onClick={() => openProductDrawer(product)}
                    >
                      <div className='mb-3 flex items-start justify-between gap-3'>
                        <div className='flex items-center gap-3'>
                          <div className='flex h-11 w-11 items-center justify-center rounded-lg bg-linear-to-br from-slate-100 to-slate-50 text-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-100'>
                            <Package className='h-5 w-5' />
                          </div>
                          <div>
                            <p className='line-clamp-1 text-sm font-semibold'>{product.name}</p>
                            <p className='font-mono text-xs text-muted-foreground'>{product.sku}</p>
                          </div>
                        </div>
                        <Badge className={`border ${primaryBadge.className}`}>{primaryBadge.label}</Badge>
                      </div>

                      <div className='grid grid-cols-3 gap-2'>
                        <div className='rounded-lg border border-border/50 bg-background/40 p-2'>
                          <p className='text-[10px] uppercase text-muted-foreground'>Total</p>
                          <p className='text-lg font-semibold'>{product.total.toLocaleString('pt-BR')}</p>
                        </div>
                        <div className='rounded-lg border border-border/50 bg-background/40 p-2'>
                          <p className='text-[10px] uppercase text-muted-foreground'>Reservado</p>
                          <p className='text-lg font-semibold'>{product.reserved.toLocaleString('pt-BR')}</p>
                        </div>
                        <div className='rounded-lg border border-border/50 bg-background/40 p-2'>
                          <p className='text-[10px] uppercase text-muted-foreground'>Disponivel</p>
                          <p className='text-lg font-semibold'>{product.available.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>

                      <div className='mt-3 space-y-2'>
                        <div className='flex items-center justify-between text-xs'>
                          <span className='text-muted-foreground'>Localizacoes</span>
                          <span className='font-medium'>{product.locationsCount}</span>
                        </div>
                        <div className='flex items-center justify-between text-xs'>
                          <span className='text-muted-foreground'>Lotes ativos</span>
                          <span className='font-medium'>{product.lotsCount}</span>
                        </div>
                        <div className='flex items-center justify-between text-xs'>
                          <span className='text-muted-foreground'>Picking</span>
                          <span className='font-medium'>{pickingQty.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className='flex items-center justify-between text-xs'>
                          <span className='text-muted-foreground'>Pulmao e demais</span>
                          <span className='font-medium'>{lungsQty.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>

                      <div className='mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground'>
                        <div className='flex items-center gap-1'>
                          <Clock3 className='h-3.5 w-3.5' />
                          Mov hoje: {product.movementsToday}
                        </div>
                        <span className='inline-flex items-center gap-1 text-primary'>
                          Ver distribuicao
                          <ChevronRight className='h-3.5 w-3.5 transition group-hover:translate-x-0.5' />
                        </span>
                      </div>
                    </Card>
                  )
                })}
              </div>

              <div ref={cardsSentinelRef} className='h-4 w-full' />
              {visibleProducts.length < filteredProducts.length || consolidatedHasMore ? (
                <div className='mt-3 flex justify-center'>
                  <Button
                    variant='outline'
                    onClick={() => {
                      if (visibleProducts.length < filteredProducts.length) {
                        setVisibleCards((prev) => prev + 24)
                        return
                      }
                      void handleLoadMoreConsolidated()
                    }}
                    disabled={isLoadingMoreConsolidated}
                  >
                    {isLoadingMoreConsolidated ? 'Carregando...' : 'Carregar mais produtos'}
                  </Button>
                </div>
              ) : null}
            </>
          )
        ) : null}

        {viewMode === 'heatmap' ? (
          heatmapData.length === 0 ? (
            <div className='flex h-40 items-center justify-center text-muted-foreground'>Sem dados para heatmap</div>
          ) : (
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
              {heatmapData.slice(0, 24).map((cell) => {
                const intensity = Math.min(1, cell.qtyAvailable / Math.max(1, heatmapData[0]?.qtyAvailable || 1))
                const opacity = 0.15 + intensity * 0.7
                return (
                  <div
                    key={cell.locationCode}
                    className='rounded-lg border border-border/50 p-3'
                    style={{ background: `rgba(59, 130, 246, ${opacity})` }}
                  >
                    <p className='font-mono text-xs'>{cell.locationCode}</p>
                    <p className='mt-1 text-xl font-semibold'>{cell.qtyAvailable.toLocaleString('pt-BR')}</p>
                    <p className='text-xs text-muted-foreground'>{cell.products} SKUs ativos</p>
                  </div>
                )
              })}
            </div>
          )
        ) : null}

        {viewMode === 'table' ? (
          sortedPositions.length === 0 ? (
            <div className='flex h-40 items-center justify-center text-muted-foreground'>Nenhuma posicao encontrada</div>
          ) : (
            <div className='space-y-3'>
              <div className='overflow-hidden rounded-lg border border-border/30'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Datas</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead>Localizacao</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Qtd Total</TableHead>
                      <TableHead>Qtd Reservada</TableHead>
                      <TableHead>Qtd Disponivel</TableHead>
                      <TableHead>Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPositions.map((position) => {
                      const total = toNumber(position.qty_total)
                      const reserved = toNumber(position.qty_reserved)
                      const available = total - reserved
                      const locationInfo = locationLabel(position.location_id)
                      const typeColor = locationInfo.location ? getLocationTypeColor(locationInfo.location.type) : null
                      return (
                        <TableRow key={position.id}>
                          <TableCell>{position.id}</TableCell>
                          <TableCell className='text-xs'>
                            <div className='leading-tight'>
                              <div className='font-medium'>Criado: {formatDateTime(position.created_at)}</div>
                              <div className='text-muted-foreground'>Atualizado: {formatDateTime(position.updated_at)}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='leading-tight'>
                              <div className='font-medium'>{position.product_name || '-'}</div>
                              <div className='font-mono text-xs text-muted-foreground'>
                                {position.variant_sku || `variant-${position.product_variant_id}`}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className='text-sm'>
                            <div className='leading-tight'>
                              <div className='font-medium flex items-center gap-2'>
                                <span>{locationInfo.code}</span>
                                {typeColor && (
                                  <Badge className={`${typeColor.bg} ${typeColor.text} text-xs`}>
                                    {typeColor.label}
                                  </Badge>
                                )}
                              </div>
                              <div className='text-xs text-muted-foreground'>{warehouseLabel(position.warehouse_id)}</div>
                            </div>
                          </TableCell>
                          <TableCell>{position.batch_id ?? '-'}</TableCell>
                          <TableCell>{total.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{reserved.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{available.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>
                            {canEditInventory ? (
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => openEditDrawer(position)}
                                className='h-8 w-8 p-0'
                              >
                                <Edit2 className='h-4 w-4' />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {hasMorePositions ? (
                <div className='flex justify-center'>
                  <Button variant='outline' onClick={() => { void handleLoadMorePositions() }} disabled={isLoadingMorePositions}>
                    {isLoadingMorePositions ? 'Carregando...' : 'Carregar mais posições'}
                  </Button>
                </div>
              ) : null}
            </div>
          )
        ) : null}
      </Card>

      <Sheet open={isProductDrawerOpen} onOpenChange={setIsProductDrawerOpen}>
        <SheetContent className='w-full sm:max-w-2xl flex flex-col p-0'>
          <SheetHeader className='px-6 py-4 border-b'>
            <SheetTitle className='flex items-center justify-between gap-3'>
              <div>
                <p className='text-base font-semibold'>{selectedProduct?.name || '-'}</p>
                <p className='mt-1 font-mono text-xs text-muted-foreground'>
                  {selectedProduct?.sku || '-'} • variant {selectedProduct?.variantId || '-'}
                </p>
              </div>
              {selectedProduct ? (() => {
                const primary = getStatusBadge(getPrimaryStatus(selectedProduct.statuses))
                return <Badge className={`border ${primary.className}`}>{primary.label}</Badge>
              })() : null}
            </SheetTitle>
          </SheetHeader>

          {selectedProduct ? (
            <div className='flex-1 overflow-y-auto px-6 py-5 space-y-6'>
              <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                <Card className='p-3 shadow-none'>
                  <p className='text-xs text-muted-foreground'>Saldo total</p>
                  <p className='text-xl font-semibold'>{selectedProduct.total.toLocaleString('pt-BR')}</p>
                </Card>
                <Card className='p-3 shadow-none'>
                  <p className='text-xs text-muted-foreground'>Reservado</p>
                  <p className='text-xl font-semibold'>{selectedProduct.reserved.toLocaleString('pt-BR')}</p>
                </Card>
                <Card className='p-3 shadow-none'>
                  <p className='text-xs text-muted-foreground'>Disponivel</p>
                  <p className='text-xl font-semibold'>{selectedProduct.available.toLocaleString('pt-BR')}</p>
                </Card>
                <Card className='p-3 shadow-none'>
                  <p className='text-xs text-muted-foreground'>Lotes ativos</p>
                  <p className='text-xl font-semibold'>{selectedProduct.lotsCount.toLocaleString('pt-BR')}</p>
                </Card>
              </div>

              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-sm font-semibold'>Distribuicao fisica</h3>
                  <span className='text-xs text-muted-foreground'>{selectedProduct.locationsCount} localizacoes</span>
                </div>
                <div className='space-y-2'>
                  {selectedProduct.locationBreakdown.map((entry) => {
                    const ratio = selectedProduct.available > 0 ? Math.max(0, Math.min(100, (entry.qtyAvailable / selectedProduct.available) * 100)) : 0
                    const typeColor = getLocationTypeColor(entry.locationType)
                    return (
                      <div key={`${entry.locationId}-${entry.warehouseId}`} className='rounded-lg border border-border/50 p-3'>
                        <div className='flex items-center justify-between gap-2'>
                          <div>
                            <p className='font-mono text-xs'>{entry.locationCode}</p>
                            <p className='text-xs text-muted-foreground'>{entry.warehouseLabel}</p>
                          </div>
                          <div className='flex items-center gap-2'>
                            <Badge className={`${typeColor.bg} ${typeColor.text} text-[10px]`}>{typeColor.label}</Badge>
                            <span className='text-sm font-semibold'>{entry.qtyAvailable.toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                        <div className='mt-2 h-2 rounded-full bg-muted'>
                          <div className='h-full rounded-full bg-primary' style={{ width: `${ratio}%` }} />
                        </div>
                        {canEditInventory && entry.positions[0] ? (
                          <div className='mt-2 flex justify-end'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => openEditDrawer(entry.positions[0])}
                              className='h-7 px-2 text-xs'
                            >
                              <Edit2 className='mr-1 h-3.5 w-3.5' /> Ajustar
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className='space-y-3'>
                <h3 className='text-sm font-semibold'>Timeline operacional</h3>
                {isMovementsLoading ? (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Loader2 className='h-4 w-4 animate-spin' /> Carregando movimentacoes...
                  </div>
                ) : movements.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>Sem movimentacoes recentes para este SKU.</p>
                ) : (
                  <div className='space-y-2'>
                    {movements.map((movement) => (
                      <div key={movement.id} className='rounded-lg border border-border/50 p-3'>
                        <div className='flex items-center justify-between text-xs'>
                          <span className='font-semibold uppercase tracking-wide'>{movement.movement_type || 'MOV'}</span>
                          <span className='text-muted-foreground'>{formatDateTime(movement.occurred_at)}</span>
                        </div>
                        <div className='mt-1 flex items-center justify-between text-sm'>
                          <span className='font-mono'>{movement.location_code || '-'}</span>
                          <span className='font-semibold'>{toNumber(movement.qty).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Edit Drawer */}
      <Sheet open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
        <SheetContent className='w-full sm:w-96 flex flex-col p-0'>
          <SheetHeader className='px-6 py-4 border-b'>
            <SheetTitle className='flex items-center gap-2'>
              <Edit2 className='h-4 w-4' />
              Editar Posição
            </SheetTitle>
            <SheetClose />
          </SheetHeader>

          {editingPosition && (
            <>
              <div className='flex-1 overflow-y-auto px-6 py-6'>
                <div className='space-y-6'>
                  {/* Info - Produto */}
                  <div className='space-y-2'>
                    <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Produto</p>
                    <p className='text-sm font-medium'>{editingPosition.product_name || '-'}</p>
                  </div>

                  {/* Info - SKU */}
                  <div className='space-y-2'>
                    <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>SKU</p>
                    <p className='text-sm font-mono'>{editingPosition.variant_sku || `variant-${editingPosition.product_variant_id}`}</p>
                  </div>

                  {/* Info - Localização */}
                  <div className='space-y-2'>
                    <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Localização</p>
                    <div>
                      <div className='flex items-center gap-2 mb-2'>
                        <p className='text-sm font-medium'>{locationLabel(editingPosition.location_id).code}</p>
                        {(() => {
                          const locInfo = locationLabel(editingPosition.location_id)
                          const typeColor = locInfo.location ? getLocationTypeColor(locInfo.location.type) : null
                          return typeColor ? (
                            <Badge className={`${typeColor.bg} ${typeColor.text} text-xs`}>
                              {typeColor.label}
                            </Badge>
                          ) : null
                        })()}
                      </div>
                      <p className='text-xs text-muted-foreground'>{warehouseLabel(editingPosition.warehouse_id)}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className='h-px bg-border' />

                  {/* Quantidade Total */}
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <Label className='text-sm font-semibold'>Quantidade Total</Label>
                      <span className='text-xs text-muted-foreground'>
                        Disp: {(editingPosition.qty_total - editingPosition.qty_reserved).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <NumberInput
                      value={editQtyTotal}
                      onChange={setEditQtyTotal}
                      placeholder='0'
                      min={0}
                    />
                    {editingPosition.qty_reserved > 0 && (
                      <p className='text-xs text-muted-foreground'>
                        Reservada: {toNumber(editingPosition.qty_reserved).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>

                  {/* Anotação */}
                  <div className='space-y-2'>
                    <Label className='text-sm font-semibold'>Anotação</Label>
                    <Input
                      placeholder='Ex: Ajuste contagem física'
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className='text-sm'
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className='border-t px-6 py-4 flex gap-3'>
                <Button
                  variant='outline'
                  onClick={closeEditDrawer}
                  disabled={isEditLoading}
                  className='flex-1'
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={isEditLoading || !canEditInventory}
                  className='flex-1'
                >
                  {isEditLoading ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
