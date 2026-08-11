'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  Clock3,
  LayoutList,
  PackagePlus,
  RefreshCcw,
  Search,
  Shuffle,
  Table2,
  Truck,
  Undo2,
  User,
  Warehouse,
  Wrench,
} from 'lucide-react'
import {
  getWmsInventoryMovementsPageAction,
  type WmsInventoryMovement,
  type WmsWarehouse,
} from '@/lib/actions/wms'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Props = {
  warehouses: WmsWarehouse[]
  initialMovements: WmsInventoryMovement[]
  initialHasMore?: boolean
  initialNextCursor?: string
  loadError?: string | null
}

type ViewMode = 'timeline' | 'heatmap' | 'table'
type QuickFilter = 'all' | 'critical' | 'divergent' | 'high_volume' | 'adjustments'
type OperationStatus = 'completed' | 'partial' | 'divergent'

type ParsedMovement = WmsInventoryMovement & {
  occurredMs: number
  orderRef?: string
  operatorName?: string
  sourceCode?: string
  destinationCode?: string
  operationKey?: string
  isDivergent: boolean
}

type TimelineGroup = {
  id: string
  movementType: string
  warehouseLabel: string
  operationAtMs: number
  operationAtLabel: string
  orderRef?: string
  operatorName?: string
  sourceCode?: string
  destinationCode?: string
  movementCount: number
  skuCount: number
  totalQty: number
  durationMs: number
  status: OperationStatus
  movements: ParsedMovement[]
  skuPreview: string[]
  locationPreview: string[]
}

const movementTypeOptions = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'RECEIVE', label: 'Entrada' },
  { value: 'MOVE', label: 'Movimentacao' },
  { value: 'RESERVE', label: 'Reserva' },
  { value: 'RELEASE', label: 'Liberacao' },
  { value: 'SHIP', label: 'Expedicao' },
  { value: 'RETURN', label: 'Devolucao' },
  { value: 'ADJUST_POS', label: 'Ajuste positivo' },
  { value: 'ADJUST_NEG', label: 'Ajuste negativo' },
]

const WINDOW_MS = 5 * 60 * 1000

function toNumber(value: string | number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatDateTime(value?: string): string {
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

function formatQty(value: string | number): string {
  const n = toNumber(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'instantaneo'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function movementMeta(type: string) {
  const key = type.toUpperCase()
  switch (key) {
    case 'RECEIVE':
      return { label: 'Entrada', icon: PackagePlus, badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    case 'MOVE':
      return { label: 'Movimentacao', icon: ArrowRightLeft, badge: 'bg-blue-100 text-blue-700 border-blue-200' }
    case 'RESERVE':
      return { label: 'Reserva', icon: Clock3, badge: 'bg-amber-100 text-amber-700 border-amber-200' }
    case 'RELEASE':
      return { label: 'Liberacao', icon: Undo2, badge: 'bg-slate-100 text-slate-700 border-slate-200' }
    case 'SHIP':
      return { label: 'Expedicao', icon: Truck, badge: 'bg-violet-100 text-violet-700 border-violet-200' }
    case 'RETURN':
      return { label: 'Devolucao', icon: Undo2, badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
    case 'ADJUST_POS':
      return { label: 'Ajuste positivo', icon: Shuffle, badge: 'bg-teal-100 text-teal-700 border-teal-200' }
    case 'ADJUST_NEG':
      return { label: 'Ajuste negativo', icon: Wrench, badge: 'bg-rose-100 text-rose-700 border-rose-200' }
    default:
      return { label: key || 'Movimento', icon: Warehouse, badge: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
}

function statusMeta(status: OperationStatus) {
  if (status === 'divergent') {
    return { label: 'divergente', className: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle }
  }
  if (status === 'partial') {
    return { label: 'parcial', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock3 }
  }
  return { label: 'concluido', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 }
}

function parseMovementDetails(movement: WmsInventoryMovement): ParsedMovement {
  const note = (movement.note || '').trim()
  const occurredMs = movement.occurred_at ? new Date(movement.occurred_at).getTime() : 0

  const orderMatch = note.match(/(?:pedido|order)\s*[#:\-]?\s*(\d+)/i)
  const operatorMatch = note.match(/(?:operador|usuario|user)\s*[:=\-]\s*([^,;|]+)/i)
  const sourceMatch = note.match(/(?:origem|from)\s*[:=\-]\s*([^,;|]+)/i)
  const destinationMatch = note.match(/(?:destino|to)\s*[:=\-]\s*([^,;|]+)/i)
  const isDivergent = /diverg|erro|inconsisten|falha/i.test(note)
  const referenceType = movement.reference_type?.trim().toUpperCase() || ''
  const referenceId = movement.reference_id?.trim()
  const operationKey = referenceId ? `${referenceType || 'REF'}:${referenceId}` : undefined
  const orderRefFromReference = referenceType.includes('ORDER') ? referenceId : undefined

  return {
    ...movement,
    occurredMs: Number.isFinite(occurredMs) ? occurredMs : 0,
    orderRef: orderRefFromReference || orderMatch?.[1],
    operatorName: movement.created_by ? `user-${movement.created_by}` : operatorMatch?.[1]?.trim(),
    sourceCode: sourceMatch?.[1]?.trim(),
    destinationCode: destinationMatch?.[1]?.trim(),
    operationKey,
    isDivergent,
  }
}

function splitCursor(cursor?: string): { cursorTs?: string; cursorId?: number } {
  if (!cursor) return {}
  const [cursorTs, idRaw] = cursor.split('|')
  const cursorId = Number(idRaw)
  if (!cursorTs || !Number.isFinite(cursorId)) return {}
  return { cursorTs, cursorId }
}

export default function AdminWmsMovementsClient({
  warehouses,
  initialMovements,
  initialHasMore = false,
  initialNextCursor,
  loadError,
}: Props) {
  const [movements, setMovements] = useState<WmsInventoryMovement[]>(initialMovements)
  const [warehouseId, setWarehouseId] = useState<string>('all')
  const [movementType, setMovementType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [visibleGroups, setVisibleGroups] = useState(40)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialNextCursor)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  async function handleSearch() {
    setLoading(true)
    const result = await getWmsInventoryMovementsPageAction({
      warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
      movementType: movementType === 'all' ? undefined : movementType,
      limit: 200,
    })
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setMovements(result.data.items)
    setHasMore(result.data.hasMore)
    setNextCursor(result.data.nextCursor)
    setVisibleGroups(40)
  }

  async function handleLoadMore() {
    if (!hasMore || !nextCursor || loadingMore) return
    setLoadingMore(true)
    const cursor = splitCursor(nextCursor)
    const result = await getWmsInventoryMovementsPageAction({
      warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
      movementType: movementType === 'all' ? undefined : movementType,
      limit: 200,
      cursorTs: cursor.cursorTs,
      cursorId: cursor.cursorId,
    })
    setLoadingMore(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setMovements((prev) => [...prev, ...result.data.items])
    setHasMore(result.data.hasMore)
    setNextCursor(result.data.nextCursor)
  }

  const parsedMovements = useMemo(() => movements.map(parseMovementDetails), [movements])

  const timelineGroups = useMemo(() => {
    const sorted = [...parsedMovements].sort((a, b) => b.occurredMs - a.occurredMs)
    const grouped = new Map<string, ParsedMovement[]>()

    for (const movement of sorted) {
      const windowMs = movement.occurredMs > 0 ? Math.floor(movement.occurredMs / WINDOW_MS) * WINDOW_MS : 0
      const opKey = movement.operationKey || movement.orderRef || movement.operatorName || 'op'
      const key = `${opKey}|${movement.movement_type}|${movement.warehouse_id}|${windowMs}`
      const list = grouped.get(key) || []
      list.push(movement)
      grouped.set(key, list)
    }

    const groups: TimelineGroup[] = []
    for (const [key, groupMovements] of grouped.entries()) {
      const first = groupMovements[0]
      const minMs = Math.min(...groupMovements.map((entry) => entry.occurredMs || 0))
      const maxMs = Math.max(...groupMovements.map((entry) => entry.occurredMs || 0))
      const totalQty = groupMovements.reduce((sum, entry) => sum + Math.abs(toNumber(entry.qty)), 0)
      const skuSet = new Set(groupMovements.map((entry) => entry.variant_sku || `variant-${entry.product_variant_id}`))
      const locationSet = new Set(groupMovements.map((entry) => entry.location_code || '-'))

      let status: OperationStatus = 'completed'
      if (groupMovements.some((entry) => entry.isDivergent)) {
        status = 'divergent'
      } else if (groupMovements.length > 8 || totalQty > 100) {
        status = 'partial'
      }

      const warehouseLabel = `${first.warehouse_code || '-'} - ${first.warehouse_name || '-'}`
      groups.push({
        id: key,
        movementType: first.movement_type,
        warehouseLabel,
        operationAtMs: maxMs,
        operationAtLabel: formatDateTime(first.occurred_at),
        orderRef: first.orderRef,
        operatorName: first.operatorName,
        sourceCode: first.sourceCode,
        destinationCode: first.destinationCode,
        movementCount: groupMovements.length,
        skuCount: skuSet.size,
        totalQty,
        durationMs: Math.max(0, maxMs - minMs),
        status,
        movements: groupMovements,
        skuPreview: Array.from(skuSet).slice(0, 5),
        locationPreview: Array.from(locationSet).slice(0, 5),
      })
    }

    return groups.sort((a, b) => b.operationAtMs - a.operationAtMs)
  }, [parsedMovements])

  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return timelineGroups.filter((group) => {
      if (quickFilter === 'critical' && group.status === 'completed') return false
      if (quickFilter === 'divergent' && group.status !== 'divergent') return false
      if (quickFilter === 'high_volume' && group.totalQty < 80) return false
      if (quickFilter === 'adjustments' && !/^ADJUST_/.test(group.movementType.toUpperCase())) return false

      if (!query) return true
      return (
        group.warehouseLabel.toLowerCase().includes(query)
        || (group.orderRef || '').toLowerCase().includes(query)
        || (group.operatorName || '').toLowerCase().includes(query)
        || group.skuPreview.some((sku) => sku.toLowerCase().includes(query))
        || group.locationPreview.some((loc) => loc.toLowerCase().includes(query))
      )
    })
  }, [quickFilter, searchTerm, timelineGroups])

  const visibleTimelineGroups = useMemo(() => filteredGroups.slice(0, visibleGroups), [filteredGroups, visibleGroups])

  const summary = useMemo(() => {
    let totalQty = 0
    let divergent = 0
    const skuSet = new Set<string>()

    for (const group of filteredGroups) {
      totalQty += group.totalQty
      if (group.status === 'divergent') divergent += 1
      group.skuPreview.forEach((sku) => skuSet.add(sku))
    }

    return {
      operations: filteredGroups.length,
      totalQty,
      divergent,
      skuCount: skuSet.size,
    }
  }, [filteredGroups])

  const heatmap = useMemo(() => {
    const map = new Map<string, { location: string; moves: number; qty: number }>()
    for (const group of filteredGroups) {
      for (const movement of group.movements) {
        const loc = movement.location_code || '-'
        const existing = map.get(loc)
        if (existing) {
          existing.moves += 1
          existing.qty += Math.abs(toNumber(movement.qty))
        } else {
          map.set(loc, { location: loc, moves: 1, qty: Math.abs(toNumber(movement.qty)) })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
  }, [filteredGroups])

  return (
    <div className='space-y-6 p-6 lg:p-8'>
      <div className='space-y-1'>
        <h1 className='flex items-center gap-2 text-lg font-medium text-foreground'>
          <Boxes className='h-5 w-5 text-primary' />
          WMS - Timeline de Movimentacao de Estoque
        </h1>
        <p className='text-sm text-muted-foreground'>Operacoes agrupadas por fluxo logistico para leitura rapida e rastreabilidade.</p>
        {loadError ? <p className='text-sm text-destructive'>{loadError}</p> : null}
      </div>

      <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
        <div className='flex flex-wrap items-end gap-2'>
          <div className='w-44'>
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
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

          <div className='w-44'>
            <Label>Tipo de movimentacao</Label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {movementTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='min-w-64 flex-1'>
            <Label>Busca inteligente</Label>
            <Input
              placeholder='Pedido, SKU, operador, localizacao...'
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div>
            <Label>Visualizacao</Label>
            <div className='mt-1 inline-flex gap-1 rounded-md border border-border/60 bg-background p-1'>
              <Button
                size='sm'
                type='button'
                className='h-8 px-3'
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                onClick={() => setViewMode('timeline')}
              >
                <LayoutList className='mr-1 h-4 w-4' /> Timeline
              </Button>
              <Button
                size='sm'
                type='button'
                className='h-8 px-3'
                variant={viewMode === 'heatmap' ? 'default' : 'ghost'}
                onClick={() => setViewMode('heatmap')}
              >
                <Warehouse className='mr-1 h-4 w-4' /> Heatmap
              </Button>
              <Button
                size='sm'
                type='button'
                className='h-8 px-3'
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                onClick={() => setViewMode('table')}
              >
                <Table2 className='mr-1 h-4 w-4' /> Tabela
              </Button>
            </div>
          </div>

          <div className='ml-auto flex items-end gap-2'>
            <Button onClick={handleSearch} disabled={loading} className='min-w-36'>
              <Search className='mr-2 h-4 w-4' />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
            <Button variant='outline' onClick={handleSearch} disabled={loading}>
              <RefreshCcw className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </Card>

      <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
        <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
          <p className='text-xs text-muted-foreground'>Operacoes agrupadas</p>
          <p className='text-2xl font-semibold'>{summary.operations.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
          <p className='text-xs text-muted-foreground'>Volume total</p>
          <p className='text-2xl font-semibold'>{summary.totalQty.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
          <p className='text-xs text-muted-foreground'>SKUs impactados</p>
          <p className='text-2xl font-semibold'>{summary.skuCount.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className='rounded-xl border border-red-100 bg-red-50/70 p-4 shadow-none dark:border-red-900/30 dark:bg-red-950/20'>
          <p className='text-xs text-muted-foreground'>Divergentes</p>
          <p className='text-2xl font-semibold text-red-700 dark:text-red-300'>{summary.divergent.toLocaleString('pt-BR')}</p>
        </Card>
      </div>

      <Card className='rounded-xl border border-border/20 p-4 shadow-none'>
        <div className='mb-3 flex flex-wrap items-center gap-2'>
          <Button size='sm' variant={quickFilter === 'all' ? 'default' : 'outline'} onClick={() => setQuickFilter('all')}>
            Todos
          </Button>
          <Button size='sm' variant={quickFilter === 'critical' ? 'default' : 'outline'} onClick={() => setQuickFilter('critical')}>
            Criticos
          </Button>
          <Button size='sm' variant={quickFilter === 'divergent' ? 'default' : 'outline'} onClick={() => setQuickFilter('divergent')}>
            Divergentes
          </Button>
          <Button size='sm' variant={quickFilter === 'high_volume' ? 'default' : 'outline'} onClick={() => setQuickFilter('high_volume')}>
            Alto volume
          </Button>
          <Button size='sm' variant={quickFilter === 'adjustments' ? 'default' : 'outline'} onClick={() => setQuickFilter('adjustments')}>
            Ajustes
          </Button>
        </div>

        {viewMode === 'timeline' ? (
          visibleTimelineGroups.length === 0 ? (
            <div className='py-12 text-center text-sm text-muted-foreground'>Nenhuma operacao encontrada.</div>
          ) : (
            <div className='space-y-3'>
              {visibleTimelineGroups.map((group) => {
                const meta = movementMeta(group.movementType)
                const status = statusMeta(group.status)
                const TypeIcon = meta.icon
                const StatusIcon = status.icon

                return (
                  <Card key={group.id} className='rounded-xl border border-border/30 p-4 shadow-none'>
                    <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                      <div className='space-y-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Badge className={`border ${meta.badge}`}>
                            <TypeIcon className='mr-1 h-3.5 w-3.5' /> {meta.label}
                          </Badge>
                          <Badge className={`border ${status.className}`}>
                            <StatusIcon className='mr-1 h-3.5 w-3.5' /> {status.label}
                          </Badge>
                          {group.orderRef ? <Badge variant='outline'>Pedido #{group.orderRef}</Badge> : null}
                        </div>

                        <div className='text-sm'>
                          <p className='font-semibold'>{group.warehouseLabel}</p>
                          <p className='text-xs text-muted-foreground'>{group.operationAtLabel}</p>
                        </div>

                        <div className='grid grid-cols-2 gap-2 text-xs md:grid-cols-4'>
                          <div className='rounded-md border border-border/50 bg-background/40 p-2'>
                            <p className='text-muted-foreground'>Movimentos</p>
                            <p className='font-semibold'>{group.movementCount}</p>
                          </div>
                          <div className='rounded-md border border-border/50 bg-background/40 p-2'>
                            <p className='text-muted-foreground'>Volume</p>
                            <p className='font-semibold'>{formatQty(group.totalQty)}</p>
                          </div>
                          <div className='rounded-md border border-border/50 bg-background/40 p-2'>
                            <p className='text-muted-foreground'>SKUs</p>
                            <p className='font-semibold'>{group.skuCount}</p>
                          </div>
                          <div className='rounded-md border border-border/50 bg-background/40 p-2'>
                            <p className='text-muted-foreground'>Duracao</p>
                            <p className='font-semibold'>{formatDuration(group.durationMs)}</p>
                          </div>
                        </div>
                      </div>

                      <div className='space-y-2 text-sm lg:min-w-64'>
                        {group.operatorName ? (
                          <p className='flex items-center gap-2 text-xs text-muted-foreground'>
                            <User className='h-3.5 w-3.5' /> Operador: {group.operatorName}
                          </p>
                        ) : null}
                        <p className='text-xs text-muted-foreground'>Origem: {group.sourceCode || '-'}</p>
                        <p className='text-xs text-muted-foreground'>Destino: {group.destinationCode || '-'}</p>
                        <div className='pt-1'>
                          <p className='text-[11px] uppercase text-muted-foreground'>SKUs afetados</p>
                          <div className='mt-1 flex flex-wrap gap-1'>
                            {group.skuPreview.map((sku) => (
                              <Badge key={sku} variant='outline' className='font-mono text-[10px]'>
                                {sku}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}

              {visibleTimelineGroups.length < filteredGroups.length ? (
                <div className='flex justify-center pt-2'>
                  <Button variant='outline' onClick={() => setVisibleGroups((prev) => prev + 40)}>
                    Carregar mais operacoes
                  </Button>
                </div>
              ) : null}

              {visibleTimelineGroups.length >= filteredGroups.length && hasMore ? (
                <div className='flex justify-center pt-2'>
                  <Button variant='outline' onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Carregando...' : 'Buscar mais do backend'}
                  </Button>
                </div>
              ) : null}
            </div>
          )
        ) : null}

        {viewMode === 'heatmap' ? (
          heatmap.length === 0 ? (
            <div className='py-12 text-center text-sm text-muted-foreground'>Sem dados para heatmap.</div>
          ) : (
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
              {heatmap.slice(0, 28).map((cell) => {
                const strongest = heatmap[0]?.qty || 1
                const intensity = Math.min(1, cell.qty / strongest)
                const opacity = 0.15 + intensity * 0.75
                return (
                  <div
                    key={cell.location}
                    className='rounded-lg border border-border/50 p-3'
                    style={{ background: `rgba(37, 99, 235, ${opacity})` }}
                  >
                    <p className='font-mono text-xs'>{cell.location}</p>
                    <p className='mt-1 text-xl font-semibold'>{cell.qty.toLocaleString('pt-BR')}</p>
                    <p className='text-xs text-muted-foreground'>{cell.moves} movs</p>
                  </div>
                )
              })}
            </div>
          )
        ) : null}

        {viewMode === 'table' ? (
          <div className='overflow-x-auto rounded-lg border border-border/30'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Localizacao</TableHead>
                  <TableHead className='text-right'>Quantidade</TableHead>
                  <TableHead>Anotacao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className='whitespace-nowrap'>{formatDateTime(movement.occurred_at)}</TableCell>
                    <TableCell className='whitespace-nowrap'>{movement.movement_type}</TableCell>
                    <TableCell>
                      <div className='leading-tight'>
                        <div className='font-medium'>{movement.product_name || '-'}</div>
                        <div className='font-mono text-xs text-muted-foreground'>
                          {movement.variant_sku || `variant-${movement.product_variant_id}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-sm'>
                      <div className='leading-tight'>
                        <div className='font-medium'>{movement.location_code || '-'}</div>
                        <div className='text-xs text-muted-foreground'>
                          {movement.warehouse_code} - {movement.warehouse_name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-right'>{formatQty(movement.qty)}</TableCell>
                    <TableCell>{movement.note || '-'}</TableCell>
                  </TableRow>
                ))}
                {parsedMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className='py-8 text-center text-sm text-muted-foreground'>
                      Nenhuma movimentacao encontrada.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
