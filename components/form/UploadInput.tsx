import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

type Props = {
  label: string
  value?: string
  onChange: (value: string) => void
  accept?: string
  maxSize?: number // em MB
  error?: boolean
  helperText?: string
  className?: string
  fullWidth?: boolean
  placeholder?: string
}

const UploadInput = ({
  label,
  value,
  onChange,
  accept = 'image/*,.pdf,.doc,.docx',
  maxSize = 10,
  error,
  helperText,
  className,
  fullWidth = false,
  placeholder = 'No file selected'
}: Props) => {
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size
    if (maxSize && file.size > maxSize * 1024 * 1024) {
      toast.error(`File cannot exceed ${maxSize}MB`)
      return
    }

    setFileName(file.name)
    handleUpload(file)
  }

  const handleUpload = async (file: File) => {
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const baseUrl = (process.env.NEXT_PUBLIC_RUST_URL ?? 'http://localhost:8080').replace(/\/$/, '')
      
      const response = await fetch(`${baseUrl}/storage/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Upload failed with status ${response.status}`)
      }

      const data = await response.json()
      
      if (data.url) {
        onChange(data.url)
        toast.success('File uploaded successfully!')
      } else {
        throw new Error('No URL returned from upload')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Upload failed')
      setFileName('')
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    onChange('')
    setFileName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type='file'
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className='space-y-2'>
        <label className='pl-1 text-sm font-medium'>{label}</label>
        <div className='flex items-center gap-2'>
          <Input
            readOnly
            value={value ?? ''}
            placeholder={fileName || placeholder}
            className='flex-1'
            aria-invalid={error || undefined}
          />
          {value && !loading && (
            <Button type='button' variant='ghost' size='icon' onClick={handleRemove}>
              <i className='tabler-x text-sm' />
            </Button>
          )}
          <Button type='button' variant='outline' onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <i className='tabler-upload text-sm mr-1' />}
            Upload
          </Button>
        </div>
        {helperText ? <p className='pl-1 text-xs text-muted-foreground'>{helperText}</p> : null}
        <div className='mt-1 flex items-center gap-2 text-xs text-muted-foreground'>
          <span>Max size: {maxSize}MB</span>
          {value ? (
            <span>
              ✓ File uploaded: <a href={value} target='_blank' rel='noopener noreferrer' className='text-primary underline'>View</a>
            </span>
          ) : null}
        </div>
      </div>

    </div>
  )
}

export default UploadInput
