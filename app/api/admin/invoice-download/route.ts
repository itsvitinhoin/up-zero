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
    return new Response('NEXT_PUBLIC_RUST_URL não configurado', { status: 500 })
  }

  const params = request.nextUrl.searchParams
  const kind = (params.get('kind') || '').trim().toLowerCase()
  const orderId = (params.get('orderId') || '').trim()
  const invoiceId = (params.get('invoiceId') || '').trim()
  const invoiceType = (params.get('invoiceType') || 'order').trim().toLowerCase()

  if (kind !== 'pdf' && kind !== 'xml') {
    return new Response('kind deve ser pdf ou xml', { status: 400 })
  }

  const targetPath = invoiceType === 'standalone'
    ? invoiceId
      ? `/orders/invoices/standalone/${encodeURIComponent(invoiceId)}/${kind}`
      : null
    : orderId
      ? `/orders/${encodeURIComponent(orderId)}/invoice/${kind}`
      : null

  if (!targetPath) {
    return new Response('Parâmetros de download inválidos', { status: 400 })
  }

  const cookieStore = await cookies()
  const adminToken = request.cookies.get('adminAuthToken')?.value || cookieStore.get('adminAuthToken')?.value
  const bearerToken = readBearerToken(request)

  const headers: HeadersInit = {
    accept: '*/*',
  }

  if (adminToken) {
    headers.cookie = `adminAuthToken=${adminToken}`
  }

  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`
  }

  const response = await fetch(new URL(targetPath, base), {
    method: 'GET',
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    const payloadText = await response.text().catch(() => '')
    return new Response(payloadText || 'Falha ao baixar documento fiscal', { status: response.status })
  }

  const payload = await response.arrayBuffer()
  const upstreamContentType = response.headers.get('content-type') || (kind === 'pdf' ? 'application/pdf' : 'application/xml')
  const upstreamDisposition = response.headers.get('content-disposition') || undefined

  const outHeaders = new Headers()
  outHeaders.set('content-type', upstreamContentType)
  if (upstreamDisposition) {
    outHeaders.set('content-disposition', upstreamDisposition)
  }

  return new Response(payload, { status: 200, headers: outHeaders })
}