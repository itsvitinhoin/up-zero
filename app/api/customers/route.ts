import { NextRequest, NextResponse } from 'next/server'
import { getSession, canManageCustomers } from '@/lib/auth'
import { getCustomersAction } from '@/lib/actions/customers'

export async function GET(request: NextRequest) {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (!canManageCustomers(session.role)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  
  const filters: {
    status?: string
    assignedSellerId?: string
    search?: string
  } = {}

  if (searchParams.get('status')) {
    filters.status = searchParams.get('status')!
  }
  
  if (searchParams.get('search')) {
    filters.search = searchParams.get('search')!
  }

  // Sellers can only see their customers
  if (session.role === 'SELLER') {
    filters.assignedSellerId = session.id
  } else if (searchParams.get('assignedSellerId')) {
    filters.assignedSellerId = searchParams.get('assignedSellerId')!
  }

  const result = await getCustomersAction({
    status: filters.status,
    assignedSellerId: filters.assignedSellerId,
    search: filters.search,
  })

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Erro ao carregar clientes' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result.data ?? [] })
}
