'use client'

import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { getStorefrontProductImagesAction, type StorefrontProductImageItem } from '@/lib/actions/product-images'

interface ImageLevelSelectorProps {
  productId?: string | null
  value: string
  onChange: (imageKey: string, productId: number) => void
  onSelectItem?: (item: StorefrontProductImageItem | null) => void
  storeId?: number
}

export function ImageLevelSelector({ productId, value, onChange, onSelectItem, storeId = 1 }: ImageLevelSelectorProps) {
  const [imageItems, setImageItems] = useState<StorefrontProductImageItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const lastSearchRef = React.useRef('')
  const hasFetchedRef = React.useRef(false)

  const fetchImageLevels = useCallback((search: string) => {
    // Evita requisições duplicadas consecutivas
    if (lastSearchRef.current === search && hasFetchedRef.current) {
      return
    }
    lastSearchRef.current = search
    hasFetchedRef.current = true

    startTransition(async () => {
      setError(null)

      try {
        const result = await getStorefrontProductImagesAction({
          storeId,
          productId: productId || undefined,
          search: search || undefined,
          limit: 50,
        })

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Erro ao carregar níveis de imagem')
        }

        setImageItems(result.data)
      } catch (err) {
        console.error('Erro ao buscar image levels:', err)
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setImageItems([])
      }
    })
  }, [productId, storeId])

  const displayValues = useMemo(() => {
    return imageItems.map(item => {
      const itemValue = `${item.product_id}:${item.image_key}`
      return {
        value: itemValue,
        display: `${item.product_name} - ${item.image_key}`,
        item
      }
    })
  }, [imageItems])

  const selectedItem = useMemo(() => {
    return imageItems.find((item) => `${item.product_id}:${item.image_key}` === value)
  }, [imageItems, value])

  const selectedDisplay = useMemo(() => {
    return selectedItem ? `${selectedItem.product_name} - ${selectedItem.image_key}` : null
  }, [selectedItem])

  const handleInputValueChange = useCallback((inputValue: string) => {
    // Não atualizar searchTerm se o input é exatamente um item selecionado
    const isSelectedItem = displayValues.some(d => d.display === inputValue)
    if (!isSelectedItem) {
      setSearchTerm(inputValue)
    }
  }, [displayValues])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchImageLevels(searchTerm)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, fetchImageLevels])

  // Carrega inicial
  useEffect(() => {
    fetchImageLevels('')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Notifica parent quando selectedItem muda (importante para modo edição)
  useEffect(() => {
    if (selectedItem) {
      onSelectItem?.(selectedItem)
    }
  }, [selectedItem, onSelectItem])

  const handleValueChange = useCallback((itemValue: string | null) => {
    if (!itemValue) {
      onChange('', 0)
      onSelectItem?.(null)
      return
    }

    const item = imageItems.find(i => `${i.product_id}:${i.image_key}` === itemValue)
    if (item) {
      onChange(item.image_key, item.product_id)
      onSelectItem?.(item)
    }
  }, [imageItems, onChange, onSelectItem])

  return (
    <div className="space-y-3">
      <Label>Selecione o nível de agrupamento visual</Label>

      <Combobox
        items={displayValues.map(d => d.display)}
        value={selectedDisplay}
        onValueChange={(display) => {
          const found = displayValues.find(d => d.display === display)
          handleValueChange(found?.value || null)
        }}
        onInputValueChange={handleInputValueChange}
      >
        <ComboboxInput
          placeholder="Selecione um nível..."
          showClear
          showTrigger
        />

        <ComboboxContent className="z-100">
          {isPending ? (
            <ComboboxEmpty>Carregando...</ComboboxEmpty>
          ) : (
            <ComboboxEmpty>Nenhum nível encontrado</ComboboxEmpty>
          )}
          <ComboboxList
            className="max-h-80"
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
            {displayValues.map(({ value: itemValue, item }) => (
              <ComboboxItem key={itemValue} value={`${item.product_name} - ${item.image_key}`}>
                <div className="flex items-center gap-3 w-full">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.primary_image_url ? (
                      <Image
                        src={item.primary_image_url}
                        alt={`${item.product_name} - ${item.image_key}`}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                        N/A
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {item.product_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.image_key} • {item.variants.length} variantes
                    </div>
                  </div>
                </div>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
