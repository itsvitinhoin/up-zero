'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Product, Category } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Search,
  X,
  Copy,
  Check,
  ImageIcon,
  Package,
} from 'lucide-react'
import { formatCurrency } from '@/lib/pricing'
import { createCustomLinkAction, updateCustomLinkAction } from '@/lib/actions/custom-links'
import type { CustomLinkDetail } from '@/lib/types'

interface NewCustomLinkFormProps {
  products: Product[]
  categories: Category[]
  initialLink?: CustomLinkDetail | null
}

export function NewCustomLinkForm({ products, categories, initialLink = null }: NewCustomLinkFormProps) {
  const router = useRouter()
  const [linkName, setLinkName] = useState(initialLink?.link?.name ?? '')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<string[]>(initialLink?.productIds ?? [])
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState<'select' | 'review'>('select')
  const [isCreating, setIsCreating] = useState(false)
  const isEditMode = Boolean(initialLink?.link?.id)

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = !selectedCategory || selectedCategory === 'all' || product.categoryId === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, search, selectedCategory])

  // Generate slug
  const slug = linkName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  // Generate preview URL
  const previewUrl = slug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/c/${slug}` : ''

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id))
    }
  }

  const copyToClipboard = () => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCreateLink = async () => {
    setIsCreating(true)
    const payload = {
      name: linkName,
      slug,
      productIds: selectedProducts,
      isActive: true,
    }

    const result = isEditMode && initialLink?.link?.id
      ? await updateCustomLinkAction(initialLink.link.id, payload)
      : await createCustomLinkAction(payload)

    if (!result.success) {
      setIsCreating(false)
      window.alert(result.error || 'Não foi possível salvar o link personalizado.')
      return
    }

    router.push('/custom-links')
  }

  if (step === 'select') {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/custom-links">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{isEditMode ? 'Editar Link Personalizado' : 'Novo Link Personalizado'}</h1>
            <p className="text-muted-foreground text-sm mt-1">Etapa 1 de 2: Selecione os Produtos</p>
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
                    <span className="font-semibold">{selectedProducts.length}</span>
                  </div>
                </div>

                <Button
                  onClick={() => setStep('review')}
                  disabled={!linkName || selectedProducts.length === 0}
                  className="w-full"
                >
                  Próximo
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main content - Products grid */}
          <div className="lg:col-span-3 space-y-4 order-1 lg:order-2">
            {/* Filtros */}
            <Card>
              <CardContent className="pt-4 sm:pt-6 space-y-4">
                <div className="flex items-center gap-2 border rounded-md px-3">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Buscar por nome ou SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                  />
                </div>

                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-40 sm:w-45">
                      <SelectValue placeholder="Todas categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      {selectedProducts.length === filteredProducts.length && filteredProducts.length > 0
                        ? 'Desselecionar'
                        : 'Selecionar Tudo'}
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                  {selectedProducts.length > 0 && ` • ${selectedProducts.length} selecionado${selectedProducts.length !== 1 ? 's' : ''}`}
                </p>
              </CardContent>
            </Card>

            {/* Products Grid */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map(product => {
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
                            <Image
                              src={product.images[0]}
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
                          {categories.find(c => c.id === product.categoryId)?.name || 'Sem categoria'}
                        </Badge>
                        <p className="font-semibold text-xs sm:text-sm">{formatCurrency(product.basePrice)}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum produto encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Review
  const selectedProductsData = products.filter(p => selectedProducts.includes(p.id))

  return (
    <div className="space-y-6 p-4 sm:p-6">
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
                  <code className="flex-1">/c/{slug}</code>
                  <button
                    onClick={copyToClipboard}
                    className="shrink-0 p-1"
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
                  <span className="font-semibold">{selectedProducts.length}</span>
                </div>
              </div>

              <Button
                onClick={handleCreateLink}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? (isEditMode ? 'Salvando...' : 'Criando...') : (isEditMode ? 'Salvar Alterações' : 'Criar Link')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main content - Product grid preview */}
        <div className="lg:col-span-3 order-1 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle>Produtos Selecionados ({selectedProducts.length})</CardTitle>
              <CardDescription>Produtos que estarão inclusos neste link</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {selectedProductsData.map(product => (
                  <div
                    key={product.id}
                    className="relative rounded-lg border overflow-hidden hover:shadow-md transition-shadow group"
                  >
                    {product.images && product.images.length > 0 ? (
                      <div className="relative w-full aspect-square bg-muted">
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
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
                          {categories.find(c => c.id === product.categoryId)?.name || 'Sem categoria'}
                        </Badge>
                        <p className="font-semibold text-xs">{formatCurrency(product.basePrice)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleProduct(product.id)}
                      className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 h-6 w-6 rounded-full bg-background/90 border border-destructive hover:bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
