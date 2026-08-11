import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

function readBearerToken(request: NextRequest): string | null {
  const raw = request.headers.get('authorization') || ''
  const trimmed = raw.trim()
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null
  const token = trimmed.slice(7).trim()
  return token || null
}

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) {
    return new Response('NEXT_PUBLIC_RUST_URL nao configurado', { status: 500 })
  }

  const orderId = (request.nextUrl.searchParams.get('orderId') || '').trim()
  if (!orderId) {
    return new Response('orderId e obrigatorio', { status: 400 })
  }

  const cookieStore = await cookies()
  const adminToken =
    request.cookies.get('adminAuthToken')?.value || cookieStore.get('adminAuthToken')?.value
  const bearerToken = readBearerToken(request)

  const headers: HeadersInit = {
    accept: 'application/pdf,*/*',
  }

  if (adminToken) {
    headers.cookie = `adminAuthToken=${adminToken}`
  }

  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`
  }

  const targetPath = `/orders/${encodeURIComponent(orderId)}/manifest/pdf`
  const response = await fetch(new URL(targetPath, base), {
    method: 'GET',
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    const payloadText = await response.text().catch(() => '')
    return new Response(payloadText || 'Falha ao gerar PDF do romaneio', {
      status: response.status,
    })
  }

  const payload = await response.arrayBuffer()
  const upstreamContentType = response.headers.get('content-type') || 'application/pdf'
  const upstreamDisposition = response.headers.get('content-disposition') || undefined

  const outHeaders = new Headers()
  outHeaders.set('content-type', upstreamContentType)
  if (upstreamDisposition) {
    outHeaders.set('content-disposition', upstreamDisposition)
  }

  return new Response(payload, { status: 200, headers: outHeaders })
}
