'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  upsertChannelPricesAction,
  type ChannelPrice,
  type SalesChannel,
} from '@/lib/actions/sales-channels'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, ArrowDown, Save, Search, Tag, X } from 'lucide-react'
import CurrencyInput from '@/components/form/CurrencyInput'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import { usePaginationMeta } from '@/hooks/use-paginated-list'

export type SalesChannelProductVariant = {
  id: number
  sku: string
  price_cents: number
  promo_cents: number
  active: boolean
  attribute_values: Array<{
    attribute_code: string
    attribute_name: string
    value_name: string
  }>
}

export type SalesChannelProduct = {
  id: number
  code: string
  name: string
  active: boolean
  variants: SalesChannelProductVariant[]
}

type EditableVariantPrice = {
  variant_id: number
  sku: string
  attrsLabel: string
  base_price_cents: number
  price_cents: number
  promo_cents: number
  dirty: boolean
}

function formatCentsDisplay(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function buildVariantLabel(variant: SalesChannelProductVariant): string {
  if (!Array.isArray(variant.attribute_values) || variant.attribute_values.length === 0) {
    return 'Sem atributos'
  }
  return variant.attribute_values
    .map((v) => `${v.attribute_name || v.attribute_code || 'Atributo'}: ${v.value_name || '-'}`)
    .join(' · ')
}

export function AdminChannelPricesClient({
  channel,
  initialPrices,
  initialProducts,
  pagination,
}: {
  channel: SalesChannel
  initialPrices: ChannelPrice[]
  initialProducts: SalesChannelProduct[]
  pagination: {
    total: number
    page: number
    limit: number
    search: string
  }
}) {
  const router = useRouter()
  const pathname = usePathname()

  const [products] = useState<SalesChannelProduct[]>(initialProducts)
  const [search, setSearch] = useState(pagination.search)

  const [selectedProduct, setSelectedProduct] = useState<SalesChannelProduct | null>(null)
  const [priceRows, setPriceRows] = useState<EditableVariantPrice[]>([])
  const [saving, setSaving] = useState(false)

  const pricesByVariant = useMemo(() => {
    const map = new Map<number, ChannelPrice>()
    for (const price of initialPrices) map.set(price.variant_id, price)
    return map
  }, [initialPrices])

  const pageSize = pagination.limit
  const currentPage = Math.max(1, pagination.page)
  const totalItems = Math.max(0, pagination.total)

  const { totalPages, safeCurrentPage, pageStart, pageEnd } = usePaginationMeta({
    currentPage,
    pageSize,
    totalItems,
    currentPageItemCount: products.length,
  })

  function navigateWithParams(nextPage: number, nextSearch: string) {
    const params = new URLSearchParams()
    if (nextPage > 1) params.set('page', String(nextPage))
    if (nextSearch.trim().length > 0) params.set('q', nextSearch.trim())
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  useEffect(() => {
    const currentSearch = (pagination.search ?? '').trim()
    const nextSearch = search.trim()
    if (nextSearch === currentSearch) return
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (nextSearch.length > 0) params.set('q', nextSearch)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    }, 400)
    return () => clearTimeout(timer)
  }, [search, pagination.search, pathname, router])

  function openProductModal(product: SalesChannelProduct) {
    const rows: EditableVariantPrice[] = product.variants.map((variant) => {
      const existing = pricesByVariant.get(variant.id)
      return {
        variant_id: variant.id,
        sku: variant.sku,
        attrsLabel: buildVariantLabel(variant),
        base_price_cents: variant.price_cents ?? 0,
        price_cents: existing?.price_cents ?? variant.price_cents ?? 0,
        promo_cents: existing?.promo_cents ?? variant.promo_cents ?? 0,
        dirty: false,
      }
    })
    setSelectedProduct(product)
    setPriceRows(rows)
  }

  function closeModal() {
    setSelectedProduct(null)
    setPriceRows([])
  }

  function updateRowPrice(variantId: number, field: 'price_cents' | 'promo_cents', value: number | null) {
    const cents = Math.round((value ?? 0) * 100)
    setPriceRows((prev) =>
      prev.map((row) =>
        row.variant_id === variantId ? { ...row, [field]: cents, dirty: true } : row,
      ),
    )
  }

  function applyToAllBelow(field: 'price_cents' | 'promo_cents', cents: number) {
    setPriceRows((prev) =>
      prev.map((row, i) => (i === 0 ? row : { ...row, [field]: cents, dirty: true }))
    )
  }

  async function saveChannelPrices() {
    if (!selectedProduct) return
    const changed = priceRows.filter((row) => row.dirty)
    if (changed.length === 0) {
      toast.info('Nenhuma alteração para salvar')
      return
    }
    setSaving(true)
    const result = await upsertChannelPricesAction(
      channel.id,
      changed.map((row) => ({
        variant_id: row.variant_id,
        price_cents: row.price_cents,
        promo_cents: row.promo_cents,
        is_active: true,
      })),
    )
    setSaving(false)
    if (!result.success) {
      toast.error(result.error ?? 'Erro ao salvar preços do canal')
      return
    }
    toast.success('Preços do canal salvos com sucesso')
    closeModal()
    router.refresh()
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sales-channels">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Canais
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              {channel.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Selecione um produto para editar os preços do canal por variante
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/20 bg-card p-3">
        <div className="relative w-full md:max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="rounded-xl border border-border/20 shadow-none overflow-hidden p-0">
        {products.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Nenhum produto encontrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer"
                  onClick={() => openProductModal(product)}
                >
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{product.code}</TableCell>
                  <TableCell>{product.variants.length}</TableCell>
                  <TableCell>
                    {product.active ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                    >
                      Definir preços
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {totalItems > 0 && (
        <AdminPaginationControls
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={(page) => navigateWithParams(page, search)}
          showing={{ start: pageStart, end: pageEnd, total: totalItems }}
        />
      )}

      <Drawer open={Boolean(selectedProduct)} onOpenChange={(open) => !open && closeModal()} direction="right">
        <DrawerContent className="w-full sm:w-[80vw] sm:max-w-none flex flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b shrink-0">
            <DrawerHeader className="p-0">
              <DrawerTitle>{selectedProduct?.name}</DrawerTitle>
              <DrawerDescription>
                Preços do canal <strong>{channel.name}</strong> por variante
              </DrawerDescription>
            </DrawerHeader>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {priceRows.length === 0 ? (
              <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                Este produto não possui variantes para precificação.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variante</TableHead>
                      <TableHead>Preço Base</TableHead>
                      <TableHead>Preço Canal</TableHead>
                      <TableHead>Preço Promocional</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceRows.map((row, index) => (
                      <TableRow key={row.variant_id} className={row.dirty ? 'bg-amber-50/40' : ''}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium">{row.attrsLabel}</div>
                            <div className="text-xs font-mono text-muted-foreground">{row.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatCentsDisplay(row.base_price_cents)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div className="w-36">
                              <CurrencyInput
                                value={row.price_cents / 100}
                                onChange={(value) => updateRowPrice(row.variant_id, 'price_cents', value)}
                              />
                            </div>
                            {index === 0 && priceRows.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                title="Aplicar a todos abaixo"
                                onClick={() => applyToAllBelow('price_cents', row.price_cents)}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div className="w-36">
                              <CurrencyInput
                                value={row.promo_cents / 100}
                                onChange={(value) => updateRowPrice(row.variant_id, 'promo_cents', value)}
                              />
                            </div>
                            {index === 0 && priceRows.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                title="Aplicar a todos abaixo"
                                onClick={() => applyToAllBelow('promo_cents', row.promo_cents)}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={saveChannelPrices} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
