import { NextRequest, NextResponse } from 'next/server'
import { getSettings, updateSettings } from '@/lib/whatsapp/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getSettings())
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const updated = updateSettings(body)
  return NextResponse.json(updated)
}
