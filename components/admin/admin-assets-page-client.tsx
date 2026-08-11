"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import AdminPaginationControls from "@/components/admin/admin-pagination-controls"
import { AssetForm } from "@/components/admin/asset-form"
import { createAssetAction, deleteAssetAction, updateAssetAction } from "@/lib/actions/assets"
import { CloudflareImage } from "@/components/ui/cloudflare-image"
import type { Attribute } from "@/lib/actions/attributes"
import type { Asset, Category } from "@/lib/types"
import { usePaginationMeta } from "@/hooks/use-paginated-list"
import { FilterX, MoreHorizontal, Palette, Pencil, Plus, Trash2, X, ImageIcon, Search } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { useAdminStore } from "@/contexts/admin-store-context"

type ProductOption = {
  id: string
  name: string
  code?: string
}

interface AdminAssetsPageClientProps {
  initialAssets: Asset[]
  summary: {
    assets: number
    skus: number
    images: number
  }
  total: number
  currentPage: number
  pageSize: number
  initialPagination?: {
    total: number
    page: number
    limit: number
    search: string
    category: string
    product: string
  }
  products: ProductOption[]
  attributes: Attribute[]
  categories: Category[]
  storeId: number | null
}

export default function AdminAssetsPageClient({
  initialAssets,
  summary,
  total,
  currentPage,
  pageSize,
  initialPagination,
  products,
  attributes,
  categories,
  storeId,
}: AdminAssetsPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { session } = useAdminStore()
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [globalSummary, setGlobalSummary] = useState(summary)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [searchQuery, setSearchQuery] = useState(initialPagination?.search ?? "")
  const [selectedCategory, setSelectedCategory] = useState(initialPagination?.category ?? "all")
  const [selectedProduct, setSelectedProduct] = useState(initialPagination?.product ?? "all")
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null
  const canCreateAssets = permissionCodes === null || permissionCodes.includes('assets.create')
  const canEditAssets = permissionCodes === null || permissionCodes.includes('assets.edit')
  const canDeleteAssets = permissionCodes === null || permissionCodes.includes('assets.delete')

  useEffect(() => {
    setAssets(initialAssets)
  }, [initialAssets])

  useEffect(() => {
    setGlobalSummary(summary)
  }, [summary])

  useEffect(() => {
    setSearchQuery(initialPagination?.search ?? "")
  }, [initialPagination?.search])

  useEffect(() => {
    setSelectedCategory(initialPagination?.category ?? "all")
    setSelectedProduct(initialPagination?.product ?? "all")
  }, [initialPagination?.category, initialPagination?.product])

  const stats = globalSummary

  function openCreate() {
    if (!canCreateAssets) {
      toast.error("Você não tem permissão para criar assets")
      return
    }

    setEditingAsset(null)
    setIsSheetOpen(true)
  }

  function openEdit(asset: Asset) {
    if (!canEditAssets) {
      toast.error("Você não tem permissão para editar assets")
      return
    }

    setEditingAsset(asset)
    setIsSheetOpen(true)
  }

  function closeSheet() {
    setIsSheetOpen(false)
    setEditingAsset(null)
  }

  async function handleRefreshAttributes() {
    router.refresh()
  }

  async function handleSubmit(formData: FormData) {
    if (editingAsset && !canEditAssets) {
      toast.error("Você não tem permissão para editar assets")
      return
    }
    if (!editingAsset && !canCreateAssets) {
      toast.error("Você não tem permissão para criar assets")
      return
    }

    const result = editingAsset
      ? await updateAssetAction(editingAsset.id, formData)
      : await createAssetAction(formData)

    if (!result.success) {
      toast.error(result.error || "Falha ao salvar obra")
      return
    }

    toast.success(editingAsset ? "Obra atualizada com sucesso" : "Obra criada com sucesso")
    closeSheet()
    router.refresh()
  }

  async function handleDelete(assetId: string) {
    if (!canDeleteAssets) {
      toast.error("Você não tem permissão para excluir assets")
      return
    }

    const confirmed = window.confirm("Deseja excluir esta obra? Esta ação não pode ser desfeita.")
    if (!confirmed) return

    const assetToDelete = assets.find((asset) => asset.id === assetId)

    const result = await deleteAssetAction(assetId)
    if (!result.success) {
      toast.error(result.error || "Falha ao excluir obra")
      return
    }

    setAssets((prev) => prev.filter((asset) => asset.id !== assetId))
    if (assetToDelete) {
      const removedSkus = assetToDelete.skuGroups.length
      const removedImages = assetToDelete.skuGroups.reduce((sum, group) => sum + group.images.length, 0)
      setGlobalSummary((prev) => ({
        assets: Math.max(0, prev.assets - 1),
        skus: Math.max(0, prev.skus - removedSkus),
        images: Math.max(0, prev.images - removedImages),
      }))
    }

    // Garante consistência com total/paginação e resumo global do servidor.
    router.refresh()
    toast.success("Obra excluída com sucesso")
  }

  const productById = useMemo(() => {
    const map = new Map<string, ProductOption>()
    for (const product of products) {
      map.set(product.id, product)
    }
    return map
  }, [products])

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedCategory !== "all" || selectedProduct !== "all"

  const totalItems = Math.max(0, initialPagination?.total ?? total)
  const { totalPages, safeCurrentPage, pageStart, pageEnd } = usePaginationMeta({
    currentPage: Math.max(1, initialPagination?.page ?? currentPage),
    pageSize,
    totalItems,
    currentPageItemCount: assets.length,
  })

  function navigateWithParams(nextPage: number, nextSearch: string, nextCategory: string, nextProduct: string) {
    const params = new URLSearchParams()
    if (nextPage > 1) {
      params.set('page', String(nextPage))
    }
    if (nextSearch.trim().length > 0) {
      params.set('q', nextSearch.trim())
    }
    if (nextCategory !== 'all') {
      params.set('category', nextCategory)
    }
    if (nextProduct !== 'all') {
      params.set('product', nextProduct)
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  useEffect(() => {
    const currentSearch = (initialPagination?.search ?? '').trim()
    const nextSearch = searchQuery.trim()

    if (nextSearch === currentSearch) {
      return
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (nextSearch.length > 0) {
        params.set('q', nextSearch)
      }
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory)
      }
      if (selectedProduct !== 'all') {
        params.set('product', selectedProduct)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    }, 400)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedCategory, selectedProduct, initialPagination?.search, pathname, router])

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Assets
            </h1>
            <p className="text-sm text-muted-foreground">CRUD de obras e imagens por SKU de atributos</p>
          </div>
          {canCreateAssets ? (
            <SheetTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Assets
              </Button>
            </SheetTrigger>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border/20 bg-card p-4">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Obras</p>
            <p className="mt-2 text-xl font-medium leading-none">{stats.assets}</p>
          </div>
          <div className="rounded-xl border border-border/20 bg-card p-4">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">SKUs</p>
            <p className="mt-2 text-xl font-medium leading-none">{stats.skus}</p>
          </div>
          <div className="rounded-xl border border-border/20 bg-card p-4">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Imagens</p>
            <p className="mt-2 text-xl font-medium leading-none">{stats.images}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/20 bg-card p-3">
          <div className="flex w-full flex-col items-stretch gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={selectedCategory}
              onValueChange={(value) => {
                setSelectedCategory(value)
                navigateWithParams(1, searchQuery, value, selectedProduct)
              }}
            >
              <SelectTrigger className="w-full lg:w-60">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedProduct}
              onValueChange={(value) => {
                setSelectedProduct(value)
                navigateWithParams(1, searchQuery, selectedCategory, value)
              }}
            >
              <SelectTrigger className="w-full lg:w-60">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              className="cursor-pointer lg:w-auto"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("all")
                setSelectedProduct("all")
                navigateWithParams(1, "", "all", "all")
              }}
              disabled={!hasActiveFilters}
            >
              <FilterX className="mr-2 h-4 w-4" />
              Remover filtros
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border/20 bg-card shadow-none overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20">
                <TableHead className="w-14" />
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Código</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Título</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Categoria</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Produto</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">SKUs</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Imagens</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {hasActiveFilters ? "Nenhuma obra encontrada com esses critérios" : "Nenhuma obra cadastrada"}
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset) => {
                  const imageCount = asset.skuGroups.reduce((sum, group) => sum + group.images.length, 0)
                  const product = productById.get(asset.productId)

                  // Imagem de destaque: primeiro grupo destacado com imagem, senão primeiro grupo com imagem
                  const highlightedKeys = new Set(asset.meta?.highlightedVariantGroups ?? [])
                  const highlightedGroup = asset.skuGroups.find(
                    (g) => highlightedKeys.has(g.combinationKey ?? "") && g.images.length > 0,
                  )
                  const thumbGroup = highlightedGroup ?? asset.skuGroups.find((g) => g.images.length > 0)
                  const thumbUrl = thumbGroup?.images[0] ?? null

                  // Categoria: pega o nome da primeira categoria do asset
                  const firstCategoryId = Array.isArray(asset.categoryIds) ? asset.categoryIds[0] : undefined
                  const categoryName = firstCategoryId
                    ? (categories.find((c) => c.id === firstCategoryId)?.name ?? "-")
                    : "-"

                  return (
                    <TableRow key={asset.id} className="border-border/20 hover:bg-muted/40">
                      <TableCell>
                        <div className="h-12 w-10 rounded-lg border border-border/20 bg-muted/40 flex items-center justify-center overflow-hidden relative">
                          {thumbUrl ? (
                            <CloudflareImage
                              src={thumbUrl}
                              cloudflare={{ width: 40, height: 48, fit: "cover", dpr: 2 }}
                              alt={asset.title ?? asset.code}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{asset.code}</TableCell>
                      <TableCell>{asset.title || "-"}</TableCell>
                      <TableCell>{categoryName}</TableCell>
                      <TableCell>{product?.name || asset.productName || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{asset.skuGroups.length}</Badge>
                      </TableCell>
                      <TableCell>{imageCount}</TableCell>
                      <TableCell>
                        {canEditAssets || canDeleteAssets ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEditAssets ? (
                                <DropdownMenuItem onClick={() => openEdit(asset)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                              ) : null}
                              {canDeleteAssets ? (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(asset.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalItems > 0 && (
          <AdminPaginationControls
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={(page) => navigateWithParams(page, searchQuery, selectedCategory, selectedProduct)}
            showing={{ start: pageStart, end: pageEnd, total: totalItems }}
          />
        )}

        <SheetContent
          className="w-full sm:w-[75vw] sm:max-w-none overflow-y-auto p-0 flex flex-col [&>button]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="flex-1 flex flex-col p-6">
            <SheetHeader className="p-0 mb-6">
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="text-base font-semibold">{editingAsset ? "Editar Assets" : "Novo Assets"}</SheetTitle>
                <SheetClose asChild>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
            </SheetHeader>

            <AssetForm
              asset={editingAsset || undefined}
              products={products}
              attributes={attributes}
              categories={categories}
              storeId={storeId}
              onSubmit={handleSubmit}
              onCancel={closeSheet}
              onRefreshAttributes={handleRefreshAttributes}
            />
          </div>
        </SheetContent>
      </div>
    </Sheet>
  )
}
