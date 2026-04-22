import { NextRequest, NextResponse } from 'next/server'
import { fireEvent, generateEventId } from '@/lib/whatsapp/engine'
import type { WaEvent, WaEventPayload, WaEventType } from '@/lib/whatsapp/types'

export async function POST(req: NextRequest) {
  let body: { type?: WaEventType; payload?: WaEventPayload }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido no corpo da requisição' }, { status: 400 })
  }

  if (!body.type) {
    return NextResponse.json({ ok: false, error: 'Campo "type" é obrigatório' }, { status: 400 })
  }

  const event: WaEvent = {
    id: generateEventId(),
    type: body.type,
    payload: body.payload ?? {},
    triggeredAt: new Date(),
    source: 'MANUAL',
  }

  const result = await fireEvent(event)

  return NextResponse.json({ ok: true, ...result })
}
