"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import IntegerInput from "@/components/form/IntegerInput"
import { CloudflareImage } from "@/components/ui/cloudflare-image"
import { formatCurrency } from "@/lib/pricing"
import {
  getOrderProductVariantsCatalogAction,
  getStoreProductsPageAction,
  getStoreProductWithVariantsAction,
} from "@/lib/actions/products"
import type { Product, ProductVariant } from "@/lib/types"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Minus,
  Package,
  Plus,
  ScanLine,
  Search,
  X,
} from "lucide-react"
import { toast } from "sonner"

const PRODUCTS_PAGE_SIZE = 30

type BarcodeScanResultItem = {
  id: number
  code: string
  status: "success" | "error"
  message: string
}

export type AssistedOrderVariantSelection = {
  variantId: string
  quantity: number
  unitPrice: number
}

export type AssistedOrderProductCatalogProps = {
  className?: string
  disabled?: boolean
  addButtonLabel?: string
  matrixDialogClassName?: string
  getVariantMaxQuantity?: (variant: ProductVariant, product: Product) => number
  onAddVariants: (payload: {
    product: Product
    items: AssistedOrderVariantSelection[]
  }) => Promise<boolean>
  onBarcodeScan: (payload: {
    product: Product
    variant: ProductVariant
  }) => Promise<boolean>
  onVariantsAdded?: () => void
}

function normalizeBarcodeCode(value: string): string {
  return String(value || "").trim().toLowerCase()
}

function findVariantByBarcodeCode(variants: ProductVariant[], normalizedCode: string): ProductVariant | null {
  for (const variant of variants) {
    const barcodeCode = normalizeBarcodeCode(variant.barcode || "")
    const skuCode = normalizeBarcodeCode(variant.variantSku || "")
    if ((barcodeCode && barcodeCode === normalizedCode) || (skuCode && skuCode === normalizedCode)) {
      return variant
    }
  }
  return null
}

export function AssistedOrderProductCatalog({
  className = "",
  disabled = false,
  addButtonLabel = "Adicionar ao Pedido",
  matrixDialogClassName = "flex h-screen max-h-screen w-screen! max-w-screen! flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[90vh] sm:w-[85vw]! sm:max-w-[85vw]!",
  getVariantMaxQuantity,
  onAddVariants,
  onBarcodeScan,
  onVariantsAdded,
}: AssistedOrderProductCatalogProps) {
  const [isPending, startTransition] = useTransition()
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [isLoadingMoreProducts, setIsLoadingMoreProducts] = useState(false)
  const [productsPage, setProductsPage] = useState(1)
  const [hasMoreProducts, setHasMoreProducts] = useState(true)
  const productsScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const productsLoadMoreRef = useRef<HTMLDivElement | null>(null)
  const productsRequestSeqRef = useRef(0)

  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState("")
  const [isScanningBarcode, setIsScanningBarcode] = useState(false)
  const [barcodeScanResults, setBarcodeScanResults] = useState<BarcodeScanResultItem[]>([])
  const barcodeInputRef = useRef<HTMLInputElement | null>(null)
  const variantLookupCacheRef = useRef<Map<string, { product: Product; variants: ProductVariant[] }>>(new Map())
  const barcodeScanSeqRef = useRef(0)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isLoadingVariants, setIsLoadingVariants] = useState(false)
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([])
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>({})
  const [collapsedVariantColors, setCollapsedVariantColors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const timeout = setTimeout(() => {
      setProductSearchTerm(productSearch.trim())
    }, 300)
    return () => clearTimeout(timeout)
  }, [productSearch])

  useEffect(() => {
    void loadProductsPage(1, { replace: true, search: productSearchTerm })
  }, [productSearchTerm])

  useEffect(() => {
    const root = productsScrollContainerRef.current
    const sentinel = productsLoadMoreRef.current
    if (!root || !sentinel || !hasMoreProducts || isLoadingProducts || isLoadingMoreProducts) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        void loadProductsPage(productsPage + 1, { replace: false, search: productSearchTerm })
      },
      { root, rootMargin: "240px 0px", threshold: 0.01 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMoreProducts, isLoadingProducts, isLoadingMoreProducts, productSearchTerm, productsPage])

  useEffect(() => {
    if (!isBarcodeModalOpen) return
    const timer = setTimeout(() => focusBarcodeInput(), 60)
    return () => clearTimeout(timer)
  }, [isBarcodeModalOpen])

  function focusBarcodeInput() {
    requestAnimationFrame(() => {
      barcodeInputRef.current?.focus({ preventScroll: true })
    })
    setTimeout(() => {
      barcodeInputRef.current?.focus({ preventScroll: true })
    }, 80)
  }

  async function loadProductsPage(page: number, options?: { replace?: boolean; search?: string }) {
    const replace = Boolean(options?.replace)
    const search = (options?.search ?? productSearchTerm).trim()
    const requestSeq = ++productsRequestSeqRef.current

    if (replace) {
      setIsLoadingProducts(true)
      setProductsPage(1)
      setHasMoreProducts(true)
      setProducts([])
    } else {
      setIsLoadingMoreProducts(true)
    }

    const result = await getStoreProductsPageAction({
      page,
      limit: PRODUCTS_PAGE_SIZE,
      isActive: true,
      search: search || undefined,
    })

    if (requestSeq !== productsRequestSeqRef.current) {
      return
    }

    if (result.success && result.data) {
      const nextItems = result.data.items || []
      const totalPages = Math.max(1, Number(result.data.total_pages || 1))

      setProducts((prev) => {
        if (replace) return nextItems
        const seen = new Set(prev.map((item) => String(item.id)))
        const merged = [...prev]
        for (const item of nextItems) {
          const key = String(item.id)
          if (!seen.has(key)) {
            merged.push(item)
            seen.add(key)
          }
        }
        return merged
      })

      setProductsPage(page)
      setHasMoreProducts(page < totalPages && nextItems.length > 0)
    } else if (replace) {
      setProducts([])
      setHasMoreProducts(false)
      if (result.error) toast.error(result.error)
    }

    if (replace) {
      setIsLoadingProducts(false)
    } else {
      setIsLoadingMoreProducts(false)
    }
  }

  async function loadVariantsForLookup(product: Product): Promise<ProductVariant[]> {
    const cacheKey = String(product.id)
    const cached = variantLookupCacheRef.current.get(cacheKey)
    if (cached) return cached.variants

    const result = await getStoreProductWithVariantsAction(String(product.id))
    if (!result.success || !result.data) {
      variantLookupCacheRef.current.set(cacheKey, { product, variants: [] })
      return []
    }

    const variants = Array.isArray(result.data.variants) ? result.data.variants : []
    variantLookupCacheRef.current.set(cacheKey, { product: result.data, variants })
    return variants
  }

  async function handleSelectProduct(product: Product) {
    setSelectedProduct(product)
    setIsLoadingVariants(true)
    setVariantQuantities({})
    setCollapsedVariantColors({})

    const result = await getStoreProductWithVariantsAction(product.id)
    if (result.success && result.data) {
      setProductVariants(result.data.variants || [])
    } else {
      setProductVariants([])
    }
    setIsLoadingVariants(false)
  }

  const variantsByColor = useMemo(() => {
    const grouped: Record<string, ProductVariant[]> = {}
    productVariants.forEach((variant) => {
      if (!grouped[variant.color]) grouped[variant.color] = []
      grouped[variant.color].push(variant)
    })
    return grouped
  }, [productVariants])

  const variantColorEntries = useMemo(() => {
    return Object.entries(variantsByColor)
      .sort(([colorA], [colorB]) => colorA.localeCompare(colorB))
      .map(([color, variants]) => [
        color,
        [...variants].sort((a, b) => String(a.size || "").localeCompare(String(b.size || ""))),
      ] as const)
  }, [variantsByColor])

  const allVariantColorGroupKeys = useMemo(() => {
    if (!selectedProduct) return []
    return variantColorEntries.map(([color]) => `${selectedProduct.id}:${color}`)
  }, [variantColorEntries, selectedProduct])

  const areAllVariantColorsCollapsed = useMemo(() => {
    return (
      allVariantColorGroupKeys.length > 0 &&
      allVariantColorGroupKeys.every((key) => Boolean(collapsedVariantColors[key]))
    )
  }, [allVariantColorGroupKeys, collapsedVariantColors])

  function toggleAllVariantColorGroups() {
    if (!selectedProduct || allVariantColorGroupKeys.length === 0) return
    const shouldCollapseAll = !areAllVariantColorsCollapsed
    setCollapsedVariantColors((prev) => {
      const next = { ...prev }
      for (const key of allVariantColorGroupKeys) {
        next[key] = shouldCollapseAll
      }
      return next
    })
  }

  function resolveMaxQuantity(variant: ProductVariant, product: Product): number {
    if (getVariantMaxQuantity) {
      return Math.max(0, Math.trunc(getVariantMaxQuantity(variant, product)))
    }
    return Math.max(0, Math.trunc(Number(variant.stock || 0)))
  }

  function setVariantQuantity(variant: ProductVariant, value: number) {
    if (!selectedProduct) return
    const maxQty = resolveMaxQuantity(variant, selectedProduct)
    setVariantQuantities((prev) => ({
      ...prev,
      [variant.id]: Math.min(maxQty, Math.max(0, Math.trunc(Number(value) || 0))),
    }))
  }

  function incrementVariantQuantity(variant: ProductVariant) {
    const currentQty = Number(variantQuantities[variant.id] || 0)
    setVariantQuantity(variant, currentQty + 1)
  }

  function decrementVariantQuantity(variant: ProductVariant) {
    const currentQty = Number(variantQuantities[variant.id] || 0)
    setVariantQuantity(variant, currentQty - 1)
  }

  function appendBarcodeScanResult(item: Omit<BarcodeScanResultItem, "id">) {
    const nextId = ++barcodeScanSeqRef.current
    setBarcodeScanResults((prev) => [{ ...item, id: nextId }, ...prev].slice(0, 12))
  }

  async function findVariantMatchForScan(
    rawCode: string,
    normalizedCode: string,
  ): Promise<{ product: Product; variant: ProductVariant } | null> {
    for (const cachedEntry of variantLookupCacheRef.current.values()) {
      const matchedVariant = findVariantByBarcodeCode(cachedEntry.variants, normalizedCode)
      if (matchedVariant) {
        return { product: cachedEntry.product, variant: matchedVariant }
      }
    }

    const catalogCandidatesResult = await getOrderProductVariantsCatalogAction(rawCode)
    const catalogCandidateProductIds = catalogCandidatesResult.success && catalogCandidatesResult.data
      ? Array.from(new Set(catalogCandidatesResult.data.map((item) => String(item.productId)).filter(Boolean)))
      : []

    for (const productId of catalogCandidateProductIds) {
      const detail = await getStoreProductWithVariantsAction(productId)
      if (!detail.success || !detail.data) continue
      const variants = Array.isArray(detail.data.variants) ? detail.data.variants : []
      variantLookupCacheRef.current.set(String(detail.data.id), { product: detail.data, variants })
      const matchedVariant = findVariantByBarcodeCode(variants, normalizedCode)
      if (matchedVariant) {
        return { product: detail.data, variant: matchedVariant }
      }
    }

    const searchedResult = await getStoreProductsPageAction({
      page: 1,
      limit: PRODUCTS_PAGE_SIZE,
      isActive: true,
      search: rawCode,
    })
    const searchedProducts = searchedResult.success && searchedResult.data
      ? (searchedResult.data.items || [])
      : []

    if (searchedProducts.length > 0) {
      setProducts((prev) => {
        const seen = new Set(prev.map((item) => String(item.id)))
        const merged = [...prev]
        for (const item of searchedProducts) {
          const key = String(item.id)
          if (!seen.has(key)) {
            merged.push(item)
            seen.add(key)
          }
        }
        return merged
      })
    }

    for (const product of searchedProducts) {
      const variants = await loadVariantsForLookup(product)
      const matchedVariant = findVariantByBarcodeCode(variants, normalizedCode)
      if (matchedVariant) {
        return { product, variant: matchedVariant }
      }
    }

    for (const product of products) {
      if (variantLookupCacheRef.current.has(String(product.id))) continue
      const variants = await loadVariantsForLookup(product)
      const matchedVariant = findVariantByBarcodeCode(variants, normalizedCode)
      if (matchedVariant) {
        return { product, variant: matchedVariant }
      }
    }

    return null
  }

  function handleBarcodeScanSubmit() {
    const rawCode = barcodeInput.trim()
    if (!rawCode || isScanningBarcode || disabled) return

    setIsScanningBarcode(true)
    setBarcodeInput("")

    startTransition(async () => {
      try {
        const normalizedCode = normalizeBarcodeCode(rawCode)
        if (!normalizedCode) return

        const match = await findVariantMatchForScan(rawCode, normalizedCode)
        if (!match) {
          const message = `Código não encontrado: ${rawCode}`
          appendBarcodeScanResult({ code: rawCode, status: "error", message })
          toast.error(message)
          return
        }

        const maxQty = resolveMaxQuantity(match.variant, match.product)
        if (maxQty <= 0) {
          const message = `Sem estoque: ${match.product.name} (${match.variant.variantSku || "sem SKU"})`
          appendBarcodeScanResult({ code: rawCode, status: "error", message })
          toast.error(message)
          return
        }

        const ok = await onBarcodeScan({ product: match.product, variant: match.variant })
        if (!ok) {
          appendBarcodeScanResult({ code: rawCode, status: "error", message: "Não foi possível adicionar o item" })
          return
        }

        const itemLabelParts = [match.product.name, match.variant.color, match.variant.size]
          .map((part) => String(part || "").trim())
          .filter(Boolean)

        const message = itemLabelParts.length > 0
          ? `Adicionado: ${itemLabelParts.join(" • ")}`
          : `Adicionado: ${match.product.name}`

        appendBarcodeScanResult({ code: rawCode, status: "success", message })
        toast.success(message)
        onVariantsAdded?.()
      } finally {
        setIsScanningBarcode(false)
        focusBarcodeInput()
      }
    })
  }

  function handleAddSelectedVariants() {
    if (!selectedProduct || disabled) return

    const items = Object.entries(variantQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([variantId, quantity]) => {
        const variant = productVariants.find((entry) => entry.id === variantId)
        const unitPrice = typeof variant?.priceOverride === "number"
          ? variant.priceOverride
          : selectedProduct.basePrice
        return { variantId, quantity, unitPrice }
      })

    if (items.length === 0) {
      toast.error("Selecione ao menos uma variante com quantidade")
      return
    }

    startTransition(async () => {
      const ok = await onAddVariants({ product: selectedProduct, items })
      if (!ok) return

      setVariantQuantities({})
      setSelectedProduct(null)
      setProductVariants([])
      setCollapsedVariantColors({})
      onVariantsAdded?.()
    })
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-4 ${className}`}>
      <div className="relative shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              className="pl-10 pr-10"
              disabled={disabled}
            />
            {productSearch ? (
              <button
                type="button"
                onClick={() => setProductSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsBarcodeModalOpen(true)}
            disabled={disabled}
            title="Bipar código de barras"
            className="shrink-0"
          >
            <ScanLine className="mr-2 h-4 w-4" />
            Bipar
          </Button>
        </div>
      </div>

      <div
        ref={productsScrollContainerRef}
        className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto content-start items-start auto-rows-max sm:grid-cols-3 lg:grid-cols-4"
      >
        {isLoadingProducts ? (
          Array.from({ length: 8 }).map((_, index) => (
            <div key={`product-skeleton-${index}`} className="rounded-lg border border-border p-3">
              <Skeleton className="mb-2 aspect-square w-full rounded-md" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="mt-2 h-3 w-2/5" />
              <Skeleton className="mt-2 h-4 w-1/3" />
            </div>
          ))
        ) : products.length === 0 ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>Nenhum produto encontrado</p>
          </div>
        ) : (
          <>
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                disabled={disabled || isPending}
                onClick={() => void handleSelectProduct(product)}
                className="rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-2 aspect-square overflow-hidden rounded-md bg-muted">
                  {product.images?.[0] ? (
                    <CloudflareImage
                      src={product.images[0]}
                      cloudflare={{ width: 300, height: 300, fit: "cover", dpr: 2 }}
                      alt={product.name}
                      width={300}
                      height={300}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.sku}</p>
                <p className="mt-1 text-sm font-semibold">{formatCurrency(product.basePrice)}</p>
              </button>
            ))}

            {isLoadingMoreProducts && (
              <div className="col-span-full grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`product-more-skeleton-${index}`} className="rounded-lg border border-border p-3">
                    <Skeleton className="mb-2 aspect-square w-full rounded-md" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ))}
              </div>
            )}

            {hasMoreProducts && (
              <div ref={productsLoadMoreRef} className="col-span-full h-2" aria-hidden="true" />
            )}
          </>
        )}
      </div>

      <Dialog
        open={isBarcodeModalOpen}
        onOpenChange={(open) => {
          setIsBarcodeModalOpen(open)
          if (!open) {
            setBarcodeInput("")
            setIsScanningBarcode(false)
          }
        }}
      >
        <DialogContent
          className="sm:max-w-xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            focusBarcodeInput()
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              Leitor de código de barras
            </DialogTitle>
            <DialogDescription>
              Bipar um item por vez. Cada leitura adiciona 1 unidade.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              handleBarcodeScanSubmit()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="assisted-barcode-scan-input">Código</Label>
              <Input
                id="assisted-barcode-scan-input"
                ref={barcodeInputRef}
                value={barcodeInput}
                onChange={(event) => setBarcodeInput(event.target.value)}
                placeholder="Ex.: 7891234567890"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={disabled}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={disabled || isScanningBarcode || !barcodeInput.trim()}
            >
              {isScanningBarcode ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando leitura
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </>
              )}
            </Button>
          </form>

          <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-2">
            {barcodeScanResults.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">Nenhuma leitura ainda.</p>
            ) : (
              barcodeScanResults.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 rounded-md border px-2 py-2 text-sm">
                  {entry.status === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.code}</p>
                    <p className="text-muted-foreground">{entry.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedProduct)}
        onOpenChange={(open) => {
          if (open) return
          setSelectedProduct(null)
          setProductVariants([])
          setVariantQuantities({})
          setCollapsedVariantColors({})
        }}
      >
        <DialogContent className={matrixDialogClassName}>
          {selectedProduct && (
            <div className="flex min-h-0 flex-1 flex-col">
              <DialogHeader className="border-b px-6 py-4">
                <DialogTitle className="text-base font-semibold">Selecionar Variantes</DialogTitle>
                <DialogDescription>
                  {selectedProduct.name} - {selectedProduct.sku}
                </DialogDescription>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-4 pb-32 sm:pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-md bg-muted">
                    {selectedProduct.images?.[0] ? (
                      <CloudflareImage
                        src={selectedProduct.images[0]}
                        cloudflare={{ width: 64, height: 64, fit: "cover", dpr: 2 }}
                        alt={selectedProduct.name}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{selectedProduct.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedProduct.sku}</p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                  <div className="sticky top-0 z-10 hidden gap-3 border-b bg-muted/95 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur md:grid md:grid-cols-[minmax(0,1.5fr)_80px_110px_112px] sm:px-4">
                    <div className="flex items-center gap-1">
                      <span>Variante</span>
                      <button
                        type="button"
                        onClick={toggleAllVariantColorGroups}
                        className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                        title={areAllVariantColorsCollapsed ? "Expandir tudo" : "Recolher tudo"}
                        aria-label={areAllVariantColorsCollapsed ? "Expandir tudo" : "Recolher tudo"}
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${areAllVariantColorsCollapsed ? "-rotate-90" : "rotate-0"}`}
                        />
                      </button>
                    </div>
                    <span>Estoque</span>
                    <span>Preço</span>
                    <span className="text-center">Quantidade</span>
                  </div>

                  {isLoadingVariants ? (
                    <div className="divide-y">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={`variant-skeleton-${index}`} className="px-3 py-3 sm:px-4">
                          <Skeleton className="h-5 w-28" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {variantColorEntries.map(([color, variants]) => {
                        const colorData = selectedProduct.colors?.find((entry) => entry.name === color)
                        const colorGroupKey = `${selectedProduct.id}:${color}`
                        const isCollapsed = Boolean(collapsedVariantColors[colorGroupKey])

                        return (
                          <div key={color} className="border-b last:border-b-0">
                            <button
                              type="button"
                              className="sticky top-0 z-[5] flex w-full items-center gap-2 border-b bg-muted/95 px-3 py-2 text-left text-sm font-medium backdrop-blur md:top-9 sm:px-4"
                              onClick={() =>
                                setCollapsedVariantColors((prev) => ({
                                  ...prev,
                                  [colorGroupKey]: !isCollapsed,
                                }))
                              }
                            >
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                              />
                              {colorData?.hex && (
                                <div
                                  className="h-4 w-4 shrink-0 rounded-full border"
                                  style={{ backgroundColor: colorData.hex }}
                                />
                              )}
                              <span>{color}</span>
                              <Badge variant="outline" className="ml-1">
                                {variants.length}
                              </Badge>
                            </button>

                            {!isCollapsed && (
                              <div className="divide-y">
                                {variants.map((variant) => {
                                  const maxQty = resolveMaxQuantity(variant, selectedProduct)
                                  const variantPrice = typeof variant.priceOverride === "number"
                                    ? variant.priceOverride
                                    : selectedProduct.basePrice

                                  return (
                                    <div
                                      key={variant.id}
                                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[minmax(0,1.5fr)_80px_110px_112px] md:items-center sm:px-4"
                                    >
                                      <div className="col-span-2 min-w-0 md:col-span-1">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="shrink-0">
                                            {variant.size || "Único"}
                                          </Badge>
                                          <span className="truncate text-xs text-muted-foreground">
                                            {selectedProduct.name}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          SKU: {variant.variantSku || "-"}
                                        </div>
                                      </div>

                                      <div className="hidden text-sm text-muted-foreground md:flex md:items-center">
                                        {maxQty}
                                      </div>

                                      <div className="order-4 flex items-center justify-between gap-3 text-sm font-medium md:order-0">
                                        <span>{formatCurrency(variantPrice)}</span>
                                        <span className="text-sm text-muted-foreground md:hidden">
                                          Estoque: {maxQty}
                                        </span>
                                      </div>

                                      <div className="order-5 col-span-2 md:order-0 md:col-span-1 md:justify-self-center">
                                        <div className="flex items-center justify-end gap-1 md:justify-center">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => decrementVariantQuantity(variant)}
                                            disabled={maxQty === 0 || (variantQuantities[variant.id] || 0) <= 0}
                                          >
                                            <Minus className="h-3.5 w-3.5" />
                                          </Button>

                                          <IntegerInput
                                            value={variantQuantities[variant.id] || 0}
                                            onChange={(value) => setVariantQuantity(variant, Number(value || 0))}
                                            min={0}
                                            max={maxQty}
                                            disabled={maxQty === 0}
                                            className="w-14 space-y-0"
                                            inputClassName="h-8 text-center text-sm"
                                          />

                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => incrementVariantQuantity(variant)}
                                            disabled={
                                              maxQty === 0 ||
                                              (variantQuantities[variant.id] || 0) >= maxQty
                                            }
                                          >
                                            <Plus className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:static sm:shrink-0 sm:px-6 sm:py-4 sm:pb-4">
                <Button
                  onClick={handleAddSelectedVariants}
                  className="w-full"
                  disabled={
                    disabled ||
                    isPending ||
                    isLoadingVariants ||
                    Object.values(variantQuantities).every((quantity) => quantity === 0)
                  }
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {addButtonLabel}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
