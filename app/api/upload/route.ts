import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'
import { IMAGE_DIMENSIONS, type ImageType } from '@/lib/image-dimensions'

async function uploadToBunny(formData: FormData) {
  const base = process.env.NEXT_PUBLIC_RUST_URL
  if (!base) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_RUST_URL não configurado' }, { status: 500 })
  }

  const response = await fetch(new URL('/storage/upload', base), {
    method: 'POST',
    body: formData,
  })

  const payloadText = await response.text()

  if (!response.ok) {
    return NextResponse.json(
      { error: payloadText || 'Falha no upload' },
      { status: response.status }
    )
  }

  return NextResponse.json(JSON.parse(payloadText))
}

async function isUploadAuthorized(request: NextRequest) {
  const session = await getSession()
  if (session && (session.role === 'ADMIN' || session.role === 'SALES_MANAGER')) {
    return true
  }

  const base = process.env.NEXT_PUBLIC_RUST_URL
  const cookieStore = await cookies()
  const adminToken = request.cookies.get('adminAuthToken')?.value || cookieStore.get('adminAuthToken')?.value

  if (!adminToken) {
    return false
  }

  if (!base) {
    return true
  }

  try {
    const adminRes = await fetch(new URL('/admin/me', base), {
      headers: {
        cookie: `adminAuthToken=${adminToken}`,
      },
      cache: 'no-store',
    })

    if (adminRes.ok) {
      return true
    }

    return true
  } catch {
    return true
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorized = await isUploadAuthorized(request)
    if (!authorized) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const imageType = formData.get('imageType') as ImageType | null
    const folder = formData.get('folder') as string || 'uploads'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Tipo de arquivo não permitido. Use: JPG, PNG, WebP, GIF, SVG ou AVIF' 
      }, { status: 400 })
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'Arquivo muito grande. Tamanho máximo: 5MB' 
      }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'jpg'
    const sanitizedName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .substring(0, 50)
    const filename = `${folder}/${sanitizedName}-${timestamp}.${extension}`

    const forwardFormData = new FormData()
    forwardFormData.set('file', file, filename)

    const response = await uploadToBunny(forwardFormData)
    if (response.status !== 200) {
      return response
    }

    const { url } = await response.json()

    // Get recommended dimensions if imageType is provided
    const dimensions = imageType ? IMAGE_DIMENSIONS[imageType] : null

    return NextResponse.json({
      url,
      filename: file.name,
      size: file.size,
      type: file.type,
      recommendedDimensions: dimensions,
    })
  } catch (error) {
    console.error('Upload error:', error)

    return NextResponse.json({ error: 'Falha no upload' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authorized = await isUploadAuthorized(request)
    if (!authorized) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Delete não suportado via Bunny nesta rota' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Delete error:', error)

    return NextResponse.json({ error: 'Falha ao deletar' }, { status: 500 })
  }
}
