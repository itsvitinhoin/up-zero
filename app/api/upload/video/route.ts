import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'

async function isUploadAuthorized(request: NextRequest) {
  const session = await getSession()
  if (session && (session.role === 'ADMIN' || session.role === 'SALES_MANAGER')) {
    return true
  }

  const cookieStore = await cookies()
  const adminToken = request.cookies.get('adminAuthToken')?.value || cookieStore.get('adminAuthToken')?.value
  return Boolean(adminToken)
}

export async function POST(request: NextRequest) {
  try {
    const authorized = await isUploadAuthorized(request)
    if (!authorized) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const streamLibraryId = (process.env.BUNNY_STREAM_LIBRARY_ID || '').trim()
    const streamApiKey = (process.env.BUNNY_STREAM_API_KEY || '').trim()
    const streamPullZone = (process.env.BUNNY_STREAM_PULL_ZONE || '').trim()

    if (!streamLibraryId || !streamApiKey) {
      return NextResponse.json(
        { error: 'BUNNY_STREAM_LIBRARY_ID/BUNNY_STREAM_API_KEY não configurados' },
        { status: 500 },
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use: MP4, WebM, OGG ou MOV' },
        { status: 400 },
      )
    }

    const maxSize = 200 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Limite atual: 200MB' },
        { status: 400 },
      )
    }

    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'mp4'
    const sanitizedName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .substring(0, 50)

    const title = `${sanitizedName}-${timestamp}`

    const createResponse = await fetch(`https://video.bunnycdn.com/library/${streamLibraryId}/videos`, {
      method: 'POST',
      headers: {
        AccessKey: streamApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    })

    const createText = await createResponse.text()
    if (!createResponse.ok) {
      return NextResponse.json(
        { error: createText || 'Falha ao criar vídeo no Bunny Stream' },
        { status: createResponse.status },
      )
    }

    const createdPayload = JSON.parse(createText)
    const videoGuid = String(createdPayload?.guid || createdPayload?.videoGuid || '').trim()

    if (!videoGuid) {
      return NextResponse.json({ error: 'Bunny Stream não retornou guid do vídeo' }, { status: 500 })
    }

    const fileBytes = await file.arrayBuffer()

    const uploadResponse = await fetch(
      `https://video.bunnycdn.com/library/${streamLibraryId}/videos/${videoGuid}`,
      {
        method: 'PUT',
        headers: {
          AccessKey: streamApiKey,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: fileBytes,
      },
    )

    const uploadText = await uploadResponse.text()
    if (!uploadResponse.ok) {
      return NextResponse.json(
        { error: uploadText || 'Falha ao enviar binário para Bunny Stream' },
        { status: uploadResponse.status },
      )
    }

    const normalizedPullZone = streamPullZone
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '')

    const hlsUrl = normalizedPullZone
      ? `https://${normalizedPullZone}/${videoGuid}/playlist.m3u8`
      : `https://iframe.mediadelivery.net/embed/${streamLibraryId}/${videoGuid}`
    const mp4_360pUrl = normalizedPullZone
      ? `https://${normalizedPullZone}/${videoGuid}/play_360p.mp4`
      : ''
    const mp4_480pUrl = normalizedPullZone
      ? `https://${normalizedPullZone}/${videoGuid}/play_480p.mp4`
      : ''

    const url = hlsUrl

    if (!url) {
      return NextResponse.json({ error: 'Upload sem URL retornada' }, { status: 500 })
    }

    return NextResponse.json({
      url,
      videoGuid,
      hlsUrl,
      mp4_360pUrl,
      mp4_480pUrl,
      embedUrl: `https://iframe.mediadelivery.net/embed/${streamLibraryId}/${videoGuid}`,
      filename: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('Upload video error:', error)
    return NextResponse.json({ error: 'Falha no upload do vídeo' }, { status: 500 })
  }
}
