"use client"

import React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X, ImageIcon, Loader2, GripVertical } from "lucide-react"
import Image from "next/image"
import { IMAGE_DIMENSIONS } from "./image-upload"

interface MultiImageUploadProps {
  value: string[]
  onChange: (urls: string[]) => void
  maxImages?: number
  folder?: string
  disabled?: boolean
  className?: string
  showHeaderInfo?: boolean
}

export function MultiImageUpload({ 
  value = [], 
  onChange, 
  maxImages = 10,
  folder = 'products',
  disabled = false,
  className = '',
  showHeaderInfo = true,
}: MultiImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const dimensions = IMAGE_DIMENSIONS.productImage

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const remainingSlots = maxImages - value.length
    if (remainingSlots <= 0) {
      setError(`Maximo de ${maxImages} imagens permitido`)
      return
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots)
    setError(null)
    setIsUploading(true)

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('imageType', 'productImage')
        formData.append('folder', folder)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Falha no upload')
        }

        return result.url as string
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      onChange([...value, ...uploadedUrls])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleRemove(index: number) {
    const url = value[index]
    
    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
    } catch {
      // Continue even if delete fails
    }

    const newUrls = value.filter((_, i) => i !== index)
    onChange(newUrls)
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newUrls = [...value]
    const draggedUrl = newUrls[draggedIndex]
    newUrls.splice(draggedIndex, 1)
    newUrls.splice(index, 0, draggedUrl)
    onChange(newUrls)
    setDraggedIndex(index)
  }

  function handleDragEnd() {
    setDraggedIndex(null)
  }

  const canAddMore = value.length < maxImages

  return (
    <div className={`space-y-4 ${className}`}>
      {showHeaderInfo && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Tamanho recomendado: {dimensions.aspectRatio} | {value.length}/{maxImages} imagens
          </div>
        </div>
      )}

      {/* Image Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
        {value.map((url, index) => (
          <div
            key={url}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative group rounded-lg border overflow-hidden bg-muted cursor-move ${
              draggedIndex === index ? 'opacity-50 ring-2 ring-primary' : ''
            }`}
            style={{ aspectRatio: '640/840' }}
          >
            <Image
              src={url || "/placeholder.svg"}
              alt={`Imagem ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            />
            
            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <div className="absolute top-2 left-2 text-white/80">
                <GripVertical className="h-5 w-5" />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Position indicator */}
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {index === 0 ? 'Principal' : index + 1}
            </div>
          </div>
        ))}

        {/* Upload Button */}
        {canAddMore && !disabled && (
          <div
            className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors ${
              isUploading ? 'pointer-events-none' : ''
            }`}
            style={{ aspectRatio: '640/840' }}
            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Enviando...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground text-center px-2">
                  Clique ou arraste
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, WebP
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!disabled && (
        <p className="text-xs text-muted-foreground">
          Arraste as imagens para reordenar. A primeira imagem sera a principal.
        </p>
      )}
    </div>
  )
}
