"use client"

import { useRef, useState, type ChangeEvent } from "react"
import { Film, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VideoUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  folder?: string
  disabled?: boolean
}

export function VideoUpload({ value, onChange, folder = "videos", disabled = false }: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", folder)

      const response = await fetch("/api/upload/video", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Falha no upload")
      onChange(result.mp4_480pUrl || result.mp4_360pUrl || result.url)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Erro ao fazer upload")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">MP4 ou WebM, proporção recomendada 1920 × 780.</p>
      {value ? (
        <div className="relative w-full max-w-2xl overflow-hidden rounded-lg border bg-muted">
          <video src={value} controls preload="metadata" className="aspect-[32/13] w-full object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8 rounded-full"
            onClick={() => onChange(null)}
            disabled={disabled || isUploading}
            aria-label="Remover vídeo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="flex aspect-[32/13] w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:cursor-not-allowed"
        >
          {isUploading ? <Loader2 className="mb-2 h-8 w-8 animate-spin" /> : <Film className="mb-2 h-8 w-8" />}
          <span className="inline-flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4" />
            {isUploading ? "Enviando..." : "Selecionar vídeo"}
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
