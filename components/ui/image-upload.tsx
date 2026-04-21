"use client"

import React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X, ImageIcon, Loader2 } from "lucide-react"
import Image from "next/image"

// Standard e-commerce image dimensions
export const IMAGE_DIMENSIONS = {
  logo: { width: 200, height: 60, label: 'Logo', aspectRatio: '200x60px' },
  favicon: { width: 32, height: 32, label: 'Favicon', aspectRatio: '32x32px' },
  mainBanner: { width: 1500, height: 600, label: 'Banner Principal', aspectRatio: '1500x600px' },
  categoryBanner: { width: 1200, height: 400, label: 'Banner de Categoria', aspectRatio: '1200x400px' },
  productImage: { width: 640, height: 840, label: 'Imagem de Produto', aspectRatio: '640x840px' },
  productThumbnail: { width: 320, height: 420, label: 'Miniatura', aspectRatio: '320x420px' },
  pageContent: { width: 1200, height: 800, label: 'Imagem de Página', aspectRatio: '1200x800px' },
} as const

export type ImageType = keyof typeof IMAGE_DIMENSIONS

interface ImageUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  imageType: ImageType
  folder?: string
  disabled?: boolean
  className?: string
  hideRecommendation?: boolean
}

export function ImageUpload({ 
  value, 
  onChange, 
  imageType, 
  folder = 'uploads',
  disabled = false,
  className = '',
  hideRecommendation = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const dimensions = IMAGE_DIMENSIONS[imageType]

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', imageType)
      formData.append('folder', folder)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Falha no upload')
      }

      onChange(result.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload')
    } finally {
      setIsUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleRemove() {
    if (!value) return

    setIsUploading(true)
    setError(null)

    try {
      onChange(null)
    } catch {
      onChange(null)
    } finally {
      setIsUploading(false)
    }
  }

  // Calculate aspect ratio for responsive sizing
  const aspectRatio = dimensions.width / dimensions.height

  return (
    <div className={`space-y-2 ${className}`}>
      {!hideRecommendation && (
        <div className="text-sm text-muted-foreground">
          Tamanho recomendado: {dimensions.aspectRatio}
        </div>
      )}
      
      {value ? (
        <div className="relative inline-block w-full max-w-[400px]">
          <div 
            className="relative border rounded-lg overflow-hidden bg-muted w-full"
            style={{ aspectRatio }}
          >
            <Image
              src={value || "/placeholder.svg"}
              alt={dimensions.label}
              fill
              className="object-contain"
              sizes="400px"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleRemove}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors w-full max-w-[400px]"
          style={{ aspectRatio: Math.max(aspectRatio, 1.5) }}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Enviando...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                Clique para fazer upload
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WebP ou GIF (max. 5MB)
              </span>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
