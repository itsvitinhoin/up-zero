"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import Image from 'next/image'
import { GripVertical, Loader2, Save, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { Category } from '@/lib/types'
import { CloudflareImage } from '@/components/ui/cloudflare-image'
import {
  getAssetSortItemsAction,
  rebuildAssetSortOrderAction,
  saveAssetSortOrderAction,
  type AssetSortItem,
} from '@/lib/actions/asset-sort-orders'
import { useAdminStore } from '@/contexts/admin-store-context'

interface AdminAssetShowcasePageClientProps {
  categories: Category[]
  storeId: number | null
  initialScopeType?: ScopeType
  initialCategoryId?: string
  initialSortType?: string
  initialSearchTerm?: string
  initialItems?: AssetSortItem[]
  initialTotal?: number
  initialPage?: number
  initialTotalPages?: number
}

type ScopeType = 'store' | 'category'
type DragSource = 'main' | 'buffer'

type SortTypeOption = {
  value: string
  label: string
}

type ResetSortType = 'auto_created_desc' | 'auto_sku_desc'

const SORT_TYPE_OPTIONS: SortTypeOption[] = [
  { value: 'manual_default', label: 'Manual Padrão' },
]

const RESET_SORT_TYPE_OPTIONS: Array<{ value: ResetSortType; label: string }> = [
  { value: 'auto_created_desc', label: 'Data Mais Recente' },
  { value: 'auto_sku_desc', label: 'SKU Mais Recente' },
]

const ITEMS_BATCH_SIZE = 40
const SEARCH_DEBOUNCE_MS = 350

export default function AdminAssetShowcasePageClient({
  categories,
  storeId,
  initialScopeType = 'store',
  initialCategoryId = '',
  initialSortType = 'manual_default',
  initialSearchTerm = '',
  initialItems,
  initialTotal = 0,
  initialPage = 1,
  initialTotalPages = 0,
}: AdminAssetShowcasePageClientProps) {
  const { session } = useAdminStore()
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null
  const canEditAssets = permissionCodes === null || permissionCodes.includes('assets.edit')
  const validCategories = useMemo(
    () => categories.filter((cat) => Boolean(cat?.id && cat?.name)),
    [categories],
  )

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialCategoryId || validCategories[0]?.id || '',
  )
  const [scopeType, setScopeType] = useState<ScopeType>(initialScopeType)
  const [sortType, setSortType] = useState<string>(initialSortType)
  const [searchInput, setSearchInput] = useState(initialSearchTerm)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [items, setItems] = useState<AssetSortItem[]>(initialItems ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [resetSortType, setResetSortType] = useState<ResetSortType>('auto_created_desc')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingSource, setDraggingSource] = useState<DragSource | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [bufferHover, setBufferHover] = useState(false)
  const [bufferItems, setBufferItems] = useState<AssetSortItem[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [page, setPage] = useState(initialPage)
  const [total, setTotal] = useState(initialTotal)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const skipNextLoad = useRef(initialItems !== undefined)

  const resolvedContext = useMemo(() => {
    if (scopeType === 'store') {
      if (!storeId || !Number.isInteger(storeId) || storeId <= 0) {
        return null
      }
      return { contextType: 'store' as const, contextId: Number(storeId) }
    }

    const categoryId = Number(selectedCategoryId)
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return null
    }
    return { contextType: 'category' as const, contextId: categoryId }
  }, [scopeType, storeId, selectedCategoryId])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  async function loadItems(options?: { append?: boolean; targetPage?: number }) {
    if (!resolvedContext) {
      setItems([])
      setPage(1)
      setTotal(0)
      setTotalPages(0)
      return
    }

    const append = options?.append === true
    const targetPage = options?.targetPage && options.targetPage > 0 ? options.targetPage : 1

    if (append) setIsLoadingMore(true)
    else setIsLoading(true)

    const result = await getAssetSortItemsAction({
      contextType: resolvedContext.contextType,
      contextId: resolvedContext.contextId,
      sortType,
      search: searchTerm || undefined,
      page: targetPage,
      pageSize: ITEMS_BATCH_SIZE,
    })

    if (!result.success) {
      toast.error(result.error || 'Erro ao carregar assets da vitrine')
      if (!append) {
        setItems([])
        setPage(1)
        setTotal(0)
        setTotalPages(0)
      }
      if (append) setIsLoadingMore(false)
      else setIsLoading(false)
      return
    }

    setItems((prev) => {
      if (!append) return result.items

      const seen = new Set(prev.map((item) => item.assetId))
      const merged = [...prev]
      for (const item of result.items) {
        if (!seen.has(item.assetId)) {
          seen.add(item.assetId)
          merged.push(item)
        }
      }
      return merged
    })

    setPage(result.page)
    setTotal(result.total)
    setTotalPages(result.totalPages)
    if (!append) setHasChanges(false)

    if (append) setIsLoadingMore(false)
    else setIsLoading(false)
  }

  useEffect(() => {
    if (scopeType === 'category' && !selectedCategoryId && validCategories.length > 0) {
      setSelectedCategoryId(validCategories[0].id)
      return
    }
    if (skipNextLoad.current) {
      skipNextLoad.current = false
      return
    }
    void loadItems({ append: false, targetPage: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeType, selectedCategoryId, sortType, searchTerm, resolvedContext?.contextId])

  useEffect(() => {
    setBufferItems([])
  }, [scopeType, selectedCategoryId, sortType, resolvedContext?.contextId])

  const hasMoreItems = page < totalPages

  useEffect(() => {
    if (!hasMoreItems || !loadMoreRef.current || isLoading || isLoadingMore || hasChanges) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        void loadItems({ append: true, targetPage: page + 1 })
      },
      { rootMargin: '300px 0px' },
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreItems, page, isLoading, isLoadingMore, hasChanges, searchTerm, sortType, resolvedContext?.contextId])

  function reorderItems(sourceId: string, targetId: string) {
    if (!canEditAssets) return
    if (sourceId === targetId) return

    const sourceIndex = items.findIndex((item) => item.assetId === sourceId)
    const targetIndex = items.findIndex((item) => item.assetId === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const next = [...items]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)

    setItems(next)
    setHasChanges(true)
  }

  function moveMainItemToBuffer(assetId: string) {
    if (!canEditAssets) return

    setItems((prev) => {
      const idx = prev.findIndex((item) => item.assetId === assetId)
      if (idx < 0) return prev

      const selected = prev[idx]
      setBufferItems((bufferPrev) => {
        if (bufferPrev.some((item) => item.assetId === assetId)) return bufferPrev
        return [selected, ...bufferPrev]
      })

      const next = [...prev]
      next.splice(idx, 1)
      return next
    })
    setHasChanges(true)
  }

  function moveBufferItemToMain(assetId: string, targetId?: string) {
    if (!canEditAssets) return

    let selected: AssetSortItem | null = null

    setBufferItems((prev) => {
      const idx = prev.findIndex((item) => item.assetId === assetId)
      if (idx < 0) return prev
      selected = prev[idx]
      const next = [...prev]
      next.splice(idx, 1)
      return next
    })

    if (!selected) return

    setItems((prev) => {
      if (prev.some((item) => item.assetId === assetId)) return prev

      const next = [...prev]
      if (targetId) {
        const targetIndex = next.findIndex((item) => item.assetId === targetId)
        if (targetIndex >= 0) {
          next.splice(targetIndex, 0, selected as AssetSortItem)
          return next
        }
      }

      next.push(selected as AssetSortItem)
      return next
    })

    setHasChanges(true)
  }

  function moveAllBufferToTop() {
    if (!canEditAssets) return
    if (bufferItems.length === 0) return

    setItems((prev) => {
      const prevIds = new Set(prev.map((item) => item.assetId))
      const fromBuffer = bufferItems.filter((item) => !prevIds.has(item.assetId))
      return [...fromBuffer, ...prev]
    })

    setBufferItems([])
    setHasChanges(true)
  }

  function handleDragStart(event: DragEvent<HTMLLIElement>, assetId: string, source: DragSource) {
    if (!canEditAssets) return

    setDraggingId(assetId)
    setDraggingSource(source)
    event.dataTransfer.effectAllowed = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    event.dataTransfer.setDragImage(event.currentTarget, rect.width / 2, rect.height / 2)
  }

  function handleDragEnter(targetId: string) {
    if (!canEditAssets) return
    if (!draggingId || draggingId === targetId) return

    if (draggingSource === 'buffer') {
      moveBufferItemToMain(draggingId, targetId)
      setDraggingSource('main')
    }

    if (draggingSource !== 'main') return

    setDropTargetId(targetId)
    reorderItems(draggingId, targetId)
  }

  function resetDragState() {
    setDraggingId(null)
    setDraggingSource(null)
    setDropTargetId(null)
    setBufferHover(false)
  }

  function getSortTypeLabel(value: ResetSortType): string {
    return value === 'auto_created_desc' ? 'Data Mais Recente' : 'SKU Mais Recente'
  }

  async function handleSave() {
    if (!canEditAssets) {
      toast.error('Você não tem permissão para editar assets')
      return
    }
    if (!resolvedContext || !hasChanges) return

    setIsSaving(true)
    const result = await saveAssetSortOrderAction({
      contextType: resolvedContext.contextType,
      contextId: resolvedContext.contextId,
      sortType,
      assetIds: items.map((item) => item.assetId),
    })

    if (!result.success) {
      toast.error(result.error || 'Erro ao salvar ordenação')
      setIsSaving(false)
      return
    }

    toast.success(`Ordenação salva (${result.updated ?? items.length} itens).`)
    setHasChanges(false)
    setIsSaving(false)
  }

  function openResetSortDialog() {
    if (!canEditAssets) {
      toast.error('Você não tem permissão para editar assets')
      return
    }

    if (sortType === 'auto_created_desc' || sortType === 'auto_sku_desc') {
      setResetSortType(sortType)
    }
    setIsResetDialogOpen(true)
  }

  async function handleRebuildSortType(targetSortType: ResetSortType) {
    if (!canEditAssets) {
      toast.error('Você não tem permissão para editar assets')
      return
    }
    if (!resolvedContext) return

    const sortTypeLabel = getSortTypeLabel(targetSortType)

    setIsRebuilding(true)
    setIsResetDialogOpen(false)
    const result = await rebuildAssetSortOrderAction({
      contextType: resolvedContext.contextType,
      contextId: resolvedContext.contextId,
      sortType,
      resetSortType: targetSortType,
    })

    if (!result.success) {
      toast.error(result.error || 'Erro ao resetar ordenação')
      setIsRebuilding(false)
      return
    }

    setBufferItems([])
    setHasChanges(false)
    await loadItems({ append: false, targetPage: 1 })

    toast.success(`Ordenação resetada para ${sortTypeLabel} (${result.updated ?? items.length} itens).`)
    setIsRebuilding(false)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Vitrine de Assets</h1>
        <p className="text-sm text-muted-foreground">
          Ordene assets por escopo e ordenação (drag and drop).
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 lg:flex-row lg:items-end">
        <div className="space-y-1 lg:w-60 lg:shrink-0">
          <label className="text-xs font-medium text-muted-foreground">Escopo</label>
          <Select value={scopeType} onValueChange={(value) => setScopeType(value as ScopeType)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="store">Loja (sem categoria)</SelectItem>
              <SelectItem value="category">Categoria</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scopeType === 'category' && (
          <div className="space-y-1 lg:w-55 lg:shrink-0">
            <label className="text-xs font-medium text-muted-foreground">Categoria</label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {validCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1 lg:w-55 lg:shrink-0">
          <label className="text-xs font-medium text-muted-foreground">Ordenação</label>
          <Select value={sortType} onValueChange={setSortType}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {SORT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 lg:min-w-0 lg:flex-1">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por código, título ou produto"
          />
        </div>
      </div>

      {scopeType === 'category' && !selectedCategoryId && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Selecione uma categoria para ordenar nesse escopo.
        </div>
      )}

      {scopeType === 'store' && !storeId && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Não foi possível resolver a loja do admin para ordenar sem categoria.
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{items.length + bufferItems.length}/{total} assets</Badge>
          {bufferItems.length > 0 && <Badge variant="outline">Intermediária: {bufferItems.length}</Badge>}
          {hasChanges && <Badge variant="default">Alterações pendentes</Badge>}
        </div>

        <div className="flex items-center gap-2">
          {canEditAssets ? (
            <Button
              variant="outline"
              onClick={openResetSortDialog}
              disabled={isLoading || isLoadingMore || isSaving || isRebuilding || !resolvedContext}
            >
              {isRebuilding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Resetar Ordenação
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void loadItems({ append: false, targetPage: 1 })} disabled={isLoading || isLoadingMore || isSaving || isRebuilding || !resolvedContext}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Recarregar
          </Button>
          {canEditAssets ? (
            <Button onClick={() => void handleSave()} disabled={!hasChanges || bufferItems.length > 0 || isSaving || isRebuilding || isLoading || isLoadingMore || !resolvedContext}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Ordem
            </Button>
          ) : null}
        </div>
      </div>

      {bufferItems.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Existem {bufferItems.length} asset(s) na área intermediária. Arraste-os de volta para a grade antes de salvar.
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="rounded-lg border bg-card xl:min-w-0 xl:flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando assets...
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum asset encontrado para este contexto.
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
              {items.map((item, index) => (
                <li
                  key={item.assetId}
                  className={`rounded-lg border bg-background p-2 transition-all ${
                    draggingId === item.assetId
                      ? 'cursor-grabbing border-transparent shadow-none opacity-70'
                      : 'cursor-grab'
                  } ${dropTargetId === item.assetId ? 'border-dashed border-sky-400 bg-sky-50/40' : ''}`}
                  draggable={canEditAssets}
                  onDragStart={(event) => handleDragStart(event, item.assetId, 'main')}
                  onDragOver={(event) => {
                    if (!canEditAssets) return
                    event.preventDefault()
                  }}
                  onDragEnter={() => handleDragEnter(item.assetId)}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (!draggingId) return
                    setDropTargetId(null)
                  }}
                  onDragEnd={resetDragState}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">#{index + 1}</div>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className={`relative mb-2 aspect-3/4 w-full overflow-hidden rounded bg-muted ${
                    draggingId === item.assetId ? 'border border-transparent' : 'border'
                  }`}>
                    {item.imageUrl ? (
                      <CloudflareImage src={item.imageUrl} cloudflare={{ width: 480, fit: 'cover', dpr: 2 }} alt={item.assetTitle || item.assetCode} fill className="object-cover" sizes="(max-width: 1024px) 50vw, 20vw" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">Sem img</div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="line-clamp-2 text-sm font-medium">{item.assetTitle || item.assetCode}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.productName || `Asset ${item.assetId}`}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!isLoading && items.length > 0 && hasMoreItems && (
            <div ref={loadMoreRef} className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando mais assets...
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-4 xl:w-72 xl:shrink-0 xl:self-start">
          <div
            className={`rounded-lg border bg-card p-3 transition-colors xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto ${
              bufferHover ? 'border-sky-400 bg-sky-50/50' : ''
            }`}
            onDragOver={(event) => {
              if (!canEditAssets) return
              event.preventDefault()
              setBufferHover(true)
            }}
            onDragEnter={(event) => {
              if (!canEditAssets) return
              event.preventDefault()
              setBufferHover(true)
            }}
            onDragLeave={() => setBufferHover(false)}
            onDrop={(event) => {
              if (!canEditAssets) return
              event.preventDefault()
              if (!draggingId) return
              if (draggingSource === 'main') {
                moveMainItemToBuffer(draggingId)
              }
              setBufferHover(false)
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Área Intermediária</h3>
              <Badge variant="secondary">{bufferItems.length}</Badge>
            </div>
            {canEditAssets && bufferItems.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mb-3 w-full"
                onClick={moveAllBufferToTop}
              >
                Enviar todos para o topo
              </Button>
            )}
            <p className="mb-3 text-xs text-muted-foreground">
              Arraste para cá assets temporários. Depois, arraste de volta para a posição desejada na grade.
            </p>

            {bufferItems.length === 0 ? (
              <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
                Solte aqui para guardar temporariamente.
              </div>
            ) : (
              <ul className="max-h-[60vh] space-y-2 overflow-auto pr-1">
                {bufferItems.map((item) => (
                  <li
                    key={item.assetId}
                    className={`flex cursor-grab items-center gap-2 rounded border bg-background p-2 ${
                      draggingId === item.assetId ? 'cursor-grabbing border-transparent opacity-70' : ''
                    }`}
                    draggable={canEditAssets}
                    onDragStart={(event) => handleDragStart(event, item.assetId, 'buffer')}
                    onDragEnd={resetDragState}
                  >
                    <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded border bg-muted">
                      {item.imageUrl ? (
                        <CloudflareImage src={item.imageUrl} cloudflare={{ width: 40, height: 48, fit: 'cover', dpr: 2 }} alt={item.assetTitle || item.assetCode} fill className="object-cover" sizes="40px" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">Sem</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs font-medium">{item.assetTitle || item.assetCode}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{item.productName || `Asset ${item.assetId}`}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetar Ordenação</DialogTitle>
            <DialogDescription>
              Escolha o tipo de ordenação automática para reconstruir no escopo selecionado. A ordem atual
              desse tipo será sobrescrita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo para resetar</label>
            <Select
              value={resetSortType}
              onValueChange={(value) => setResetSortType(value as ResetSortType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {RESET_SORT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetDialogOpen(false)}
              disabled={isRebuilding}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleRebuildSortType(resetSortType)}
              disabled={isRebuilding || !resolvedContext}
            >
              {isRebuilding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
