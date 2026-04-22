import { useCallback, useMemo, useRef, useState } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Loader2 } from 'lucide-react'

/**
 * AvatarInput
 * - Circle preview that opens a modal to crop an image as a circle
 * - Uploads the cropped image and returns the URL via onChange
 */

type Props = {
  label?: string
  value?: string
  onChange: (url: string) => void
  name?: string
  maxFileSizeMb?: number
  accept?: string
}

const DEFAULT_MAX_MB = 5

const readFileAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const createCroppedBlob = async (imageSrc: string, crop: Area): Promise<Blob> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.crossOrigin = 'anonymous'
    img.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.save()
  ctx.beginPath()
  ctx.arc(crop.width / 2, crop.height / 2, Math.min(crop.width, crop.height) / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  )

  ctx.restore()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('Failed to crop image'))
      resolve(blob)
    }, 'image/png')
  })
}

const AvatarInput = ({ label = 'Avatar', value, onChange, name, maxFileSizeMb = DEFAULT_MAX_MB, accept = 'image/*' }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const previewUrl = useMemo(() => value, [value])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > maxFileSizeMb * 1024 * 1024) {
      alert(`O arquivo deve ter no máximo ${maxFileSizeMb}MB`)
      return
    }

    const dataUrl = await readFileAsDataURL(file)
    setImageSrc(dataUrl)
    setDialogOpen(true)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setUploading(true)

    try {
      const blob = await createCroppedBlob(imageSrc, croppedAreaPixels)
      const file = new File([blob], `avatar-${Date.now()}.png`, { type: 'image/png' })

      const formData = new FormData()
      formData.append('file', file)

      const baseUrl = (process.env.NEXT_PUBLIC_RUST_URL ?? 'http://localhost:8080').replace(/\/$/, '')
      const response = await fetch(`${baseUrl}/storage/upload`, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Falha no upload')
      }

      const data = await response.json()
      if (!data.url) throw new Error('Resposta de upload sem URL')

      onChange(data.url)
      setDialogOpen(false)
    } catch (error) {
      console.error('Avatar upload error', error)
      alert(error instanceof Error ? error.message : 'Falha ao enviar avatar')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='relative flex w-fit items-center gap-3'>
        <div
          onClick={() => fileInputRef.current?.click()}
          className='cursor-pointer'
          style={{
            width: 104,
            height: 104,
            borderRadius: '50%',
            border: '2px dashed hsl(var(--border))',
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: 'hsl(var(--muted))',
            backgroundImage: previewUrl ? `url(${previewUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {!previewUrl && (
            <div className='flex h-full w-full items-center justify-center text-muted-foreground'>
              <i className='tabler-user text-4xl' />
            </div>
          )}

          <input
            ref={fileInputRef}
            type='file'
            accept={accept}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {previewUrl && (
          <Button
            type='button'
            size='icon'
            variant='destructive'
            onClick={() => onChange('')}
            className='absolute -right-2 -top-2 h-6 w-6 rounded-full p-0'
          >
            <i className='tabler-x text-sm' />
          </Button>
        )}

        {name && <input type='hidden' name={name} value={value ?? ''} />}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !uploading && setDialogOpen(open)}>
        <DialogContent className='max-w-xl'>
          <DialogHeader>
            <DialogTitle>Crop do avatar</DialogTitle>
          </DialogHeader>
          <div className='relative h-90'>
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape='round'
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
          </div>
          <div className='flex items-center gap-2 px-1 py-1.5'>
          <span className='text-xs text-muted-foreground'>Zoom</span>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.05}
            onValueChange={(value) => setZoom(value[0] ?? 1)}
          />
          </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => setDialogOpen(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button type='button' onClick={handleUpload} disabled={uploading || !imageSrc}>
            {uploading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
            {uploading ? 'Enviando...' : 'Salvar'}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AvatarInput
