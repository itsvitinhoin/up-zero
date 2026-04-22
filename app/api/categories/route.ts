import { NextResponse } from 'next/server'
import { getCategoriesAction } from '@/lib/actions/products'

export async function GET() {
  const result = await getCategoriesAction()
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Erro ao carregar categorias' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result.data ?? [] })
}
