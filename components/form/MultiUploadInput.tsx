import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type MultiUploadInputProps = {
  label?: string
  value?: string[]
  onChange: (value: string[]) => void
  accept?: string
  maxSize?: number
  maxFiles?: number
  error?: boolean
  helperText?: string
  className?: string
  placeholder?: string
}

const MultiUploadInput = ({
  label,
  value = [],
  onChange,
  accept = 'image/*,.pdf,.doc,.docx',
  maxSize = 10,
  maxFiles = 20,
  error,
  helperText,
  className,
  placeholder = 'Nenhum arquivo selecionado',
}: MultiUploadInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)

    const baseUrl = (process.env.NEXT_PUBLIC_RUST_URL ?? 'http://localhost:8080').replace(/\/$/, '')

    const response = await fetch(`${baseUrl}/storage/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Upload falhou com status ${response.status}`)
    }

    const data = await response.json()
    if (!data.url || typeof data.url !== 'string') {
      throw new Error('Resposta de upload inválida: URL ausente')
    }

    return data.url
  }

  const resolveFileUrl = (rawValue: string): string | null => {
    const normalized = rawValue.trim()
    if (!normalized) return null

    if (/^https?:\/\//i.test(normalized)) {
      return normalized
    }

    if (normalized.startsWith('/')) {
      return normalized
    }

    const hasExtension = /\.[a-z0-9]+$/i.test(normalized)
    if (!hasExtension) {
      return null
    }

    const storageBase = (process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL ?? 'https://storage.upzero.com.br/uploads').replace(/\/$/, '')
    return `${storageBase}/${encodeURIComponent(normalized)}`
  }

  const resolveFileName = (rawValue: string, index: number): string => {
    const normalized = rawValue.trim()
    if (!normalized) return `arquivo-${index + 1}`

    const candidate = normalized.split('/').pop() || normalized
    return decodeURIComponent(candidate)
  }

  const openFileInNewTab = (rawValue: string) => {
    const fileUrl = resolveFileUrl(rawValue)
    if (!fileUrl) {
      toast.error('Arquivo sem URL valida para visualizacao')
      return
    }

    window.open(fileUrl, '_blank', 'noopener,noreferrer')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])

    if (selectedFiles.length === 0) {
      return
    }

    const filesLeft = Math.max(0, maxFiles - value.length)
    if (filesLeft === 0) {
      toast.error(`Limite de ${maxFiles} arquivos atingido`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const filesToUpload = selectedFiles.slice(0, filesLeft)

    const oversized = filesToUpload.find((file) => file.size > maxSize * 1024 * 1024)
    if (oversized) {
      toast.error(`O arquivo ${oversized.name} excede ${maxSize}MB`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setLoading(true)

    try {
      const uploadedUrls: string[] = []

      for (const file of filesToUpload) {
        const url = await uploadFile(file)
        uploadedUrls.push(url)
      }

      const nextValue = [...value, ...uploadedUrls]
      onChange(nextValue)

      if (selectedFiles.length > filesToUpload.length) {
        toast.success(`${filesToUpload.length} arquivos enviados. Limite de ${maxFiles} arquivos aplicado.`)
      } else {
        toast.success(`${uploadedUrls.length} arquivo(s) enviado(s) com sucesso!`)
      }
    } catch (error) {
      console.error('Multi upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Falha no upload de arquivos')
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeAt = (index: number) => {
    const nextValue = value.filter((_, i) => i !== index)
    onChange(nextValue)
  }

  const clearAll = () => {
    onChange([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type='file'
        multiple
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className={label ? 'space-y-2' : 'space-y-1'}>
        {label ? <label className='pl-1 text-sm font-medium'>{label}</label> : null}

        <div className='flex items-center gap-2'>
          <Input
            readOnly
            value={value.length > 0 ? `${value.length} arquivo(s)` : ''}
            placeholder={placeholder}
            className='flex-1'
            aria-invalid={error || undefined}
          />

          {value.length > 0 && !loading ? (
            <Button type='button' variant='ghost' size='icon' onClick={clearAll} title='Remover todos'>
              <X className='h-4 w-4' />
            </Button>
          ) : null}

          <Button type='button' variant='outline' onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <i className='tabler-upload text-sm mr-1' />}
            Upload
          </Button>
        </div>

        {helperText ? <p className='pl-1 text-xs text-muted-foreground'>{helperText}</p> : null}

        <div className='mt-1 flex items-center gap-2 text-xs text-muted-foreground'>
          <span>Max size: {maxSize}MB</span>
          <span>Max files: {maxFiles}</span>
        </div>

        {value.length > 0 ? (
          <div className='space-y-2 rounded-md border p-2'>
            {value.map((url, index) => {
              const fileName = resolveFileName(url, index)
              const fileUrl = resolveFileUrl(url)
              return (
                <div key={`${url}-${index}`} className='flex items-center gap-2'>
                  <Button
                    type='button'
                    variant='ghost'
                    className='h-9 flex-1 justify-start truncate border px-3 font-normal'
                    onClick={() => openFileInNewTab(url)}
                    title={fileUrl ? 'Abrir arquivo em nova aba' : 'Arquivo sem URL valida para visualizacao'}
                  >
                    <span className='truncate text-left'>{fileName}</span>
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => removeAt(index)}
                    title='Remover arquivo'
                  >
                    <X className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => openFileInNewTab(url)}
                    disabled={!fileUrl}
                    title={fileUrl ? 'Abrir visualizacao em nova aba' : 'Arquivo sem URL valida para visualizacao'}
                  >
                    Ver
                  </Button>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export type { MultiUploadInputProps }
export default MultiUploadInput
