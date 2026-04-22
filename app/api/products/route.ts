import { NextRequest, NextResponse } from 'next/server'
import { getProductsAction } from '@/lib/actions/products'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const filters = {
    categoryId: searchParams.get('categoryId') || undefined,
    search: searchParams.get('search') || undefined,
    isActive: searchParams.get('isActive') === 'false' ? false : true,
  }

  const result = await getProductsAction(filters)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Erro ao carregar produtos' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result.data ?? [] })
}
