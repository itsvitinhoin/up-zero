'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { getStoreProductsPageAction } from '@/lib/actions/products'
import type { Product } from '@/lib/types'

type ProductSearchSelectProps = {
  value: string
  onChange: (value: string) => void
  onSelectProduct?: (product: Product | null) => void
  placeholder?: string
  disabled?: boolean
  initialProducts?: Product[]
}

export function ProductSearchSelect({
  value,
  onChange,
  onSelectProduct,
  placeholder = 'Selecione um produto',
  disabled = false,
  initialProducts = [],
}: ProductSearchSelectProps) {
  const [isPending, startTransition] = useTransition()
  const [products, setProducts] = useState<Product[]>(initialProducts)

  const handleValueChange = useCallback((newValue: string | null) => {
    onChange(newValue || '')
  }, [onChange])

  const fetchProducts = useCallback((searchTerm: string) => {
    startTransition(async () => {
      const result = await getStoreProductsPageAction({
        page: 1,
        limit: 50,
        search: searchTerm || undefined,
      })
      if (result.success && result.data?.items) {
        // Merge with initial products to ensure selected product is always available
        const fetchedIds = new Set(result.data.items.map(p => p.id))
        const merged = [
          ...result.data.items,
          ...initialProducts.filter(p => !fetchedIds.has(p.id))
        ]
        setProducts(merged)
      } else {
        setProducts(initialProducts)
      }
    })
  }, [initialProducts])

  // Debounce search
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchProducts(searchTerm)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, fetchProducts])

  // Load initial products on mount
  useEffect(() => {
    if (!products.length && !searchTerm) {
      fetchProducts('')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Use product names as items for simple string matching
  const productNames = products.map(p => p.name)
  const selectedName = products.find(p => p.id === value)?.name || null

  return (
    <Combobox
      items={productNames}
      value={selectedName}
      onValueChange={(name) => {
        const product = products.find(p => p.name === name)
        onSelectProduct?.(product || null)
        handleValueChange(product?.id || null)
      }}
      onInputValueChange={setSearchTerm}
      disabled={disabled}
    >
      <ComboboxInput placeholder={placeholder} />
      <ComboboxContent
        className="z-100"
        onWheel={(e) => e.stopPropagation()}
      >
        {isPending ? (
          <ComboboxEmpty>Buscando...</ComboboxEmpty>
        ) : (
          <ComboboxEmpty>Nenhum produto encontrado.</ComboboxEmpty>
        )}
        <ComboboxList
          style={{
            touchAction: 'auto',
            WebkitOverflowScrolling: 'touch',
            pointerEvents: 'auto'
          } as React.CSSProperties}
          onWheel={(e) => {
            // Allow scroll inside ComboboxList, prevent propagation to Sheet
            const target = e.currentTarget
            const atTop = target.scrollTop === 0
            const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight

            if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
              return // Allow overscroll to propagate
            }
            e.stopPropagation()
          }}
        >
          {(productName) => (
            <ComboboxItem key={productName} value={productName}>
              {productName}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
