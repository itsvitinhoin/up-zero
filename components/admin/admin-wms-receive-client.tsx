'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDown, Boxes, ChevronDown, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import {
  getWmsLocationsAction,
  getWmsPositionsPageAction,
  moveWmsInventoryAction,
  receiveWmsInventoryAction,
  updateWmsInventoryBatchAction,
  updateWmsInventoryPositionAction,
  type WmsInventoryPosition,
  type WmsLocation,
  type WmsWarehouse,
} from '@/lib/actions/wms'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import { usePaginationMeta } from '@/hooks/use-paginated-list'
import { getOrderProductVariantsCatalogAction } from '@/lib/actions/products'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  SheetTrigger,
} from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import FormInput from '@/components/form/FormInput'
import NumberInput from '@/components/form/NumberInput'
import CurrencyInput from '@/components/form/CurrencyInput'
import { useAdminStore } from '@/contexts/admin-store-context'

type Props = {
  warehouses: WmsWarehouse[]
  locations: WmsLocation[]
  initialPositions: WmsInventoryPosition[]
  initialTotalPositions: number
  initialPageSize: number
  initialHistoryWarehouseId: string
  initialCurrentPage: number
  loadError?: string | null
}

type VariantReceiveRow = {
  rowKey: string
  variantId: number
  variantSku: string
  label: string
  quantity: number | null
  lot_code: string
  expires_at: string
  unit_cost: number | null
}

type ProductBlock = {
  productId: string
  productName: string
  productCode: string
  expanded: boolean
  variants: VariantReceiveRow[]
}

type ProductSearchResult = {
  productId: string
  productName: string
  productCode: string
}

type RawCatalogItem = {
  productId: string
  productName: string
  productCode: string
  variantId: string
  variantSku: string
  color: string
  size: string
}

const PREFERRED_MOVE_DESTINATION = '__preferred__'

function buildVariantLabel(color: string, size: string, sku: string, productCode?: string): string {
  const normalizedSku = String(sku || '').trim()
  const normalizedCode = String(productCode || '').trim()

  // Prefer SKU parsing because catalog-level attributes can be shared across variants.
  if (normalizedSku) {
    const lowerSku = normalizedSku.toLowerCase()
    const lowerCode = normalizedCode.toLowerCase()
    const remainder = lowerCode && lowerSku.startsWith(`${lowerCode}-`)
      ? normalizedSku.slice(normalizedCode.length + 1)
      : normalizedSku

    const tokens = remainder.split('-').filter(Boolean)
    if (tokens.length >= 2) {
      const sizeFromSku = tokens[tokens.length - 1].toUpperCase()
      const colorFromSku = tokens
        .slice(0, -1)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
        .join(' ')
        .trim()

      if (colorFromSku) {
        return `${colorFromSku} / ${sizeFromSku}`
      }
    }
  }

  const parts = [color, size].filter((v) => v && v !== '-')
  return parts.length > 0 ? parts.join(' / ') : sku
}

function toNumber(value: string | number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toInteger(value: number | null | undefined): number {
  if (value == null) return 0
  return Math.max(0, Math.trunc(value))
}

export default function AdminWmsReceiveClient({
  warehouses,
  locations,
  initialPositions,
  initialTotalPositions,
  initialPageSize,
  initialHistoryWarehouseId,
  initialCurrentPage,
  loadError,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session } = useAdminStore()
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null
  const canManageInventoryMovements = permissionCodes === null || permissionCodes.includes('inventory.manage_movements')
  const canEditInventory = permissionCodes === null || permissionCodes.includes('inventory.edit')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0] ? String(warehouses[0].id) : '')
  const [reference, setReference] = useState('')
  const [productBlocks, setProductBlocks] = useState<ProductBlock[]>([])
  const [positions, setPositions] = useState<WmsInventoryPosition[]>(initialPositions)
  const [totalPositions, setTotalPositions] = useState(initialTotalPositions)
  const [pageSize] = useState(Math.max(1, initialPageSize || 100))
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialCurrentPage || 1))
  const [loadingPage, setLoadingPage] = useState(false)
  const [historyWarehouseId, setHistoryWarehouseId] = useState<string>(
    initialHistoryWarehouseId || (warehouses[0] ? String(warehouses[0].id) : '')
  )
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedPositions, setSelectedPositions] = useState<number[]>([])
  const [moveDestinationLocationId, setMoveDestinationLocationId] = useState<string>('')
  const [movingSelected, setMovingSelected] = useState(false)
  const [allLocations, setAllLocations] = useState<WmsLocation[]>(locations)
  const [editingPosition, setEditingPosition] = useState<WmsInventoryPosition | null>(null)
  const [editQtyTotal, setEditQtyTotal] = useState<number | null>(null)
  const [editLotCode, setEditLotCode] = useState('')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editUnitCost, setEditUnitCost] = useState<number | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isEditSaving, setIsEditSaving] = useState(false)

  function locationLabel(id: number): string {
    const location = allLocations.find((item) => item.id === id)
    return location ? `${location.code} (${location.type})` : `#${id}`
  }

  function warehouseLabel(id: number): string {
    const warehouse = warehouses.find((item) => item.id === id)
    return warehouse ? `${warehouse.code} - ${warehouse.name}` : `#${id}`
  }

  function syncReceiptsQuery(nextWarehouseId: string, nextPage: number, replace = false) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextWarehouseId) {
      params.set('warehouse', nextWarehouseId)
    } else {
      params.delete('warehouse')
    }
    if (nextPage > 1) {
      params.set('page', String(nextPage))
    } else {
      params.delete('page')
    }

    const query = params.toString()
    const currentQuery = searchParams.toString()
    if (query === currentQuery) {
      return
    }

    const href = query ? `?${query}` : '?'

    if (replace) {
      router.replace(href, { scroll: false })
      return
    }
    router.push(href, { scroll: false })
  }


  // Product search
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([])
  const [rawSearchItems, setRawSearchItems] = useState<RawCatalogItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced product search
  useEffect(() => {
    if (!isDrawerOpen) return
    if (!productSearch.trim()) {
      setSearchResults([])
      setRawSearchItems([])
      setSearchOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      const result = await getOrderProductVariantsCatalogAction(productSearch.trim())
      setSearchLoading(false)
      if (!result.success || !result.data) {
        setSearchResults([])
        setRawSearchItems([])
        return
      }
      const raw = result.data as RawCatalogItem[]
      setRawSearchItems(raw)
      const seen = new Map<string, ProductSearchResult>()
      for (const item of raw) {
        if (!seen.has(item.productId)) {
          seen.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
          })
        }
      }
      setSearchResults(Array.from(seen.values()))
      setSearchOpen(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, isDrawerOpen])

  function addProductBlock(product: ProductSearchResult) {
    if (productBlocks.some((b) => b.productId === product.productId)) {
      toast.info(`${product.productName} já está na lista`)
      setSearchOpen(false)
      setProductSearch('')
      return
    }
    const variantMap = new Map<number, VariantReceiveRow>()
    const dedupeKeyToVariantId = new Map<string, number>()

    rawSearchItems
      .filter((item) => item.productId === product.productId)
      .forEach((item) => {
        const variantId = Number(item.variantId)
        if (!Number.isInteger(variantId) || variantId <= 0) {
          return
        }

        const nextLabel = buildVariantLabel(item.color, item.size, item.variantSku, item.productCode)
        const skuKey = String(item.variantSku || '').trim().toLowerCase()
        const labelKey = String(nextLabel || '').trim().toLowerCase()
        const dedupeKey = skuKey || labelKey || `variant:${variantId}`

        const existingVariantIdForKey = dedupeKeyToVariantId.get(dedupeKey)
        if (existingVariantIdForKey && existingVariantIdForKey !== variantId) {
          return
        }

        if (!existingVariantIdForKey) {
          dedupeKeyToVariantId.set(dedupeKey, variantId)
        }

        const existing = variantMap.get(variantId)

        if (!existing) {
          variantMap.set(variantId, {
            rowKey: `${product.productId}:${variantId}`,
            variantId,
            variantSku: item.variantSku,
            label: nextLabel,
            quantity: null,
            lot_code: '',
            expires_at: '',
            unit_cost: null,
          })
          return
        }

        // Keep the most complete visual label/SKU when backend returns duplicated rows.
        if ((!existing.variantSku || existing.variantSku.trim().length === 0) && item.variantSku) {
          existing.variantSku = item.variantSku
        }
        if ((!existing.label || existing.label.trim().length === 0) && nextLabel) {
          existing.label = nextLabel
        }
      })

    const variants: VariantReceiveRow[] = Array.from(variantMap.values())
    setProductBlocks((prev) => [
      ...prev,
      {
        productId: product.productId,
        productName: product.productName,
        productCode: product.productCode,
        expanded: true,
        variants,
      },
    ])
    setSearchOpen(false)
    setProductSearch('')
  }

  function removeProductBlock(productId: string) {
    setProductBlocks((prev) => prev.filter((b) => b.productId !== productId))
  }

  function toggleExpanded(productId: string) {
    setProductBlocks((prev) =>
      prev.map((b) => (b.productId === productId ? { ...b, expanded: !b.expanded } : b))
    )
  }

  function updateVariant(productId: string, rowKey: string, patch: Partial<VariantReceiveRow>) {
    setProductBlocks((prev) =>
      prev.map((block) =>
        block.productId !== productId
          ? block
          : {
              ...block,
              variants: block.variants.map((v) =>
                v.rowKey === rowKey ? { ...v, ...patch } : v
              ),
            }
      )
    )
  }

  function applyToAll(productId: string, sourceRowKey: string, field: keyof VariantReceiveRow) {
    setProductBlocks((prev) =>
      prev.map((block) => {
        if (block.productId !== productId) return block
        const source = block.variants.find((v) => v.rowKey === sourceRowKey)
        if (!source) return block
        return {
          ...block,
          variants: block.variants.map((v) =>
            v.rowKey === sourceRowKey ? v : { ...v, [field]: source[field] }
          ),
        }
      })
    )
  }

  const validItemsCount = useMemo(() => {
    return productBlocks.reduce((count, block) => {
      return count + block.variants.filter((v) => (v.quantity ?? 0) > 0).length
    }, 0)
  }, [productBlocks])

  const receivingLocationIds = useMemo(
    () => new Set(allLocations.filter((location) => location.type === 'RECEIVING').map((location) => location.id)),
    [allLocations]
  )

  const receivingPositions = useMemo(() => {
    return positions.filter((position) => {
      const inReceiving = receivingLocationIds.has(position.location_id)
      if (!inReceiving) return false
      const available = toNumber(position.qty_total) - toNumber(position.qty_reserved)
      return available > 0
    })
  }, [positions, receivingLocationIds])

  const {
    totalPages,
    safeCurrentPage,
    pageStart,
    pageEnd,
  } = usePaginationMeta({
    currentPage,
    pageSize,
    totalItems: totalPositions,
    currentPageItemCount: receivingPositions.length,
  })

  const selectedRowsForMove = useMemo(
    () => receivingPositions.filter((position) => selectedPositions.includes(position.id)),
    [receivingPositions, selectedPositions]
  )

  const effectiveMoveWarehouseId = useMemo(() => {
    if (historyWarehouseId) return Number(historyWarehouseId)
    const uniqueWarehouseIds = Array.from(new Set(selectedRowsForMove.map((position) => position.warehouse_id)))
    return uniqueWarehouseIds.length === 1 ? uniqueWarehouseIds[0] : null
  }, [historyWarehouseId, selectedRowsForMove])

  const destinationLocations = useMemo(() => {
    return allLocations.filter((location) => {
      if (!location.active) return false
      if (location.type === 'RECEIVING') return false
      if (!effectiveMoveWarehouseId) return false
      return location.warehouse_id === effectiveMoveWarehouseId
    })
  }, [allLocations, effectiveMoveWarehouseId])

  const selectedRowsMissingPreferred = useMemo(() => {
    return selectedRowsForMove.filter((position) => {
      const preferredLocationId = position.preferred_sellable_location_id
      if (!preferredLocationId) return true

      return !destinationLocations.some((location) => location.id === preferredLocationId)
    })
  }, [selectedRowsForMove, destinationLocations])

  useEffect(() => {
    if (destinationLocations.length === 0) {
      setMoveDestinationLocationId('')
      return
    }

    if (moveDestinationLocationId === PREFERRED_MOVE_DESTINATION) {
      return
    }

    const hasSelectedDestination = destinationLocations.some(
      (location) => String(location.id) === moveDestinationLocationId
    )

    if (!hasSelectedDestination) {
      setMoveDestinationLocationId(PREFERRED_MOVE_DESTINATION)
    }
  }, [destinationLocations, moveDestinationLocationId])

  const allSelectedInView = useMemo(() => {
    if (receivingPositions.length === 0) return false
    return receivingPositions.every((position) => selectedPositions.includes(position.id))
  }, [receivingPositions, selectedPositions])

  function resetForm() {
    setWarehouseId(warehouses[0] ? String(warehouses[0].id) : '')
    setReference('')
    setProductBlocks([])
    setProductSearch('')
    setSearchResults([])
    setRawSearchItems([])
    setSearchOpen(false)
  }

  async function refreshHistory() {
    setLoadingHistory(true)
    await refreshReceivingData(currentPage, historyWarehouseId, { syncUrl: true, replaceUrl: true })
    setLoadingHistory(false)
  }

  async function refreshReceivingData(
    page = currentPage,
    warehouseIdOverride?: string,
    options?: { syncUrl?: boolean; replaceUrl?: boolean }
  ) {
    const effectiveWarehouseId = warehouseIdOverride ?? historyWarehouseId
    const warehouseId = effectiveWarehouseId ? Number(effectiveWarehouseId) : undefined

    const receivingLocationId = allLocations.find(
      (location) => location.active && location.type === 'RECEIVING' && (!warehouseId || location.warehouse_id === warehouseId)
    )?.id

    if (!receivingLocationId) {
      setPositions([])
      setTotalPositions(0)
      setCurrentPage(1)
      if (options?.syncUrl) {
        syncReceiptsQuery(effectiveWarehouseId, 1, options.replaceUrl)
      }
      return
    }

    const offset = Math.max(0, (page - 1) * pageSize)

    const [locationsResult, positionsResult] = await Promise.all([
      getWmsLocationsAction(),
      getWmsPositionsPageAction({
        warehouseId,
        locationId: receivingLocationId,
        availableOnly: true,
        limit: pageSize,
        offset,
      }),
    ])

    if (locationsResult.success) {
      setAllLocations(locationsResult.data)
    }
    if (positionsResult.success) {
      const items = positionsResult.data.items
      const total = positionsResult.data.total

      if (page > 1 && total > 0 && items.length === 0) {
        const lastPage = Math.max(1, Math.ceil(total / pageSize))
        if (lastPage !== page) {
          await refreshReceivingData(lastPage, effectiveWarehouseId)
          return
        }
      }

      setPositions(items)
      setTotalPositions(total)
      setCurrentPage(page)
      if (options?.syncUrl) {
        syncReceiptsQuery(effectiveWarehouseId, page, options.replaceUrl)
      }
    } else {
      toast.error(positionsResult.error)
    }
  }

  async function handleHistoryWarehouseChange(nextWarehouseId: string) {
    setHistoryWarehouseId(nextWarehouseId)
    setCurrentPage(1)
    setSelectedPositions([])
    setLoadingPage(true)
    await refreshReceivingData(1, nextWarehouseId, { syncUrl: true })
    setLoadingPage(false)
  }

  async function handleSubmit() {
    if (!canManageInventoryMovements) {
      toast.error('Você não tem permissão para gerenciar movimentações de estoque')
      return
    }

    const warehouse_id = Number(warehouseId)
    if (!warehouse_id) {
      toast.error('Selecione um warehouse')
      return
    }
    if (validItemsCount === 0) {
      toast.error('Informe ao menos uma variante com quantidade')
      return
    }

    const items = productBlocks.flatMap((block) =>
      block.variants
        .filter((v) => (v.quantity ?? 0) > 0)
        .map((v) => ({
          product_variant_id: v.variantId,
          quantity: toInteger(v.quantity),
          lot_code: v.lot_code,
          expires_at: v.expires_at || undefined,
          unit_cost_cents: v.unit_cost == null ? 0 : Math.max(0, Math.round(v.unit_cost * 100)),
        }))
    )

    setLoading(true)
    const result = await receiveWmsInventoryAction({ warehouse_id, reference, items })
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(`Recebimento concluido: ${result.data.items_received} item(ns)`)
    resetForm()
    setIsDrawerOpen(false)
    await refreshReceivingData(1, historyWarehouseId, { syncUrl: true })
    router.refresh()
  }

  function togglePositionSelection(positionId: number, checked: boolean) {
    setSelectedPositions((prev) => {
      if (checked) return prev.includes(positionId) ? prev : [...prev, positionId]
      return prev.filter((id) => id !== positionId)
    })
  }

  function toggleSelectAllInView(checked: boolean) {
    if (!checked) {
      const visibleIds = new Set(receivingPositions.map((position) => position.id))
      setSelectedPositions((prev) => prev.filter((id) => !visibleIds.has(id)))
      return
    }

    setSelectedPositions((prev) => {
      const next = new Set(prev)
      receivingPositions.forEach((position) => next.add(position.id))
      return Array.from(next)
    })
  }

  async function handleMoveSelected() {
    if (!canManageInventoryMovements) {
      toast.error('Você não tem permissão para gerenciar movimentações de estoque')
      return
    }

    if (!effectiveMoveWarehouseId) {
      toast.error('Selecione itens de apenas um warehouse para mover em lote')
      return
    }

    const warehouseId = effectiveMoveWarehouseId
    if (!moveDestinationLocationId) {
      toast.error('Selecione a localizacao de destino')
      return
    }

    const selectedRows = selectedRowsForMove
    if (selectedRows.length === 0) {
      toast.error('Selecione ao menos uma posicao em RECEIVING')
      return
    }

    const usePreferredDestination = moveDestinationLocationId === PREFERRED_MOVE_DESTINATION
    if (usePreferredDestination && selectedRowsMissingPreferred.length > 0) {
      toast.error(
        selectedRowsMissingPreferred.length === 1
          ? 'O produto selecionado não possui localização preferencial válida no warehouse.'
          : 'Há produtos selecionados sem localização preferencial válida no warehouse.'
      )
      return
    }

    const destinationLocationId = usePreferredDestination ? null : Number(moveDestinationLocationId)
    if (!usePreferredDestination && !destinationLocationId) {
      toast.error('Selecione a localizacao de destino')
      return
    }

    setMovingSelected(true)
    let movedCount = 0

    for (const position of selectedRows) {
      const available = toNumber(position.qty_total) - toNumber(position.qty_reserved)
      if (available <= 0) continue

      const moveResult = await moveWmsInventoryAction({
        warehouse_id: warehouseId,
        product_variant_id: position.product_variant_id,
        from_location_id: position.location_id,
        to_location_id: usePreferredDestination
          ? Number(position.preferred_sellable_location_id)
          : Number(destinationLocationId),
        batch_id: position.batch_id,
        quantity: available,
        reference: 'MOVE_FROM_RECEIVING',
      })

      if (!moveResult.success) {
        setMovingSelected(false)
        toast.error(moveResult.error)
        return
      }

      movedCount += 1
    }

    setMovingSelected(false)
    setSelectedPositions([])
    setMoveDestinationLocationId('')
    await refreshReceivingData(currentPage, historyWarehouseId, { syncUrl: true, replaceUrl: true })
    toast.success(`Movimentacao concluida para ${movedCount} posicao(oes)`)
  }

  function formatDate(value?: string): string {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('pt-BR', {
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

  function openNewReceiptDrawer() {
    if (!canManageInventoryMovements) {
      toast.error('Você não tem permissão para gerenciar movimentações de estoque')
      return
    }

    resetForm()
    setIsDrawerOpen(true)
  }

  function openEditDialog(position: WmsInventoryPosition) {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    setEditingPosition(position)
    setEditQtyTotal(toInteger(toNumber(position.qty_total)))
    setEditLotCode(position.lot_code || '')
    setEditExpiresAt(position.expires_at ? position.expires_at.slice(0, 10) : '')
    setEditUnitCost(position.unit_cost_cents == null ? null : Number(position.unit_cost_cents) / 100)
    setIsEditOpen(true)
  }

  function closeEditDialog() {
    setIsEditOpen(false)
    setEditingPosition(null)
    setEditQtyTotal(null)
    setEditLotCode('')
    setEditExpiresAt('')
    setEditUnitCost(null)
  }

  async function handleSaveEdit() {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    if (!editingPosition || editQtyTotal == null || editQtyTotal < 0) {
      toast.error('Quantidade inválida')
      return
    }

    setIsEditSaving(true)

    const updatePositionResult = await updateWmsInventoryPositionAction(editingPosition.id, {
      qty_total: toInteger(editQtyTotal),
      note: 'EDIT_FROM_RECEIPTS',
    })

    if (!updatePositionResult.success) {
      setIsEditSaving(false)
      toast.error(updatePositionResult.error)
      return
    }

    if (editingPosition.batch_id) {
      const updateBatchResult = await updateWmsInventoryBatchAction(editingPosition.batch_id, {
        lot_code: editLotCode,
        expires_at: editExpiresAt || undefined,
        unit_cost_cents: editUnitCost == null ? undefined : Math.round(editUnitCost * 100),
      })

      if (!updateBatchResult.success) {
        setIsEditSaving(false)
        toast.error(updateBatchResult.error)
        return
      }
    }

    setIsEditSaving(false)
    await refreshReceivingData(currentPage, historyWarehouseId, { syncUrl: true, replaceUrl: true })
    toast.success('Registro atualizado com sucesso')
    closeEditDialog()
  }

  useEffect(() => {
    syncReceiptsQuery(historyWarehouseId, currentPage, true)
  }, [])

  function formatCurrencyFromCents(value?: number): string {
    if (value == null) return '-'
    return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
      <div className='space-y-6 p-6 lg:p-8'>
        {/* Page header */}
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1'>
            <h1 className='flex items-center gap-2 text-lg font-medium text-foreground'>
              <Boxes className='h-5 w-5 text-primary' />
              Entrada de Estoque
            </h1>
            <p className='text-sm text-muted-foreground'>
              Lista de recebimentos de estoque com filtro por warehouse.
            </p>
            {loadError ? <p className='text-sm text-destructive'>{loadError}</p> : null}
          </div>

          <div className='flex items-center gap-2'>
            <Select value={historyWarehouseId} onValueChange={(value) => { void handleHistoryWarehouseChange(value) }}>
              <SelectTrigger className='w-64'>
                <SelectValue placeholder='Filtrar warehouse' />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={String(wh.id)}>
                    {wh.code} - {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant='outline' size='sm' onClick={refreshHistory} disabled={loadingHistory}>
              {loadingHistory ? 'Atualizando...' : 'Atualizar'}
            </Button>

            {canManageInventoryMovements ? (
              <SheetTrigger asChild>
                <Button size='sm' onClick={openNewReceiptDrawer} disabled={warehouses.length === 0}>
                  <Plus className='h-4 w-4 sm:mr-2' />
                  <span className='hidden sm:inline'>Novo Recebimento</span>
                </Button>
              </SheetTrigger>
            ) : null}
          </div>
        </div>

        {/* Receiving positions batch move */}
        <Card className='overflow-hidden rounded-xl border border-border/20 p-0 shadow-none'>
          <div className='flex flex-wrap items-end justify-between gap-3 border-b border-border/20 p-4'>
            <div>
              <h2 className='text-sm font-medium'>Posicoes em RECEIVING</h2>
              <p className='text-xs text-muted-foreground'>
                Selecione em lote e mova o estoque para a localizacao definitiva.
              </p>
            </div>

            <div className='flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto'>
              <Select
                value={moveDestinationLocationId}
                onValueChange={setMoveDestinationLocationId}
                disabled={!canManageInventoryMovements || !effectiveMoveWarehouseId || destinationLocations.length === 0}
              >
                <SelectTrigger className='w-full sm:w-72'>
                  <SelectValue placeholder='Destino (nao RECEIVING)' />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={PREFERRED_MOVE_DESTINATION}>
                      Localização preferencial do produto
                    </SelectItem>
                  {destinationLocations.map((location) => (
                    <SelectItem key={location.id} value={String(location.id)}>
                      {location.code} ({location.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleMoveSelected}
                disabled={
                  movingSelected ||
                  !canManageInventoryMovements ||
                  !effectiveMoveWarehouseId ||
                  destinationLocations.length === 0 ||
                  !moveDestinationLocationId ||
                  selectedRowsForMove.length === 0
                }
              >
                {movingSelected ? 'Movendo...' : 'Mover estoque selecionado'}
              </Button>

              <span className='text-xs text-muted-foreground'>
                Selecionados: {selectedPositions.length}
              </span>
              {moveDestinationLocationId === PREFERRED_MOVE_DESTINATION && selectedRowsMissingPreferred.length > 0 ? (
                <span className='w-full text-xs text-destructive sm:w-auto'>
                  {selectedRowsMissingPreferred.length === 1
                    ? '1 item sem localização preferencial vinculada.'
                    : `${selectedRowsMissingPreferred.length} itens sem localização preferencial vinculada.`}
                </span>
              ) : null}
            </div>
          </div>

          {receivingPositions.length === 0 ? (
            <div className='flex h-24 items-center justify-center text-sm text-muted-foreground'>
              Nenhuma posicao com saldo em RECEIVING.
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-12'>
                      <Checkbox
                        checked={allSelectedInView}
                          disabled={!canManageInventoryMovements}
                        onCheckedChange={(value) => toggleSelectAllInView(Boolean(value))}
                      />
                    </TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Localizacao</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className='text-right'>Qtd</TableHead>
                    <TableHead>Custo Unit.</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivingPositions.map((position) => {
                    const available = toNumber(position.qty_total) - toNumber(position.qty_reserved)
                    const isChecked = selectedPositions.includes(position.id)
                    return (
                      <TableRow key={position.id}>
                        <TableCell>
                          <Checkbox
                            checked={isChecked}
                            disabled={!canManageInventoryMovements}
                            onCheckedChange={(value) => togglePositionSelection(position.id, Boolean(value))}
                          />
                        </TableCell>
                        <TableCell>{position.id}</TableCell>
                        <TableCell>{formatDate(position.updated_at || position.created_at)}</TableCell>
                        <TableCell>
                          <div className='leading-tight'>
                            <div className='font-medium'>{locationLabel(position.location_id)}</div>
                            <div className='text-xs text-muted-foreground'>{warehouseLabel(position.warehouse_id)}</div>
                          </div>
                        </TableCell>
                        <TableCell>{position.lot_code || '-'}</TableCell>
                        <TableCell>{position.expires_at ? formatDate(position.expires_at) : '-'}</TableCell>
                        <TableCell>
                          <div className='leading-tight'>
                            <div className='font-medium'>{position.product_name || '-'}</div>
                            <div className='font-mono text-xs text-muted-foreground'>
                              {position.variant_sku || `variant-${position.product_variant_id}`}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className='text-right'>{available.toLocaleString('pt-BR')}</TableCell>
                        <TableCell>{formatCurrencyFromCents(position.unit_cost_cents)}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          {canEditInventory ? (
                            <Button variant='ghost' size='sm' onClick={() => openEditDialog(position)}>
                              <Pencil className='h-4 w-4' />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className='border-t border-border/20 p-4'>
            <AdminPaginationControls
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={(page) => {
                setLoadingPage(true)
                void refreshReceivingData(page, historyWarehouseId, { syncUrl: true }).finally(() => setLoadingPage(false))
              }}
              showing={{
                start: pageStart,
                end: pageEnd,
                total: totalPositions,
              }}
            />
            {loadingPage ? (
              <p className='mt-2 text-xs text-muted-foreground'>Carregando página...</p>
            ) : null}
          </div>
        </Card>

        <Dialog open={isEditOpen} onOpenChange={(open) => !open && closeEditDialog()}>
          <DialogContent className='max-w-lg'>
            <DialogHeader>
              <DialogTitle>Editar posição em RECEIVING</DialogTitle>
              <DialogDescription>
                Atualize quantidade, lote, validade e custo unitário.
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4'>
              <div className='space-y-1'>
                <Label>Quantidade</Label>
                <NumberInput
                  value={editQtyTotal}
                  onChange={(value) => setEditQtyTotal(value == null ? null : toInteger(value))}
                  min={0}
                  decimals={0}
                />
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div className='space-y-1'>
                  <Label>Lote</Label>
                  <Input value={editLotCode} onChange={(e) => setEditLotCode(e.target.value)} />
                </div>
                <div className='space-y-1'>
                  <Label>Validade</Label>
                  <Input type='date' value={editExpiresAt} onChange={(e) => setEditExpiresAt(e.target.value)} />
                </div>
              </div>

              <div className='space-y-1'>
                <Label>Custo Unitário</Label>
                <CurrencyInput value={editUnitCost} onChange={setEditUnitCost} locale='pt-BR' currency='BRL' decimals={2} min={0} />
              </div>
            </div>

            <DialogFooter>
              <Button variant='outline' onClick={closeEditDialog} disabled={isEditSaving}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={isEditSaving || !canEditInventory}>
                {isEditSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Drawer */}
        <SheetContent
          className='w-full sm:w-[80vw] lg:w-[80vw] sm:max-w-none p-0 flex flex-col [&>button]:hidden'
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <SheetHeader className='px-6 py-4 border-b'>
            <div className='flex items-center justify-between gap-3'>
              <SheetTitle className='text-base font-semibold'>Novo Recebimento</SheetTitle>
              <SheetClose asChild>
                <Button type='button' variant='outline' size='icon' className='h-8 w-8 shrink-0'>
                  <X className='h-4 w-4' />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className='flex-1 overflow-y-auto p-6 space-y-6'>
            {/* Warehouse + Reference */}
            <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>Warehouse *</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId} disabled={warehouses.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder='Selecione o warehouse' />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={String(wh.id)}>
                          {wh.code} - {wh.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FormInput
                  label='Referencia'
                  placeholder='Ex: NF-12345'
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </Card>

            {/* Product search + accordion blocks */}
            <Card className='rounded-xl border border-border/20 p-4 shadow-none space-y-4'>
              <div>
                <h2 className='text-sm font-medium mb-3'>Itens do Recebimento</h2>

                {/* Search box */}
                <div ref={searchRef} className='relative'>
                  <div className='relative'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
                    <Input
                      placeholder='Buscar produto por nome ou código...'
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onFocus={() => { if (searchResults.length > 0) setSearchOpen(true) }}
                      className='pl-9'
                    />
                    {searchLoading && (
                      <span className='absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground'>
                        Buscando...
                      </span>
                    )}
                  </div>

                  {/* Dropdown results */}
                  {searchOpen && searchResults.length > 0 && (
                    <div className='absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md max-h-60 overflow-y-auto'>
                      {searchResults.map((product) => {
                        const alreadyAdded = productBlocks.some((b) => b.productId === product.productId)
                        return (
                          <button
                            key={product.productId}
                            type='button'
                            className='flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-accent transition-colors'
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addProductBlock(product)}
                          >
                            <span>
                              <span className='font-medium'>{product.productName}</span>
                              <span className='ml-2 font-mono text-xs text-muted-foreground'>{product.productCode}</span>
                            </span>
                            {alreadyAdded && (
                              <span className='text-xs text-muted-foreground shrink-0'>já adicionado</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {searchOpen && !searchLoading && searchResults.length === 0 && productSearch.trim() && (
                    <div className='absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md px-4 py-3 text-sm text-muted-foreground'>
                      Nenhum produto encontrado
                    </div>
                  )}
                </div>
              </div>

              {/* Product accordion blocks */}
              {productBlocks.length === 0 ? (
                <div className='flex h-20 items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground'>
                  Busque e adicione produtos acima
                </div>
              ) : (
                <div className='space-y-3'>
                  {productBlocks.map((block) => (
                    <Collapsible
                      key={block.productId}
                      open={block.expanded}
                      onOpenChange={() => toggleExpanded(block.productId)}
                    >
                      <div className='rounded-lg border border-border/40 overflow-hidden'>
                        {/* Accordion header */}
                        <div className='flex items-center justify-between gap-2 bg-muted/30 px-4 py-2.5'>
                          <CollapsibleTrigger asChild>
                            <button type='button' className='flex flex-1 items-center gap-2 text-left min-w-0'>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${block.expanded ? '' : '-rotate-90'}`}
                              />
                              <span className='font-medium text-sm truncate'>{block.productName}</span>
                              <span className='font-mono text-xs text-muted-foreground shrink-0'>{block.productCode}</span>
                              <span className='text-xs text-muted-foreground shrink-0'>
                                ({block.variants.filter((v) => (v.quantity ?? 0) > 0).length}/{block.variants.length} com qtd)
                              </span>
                            </button>
                          </CollapsibleTrigger>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive'
                            onClick={() => removeProductBlock(block.productId)}
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </div>

                        {/* Variant table */}
                        <CollapsibleContent>
                          <div className='overflow-x-auto'>
                            <table className='w-full text-sm'>
                              <thead>
                                <tr className='border-b border-border/40 bg-muted/10'>
                                  <th className='px-4 py-2 text-left text-xs font-medium text-muted-foreground'>Variante / SKU</th>
                                  <th className='px-3 py-2 text-left text-xs font-medium text-muted-foreground w-32'>Quantidade</th>
                                  <th className='px-3 py-2 text-left text-xs font-medium text-muted-foreground w-36'>Lote</th>
                                  <th className='px-3 py-2 text-left text-xs font-medium text-muted-foreground w-36'>Validade</th>
                                  <th className='px-3 py-2 text-left text-xs font-medium text-muted-foreground w-36'>Custo Unit.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {block.variants.map((variant, vIdx) => (
                                  <tr key={variant.rowKey} className='border-b border-border/20 last:border-0'>
                                    <td className='px-4 py-2'>
                                      <div className='font-medium leading-tight'>{variant.label}</div>
                                      <div className='font-mono text-xs text-muted-foreground'>{variant.variantSku}</div>
                                    </td>
                                    <td className='px-3 py-2'>
                                      <div className='flex items-center gap-1'>
                                        <NumberInput
                                          label=''
                                          value={variant.quantity}
                                          onChange={(value) =>
                                            updateVariant(block.productId, variant.rowKey, {
                                              quantity: value == null ? null : toInteger(value),
                                            })
                                          }
                                          min={0}
                                          decimals={0}
                                          fullWidth
                                        />
                                        {block.variants.length > 1 && (
                                          <button
                                            type='button'
                                            title='Aplicar quantidade para as demais variantes'
                                            className={`shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent ${vIdx !== 0 ? 'invisible pointer-events-none' : ''}`}
                                            onClick={() => applyToAll(block.productId, variant.rowKey, 'quantity')}
                                          >
                                            <ArrowDown className='h-3.5 w-3.5' />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className='px-3 py-2'>
                                      <div className='flex items-center gap-1'>
                                        <FormInput
                                          label=''
                                          placeholder='LT-2026-05'
                                          value={variant.lot_code}
                                          onChange={(e) => updateVariant(block.productId, variant.rowKey, { lot_code: e.target.value.toUpperCase() })}
                                        />
                                        {block.variants.length > 1 && (
                                          <button
                                            type='button'
                                            title='Aplicar lote para as demais variantes'
                                            className={`shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent ${vIdx !== 0 ? 'invisible pointer-events-none' : ''}`}
                                            onClick={() => applyToAll(block.productId, variant.rowKey, 'lot_code')}
                                          >
                                            <ArrowDown className='h-3.5 w-3.5' />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className='px-3 py-2'>
                                      <div className='flex items-center gap-1'>
                                        <FormInput
                                          label=''
                                          type='date'
                                          value={variant.expires_at}
                                          onChange={(e) => updateVariant(block.productId, variant.rowKey, { expires_at: e.target.value })}
                                        />
                                        {block.variants.length > 1 && (
                                          <button
                                            type='button'
                                            title='Aplicar validade para as demais variantes'
                                            className={`shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent ${vIdx !== 0 ? 'invisible pointer-events-none' : ''}`}
                                            onClick={() => applyToAll(block.productId, variant.rowKey, 'expires_at')}
                                          >
                                            <ArrowDown className='h-3.5 w-3.5' />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className='px-3 py-2'>
                                      <div className='flex items-center gap-1'>
                                        <CurrencyInput
                                          label=''
                                          value={variant.unit_cost}
                                          onChange={(value) => updateVariant(block.productId, variant.rowKey, { unit_cost: value })}
                                          locale='pt-BR'
                                          currency='BRL'
                                          decimals={2}
                                          min={0}
                                        />
                                        {block.variants.length > 1 && (
                                          <button
                                            type='button'
                                            title='Aplicar custo para as demais variantes'
                                            className={`shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent ${vIdx !== 0 ? 'invisible pointer-events-none' : ''}`}
                                            onClick={() => applyToAll(block.productId, variant.rowKey, 'unit_cost')}
                                          >
                                            <ArrowDown className='h-3.5 w-3.5' />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Footer */}
          <div className='border-t bg-background px-6 py-4 flex items-center justify-between gap-2'>
            <p className='text-sm text-muted-foreground'>
              {validItemsCount > 0
                ? `${validItemsCount} variante(s) com quantidade preenchida`
                : 'Nenhum item com quantidade'}
            </p>
            <div className='flex items-center gap-2'>
              <SheetClose asChild>
                <Button variant='outline' disabled={loading}>Cancelar</Button>
              </SheetClose>
              <Button
                onClick={handleSubmit}
                disabled={loading || warehouses.length === 0 || validItemsCount === 0}
              >
                {loading ? 'Confirmando...' : 'Confirmar Recebimento'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </div>
    </Sheet>
  )
}
