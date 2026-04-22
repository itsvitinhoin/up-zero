import { NextRequest, NextResponse } from 'next/server'
import { getStoreProductWithVariantsAction } from '@/lib/actions/products'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await getStoreProductWithVariantsAction(id)

  if (!result.success || !result.data) {
    return NextResponse.json(
      { success: false, error: 'Product not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: result.data,
  })
}
