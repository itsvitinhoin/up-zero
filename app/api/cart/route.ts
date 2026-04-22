import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getCartAction, addToCartAction } from '@/lib/actions/cart'

export async function GET() {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const result = await getCartAction()
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Erro ao carregar carrinho' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result.data })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const { productId, variantId, quantity } = body

  if (!productId || !variantId || !quantity) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields' },
      { status: 400 }
    )
  }

  const result = await addToCartAction(productId, variantId, Number(quantity))
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Erro ao adicionar item' }, { status: 400 })
  }

  return NextResponse.json({ success: true, data: result.data })
}
