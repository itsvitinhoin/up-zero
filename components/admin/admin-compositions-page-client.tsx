'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  GripVertical,
  Layers,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
  Search,
  SlidersHorizontal,
  FilterX,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Package,
  ChevronLeft,
  ChevronRight,
  Upload,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Asset, Product } from '@/lib/types'
import {
  createCompositionAction,
  createCompositionItemAction,
  deleteCompositionAction,
  deleteCompositionItemAction,
  getCompositionItemsAction,
  updateCompositionAction,
  updateCompositionItemAction,
  type Composition,
  type CompositionItem,
  type CompositionItemsSummary,
  type PaginatedCompositionsResponse,
} from '@/lib/actions/compositions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CloudflareImage } from '@/components/ui/cloudflare-image'
import PercentageInput from '@/components/form/PercentageInput'
import IntegerInput from '@/components/form/IntegerInput'
import CurrencyInput from '@/components/form/CurrencyInput'
import { ProductSearchSelect } from '@/components/admin/product-search-select'
import { ImageLevelSelector } from '@/components/admin/image-level-selector'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MultiImageUpload } from '@/components/ui/multi-image-upload'
import RichTextEditor from '@/components/form/RichTextEditor'

type CompositionDialogMode = 'create' | 'edit' | 'delete' | null
type ItemDialogMode = 'create' | 'edit' | 'delete' | null

type CompositionFormData = {
  code: string
  name: string
  description: string
  active: boolean
  selection_mode: Composition['selection_mode']
  pricing_mode: Composition['pricing_mode']
  display_mode: Composition['display_mode']
  images: string[]
  videos: string[]
}

type CompositionItemFormData = {
  product_id: string
  variant_image_level_code: string
  asset_id: string
  quantity: number
  item_discount_mode: CompositionItem['item_discount_mode']
  item_discount_value: number
  sort_order: number
}

const emptyCompositionForm = (): CompositionFormData => ({
  code: '',
  name: '',
  description: '',
  active: true,
  selection_mode: 'PRODUCT',
  pricing_mode: 'NONE',
  display_mode: 'GROUPED',
  images: [],
  videos: [],
})

function parseCsvUrls(csv: string | null | undefined): string[] {
  if (!csv) return []
  return csv
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function toCsvUrls(urls: string[]): string {
  return urls
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .join(',')
}

const emptyItemForm = (): CompositionItemFormData => ({
  product_id: '',
  variant_image_level_code: '',
  asset_id: '',
  quantity: 1,
  item_discount_mode: 'NONE',
  item_discount_value: 0,
  sort_order: 0,
})

const selectionModeLabels: Record<Composition['selection_mode'], string> = {
  PRODUCT: 'Produto',
  IMAGE_LEVEL: 'Nível da imagem',
  ASSET: 'Asset',
}

const pricingModeLabels: Record<Composition['pricing_mode'], string> = {
  NONE: 'Sem ajuste',
  ITEM_PERCENT: 'Desconto percentual por item',
  ITEM_FIXED: 'Desconto fixo por item',
  BUNDLE_PERCENT: 'Desconto percentual no combo',
  BUNDLE_FIXED: 'Desconto fixo no combo',
}

const unsupportedPricingModes = new Set<Composition['pricing_mode']>(['BUNDLE_PERCENT', 'BUNDLE_FIXED'])

function isPricingModeSupported(mode: Composition['pricing_mode']) {
  return !unsupportedPricingModes.has(mode)
}

const displayModeLabels: Record<Composition['display_mode'], string> = {
  GROUPED: 'Agrupado',
  SPLIT: 'Separado',
}

const itemDiscountModeLabels: Record<CompositionItem['item_discount_mode'], string> = {
  NONE: 'Sem desconto',
  PERCENT_BPS: 'Percentual',
  FIXED_CENTS: 'Valor fixo',
}

function normalizeItemDiscountByPricingMode(
  pricingMode: Composition['pricing_mode'],
  itemDiscountMode: CompositionItem['item_discount_mode'],
  itemDiscountValue: number,
): { mode: CompositionItem['item_discount_mode']; value: number } {
  if (pricingMode === 'ITEM_PERCENT') {
    return {
      mode: 'PERCENT_BPS',
      value: Math.max(0, itemDiscountValue || 0),
    }
  }

  if (pricingMode === 'ITEM_FIXED') {
    return {
      mode: 'FIXED_CENTS',
      value: Math.max(0, itemDiscountValue || 0),
    }
  }

  return {
    mode: 'NONE',
    value: 0,
  }
}

function computeEstimate(params: {
  selectionMode: Composition['selection_mode']
  product: Product | undefined
  selectedImageLevelItem: any | null
  quantity: number
  itemDiscountValue: number
  isItemPercentMode: boolean
  isItemFixedMode: boolean
}): CompositionItem['estimate'] {
  const {
    selectionMode,
    product,
    selectedImageLevelItem,
    quantity,
    itemDiscountValue,
    isItemPercentMode,
    isItemFixedMode,
  } = params

  if (!Number.isFinite(quantity) || quantity <= 0) return null

  let avgPriceCents = 0
  let variantCount = 0
  let productName: string | undefined

  if (selectionMode === 'IMAGE_LEVEL') {
    if (!selectedImageLevelItem) return null
    const variants = selectedImageLevelItem.variants || []
    avgPriceCents = variants.length > 0
      ? variants.reduce((sum: number, v: any) => sum + (v.promo_cents || v.price_cents || 0), 0) / variants.length
      : 0
    variantCount = variants.length
    productName = selectedImageLevelItem.product_name
  } else {
    if (!product) return null
    const promo = typeof product.promoPrice === 'number' ? product.promoPrice : null
    const base = typeof product.basePrice === 'number' ? product.basePrice : 0
    const unitPrice = promo !== null && promo > 0 ? promo : base
    avgPriceCents = Math.round(Math.max(0, unitPrice) * 100)
    variantCount = 1
    productName = product.name
  }

  const subtotal = avgPriceCents * quantity
  const discountAmount = isItemPercentMode
    ? subtotal * (itemDiscountValue / 10000)
    : isItemFixedMode
      ? itemDiscountValue * quantity
      : 0
  const total = Math.max(0, subtotal - discountAmount)

  return {
    avg_price_cents: Math.round(avgPriceCents),
    subtotal_cents: Math.round(subtotal),
    discount_cents: Math.round(discountAmount),
    total_cents: Math.round(total),
    variant_count: variantCount,
    product_name: productName,
    image_url: selectionMode === 'IMAGE_LEVEL'
      ? selectedImageLevelItem?.primary_image_url
      : product?.images?.[0],
  }
}

interface AdminCompositionsPageClientProps {
  paginatedCompositions: PaginatedCompositionsResponse | null
  products: Product[]
  assets: Asset[]
  initialError?: string | null
}

interface SortableItemProps {
  item: CompositionItem
  product: Product | undefined
  asset: Asset | undefined
  itemDiscountModeLabels: Record<CompositionItem['item_discount_mode'], string>
  pricingMode: Composition['pricing_mode']
  onEdit: (item: CompositionItem) => void
  onDelete: (item: CompositionItem) => void
}

function SortableItem({ item, product, asset, itemDiscountModeLabels, pricingMode, onEdit, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const productTitle = product?.name || item.estimate?.product_name || `Produto #${item.product_id}`
  const assetImage = asset?.skuGroups?.find((group) => group.images?.length > 0)?.images?.[0]
  const productImage = product?.images?.[0]
  const thumbnailSrc = item.estimate?.image_url || assetImage || productImage || null

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-border/20 align-top"
    >
      <td className="w-8 px-2 py-3 align-middle">
        <button
          className="cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          aria-label="Arrastar item"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </td>
      <td className="w-16 px-2 py-3">
        <div className="h-12 w-10 rounded-lg border border-border/20 bg-muted/40 flex items-center justify-center overflow-hidden relative">
          {thumbnailSrc ? (
            <CloudflareImage
              src={thumbnailSrc}
              cloudflare={{ width: 40, height: 48, fit: 'cover', dpr: 2 }}
              alt={productTitle}
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </td>
      <td className="px-2 py-3">
        <div>
          <p className="text-foreground">{productTitle}</p>
          <p className="text-xs text-muted-foreground">ID: {item.product_id}</p>
          {item.variant_image_level_code ? (
            <p className="text-xs text-muted-foreground">Nível imagem: {item.variant_image_level_code}</p>
          ) : null}
          {item.asset_id ? (
            <p className="text-xs text-muted-foreground">Asset: {asset?.title || asset?.code || `#${item.asset_id}`}</p>
          ) : null}
        </div>
      </td>
      <td className="px-2 py-3 text-sm text-foreground">{item.quantity}</td>
      <td className="px-2 py-3 text-sm text-muted-foreground">
        {itemDiscountModeLabels[item.item_discount_mode]}
        {item.item_discount_mode === 'PERCENT_BPS' && item.item_discount_value > 0 ? ` (${(item.item_discount_value / 100).toFixed(2)}%)` : ''}
      </td>
      <td className="px-2 py-3 text-sm text-muted-foreground">
        {item.estimate ? `R$ ${((item.estimate.avg_price_cents || 0) / 100).toFixed(2)}` : '-'}
      </td>
      <td className="px-2 py-3 text-sm text-muted-foreground">
        {item.estimate ? `R$ ${((item.estimate.subtotal_cents || 0) / 100).toFixed(2)}` : '-'}
      </td>
      <td className="px-2 py-3 text-sm text-destructive">
        {item.estimate && (item.estimate.discount_cents || 0) > 0
          ? `- R$ ${((item.estimate.discount_cents || 0) / 100).toFixed(2)}`
          : '-'}
      </td>
      <td className="px-2 py-3 text-sm text-foreground">
        {item.estimate ? `R$ ${((item.estimate.total_cents || 0) / 100).toFixed(2)}` : '-'}
      </td>
      <td className="w-14 px-2 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="cursor-pointer">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(item)} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" />
              Editar item
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => onDelete(item)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

export function AdminCompositionsPageClient({
  paginatedCompositions,
  products,
  assets,
  initialError,
}: AdminCompositionsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Extract compositions and pagination data
  const compositions = paginatedCompositions?.items || []
  const totalCompositions = paginatedCompositions?.total || 0
  const currentPage = paginatedCompositions?.page || 1
  const pageSize = paginatedCompositions?.page_size || 20
  const totalPages = paginatedCompositions?.total_pages || 1

  // Read filters from URL
  const currentSearch = searchParams.get('search') || ''
  const currentActive = searchParams.get('active') || 'all'
  const currentPricingModeFilter = searchParams.get('pricing_mode') || 'all'

  const [selectedCompositionId, setSelectedCompositionId] = useState<number | null>(compositions[0]?.id ?? null)
  const [itemsByComposition, setItemsByComposition] = useState<Record<number, CompositionItem[]>>({})
  const [itemsSummaryByComposition, setItemsSummaryByComposition] = useState<Record<number, CompositionItemsSummary>>({})
  const [tempItems, setTempItems] = useState<CompositionItem[]>([]) // Items temporários durante criação
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [compositionDialogMode, setCompositionDialogMode] = useState<CompositionDialogMode>(null)
  const [itemDialogMode, setItemDialogMode] = useState<ItemDialogMode>(null)
  const [compositionTab, setCompositionTab] = useState<'general' | 'items' | 'images' | 'videos'>('general')
  const [selectedComposition, setSelectedComposition] = useState<Composition | null>(compositions[0] ?? null)
  const [selectedItem, setSelectedItem] = useState<CompositionItem | null>(null)
  const [compositionForm, setCompositionForm] = useState<CompositionFormData>(emptyCompositionForm())
  const [itemForm, setItemForm] = useState<CompositionItemFormData>(emptyItemForm())
  const [selectedImageLevelItem, setSelectedImageLevelItem] = useState<any | null>(null)
  const [selectedProductForEstimate, setSelectedProductForEstimate] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [draggedVideoIndex, setDraggedVideoIndex] = useState<number | null>(null)
  const videoFileInputRef = useRef<HTMLInputElement | null>(null)

  // Local filter states for form inputs (will trigger URL updates)
  const [searchInput, setSearchInput] = useState(currentSearch)
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>(currentActive as any)
  const [pricingModeFilter, setPricingModeFilter] = useState<string>(currentPricingModeFilter)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Update local state when URL changes
  useEffect(() => {
    setSearchInput(currentSearch)
    setActiveFilter(currentActive as any)
    setPricingModeFilter(currentPricingModeFilter)
  }, [currentSearch, currentActive, currentPricingModeFilter])

  const productsById = useMemo(() => {
    return new Map(products.map((product) => [Number(product.id), product]))
  }, [products])

  const assetsById = useMemo(() => {
    return new Map(assets.map((asset) => [Number(asset.id), asset]))
  }, [assets])

  const selectedProductAssets = useMemo(() => {
    const selectedProductId = Number(itemForm.product_id)
    if (!Number.isInteger(selectedProductId) || selectedProductId <= 0) return assets
    return assets.filter((asset) => Number(asset.productId) === selectedProductId)
  }, [assets, itemForm.product_id])

  useEffect(() => {
    if (!selectedComposition && compositions.length > 0 && !selectedCompositionId) {
      setSelectedCompositionId(compositions[0].id)
      setSelectedComposition(compositions[0])
    }
  }, [compositions, selectedComposition, selectedCompositionId])

  useEffect(() => {
    if (!selectedCompositionId || itemsByComposition[selectedCompositionId]) return

    let cancelled = false
    setItemsLoading(true)
    setItemsError(null)

    getCompositionItemsAction(selectedCompositionId).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setItemsError(result.error)
      } else {
        setItemsByComposition((prev) => ({ ...prev, [selectedCompositionId]: result.data.items }))
        setItemsSummaryByComposition((prev) => ({ ...prev, [selectedCompositionId]: result.data.summary }))
      }
      setItemsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [itemsByComposition, selectedCompositionId])

  const currentItems = compositionDialogMode === 'create'
    ? tempItems
    : selectedCompositionId ? (itemsByComposition[selectedCompositionId] ?? []) : []

  const currentItemsSummary = useMemo(() => {
    if (compositionDialogMode === 'create') {
      return tempItems.reduce(
        (acc, item) => {
          acc.subtotal_cents += item.estimate?.subtotal_cents || 0
          acc.discount_cents += item.estimate?.discount_cents || 0
          acc.total_cents += item.estimate?.total_cents || 0
          return acc
        },
        { subtotal_cents: 0, discount_cents: 0, total_cents: 0 } as CompositionItemsSummary,
      )
    }

    if (!selectedCompositionId) {
      return { subtotal_cents: 0, discount_cents: 0, total_cents: 0 } as CompositionItemsSummary
    }

    return (
      itemsSummaryByComposition[selectedCompositionId] ||
      ({ subtotal_cents: 0, discount_cents: 0, total_cents: 0 } as CompositionItemsSummary)
    )
  }, [compositionDialogMode, itemsSummaryByComposition, selectedCompositionId, tempItems])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = currentItems.findIndex((item) => item.id === active.id)
    const newIndex = currentItems.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const reorderedItems = arrayMove(currentItems, oldIndex, newIndex).map((item, index) => ({
      ...item,
      sort_order: index,
    }))

    // Se estamos no modo de criação, atualizar tempItems
    if (compositionDialogMode === 'create') {
      setTempItems(reorderedItems.map((item, index) => ({ ...item, sort_order: index })))
      return
    }

    // Modo de edição: atualizar local e sync com backend
    if (!selectedCompositionId) return

    // Update local state immediately for smooth UX
    setItemsByComposition((prev) => ({
      ...prev,
      [selectedCompositionId]: reorderedItems,
    }))

    // Update sort_order for all affected items in backend
    const updatePromises = reorderedItems.map((item, index) =>
      updateCompositionItemAction(selectedCompositionId, item.id, { sort_order: index })
    )

    try {
      const results = await Promise.all(updatePromises)
      const failed = results.filter((r) => !r.success)

      if (failed.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Erro ao reordenar',
          description: 'Alguns itens não puderam ser reordenados.',
        })
        // Refresh items to get correct state
        const result = await getCompositionItemsAction(selectedCompositionId)
        if (result.success) {
          setItemsByComposition((prev) => ({
            ...prev,
            [selectedCompositionId]: result.data.items,
          }))
          setItemsSummaryByComposition((prev) => ({
            ...prev,
            [selectedCompositionId]: result.data.summary,
          }))
        }
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao salvar nova ordem.',
      })
      // Refresh items on error
      const result = await getCompositionItemsAction(selectedCompositionId)
      if (result.success) {
        setItemsByComposition((prev) => ({
          ...prev,
          [selectedCompositionId]: result.data.items,
        }))
        setItemsSummaryByComposition((prev) => ({
          ...prev,
          [selectedCompositionId]: result.data.summary,
        }))
      }
    }
  }

  // When editing/creating composition, use form values. Otherwise use selected composition values.
  const effectiveSelectionMode = (compositionDialogMode === 'create' || compositionDialogMode === 'edit')
    ? compositionForm.selection_mode
    : (selectedComposition?.selection_mode ?? 'PRODUCT')
  const effectivePricingMode = (compositionDialogMode === 'create' || compositionDialogMode === 'edit')
    ? compositionForm.pricing_mode
    : (selectedComposition?.pricing_mode ?? 'NONE')
  const currentSelectionMode = effectiveSelectionMode
  const currentPricingMode = effectivePricingMode
  const itemDiscountEnabled = currentPricingMode === 'ITEM_PERCENT' || currentPricingMode === 'ITEM_FIXED'
  const isItemPercentMode = currentPricingMode === 'ITEM_PERCENT'
  const isItemFixedMode = currentPricingMode === 'ITEM_FIXED'
  const isSimpleQuantityMode = currentPricingMode === 'NONE'
  const selectedProduct = useMemo(() => {
    const id = Number(itemForm.product_id)
    if (!Number.isInteger(id) || id <= 0) return undefined
    return selectedProductForEstimate ?? productsById.get(id)
  }, [itemForm.product_id, productsById, selectedProductForEstimate])
  const draftItemEstimate = useMemo(() => {
    return computeEstimate({
      selectionMode: currentSelectionMode,
      product: selectedProduct,
      selectedImageLevelItem,
      quantity: itemForm.quantity,
      itemDiscountValue: itemForm.item_discount_value,
      isItemPercentMode,
      isItemFixedMode,
    })
  }, [
    currentSelectionMode,
    selectedProduct,
    selectedImageLevelItem,
    itemForm.quantity,
    itemForm.item_discount_value,
    isItemPercentMode,
    isItemFixedMode,
  ])
  const itemDiscountModeLockedTo: CompositionItem['item_discount_mode'] = currentPricingMode === 'ITEM_PERCENT'
    ? 'PERCENT_BPS'
    : currentPricingMode === 'ITEM_FIXED'
      ? 'FIXED_CENTS'
      : 'NONE'
  const compositionTabIndex =
    compositionTab === 'general'
      ? 0
      : compositionTab === 'images'
        ? 1
        : compositionTab === 'videos'
          ? 2
          : 3

  // Functions to update URL with filters
  const updateFilters = (filters: { search?: string; active?: string; pricing_mode?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (filters.search !== undefined) {
      if (filters.search) {
        params.set('search', filters.search)
      } else {
        params.delete('search')
      }
    }

    if (filters.active !== undefined) {
      if (filters.active && filters.active !== 'all') {
        params.set('active', filters.active)
      } else {
        params.delete('active')
      }
    }

    if (filters.pricing_mode !== undefined) {
      if (filters.pricing_mode && filters.pricing_mode !== 'all') {
        params.set('pricing_mode', filters.pricing_mode)
      } else {
        params.delete('pricing_mode')
      }
    }

    if (filters.page !== undefined) {
      if (filters.page > 1) {
        params.set('page', filters.page.toString())
      } else {
        params.delete('page')
      }
    }

    startTransition(() => {
      router.push(`/compositions?${params.toString()}`)
    })
  }

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
  }

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateFilters({ search: searchInput, page: 1 })
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchInput])

  const handleActiveFilterChange = (value: 'all' | 'active' | 'inactive') => {
    setActiveFilter(value)
    updateFilters({ active: value, page: 1 })
  }

  const handlePricingModeFilterChange = (value: string) => {
    setPricingModeFilter(value)
    updateFilters({ pricing_mode: value, page: 1 })
  }

  const handlePageChange = (page: number) => {
    updateFilters({ page })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Calculate stats from current page data (for display only)
  const pageStats = useMemo(() => ({
    active: compositions.filter((c) => c.active).length,
    inactive: compositions.filter((c) => !c.active).length,
    byPricingMode: {
      NONE: compositions.filter((c) => c.pricing_mode === 'NONE').length,
      ITEM_PERCENT: compositions.filter((c) => c.pricing_mode === 'ITEM_PERCENT').length,
      ITEM_FIXED: compositions.filter((c) => c.pricing_mode === 'ITEM_FIXED').length,
    },
  }), [compositions])

  const hasActiveFilters = currentSearch.trim().length > 0 || currentActive !== 'all' || currentPricingModeFilter !== 'all'

  const clearFilters = () => {
    setSearchInput('')
    setActiveFilter('all')
    setPricingModeFilter('all')
    setMobileFiltersOpen(false)
    startTransition(() => {
      router.push('/compositions')
    })
  }

  function openCreateComposition() {
    setSelectedComposition(null)
    setCompositionForm(emptyCompositionForm())
    setCompositionTab('general')
    setTempItems([]) // Limpar items temporários
    setCompositionDialogMode('create')
  }

  function openEditComposition(composition: Composition) {
    setSelectedComposition(composition)
    setSelectedCompositionId(composition.id)
    setCompositionTab('general')
    setCompositionForm({
      code: composition.code,
      name: composition.name,
      description: composition.description ?? '',
      active: composition.active,
      selection_mode: composition.selection_mode,
      pricing_mode: composition.pricing_mode,
      display_mode: 'GROUPED',
      images: parseCsvUrls(composition.images_url),
      videos: parseCsvUrls(composition.videos_url),
    })
    setCompositionDialogMode('edit')
  }

  function openDeleteComposition(composition: Composition) {
    setSelectedComposition(composition)
    setCompositionDialogMode('delete')
  }

  function openCreateItem() {
    setSelectedItem(null)
    setSelectedProductForEstimate(null)
    const empty = emptyItemForm()
    const normalizedDiscount = normalizeItemDiscountByPricingMode(
      effectivePricingMode,
      empty.item_discount_mode,
      empty.item_discount_value,
    )
    // Set sort_order to next available position
    const maxSortOrder = currentItems.length > 0
      ? Math.max(...currentItems.map((item) => item.sort_order))
      : -1
    setItemForm({
      ...empty,
      item_discount_mode: normalizedDiscount.mode,
      item_discount_value: normalizedDiscount.value,
      sort_order: maxSortOrder + 1,
    })
    setItemDialogMode('create')
  }

  function openEditItem(item: CompositionItem) {
    setSelectedItem(item)
    setSelectedProductForEstimate(productsById.get(Number(item.product_id)) ?? null)
    const normalizedDiscount = normalizeItemDiscountByPricingMode(
      effectivePricingMode,
      item.item_discount_mode,
      item.item_discount_value,
    )
    setItemForm({
      product_id: String(item.product_id),
      variant_image_level_code: item.variant_image_level_code ?? '',
      asset_id: item.asset_id ? String(item.asset_id) : '',
      quantity: item.quantity,
      item_discount_mode: normalizedDiscount.mode,
      item_discount_value: normalizedDiscount.value,
      sort_order: item.sort_order,
    })
    setItemDialogMode('edit')
  }

  function openDeleteItem(item: CompositionItem) {
    setSelectedItem(item)
    setItemDialogMode('delete')
  }

  function closeCompositionDialog() {
    setCompositionDialogMode(null)
    setCompositionTab('general')
    setUploadingVideo(false)
    setDraggedVideoIndex(null)
    setTempItems([]) // Limpar items temporários ao fechar
    setSelectedComposition(compositions.find((entry) => entry.id === selectedCompositionId) ?? null)
  }

  async function uploadCompositionVideos(files: File[]) {
    if (files.length === 0) return

    setUploadingVideo(true)
    try {
      const uploaded: string[] = []

      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload/video', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          throw new Error(text || `Falha no upload do vídeo ${file.name}`)
        }

        const result = await response.json()
        const url = typeof result?.url === 'string' ? result.url.trim() : ''
        if (!url) {
          throw new Error(`Upload do vídeo ${file.name} retornou sem URL válida`)
        }
        uploaded.push(url)
      }

      setCompositionForm((prev) => ({
        ...prev,
        videos: [...prev.videos, ...uploaded],
      }))
      toast({ description: `${uploaded.length} vídeo(s) enviado(s) com sucesso` })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Erro ao enviar vídeo',
        variant: 'destructive',
      })
    } finally {
      setUploadingVideo(false)
      if (videoFileInputRef.current) {
        videoFileInputRef.current.value = ''
      }
    }
  }

  function moveVideo(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    setCompositionForm((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.videos.length ||
        toIndex >= prev.videos.length
      ) {
        return prev
      }
      const next = [...prev.videos]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return {
        ...prev,
        videos: next,
      }
    })
  }

  function closeItemDialog() {
    setItemDialogMode(null)
    setSelectedItem(null)
    setSelectedImageLevelItem(null)
    setSelectedProductForEstimate(null)
  }

  async function reloadItems(compositionId: number) {
    setItemsLoading(true)
    setItemsError(null)
    const result = await getCompositionItemsAction(compositionId)
    setItemsLoading(false)
    if (!result.success) {
      setItemsError(result.error)
      return false
    }
    setItemsByComposition((prev) => ({ ...prev, [compositionId]: result.data.items }))
    setItemsSummaryByComposition((prev) => ({ ...prev, [compositionId]: result.data.summary }))
    return true
  }

  async function submitComposition() {
    if (!compositionForm.code.trim() || !compositionForm.name.trim()) {
      toast({ description: 'Código e nome são obrigatórios', variant: 'destructive' })
      return
    }

    if (!isPricingModeSupported(compositionForm.pricing_mode)) {
      toast({
        description: 'Modo de preço de combo ainda não está disponível para uso nesta tela.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    const payload: any = {
      code: compositionForm.code.trim(),
      name: compositionForm.name.trim(),
      description: compositionForm.description.trim() || undefined,
      active: compositionForm.active,
      selection_mode: compositionForm.selection_mode,
      pricing_mode: compositionForm.pricing_mode,
      display_mode: 'GROUPED',
      images_url: toCsvUrls(compositionForm.images),
      videos_url: toCsvUrls(compositionForm.videos),
    }

    // Se estamos criando e há items temporários, incluir no payload
    if (compositionDialogMode === 'create' && tempItems.length > 0) {
      payload.items = tempItems.map((item) => ({
        product_id: item.product_id,
        variant_image_level_code: item.variant_image_level_code,
        asset_id: item.asset_id,
        quantity: item.quantity,
        item_discount_mode: item.item_discount_mode,
        item_discount_value: item.item_discount_value,
        sort_order: item.sort_order,
      }))
    }

    const result = compositionDialogMode === 'edit' && selectedComposition
      ? await updateCompositionAction(selectedComposition.id, payload)
      : await createCompositionAction(payload)

    setSaving(false)
    if (!result.success) {
      toast({ description: result.error, variant: 'destructive' })
      return
    }

    if (compositionDialogMode === 'edit' && selectedComposition) {
      setSelectedComposition(result.data)
      toast({ description: 'Composição atualizada com sucesso' })
      closeCompositionDialog()
      router.refresh()
    } else {
      // Criação bem-sucedida
      const hadItems = tempItems.length > 0

      setSelectedCompositionId(result.data.id)
      setSelectedComposition(result.data)
      setTempItems([]) // Limpar items temporários

      if (hadItems) {
        // Se criou com items, fechar o dialog
        toast({ description: 'Composição criada com sucesso' })
        closeCompositionDialog()
      } else {
        // Se não tinha items, permitir adicionar agora (comportamento antigo)
        setCompositionForm({
          code: result.data.code,
          name: result.data.name,
          description: result.data.description ?? '',
          active: result.data.active,
          selection_mode: result.data.selection_mode,
          pricing_mode: result.data.pricing_mode,
          display_mode: 'GROUPED',
          images: parseCsvUrls(result.data.images_url),
          videos: parseCsvUrls(result.data.videos_url),
        })
        setCompositionDialogMode('edit')
        setCompositionTab('items')
        await reloadItems(result.data.id)
        toast({ description: 'Composição criada com sucesso' })
      }
    }

    router.refresh()
  }

  async function confirmDeleteComposition() {
    if (!selectedComposition) return
    setSaving(true)
    const result = await deleteCompositionAction(selectedComposition.id)
    setSaving(false)
    if (!result.success) {
      toast({ description: result.error, variant: 'destructive' })
      return
    }

    setItemsByComposition((prev) => {
      const next = { ...prev }
      delete next[selectedComposition.id]
      return next
    })
    if (selectedCompositionId === selectedComposition.id) {
      setSelectedCompositionId(null)
      setSelectedComposition(null)
    }
    setCompositionDialogMode(null)
    toast({ description: 'Composição excluída com sucesso' })
    router.refresh()
  }

  async function submitItem() {
    const productId = Number(itemForm.product_id)
    const assetId = itemForm.asset_id.trim() ? Number(itemForm.asset_id) : null
    if (!Number.isInteger(productId) || productId <= 0) {
      toast({ description: 'Produto é obrigatório', variant: 'destructive' })
      return
    }
    if (itemForm.quantity <= 0) {
      toast({ description: 'Quantidade deve ser maior que zero', variant: 'destructive' })
      return
    }
    if (currentSelectionMode === 'ASSET' && (!assetId || assetId <= 0)) {
      toast({ description: 'Asset ID é obrigatório para composições do tipo ASSET', variant: 'destructive' })
      return
    }
    if (currentSelectionMode === 'IMAGE_LEVEL' && !itemForm.variant_image_level_code.trim()) {
      toast({ description: 'Nível da imagem é obrigatório para composições IMAGE_LEVEL', variant: 'destructive' })
      return
    }

    const normalizedDiscount = normalizeItemDiscountByPricingMode(
      effectivePricingMode,
      itemForm.item_discount_mode,
      itemForm.item_discount_value,
    )

    // Se estamos no modo de criação, adicionar ao tempItems
    if (compositionDialogMode === 'create') {
      const estimate = computeEstimate({
        selectionMode: currentSelectionMode,
        product: selectedProduct,
        selectedImageLevelItem,
        quantity: itemForm.quantity,
        itemDiscountValue: itemForm.item_discount_value,
        isItemPercentMode,
        isItemFixedMode,
      })

      const newItem: CompositionItem = {
        id: -(tempItems.length + 1), // ID temporário negativo
        composition_id: 0, // Será preenchido depois
        product_id: productId,
        variant_image_level_code: itemForm.variant_image_level_code.trim() || null,
        asset_id: assetId && assetId > 0 ? assetId : null,
        quantity: itemForm.quantity,
        item_discount_mode: normalizedDiscount.mode,
        item_discount_value: normalizedDiscount.value,
        sort_order: itemForm.sort_order,
        estimate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (itemDialogMode === 'edit' && selectedItem) {
        // Editar item temporário
        setTempItems((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...newItem, id: selectedItem.id } : item)))
        toast({ description: 'Item atualizado com sucesso' })
      } else {
        // Criar novo item temporário
        setTempItems((prev) => [...prev, newItem])
        toast({ description: 'Item adicionado com sucesso' })
      }

      closeItemDialog()
      return
    }

    // Modo de edição: usar API normalmente
    if (!selectedComposition) return

    setSaving(true)
    const payload = {
      product_id: productId,
      variant_image_level_code: itemForm.variant_image_level_code.trim() || null,
      asset_id: assetId && assetId > 0 ? assetId : null,
      quantity: itemForm.quantity,
      item_discount_mode: normalizedDiscount.mode,
      item_discount_value: normalizedDiscount.value,
      sort_order: itemForm.sort_order,
    }

    const result = itemDialogMode === 'edit' && selectedItem
      ? await updateCompositionItemAction(selectedComposition.id, selectedItem.id, payload)
      : await createCompositionItemAction(selectedComposition.id, payload)

    setSaving(false)
    if (!result.success) {
      toast({ description: result.error, variant: 'destructive' })
      return
    }

    await reloadItems(selectedComposition.id)
    toast({ description: itemDialogMode === 'edit' ? 'Item atualizado com sucesso' : 'Item criado com sucesso' })
    closeItemDialog()
    router.refresh()
  }

  async function confirmDeleteItem() {
    if (!selectedItem) return

    // Se estamos no modo de criação, remover do tempItems
    if (compositionDialogMode === 'create') {
      setTempItems((prev) => prev.filter((item) => item.id !== selectedItem.id))
      toast({ description: 'Item removido com sucesso' })
      closeItemDialog()
      return
    }

    // Modo de edição: usar API normalmente
    if (!selectedComposition) return
    setSaving(true)
    const result = await deleteCompositionItemAction(selectedComposition.id, selectedItem.id)
    setSaving(false)
    if (!result.success) {
      toast({ description: result.error, variant: 'destructive' })
      return
    }

    await reloadItems(selectedComposition.id)
    toast({ description: 'Item excluído com sucesso' })
    closeItemDialog()
    router.refresh()
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      {/* Header */}
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              Catálogo de vendas
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <Layers className="h-6 w-6 text-primary" />
              Composição de Produtos
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {totalCompositions} {hasActiveFilters ? 'composições encontradas' : 'composições cadastradas'}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full cursor-pointer md:hidden"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Abrir filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Button onClick={openCreateComposition} className="h-10 gap-2 rounded-full px-5 cursor-pointer">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Composição</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="right">
        <DrawerContent className="max-w-none flex flex-col data-[vaul-drawer-direction=right]:w-[80vw] sm:data-[vaul-drawer-direction=right]:w-[80vw]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine a lista de composições no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={activeFilter} onValueChange={(value: any) => handleActiveFilterChange(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pricingModeFilter} onValueChange={handlePricingModeFilterChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Modo de preço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos modos</SelectItem>
                <SelectItem value="NONE">Sem ajuste</SelectItem>
                <SelectItem value="ITEM_PERCENT">Desconto percentual</SelectItem>
                <SelectItem value="ITEM_FIXED">Desconto fixo</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={clearFilters}
              className="h-10 w-10 rounded-full cursor-pointer self-end"
              aria-label="Limpar filtros"
              title="Limpar filtros"
              disabled={!hasActiveFilters}
            >
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" className="w-full cursor-pointer bg-black text-white hover:bg-black/90">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Total</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{totalCompositions}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2 text-slate-700">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Ativas {hasActiveFilters ? '(pág.)' : ''}</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{pageStats.active}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Inativas {hasActiveFilters ? '(pág.)' : ''}</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{pageStats.inactive}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2 text-slate-700">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">% Desconto {hasActiveFilters ? '(pág.)' : ''}</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{pageStats.byPricingMode.ITEM_PERCENT}</p>
            </div>
            <div className="rounded-full bg-violet-100 p-2 text-violet-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-violet-300 to-violet-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">R$ Fixo {hasActiveFilters ? '(pág.)' : ''}</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{pageStats.byPricingMode.ITEM_FIXED}</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2 text-blue-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-blue-300 to-blue-500" />
        </div>
      </div>

      {/* Filters Bar (Desktop) */}
      <div className="hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm md:block">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(320px,1.5fr)_180px_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-10 rounded-full pl-10"
            />
          </div>
          <Select value={activeFilter} onValueChange={(value: any) => handleActiveFilterChange(value)}>
            <SelectTrigger className="h-10 rounded-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={pricingModeFilter} onValueChange={handlePricingModeFilterChange}>
            <SelectTrigger className="h-10 rounded-full">
              <SelectValue placeholder="Modo de preço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos modos</SelectItem>
              <SelectItem value="NONE">Sem ajuste</SelectItem>
              <SelectItem value="ITEM_PERCENT">Desconto percentual</SelectItem>
              <SelectItem value="ITEM_FIXED">Desconto fixo</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={clearFilters}
            className="h-10 w-10 rounded-full cursor-pointer"
            aria-label="Limpar filtros"
            title="Limpar filtros"
            disabled={!hasActiveFilters}
          >
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {initialError ? (
        <Card className="border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {initialError}
        </Card>
      ) : null}

      {/* Compositions List */}
      <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
        {compositions.length === 0 ? (
          <div className="flex h-56 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {compositions.length === 0
              ? 'Nenhuma composição cadastrada ainda.'
              : 'Nenhuma composição encontrada com os filtros aplicados.'}
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[64px_120px_minmax(220px,1.8fr)_110px_120px_minmax(210px,1.3fr)_120px_120px_90px_56px] items-center gap-2 border-b border-border/20 bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid">
              <span>Imagem</span>
              <span>Criado em</span>
              <span>Nome</span>
              <span>Codigo</span>
              <span>Selecao</span>
              <span>Preco</span>
              <span className="text-right">Desc Total</span>
              <span className="text-right">Total Comp.</span>
              <span>Status</span>
              <span className="text-right">Acoes</span>
            </div>
            {compositions.map((composition) => {
              return (
                <div
                  key={composition.id}
                  className={[
                    'group grid gap-2 border-b border-border/20 bg-background p-4 text-left transition-colors hover:bg-muted/30 md:grid-cols-[64px_120px_minmax(220px,1.8fr)_110px_120px_minmax(210px,1.3fr)_120px_120px_90px_56px] md:items-center md:px-4 md:py-3',
                  ].join(' ')}
                >
                  <div className="hidden md:block">
                    <div className="h-12 w-10 rounded-lg border border-border/20 bg-muted/40 flex items-center justify-center overflow-hidden relative">
                      {parseCsvUrls(composition.images_url)[0] ? (
                        <CloudflareImage
                          src={parseCsvUrls(composition.images_url)[0] || '/placeholder.svg'}
                          cloudflare={{ width: 40, height: 48, fit: 'cover', dpr: 2 }}
                          alt={composition.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(composition.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </div>
                  <div className="col-span-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">{composition.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground md:hidden">Composicao #{composition.id}</p>
                  </div>

                  <div className="font-mono text-xs text-muted-foreground">{composition.code}</div>

                  <div>
                    <Badge variant="outline">{selectionModeLabels[composition.selection_mode]}</Badge>
                  </div>

                  <div className="min-w-0">
                    <Badge
                      variant="secondary"
                      className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                      title={pricingModeLabels[composition.pricing_mode]}
                    >
                      {pricingModeLabels[composition.pricing_mode]}
                    </Badge>
                  </div>

                  <div className="text-right text-sm text-destructive tabular-nums">
                    - R$ {(((composition.total_discount_cents ?? 0) as number) / 100).toFixed(2)}
                  </div>

                  <div className="text-right text-sm font-medium text-foreground tabular-nums">
                    R$ {(((composition.total_composition_cents ?? 0) as number) / 100).toFixed(2)}
                  </div>

                  <div>
                    {composition.active ? (
                      <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
                        Ativa
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
                  </div>

                  <div className="justify-self-end" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full cursor-pointer">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditComposition(composition)} className="cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive cursor-pointer"
                          onClick={() => openDeleteComposition(composition)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">
            Mostrando {compositions.length} de {totalCompositions} composições
            {hasActiveFilters && ' (filtrado)'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 cursor-pointer"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'ghost'}
                    size="icon"
                    className="h-9 w-9 cursor-pointer"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isPending}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 cursor-pointer"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Sheet
        open={compositionDialogMode === 'create' || compositionDialogMode === 'edit'}
        onOpenChange={(open) => !open && closeCompositionDialog()}
      >
        <SheetContent className="w-full sm:w-[70vw] lg:w-[70vw] sm:max-w-none p-0 flex flex-col [&>button]:hidden">
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <SheetHeader className="p-0 mb-6">
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="text-base font-semibold">
                  {compositionDialogMode === 'edit' ? 'Editar composição' : 'Nova composição'}
                </SheetTitle>
                <SheetClose asChild>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
              <p className="text-sm text-muted-foreground">
                Defina como a composição será montada e exibida no carrinho.
              </p>
              </SheetHeader>

              <Tabs value={compositionTab} onValueChange={(value) => setCompositionTab(value as 'general' | 'items' | 'images' | 'videos')}>
                <TabsList className="relative grid w-full grid-cols-4">
                  <span
                    className="absolute inset-y-0.75 left-0.75 rounded-md bg-background shadow-sm transition-transform duration-300 ease-out pointer-events-none z-0"
                    style={{
                      width: 'calc(25% - 6px)',
                      transform: `translateX(calc(${compositionTabIndex * 100}% + ${compositionTabIndex * 6}px))`,
                    }}
                  />
                  <TabsTrigger value="general" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
                    <Settings2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Dados Gerais</span>
                  </TabsTrigger>
                  <TabsTrigger value="images" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
                    <Package className="h-4 w-4" />
                    <span className="hidden sm:inline">Imagens</span>
                  </TabsTrigger>
                  <TabsTrigger value="videos" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
                    <Package className="h-4 w-4" />
                    <span className="hidden sm:inline">Vídeos</span>
                  </TabsTrigger>
                  <TabsTrigger value="items" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
                    <List className="h-4 w-4" />
                    <span className="hidden sm:inline">Itens</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Dados gerais</CardTitle>
                      <CardDescription>
                        Configure identificação, regras de seleção e preço da composição.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Código *</Label>
                          <Input
                            value={compositionForm.code}
                            onChange={(event) => setCompositionForm((prev) => ({ ...prev, code: event.target.value }))}
                            placeholder="Ex: kit-inverno"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Nome *</Label>
                          <Input
                            value={compositionForm.name}
                            onChange={(event) => setCompositionForm((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="Ex: Kit Inverno"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Descrição</Label>
                        <RichTextEditor
                          value={compositionForm.description}
                          onChange={(value) => setCompositionForm((prev) => ({
                            ...prev,
                            description: value.html,
                          }))}
                          placeholder="Descreva a composição..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Modo de seleção</Label>
                          <Select
                            value={compositionForm.selection_mode}
                            onValueChange={(value: Composition['selection_mode']) => setCompositionForm((prev) => ({ ...prev, selection_mode: value }))}
                          >
                            <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PRODUCT">Produto</SelectItem>
                              <SelectItem value="IMAGE_LEVEL">Nível da imagem</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Modo de preço</Label>
                          <Select
                            value={compositionForm.pricing_mode}
                            onValueChange={(value: Composition['pricing_mode']) => setCompositionForm((prev) => ({ ...prev, pricing_mode: value }))}
                          >
                            <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">Sem ajuste</SelectItem>
                              <SelectItem value="ITEM_PERCENT">Desconto percentual por item</SelectItem>
                              <SelectItem value="ITEM_FIXED">Desconto fixo por item</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          className="cursor-pointer"
                          checked={compositionForm.active}
                          onCheckedChange={(value) => setCompositionForm((prev) => ({ ...prev, active: value }))}
                        />
                        <Label>Ativa</Label>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="items" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Itens da composição</CardTitle>
                      <CardDescription>
                        Adicione produtos e configure os parâmetros de cada item da composição.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {compositionDialogMode !== 'create' && !selectedComposition ? (
                        <div className="rounded-lg border border-dashed border-border/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                          Salve os dados gerais da composicao para liberar o gerenciamento de itens.
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">Itens da composicao</p>
                              <p className="text-xs text-muted-foreground">
                                {compositionDialogMode === 'create' ? (
                                  <>Modo {selectionModeLabels[compositionForm.selection_mode]}</>
                                ) : selectedComposition ? (
                                  <>Modo {selectionModeLabels[selectedComposition.selection_mode]}</>
                                ) : null}
                              </p>
                            </div>
                            <Button size="sm" onClick={openCreateItem} className="cursor-pointer">
                              <Plus className="mr-1 h-4 w-4" />
                              Novo Item
                            </Button>
                          </div>

                          {itemsError ? (
                            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                              {itemsError}
                            </div>
                          ) : null}

                          {itemsLoading ? (
                            <div className="rounded-lg border border-border/20 p-6 text-center text-sm text-muted-foreground">
                              Carregando itens...
                            </div>
                          ) : currentItems.length === 0 ? (
                            <div className="rounded-lg border border-border/20 p-6 text-center text-sm text-muted-foreground">
                              Essa composicao ainda nao tem itens.
                            </div>
                          ) : (
                            <>
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                              >
                                <SortableContext
                                  items={currentItems.map((item) => item.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="rounded-lg border border-border/20 overflow-hidden">
                                    <div className="overflow-x-auto">
                                      <table className="w-full min-w-205 border-collapse">
                                        <thead className="bg-muted/40">
                                          <tr className="text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
                                            <th className="w-8 px-2 py-2 font-normal" />
                                            <th className="w-16 px-2 py-2 font-normal">Imagem</th>
                                            <th className="px-2 py-2 font-normal">Nome</th>
                                            <th className="px-2 py-2 font-normal">Qtd</th>
                                            <th className="px-2 py-2 font-normal">Desconto</th>
                                            <th className="px-2 py-2 font-normal">Preço Médio</th>
                                            <th className="px-2 py-2 font-normal">Subtotal</th>
                                            <th className="px-2 py-2 font-normal">Desc. Est.</th>
                                            <th className="px-2 py-2 font-normal">Total Est.</th>
                                            <th className="w-14 px-2 py-2 text-right font-normal">Ações</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {currentItems.map((item) => {
                                            const product = productsById.get(item.product_id)
                                            const asset = item.asset_id ? assetsById.get(item.asset_id) : null
                                            return (
                                              <SortableItem
                                                key={item.id}
                                                item={item}
                                                product={product}
                                                asset={asset}
                                                itemDiscountModeLabels={itemDiscountModeLabels}
                                                pricingMode={currentPricingMode}
                                                onEdit={openEditItem}
                                                onDelete={openDeleteItem}
                                              />
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </SortableContext>
                              </DndContext>

                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                                  <p className="text-xs uppercase tracking-[0.06em] text-muted-foreground">Desconto Total</p>
                                  <p className="text-lg font-semibold text-destructive">
                                    - R$ {(currentItemsSummary.discount_cents / 100).toFixed(2)}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                                  <p className="text-xs uppercase tracking-[0.06em] text-muted-foreground">Total da Composição</p>
                                  <p className="text-lg font-semibold text-foreground">
                                    R$ {(currentItemsSummary.total_cents / 100).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="images" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
                        <div className="min-w-0 space-y-1.5 md:max-w-[42%]">
                          <CardTitle className="text-lg">Imagens do Produto</CardTitle>
                          <CardDescription>
                            Faça upload de múltiplas imagens e organize a ordem de exibição.
                          </CardDescription>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1.5 md:w-[52%] md:text-right">
                          <p className="font-medium text-foreground">
                            Você pode adicionar fotos no formato PNG, JPG, JPEG ou GIF.
                          </p>
                          <p>A dimensão recomendada para o upload da foto é de 683x1024px.</p>
                          <p>O tamanho recomendado para o upload da foto é de 1MB e GIF até 5MB.</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Produto</div>
                      </div>
                      <MultiImageUpload
                        value={compositionForm.images}
                        onChange={(images) => setCompositionForm((prev) => ({ ...prev, images }))}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="videos" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Vídeos do Produto</CardTitle>
                      <CardDescription>
                        Os vídeos são agrupados pelos atributos selecionados.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Produto</div>
                        <div className="text-sm text-muted-foreground">1 vídeo por grupo.</div>
                      </div>
                      <div className="space-y-3">
                        <input
                          ref={videoFileInputRef}
                          type="file"
                          accept="video/*"
                          multiple
                          className="hidden"
                          onChange={(event) => {
                            const files = event.target.files ? Array.from(event.target.files) : []
                            if (files.length > 0) {
                              uploadCompositionVideos(files)
                            }
                          }}
                        />

                        {compositionForm.videos.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => videoFileInputRef.current?.click()}
                            disabled={uploadingVideo}
                            className="w-44 aspect-3/4 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
                          >
                            {uploadingVideo ? (
                              <Loader2 className="h-8 w-8 animate-spin" />
                            ) : (
                              <>
                                <Upload className="h-8 w-8 mb-2" />
                                <span className="text-base">Adicionar vídeo</span>
                                <span className="text-sm mt-1">MP4, WebM, OGG ou MOV</span>
                              </>
                            )}
                          </button>
                        ) : null}

                        {compositionForm.videos.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex justify-start">
                              <Button
                                type="button"
                                variant="outline"
                                className="cursor-pointer"
                                disabled={uploadingVideo}
                                onClick={() => videoFileInputRef.current?.click()}
                              >
                                {uploadingVideo ? 'Enviando vídeos...' : 'Adicionar mais vídeos'}
                              </Button>
                            </div>
                            {compositionForm.videos.map((videoUrl, index) => (
                              <div
                                key={`${videoUrl}-${index}`}
                                className="flex items-center gap-2 rounded-lg border border-border/40 bg-background p-2"
                                draggable
                                onDragStart={() => setDraggedVideoIndex(index)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => {
                                  if (draggedVideoIndex === null) return
                                  moveVideo(draggedVideoIndex, index)
                                  setDraggedVideoIndex(null)
                                }}
                                onDragEnd={() => setDraggedVideoIndex(null)}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <Input value={videoUrl} readOnly className="font-mono text-xs" />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="cursor-pointer"
                                  onClick={() => setCompositionForm((prev) => ({
                                    ...prev,
                                    videos: prev.videos.filter((_, currentIndex) => currentIndex !== index),
                                  }))}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            <div className="border-t bg-background p-4 sm:p-6 sticky bottom-0 flex justify-end gap-2">
              <Button variant="outline" onClick={closeCompositionDialog} className="cursor-pointer">Cancelar</Button>
              <Button
                className="cursor-pointer"
                onClick={submitComposition}
                disabled={saving}
              >
                {compositionDialogMode === 'edit' ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={compositionDialogMode === 'delete'} onOpenChange={(open) => !open && closeCompositionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir composição</DialogTitle>
            <DialogDescription>
              Essa ação remove a composição e os itens vinculados.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Confirma excluir <span className="font-medium text-foreground">{selectedComposition?.name}</span>?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCompositionDialog} className="cursor-pointer">Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteComposition} disabled={saving} className="cursor-pointer">
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={itemDialogMode === 'create' || itemDialogMode === 'edit'}
        onOpenChange={(open) => !open && closeItemDialog()}
      >
        <SheetContent className="w-full sm:w-[70vw] lg:w-[70vw] sm:max-w-none p-0 flex flex-col [&>button]:hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <SheetHeader className="p-0 mb-6">
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="text-base font-semibold">
                  {itemDialogMode === 'edit' ? 'Editar item da composição' : 'Novo item da composição'}
                </SheetTitle>
                <SheetClose asChild>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
              <p className="text-sm text-muted-foreground">
                Defina o produto base e os parâmetros de seleção do item.
              </p>
            </SheetHeader>

            <div className="space-y-4">
              {currentSelectionMode === 'IMAGE_LEVEL' ? (
                <ImageLevelSelector
                  value={itemForm.product_id && itemForm.variant_image_level_code
                    ? `${itemForm.product_id}:${itemForm.variant_image_level_code}`
                    : ''
                  }
                  onChange={(imageKey, productId) => setItemForm((prev) => ({
                    ...prev,
                    product_id: String(productId),
                    variant_image_level_code: imageKey,
                  }))}
                  onSelectItem={(item) => setSelectedImageLevelItem(item)}
                />
              ) : (
                <div className="space-y-1.5">
                  <Label>Produto *</Label>
                  <ProductSearchSelect
                    value={itemForm.product_id}
                    onChange={(value) => setItemForm((prev) => ({ ...prev, product_id: value }))}
                    onSelectProduct={setSelectedProductForEstimate}
                    placeholder="Selecione um produto"
                    initialProducts={products}
                  />
                </div>
              )}
              {isItemPercentMode ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Quantidade *</Label>
                      <IntegerInput
                        value={itemForm.quantity}
                        onChange={(value) => setItemForm((prev) => ({ ...prev, quantity: value ?? 1 }))}
                        min={1}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor em porcentagem *</Label>
                      <PercentageInput
                        value={itemForm.item_discount_value / 10000}
                        onChange={(value) => setItemForm((prev) => ({
                          ...prev,
                          item_discount_value: Math.max(0, Math.round((value ?? 0) * 10000)),
                        }))}
                        min={0}
                        max={100}
                        allowNegative={false}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </>
              ) : isItemFixedMode ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Quantidade *</Label>
                      <IntegerInput
                        value={itemForm.quantity}
                        onChange={(value) => setItemForm((prev) => ({ ...prev, quantity: value ?? 1 }))}
                        min={1}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Desconto do item (R$) *</Label>
                      <CurrencyInput
                        value={itemForm.item_discount_value / 100}
                        onChange={(value) => setItemForm((prev) => ({
                          ...prev,
                          item_discount_value: Math.max(0, Math.round((value ?? 0) * 100)),
                        }))}
                        locale="pt-BR"
                        currency="BRL"
                        allowNegative={false}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </>
              ) : isSimpleQuantityMode ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Quantidade *</Label>
                    <IntegerInput
                      value={itemForm.quantity}
                      onChange={(value) => setItemForm((prev) => ({ ...prev, quantity: value ?? 1 }))}
                      min={1}
                      placeholder="1"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Quantidade *</Label>
                      <IntegerInput
                        value={itemForm.quantity}
                        onChange={(value) => setItemForm((prev) => ({ ...prev, quantity: value ?? 1 }))}
                        min={1}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Desconto do item</Label>
                      <Input value={itemDiscountModeLabels[itemDiscountModeLockedTo]} readOnly disabled />
                      {!itemDiscountEnabled ? (
                        <p className="text-xs text-muted-foreground">
                          Desconto por item desativado para o modo de preço atual da composição.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          O modo de preço da composição define automaticamente o tipo de desconto do item.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Valor do desconto</Label>
                      <Input
                        type="number"
                        min={0}
                        value={itemDiscountEnabled ? itemForm.item_discount_value : 0}
                        onChange={(event) => setItemForm((prev) => ({ ...prev, item_discount_value: Number(event.target.value) || 0 }))}
                        disabled={!itemDiscountEnabled}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Asset</Label>
                      <Select
                        value={itemForm.asset_id || '__none__'}
                        onValueChange={(value) => setItemForm((prev) => ({ ...prev, asset_id: value === '__none__' ? '' : value }))}
                      >
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue placeholder={currentSelectionMode === 'ASSET' ? 'Selecione um asset' : 'Opcional'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem asset</SelectItem>
                          {selectedProductAssets.map((asset) => (
                            <SelectItem key={asset.id} value={String(asset.id)}>
                              {asset.title || asset.code || `Asset ${asset.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {currentSelectionMode === 'ASSET' ? (
                        <p className="text-xs text-muted-foreground">Obrigatório para composições com seleção por asset.</p>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <SheetFooter className="border-t bg-background p-4 sm:p-6 sticky bottom-0 space-y-3 mt-auto">
            {draftItemEstimate && (
              <div className="w-full rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Resumo do cálculo</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preço médio unitário:</span>
                    <span className="font-medium">R$ {((draftItemEstimate.avg_price_cents || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantidade:</span>
                    <span className="font-medium">{itemForm.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">R$ {((draftItemEstimate.subtotal_cents || 0) / 100).toFixed(2)}</span>
                  </div>
                  {(draftItemEstimate.discount_cents || 0) > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Desconto {isItemPercentMode ? `(${(itemForm.item_discount_value / 100).toFixed(2)}%)` : ''}:</span>
                      <span className="font-medium">- R$ {((draftItemEstimate.discount_cents || 0) / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 border-t text-base">
                    <span className="font-semibold">Total estimado:</span>
                    <span className="font-bold text-primary">R$ {((draftItemEstimate.total_cents || 0) / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" onClick={closeItemDialog} className="cursor-pointer">Cancelar</Button>
              <Button className="cursor-pointer" onClick={submitItem} disabled={saving}>
                {itemDialogMode === 'edit' ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={itemDialogMode === 'delete'} onOpenChange={(open) => !open && closeItemDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir item da composição</DialogTitle>
            <DialogDescription>
              Esse item será removido da composição.
            </DialogDescription>
          </DialogHeader>

          <div className="text-sm text-muted-foreground">
            Confirma excluir o item <span className="font-medium text-foreground">#{selectedItem?.id}</span>?
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeItemDialog} className="cursor-pointer">Cancelar</Button>
            <Button className="cursor-pointer" variant="destructive" onClick={confirmDeleteItem} disabled={saving}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}