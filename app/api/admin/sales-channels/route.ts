import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/actions/auth'
import {
  getSalesChannelsAction,
  createSalesChannelAction,
} from '@/lib/actions/sales-channels'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
  }

  const result = await getSalesChannelsAction()
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ success: true, data: result.data ?? [] })
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const data = Array.isArray(body) ? body[0] : body
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ success: false, error: 'Payload inválido' }, { status: 400 })
  }

  const { name, code, description, is_default, is_active, min_qty, sort_order } = data as Record<string, unknown>

  if (!name || !code) {
    return NextResponse.json({ success: false, error: 'name e code são obrigatórios' }, { status: 422 })
  }

  const result = await createSalesChannelAction({
    name: String(name),
    code: String(code),
    description: description != null && description !== '$undefined' ? String(description) : undefined,
    is_default: typeof is_default === 'boolean' ? is_default : undefined,
    is_active: typeof is_active === 'boolean' ? is_active : undefined,
    min_qty: typeof min_qty === 'number' ? min_qty : undefined,
    sort_order: typeof sort_order === 'number' ? sort_order : undefined,
  })

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json({ success: true, data: result.data }, { status: 201 })
}
