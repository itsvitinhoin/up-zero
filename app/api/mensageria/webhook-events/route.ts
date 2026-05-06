import { NextRequest, NextResponse } from 'next/server'
import { getWebhookEvents } from '@/lib/whatsapp/store'
import { maskId, maskPhone } from '@/lib/whatsapp/meta'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '100'), 500)
  return NextResponse.json(
    getWebhookEvents(limit).map((evt) => ({
      ...evt,
      fromMasked: maskPhone(evt.from),
      phoneNumberIdMasked: maskId(evt.phoneNumberId),
    })),
  )
}
