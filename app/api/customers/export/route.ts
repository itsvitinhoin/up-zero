import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { checkUserPermission } from '@/lib/actions/permissions'

export async function GET(request: NextRequest) {
  const permission = await checkUserPermission('reports.export').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para exportar relatórios' }, { status: 403 })
  }

  const baseUrl = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim().replace(/\/$/, '')
  if (!baseUrl) {
    return NextResponse.json({ error: 'Backend URL não configurado' }, { status: 500 })
  }

  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  const scopedStoreId = await getAdminStoreIdFromToken()
  if (!scopedStoreId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const search = request.nextUrl.searchParams
  const params = new URLSearchParams()
  params.set('store_id', String(scopedStoreId))
  const q = search.get('q')
  const status = search.get('status')
  const type = search.get('type')
  const assignedSellerId = search.get('assigned_seller_id') || search.get('seller')
  const from = search.get('from')
  const to = search.get('to')
  if (q) params.set('q', q)
  if (status && status !== 'all') params.set('status', status)
  if (type && type !== 'all') params.set('customer_type', type)
  if (assignedSellerId === 'none') {
    params.set('without_seller', 'true')
  } else if (assignedSellerId && /^\d+$/.test(assignedSellerId)) {
    params.set('assigned_seller_id', assignedSellerId)
  }
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const response = await fetch(`${baseUrl}/customers/export?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    return NextResponse.json(
      { error: `Erro ao exportar: ${response.status} ${text}` },
      { status: response.status },
    )
  }

  const buffer = await response.arrayBuffer()
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="clientes-${dateStr}.xlsx"`,
    },
  })
}
