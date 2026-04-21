import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getOrdersAction } from '@/lib/actions/orders'

export async function GET(request: NextRequest) {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)

  const result = await getOrdersAction({
    customerId: searchParams.get('customerId') || undefined,
    status: searchParams.get('status') || undefined,
  })

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Erro ao carregar pedidos' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result.data ?? [] })
}
