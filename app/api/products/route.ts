import { NextRequest, NextResponse } from 'next/server'
import { getPaginatedStoreProductsAction } from '@/lib/actions/products'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pageParam = Number(searchParams.get('page') || '1')
  const limitParam = Number(searchParams.get('limit') || '24')

  const filters = {
    page: Number.isFinite(pageParam) ? pageParam : 1,
    limit: Number.isFinite(limitParam) ? limitParam : 24,
    categoryId: searchParams.get('categoryId') || undefined,
    search: searchParams.get('search') || undefined,
    isActive: searchParams.get('isActive') === 'false' ? false : true,
  }

  const result = await getPaginatedStoreProductsAction(filters)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Erro ao carregar produtos' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result.data })
}
