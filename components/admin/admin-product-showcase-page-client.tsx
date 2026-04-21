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
import { toast } from 'sonner'
import type { Category } from '@/lib/types'
import {
  getProductSortItemsAction,
  saveProductSortOrderAction,
  type ProductSortItem,
} from '@/lib/actions/product-sort-orders'

interface AdminProductShowcasePageClientProps {
  categories: Category[]
  storeId: number | null
  initialItems?: ProductSortItem[]
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

const SORT_TYPE_OPTIONS: SortTypeOption[] = [
  { value: 'manual_default', label: 'Manual Padrão' },
]

const ITEMS_BATCH_SIZE = 40
const SEARCH_DEBOUNCE_MS = 350

export default function AdminProductShowcasePageClient({
  categories,
  storeId,
  initialItems,
  initialTotal = 0,
  initialPage = 1,
  initialTotalPages = 0,
}: AdminProductShowcasePageClientProps) {
  const validCategories = useMemo(
    () => categories.filter((cat) => Boolean(cat?.id && cat?.name)),
    [categories],
  )

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    validCategories[0]?.id || '',
  )
  const [scopeType, setScopeType] = useState<ScopeType>('store')
  const [sortType, setSortType] = useState<string>('manual_default')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [items, setItems] = useState<ProductSortItem[]>(initialItems ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingSource, setDraggingSource] = useState<DragSource | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [bufferHover, setBufferHover] = useState(false)
  const [bufferItems, setBufferItems] = useState<ProductSortItem[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [page, setPage] = useState(initialPage)
  const [total, setTotal] = useState(initialTotal)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  // Pula o primeiro useEffect de load quando há dados SSR
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

    const result = await getProductSortItemsAction({
      contextType: resolvedContext.contextType,
      contextId: resolvedContext.contextId,
      sortType,
      search: searchTerm || undefined,
      page: targetPage,
      pageSize: ITEMS_BATCH_SIZE,
    })

    if (!result.success) {
      toast.error(result.error || 'Erro ao carregar produtos da vitrine')
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

      const seen = new Set(prev.map((item) => item.productId))
      const merged = [...prev]
      for (const item of result.items) {
        if (!seen.has(item.productId)) {
          seen.add(item.productId)
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
    if (sourceId === targetId) return

    const sourceIndex = items.findIndex((item) => item.productId === sourceId)
    const targetIndex = items.findIndex((item) => item.productId === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const next = [...items]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)

    setItems(next)
    setHasChanges(true)
  }

  function moveMainItemToBuffer(productId: string) {
    setItems((prev) => {
      const idx = prev.findIndex((item) => item.productId === productId)
      if (idx < 0) return prev

      const selected = prev[idx]
      setBufferItems((bufferPrev) => {
        if (bufferPrev.some((item) => item.productId === productId)) return bufferPrev
        return [selected, ...bufferPrev]
      })

      const next = [...prev]
      next.splice(idx, 1)
      return next
    })
    setHasChanges(true)
  }

  function moveBufferItemToMain(productId: string, targetId?: string) {
    let selected: ProductSortItem | null = null

    setBufferItems((prev) => {
      const idx = prev.findIndex((item) => item.productId === productId)
      if (idx < 0) return prev
      selected = prev[idx]
      const next = [...prev]
      next.splice(idx, 1)
      return next
    })

    if (!selected) return

    setItems((prev) => {
      if (prev.some((item) => item.productId === productId)) return prev

      const next = [...prev]
      if (targetId) {
        const targetIndex = next.findIndex((item) => item.productId === targetId)
        if (targetIndex >= 0) {
          next.splice(targetIndex, 0, selected as ProductSortItem)
          return next
        }
      }

      next.push(selected as ProductSortItem)
      return next
    })

    setHasChanges(true)
  }

  function moveAllBufferToTop() {
    if (bufferItems.length === 0) return

    setItems((prev) => {
      const prevIds = new Set(prev.map((item) => item.productId))
      const fromBuffer = bufferItems.filter((item) => !prevIds.has(item.productId))
      return [...fromBuffer, ...prev]
    })

    setBufferItems([])
    setHasChanges(true)
  }

  function handleDragStart(event: DragEvent<HTMLLIElement>, productId: string, source: DragSource) {
    setDraggingId(productId)
    setDraggingSource(source)
    event.dataTransfer.effectAllowed = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    event.dataTransfer.setDragImage(event.currentTarget, rect.width / 2, rect.height / 2)
  }

  function handleDragEnter(targetId: string) {
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

  async function handleSave() {
    if (!resolvedContext || !hasChanges) return

    setIsSaving(true)
    const result = await saveProductSortOrderAction({
      contextType: resolvedContext.contextType,
      contextId: resolvedContext.contextId,
      sortType,
      productIds: items.map((item) => item.productId),
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

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Vitrine</h1>
        <p className="text-sm text-muted-foreground">
          Ordene produtos por escopo e ordenação (drag and drop).
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
            placeholder="Buscar por nome ou código"
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
          <Badge variant="secondary">{items.length + bufferItems.length}/{total} produtos</Badge>
          {bufferItems.length > 0 && <Badge variant="outline">Intermediária: {bufferItems.length}</Badge>}
          {hasChanges && <Badge variant="default">Alterações pendentes</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadItems({ append: false, targetPage: 1 })} disabled={isLoading || isLoadingMore || isSaving || !resolvedContext}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Recarregar
          </Button>
          <Button onClick={() => void handleSave()} disabled={!hasChanges || bufferItems.length > 0 || isSaving || isLoading || isLoadingMore || !resolvedContext}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Ordem
          </Button>
        </div>
      </div>

      {bufferItems.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Existem {bufferItems.length} produto(s) na área intermediária. Arraste-os de volta para a grade antes de salvar.
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="rounded-lg border bg-card xl:min-w-0 xl:flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando produtos...
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado para este contexto.
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
              {items.map((item, index) => (
                <li
                  key={item.productId}
                  className={`rounded-lg border bg-background p-2 transition-all ${
                    draggingId === item.productId
                      ? 'cursor-grabbing border-transparent shadow-none opacity-70'
                      : 'cursor-grab'
                  } ${dropTargetId === item.productId ? 'border-dashed border-sky-400 bg-sky-50/40' : ''}`}
                  draggable
                  onDragStart={(event) => handleDragStart(event, item.productId, 'main')}
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={() => handleDragEnter(item.productId)}
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
                    draggingId === item.productId ? 'border border-transparent' : 'border'
                  }`}>
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="(max-width: 1024px) 50vw, 20vw" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">Sem img</div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="line-clamp-2 text-sm font-medium">{item.productName}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.productCode || `ID ${item.productId}`}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!isLoading && items.length > 0 && hasMoreItems && (
            <div ref={loadMoreRef} className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando mais produtos...
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-4 xl:w-72 xl:shrink-0 xl:self-start">
          <div
            className={`rounded-lg border bg-card p-3 transition-colors xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto ${
              bufferHover ? 'border-sky-400 bg-sky-50/50' : ''
            }`}
            onDragOver={(event) => {
              event.preventDefault()
              setBufferHover(true)
            }}
            onDragEnter={(event) => {
              event.preventDefault()
              setBufferHover(true)
            }}
            onDragLeave={() => setBufferHover(false)}
            onDrop={(event) => {
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
            {bufferItems.length > 0 && (
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
              Arraste para cá produtos temporários. Depois, arraste de volta para a posição desejada na grade.
            </p>

            {bufferItems.length === 0 ? (
              <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
                Solte aqui para guardar temporariamente.
              </div>
            ) : (
              <ul className="max-h-[60vh] space-y-2 overflow-auto pr-1">
                {bufferItems.map((item) => (
                  <li
                    key={item.productId}
                    className={`flex cursor-grab items-center gap-2 rounded border bg-background p-2 ${
                      draggingId === item.productId ? 'cursor-grabbing border-transparent opacity-70' : ''
                    }`}
                    draggable
                    onDragStart={(event) => handleDragStart(event, item.productId, 'buffer')}
                    onDragEnd={resetDragState}
                  >
                    <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded border bg-muted">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="40px" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">Sem</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs font-medium">{item.productName}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{item.productCode || `ID ${item.productId}`}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
