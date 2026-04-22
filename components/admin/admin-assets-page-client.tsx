"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import type { Attribute } from "@/lib/actions/attributes"
import type { Asset, Category } from "@/lib/types"
import { usePaginationMeta } from "@/hooks/use-paginated-list"
import { MoreHorizontal, Palette, Pencil, Plus, Trash2, X, ImageIcon } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

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
  products,
  attributes,
  categories,
  storeId,
}: AdminAssetsPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [globalSummary, setGlobalSummary] = useState(summary)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)

  useEffect(() => {
    setAssets(initialAssets)
  }, [initialAssets])

  useEffect(() => {
    setGlobalSummary(summary)
  }, [summary])

  const stats = globalSummary

  function openCreate() {
    setEditingAsset(null)
    setIsSheetOpen(true)
  }

  function openEdit(asset: Asset) {
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

  const totalItems = Math.max(0, total)
  const { totalPages, safeCurrentPage, pageStart, pageEnd } = usePaginationMeta({
    currentPage,
    pageSize,
    totalItems,
    currentPageItemCount: assets.length,
  })

  function goToPage(page: number) {
    const targetPage = Math.min(Math.max(1, page), totalPages)
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (targetPage <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(targetPage))
    }

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

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
          <SheetTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Assets
            </Button>
          </SheetTrigger>
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
                    Nenhuma obra cadastrada
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
                            <Image
                              src={thumbUrl}
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(asset)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(asset.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
            onPageChange={goToPage}
            showing={{ start: pageStart, end: pageEnd, total: totalItems }}
          />
        )}

        <SheetContent className="w-full sm:w-[75vw] sm:max-w-none overflow-y-auto p-0 flex flex-col [&>button]:hidden">
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
