import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Endpoint placeholder para product-images
 * As imagens de produtos são buscadas via /v1/product-images do backend Rust
 * através da ação servidor getProductImagesAction()
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Use /v1/product-images from backend instead' },
    { status: 410 }
  )
}

