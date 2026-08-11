'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { PaginatedResponse, Product, Category } from '@/lib/types'
import { useAdminStore } from '@/contexts/admin-store-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import {
  ArrowLeft,
  Search,
  FilterX,
  X,
  Copy,
  Check,
  ImageIcon,
  Package,
  AlertTriangle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/pricing'
import { createCustomLinkAction, updateCustomLinkAction } from '@/lib/actions/custom-links'
import { buildStorefrontUrl } from '@/lib/storefront-url'
import type { CustomLinkDetail } from '@/lib/types'
import { CloudflareImage } from '@/components/ui/cloudflare-image'

interface NewCustomLinkFormProps {
  initialPagination: PaginatedResponse<Product>
  categories: Category[]
  initialLink?: CustomLinkDetail | null
  initialSelectedProducts?: Product[]
}

type ProductSearchResponse = {
  success: boolean
  data?: PaginatedResponse<Product>
  error?: string
}

const ALL_CATEGORIES_VALUE = '__all_categories__'

type CategoryOption = {
  value: string
  label: string
}

type ReviewSort = 'custom' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'

export function NewCustomLinkForm({
  initialPagination,
  categories,
  initialLink = null,
  initialSelectedProducts = [],
}: NewCustomLinkFormProps) {
  const router = useRouter()
  const { storefrontUrl, store, session } = useAdminStore()
  const [linkName, setLinkName] = useState(initialLink?.link?.name ?? '')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedProducts, setSelectedProducts] = useState<string[]>(initialLink?.productIds ?? [])
  const [products, setProducts] = useState<Product[]>(initialPagination.items)
  const [pagination, setPagination] = useState<PaginatedResponse<Product>>(initialPagination)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState<'select' | 'review'>('select')
  const [isCreating, setIsCreating] = useState(false)
  const [showPrice, setShowPrice] = useState(initialLink?.link?.showPrice ?? true)
  const [applyToAllProducts, setApplyToAllProducts] = useState(initialLink?.link?.applyToAllProducts ?? false)
  const [priceFxActive, setPriceFxActive] = useState(false)
  const [reviewSort, setReviewSort] = useState<ReviewSort>('custom')
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null)
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorDialogMessage, setErrorDialogMessage] = useState('')
  const [selectedProductsMap, setSelectedProductsMap] = useState<Record<string, Product>>(() => {
    const entries = initialSelectedProducts.map((product) => [product.id, product] as const)
    return Object.fromEntries(entries)
  })
  const isEditMode = Boolean(initialLink?.link?.id)
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null
  const canSubmitCustomLink = permissionCodes === null
    || permissionCodes.includes(isEditMode ? 'custom_links.edit' : 'custom_links.create')
  const hasActiveFilters = search.trim().length > 0 || selectedCategory !== 'all'
  const selectionRequired = !applyToAllProducts
  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const seen = new Set<string>()
    const options: CategoryOption[] = [
      { value: ALL_CATEGORIES_VALUE, label: 'Todas categorias' },
    ]

    for (const category of categories) {
      const categoryId = String(category.id || '').trim()
      if (!categoryId || seen.has(categoryId)) {
        continue
      }

      seen.add(categoryId)
      options.push({
        value: categoryId,
        label: String(category.name || 'Sem nome').trim() || 'Sem nome',
      })
    }

    return options
  }, [categories])
  const categorySelectValue = useMemo(() => {
    if (selectedCategory === 'all') {
      return ALL_CATEGORIES_VALUE
    }

    return categoryOptions.some((option) => option.value === selectedCategory)
      ? selectedCategory
      : ALL_CATEGORIES_VALUE
  }, [categoryOptions, selectedCategory])
  const safeCategories = useMemo(() => {
    return categoryOptions
      .filter((option) => option.value !== ALL_CATEGORIES_VALUE)
      .map((option) => ({ id: option.value, name: option.label }))
  }, [categoryOptions])

  async function loadProducts(nextPage: number, nextSearch: string, nextCategory: string) {
    setIsLoadingProducts(true)
    setProductsError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(nextPage))
      params.set('limit', '24')
      params.set('isActive', 'true')

      const trimmedSearch = nextSearch.trim()
      if (trimmedSearch) {
        params.set('search', trimmedSearch)
      }

      if (nextCategory !== 'all') {
        params.set('categoryId', nextCategory)
      }

      const response = await fetch(`/api/products?${params.toString()}`, {
        cache: 'no-store',
      })

      const payload = (await response.json().catch(() => null)) as ProductSearchResponse | null

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || 'Erro ao carregar produtos')
      }

      setProducts(payload.data.items)
      setPagination(payload.data)
    } catch (error) {
      setProductsError(error instanceof Error ? error.message : 'Erro ao carregar produtos')
      setProducts([])
      setPagination((current) => ({
        ...current,
        items: [],
        total: 0,
        page: nextPage,
        pageSize: 24,
        totalPages: 1,
      }))
    } finally {
      setIsLoadingProducts(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProducts(1, search, selectedCategory)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [search, selectedCategory])

  useEffect(() => {
    if (!showPrice) {
      setPriceFxActive(false)
      return
    }

    setPriceFxActive(true)
    const timer = window.setTimeout(() => {
      setPriceFxActive(false)
    }, 260)

    return () => window.clearTimeout(timer)
  }, [showPrice])

  // Generate slug
  const slug = linkName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  const getCustomLinkPath = (value: string) => {
    return store?.maintenanceMode ? `/private/c/${value}` : `/c/${value}`
  }

  // Generate preview URL
  const previewPath = slug ? buildStorefrontUrl(storefrontUrl, getCustomLinkPath(slug)) : ''
  const previewUrl = previewPath

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts((previous) => {
      const isSelected = previous.includes(productId)

      if (isSelected) {
        setSelectedProductsMap((current) => {
          const next = { ...current }
          delete next[productId]
          return next
        })
        return previous.filter((id) => id !== productId)
      }

      const selectedProduct = products.find((product) => product.id === productId)
      if (selectedProduct) {
        setSelectedProductsMap((current) => ({
          ...current,
          [productId]: selectedProduct,
        }))
      }

      return [...previous, productId]
    })
  }

  const handleSelectAll = () => {
    const currentPageIds = products.map((product) => product.id)
    const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedProducts.includes(id))

    if (allCurrentPageSelected) {
      setSelectedProducts((previous) => previous.filter((id) => !currentPageIds.includes(id)))
      setSelectedProductsMap((current) => {
        const next = { ...current }
        for (const productId of currentPageIds) {
          delete next[productId]
        }
        return next
      })
    } else {
      setSelectedProducts((previous) => Array.from(new Set([...previous, ...currentPageIds])))
      setSelectedProductsMap((current) => {
        const next = { ...current }
        for (const product of products) {
          next[product.id] = product
        }
        return next
      })
    }
  }

  const handleClearFilters = () => {
    setSearch('')
    setSelectedCategory('all')
  }

  const copyToClipboard = () => {
    if (slug) {
      const absolutePreviewUrl = buildStorefrontUrl(
        storefrontUrl,
        getCustomLinkPath(slug),
        typeof window !== 'undefined' ? window.location.origin : undefined,
      )
      navigator.clipboard.writeText(absolutePreviewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCreateLink = async () => {
    if (!canSubmitCustomLink) {
      setErrorDialogMessage(isEditMode
        ? 'Você não tem permissão para editar links personalizados'
        : 'Você não tem permissão para criar links personalizados')
      setErrorDialogOpen(true)
      return
    }

    setIsCreating(true)
    const payload = {
      name: linkName,
      slug,
      productIds: applyToAllProducts ? [] : selectedProducts,
      isActive: true,
      showPrice,
      applyToAllProducts,
    }

    const result = isEditMode && initialLink?.link?.id
      ? await updateCustomLinkAction(initialLink.link.id, payload)
      : await createCustomLinkAction(payload)

    if (!result.success) {
      setIsCreating(false)
      setErrorDialogMessage(result.error || 'Não foi possível salvar o link personalizado.')
      setErrorDialogOpen(true)
      return
    }

    router.push('/custom-links')
  }

  const handleProceedFromSelect = () => {
    if (applyToAllProducts) {
      void handleCreateLink()
      return
    }

    setStep('review')
  }

  const pageStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const pageEnd = pagination.total === 0 ? 0 : pageStart + Math.max(0, products.length - 1)
  const selectedProductsData = useMemo(() => {
    return selectedProducts
      .map((productId) => selectedProductsMap[productId])
      .filter((product): product is Product => Boolean(product))
  }, [selectedProducts, selectedProductsMap])

  const getProductCategoryLabel = (product: Product): string => {
    const byId = safeCategories.find((category) => category.id === product.categoryId)?.name
    if (byId) return byId

    const byPayload = String((product as Product & { categoryName?: unknown }).categoryName ?? '').trim()
    if (byPayload.length > 0) return byPayload

    return 'Sem categoria'
  }

  const handleReviewSortChange = (value: ReviewSort) => {
    setReviewSort(value)

    if (value === 'custom') {
      return
    }

    setSelectedProducts((previous) => {
      const next = [...previous]

      next.sort((idA, idB) => {
        const productA = selectedProductsMap[idA]
        const productB = selectedProductsMap[idB]

        if (!productA && !productB) {
          return 0
        }

        if (!productA) {
          return 1
        }

        if (!productB) {
          return -1
        }

        switch (value) {
          case 'name-asc':
            return productA.name.localeCompare(productB.name, 'pt-BR')
          case 'name-desc':
            return productB.name.localeCompare(productA.name, 'pt-BR')
          case 'price-asc':
            return productA.basePrice - productB.basePrice
          case 'price-desc':
            return productB.basePrice - productA.basePrice
          default:
            return 0
        }
      })

      return next
    })
  }

  const handleReviewDragStart = (event: React.DragEvent<HTMLDivElement>, productId: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', productId)
    setDraggedProductId(productId)
    setDragOverProductId(productId)
  }

  const handleReviewDragOver = (event: React.DragEvent<HTMLDivElement>, productId: string) => {
    event.preventDefault()
    if (dragOverProductId !== productId) {
      setDragOverProductId(productId)
    }
  }

  const handleReviewDrop = (targetProductId: string) => {
    if (!draggedProductId || draggedProductId === targetProductId) {
      setDraggedProductId(null)
      setDragOverProductId(null)
      return
    }

    setSelectedProducts((previous) => {
      const next = [...previous]
      const fromIndex = next.indexOf(draggedProductId)
      const toIndex = next.indexOf(targetProductId)

      if (fromIndex === -1 || toIndex === -1) {
        return previous
      }

      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })

    setReviewSort('custom')

    setDraggedProductId(null)
    setDragOverProductId(null)
  }

  const handleReviewDragEnd = () => {
    setDraggedProductId(null)
    setDragOverProductId(null)
  }

  if (step === 'select') {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Erro</DialogTitle>
              <DialogDescription>{errorDialogMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => setErrorDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/custom-links">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{isEditMode ? 'Editar Link Personalizado' : 'Novo Link Personalizado'}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {applyToAllProducts
                ? 'Etapa unica: Link para todos os produtos'
                : 'Etapa 1 de 2: Selecione os Produtos'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Sidebar com nome do link */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <Card className="lg:sticky lg:top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumo do Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Link</Label>
                  <Input
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="Ex: Coleção Verão"
                  />
                  {slug && (
                    <p className="text-xs text-muted-foreground break-all">
                      slug: <code className="bg-muted px-1.5 py-0.5 rounded">{slug}</code>
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Produtos</span>
                    <span className="font-semibold">{applyToAllProducts ? 'Todos' : selectedProducts.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <div>
                      <p className="text-sm font-medium">Mostrar preco</p>
                      <p className="text-xs text-muted-foreground">Controla exibicao de preco no link publico</p>
                    </div>
                    <Switch checked={showPrice} onCheckedChange={setShowPrice} />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <div>
                      <p className="text-sm font-medium">Todos os produtos</p>
                      <p className="text-xs text-muted-foreground">Quando ativo, o link usa a mesma busca da tela geral de produtos</p>
                    </div>
                    <Switch checked={applyToAllProducts} onCheckedChange={setApplyToAllProducts} />
                  </div>
                </div>

                <Button
                  onClick={handleProceedFromSelect}
                  disabled={!canSubmitCustomLink || isCreating || !linkName || (selectionRequired && selectedProducts.length === 0)}
                  className="w-full"
                >
                  {isCreating
                    ? (isEditMode ? 'Salvando...' : 'Criando...')
                    : (applyToAllProducts
                      ? (isEditMode ? 'Salvar Alterações' : 'Criar Link')
                      : 'Próximo')}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main content - Products grid */}
          <div className="lg:col-span-3 space-y-4 order-1 lg:order-2">
            {applyToAllProducts ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold uppercase tracking-wide">Nota importante</p>
                        <p className="text-sm leading-relaxed">
                          Ao ativar "Todos os produtos", este link vai mostrar automaticamente todo o catalogo da sua loja. Voce nao precisa escolher produto por produto.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Filtros */}
                <Card>
                  <CardContent className="pt-4 sm:pt-6 space-y-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 border rounded-md px-3 flex-1 min-w-0">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          placeholder="Buscar por nome ou SKU..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                        />
                      </div>

                      {categorySelectValue ? (
                        <Select
                          value={categorySelectValue}
                          onValueChange={(value) => setSelectedCategory(value === ALL_CATEGORIES_VALUE ? 'all' : value)}
                        >
                          <SelectTrigger className="w-40 sm:w-48 shrink-0">
                            <SelectValue placeholder="Todas categorias" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleClearFilters}
                        disabled={!hasActiveFilters}
                        title="Limpar busca e categoria"
                        aria-label="Limpar busca e categoria"
                        className="shrink-0"
                      >
                        <FilterX className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        disabled={products.length === 0}
                        className="shrink-0"
                      >
                        {products.length > 0 && products.every((product) => selectedProducts.includes(product.id))
                          ? 'Desselecionar'
                          : 'Selecionar Tudo'}
                      </Button>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Mostrando {pageStart}-{pageEnd} de {pagination.total} produto{pagination.total !== 1 ? 's' : ''}
                      {selectedProducts.length > 0 && ` • ${selectedProducts.length} selecionado${selectedProducts.length !== 1 ? 's' : ''}`}
                    </p>
                    {productsError && (
                      <p className="text-sm text-destructive">{productsError}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Products Grid */}
                <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {products.map(product => {
                    const isSelected = selectedProducts.includes(product.id)
                    return (
                      <Card
                        key={product.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isSelected ? 'ring-2 ring-primary shadow-md' : ''
                        }`}
                        onClick={() => handleToggleProduct(product.id)}
                      >
                        <CardContent className="p-2 sm:p-3">
                          <div className="relative mb-2 sm:mb-3">
                            {product.images && product.images.length > 0 ? (
                              <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted">
                                <CloudflareImage
                                  src={product.images[0]}
                                  cloudflare={{ width: 480, fit: 'cover', dpr: 2 }}
                                  alt={product.name}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                />
                              </div>
                            ) : (
                              <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                              <div className={`h-5 w-5 sm:h-6 sm:w-6 rounded border-2 flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'bg-primary border-primary'
                                  : 'border-muted-foreground/50 bg-background/80 backdrop-blur-sm'
                              }`}>
                                {isSelected && (
                                  <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
                                )}
                              </div>
                            </div>
                          </div>
                          <h3 className="font-semibold text-xs sm:text-sm line-clamp-2">{product.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{product.sku}</p>
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant="secondary" className="text-xs truncate max-w-20">
                              {getProductCategoryLabel(product)}
                            </Badge>
                            <p
                              className={`font-semibold text-xs sm:text-sm transition-all duration-200 ${
                                showPrice ? 'opacity-100 blur-0' : 'opacity-45 blur-[0.5px]'
                              } ${showPrice && priceFxActive ? 'scale-[1.02]' : 'scale-100'}`}
                            >
                              {formatCurrency(product.basePrice)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {isLoadingProducts && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    Carregando produtos...
                  </div>
                )}

                {products.length === 0 && !isLoadingProducts && (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum produto encontrado</p>
                  </div>
                )}

                {pagination.totalPages > 1 && (
                  <AdminPaginationControls
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={(page) => loadProducts(page, search, selectedCategory)}
                    showing={{
                      start: pageStart,
                      end: pageEnd,
                      total: pagination.total,
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Review
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Erro</DialogTitle>
            <DialogDescription>{errorDialogMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setErrorDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setStep('select')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{isEditMode ? 'Editar Link Personalizado' : 'Novo Link Personalizado'}</h1>
          <p className="text-muted-foreground text-sm mt-1">Etapa 2 de 2: Resumo</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{linkName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Link do Catálogo</p>
                <div className="flex items-center gap-1 bg-muted p-2 rounded text-xs break-all">
                  <code className="flex-1">{previewPath}</code>
                  <button
                    onClick={copyToClipboard}
                    className="shrink-0 p-1 cursor-pointer"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 cursor-pointer hover:text-primary" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de Produtos</span>
                  <span className="font-semibold">{applyToAllProducts ? 'Todos os produtos' : selectedProducts.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Exibir preco</span>
                  <span className="font-semibold">{showPrice ? 'Sim' : 'Nao'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Usar catalogo geral</span>
                  <span className="font-semibold">{applyToAllProducts ? 'Sim' : 'Nao'}</span>
                </div>
              </div>

              <Button
                onClick={handleCreateLink}
                disabled={!canSubmitCustomLink || isCreating}
                className="w-full"
              >
                {isCreating ? (isEditMode ? 'Salvando...' : 'Criando...') : (isEditMode ? 'Salvar Alterações' : 'Criar Link')}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('select')}
                className="w-full"
              >
                Voltar
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main content - Product grid preview */}
        <div className="lg:col-span-3 order-1 lg:order-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                          <CardTitle>{applyToAllProducts ? 'Todos os produtos da vitrine' : `Produtos Selecionados (${selectedProducts.length})`}</CardTitle>
                          <CardDescription>
                            {applyToAllProducts
                              ? 'Este link vai carregar o catalogo geral da vitrine, com busca e ordenacao da tela padrao.'
                              : 'Arraste e solte para ordenar. Clique no X para remover.'}
                          </CardDescription>
              </div>
                        {!applyToAllProducts && (
                          <Select value={reviewSort} onValueChange={(value) => handleReviewSortChange(value as ReviewSort)}>
                            <SelectTrigger className="w-44 sm:w-52">
                              <SelectValue placeholder="Ordenar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">Personalizado</SelectItem>
                              <SelectItem value="name-asc">Nome A-Z</SelectItem>
                              <SelectItem value="name-desc">Nome Z-A</SelectItem>
                              <SelectItem value="price-asc">Menor preço</SelectItem>
                              <SelectItem value="price-desc">Maior preço</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
            </CardHeader>
            <CardContent>
                        {applyToAllProducts ? (
                          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                            O link publico vai reutilizar a mesma listagem de todos os produtos da vitrine. Os filtros, a busca e a ordenacao serao os da tela padrao.
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                            {selectedProductsData.map(product => (
                              <div
                                key={product.id}
                                draggable
                                onDragStart={(event) => handleReviewDragStart(event, product.id)}
                                onDragOver={(event) => handleReviewDragOver(event, product.id)}
                                onDrop={() => handleReviewDrop(product.id)}
                                onDragEnd={handleReviewDragEnd}
                                className={`relative rounded-lg border overflow-hidden hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing ${
                                  dragOverProductId === product.id && draggedProductId !== product.id
                                    ? 'ring-2 ring-primary/60'
                                    : ''
                                }`}
                              >
                                {product.images && product.images.length > 0 ? (
                                  <div className="relative w-full aspect-square bg-muted">
                                    <CloudflareImage
                                      src={product.images[0]}
                                      cloudflare={{ width: 480, fit: 'cover', dpr: 2 }}
                                      alt={product.name}
                                      fill
                                      draggable={false}
                                      className="object-cover"
                                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-full aspect-square bg-muted flex items-center justify-center">
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="p-2 sm:p-3 bg-background">
                                  <h3 className="font-semibold text-xs sm:text-sm line-clamp-2">{product.name}</h3>
                                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <Badge variant="secondary" className="text-xs truncate max-w-20">
                                      {getProductCategoryLabel(product)}
                                    </Badge>
                                    <p
                                      className={`font-semibold text-xs transition-all duration-200 ${
                                        showPrice ? 'opacity-100 blur-0' : 'opacity-45 blur-[0.5px]'
                                      } ${showPrice && priceFxActive ? 'scale-[1.02]' : 'scale-100'}`}
                                    >
                                      {formatCurrency(product.basePrice)}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(event) => {
                                    event.preventDefault()
                                    handleToggleProduct(product.id)
                                  }}
                                  className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 h-6 w-6 rounded-full bg-background/90 border border-destructive hover:bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
