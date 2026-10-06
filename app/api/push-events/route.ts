import { verifyEvent } from '@/lib/push/auth'
import { applyEvent, eventSchema } from '@/lib/push/engine'
import { mutateState } from '@/lib/push/repository'
import { PushError } from '@/lib/push/types'
import { z } from 'zod'
import { after } from 'next/server'
import { processStore } from '@/lib/push/worker'
export const maxDuration = 300
export async function POST(request: Request) {
  const raw = await request.text()
  if (Buffer.byteLength(raw) > 24000) return Response.json({ error: 'Evento muito grande.' }, { status: 413 })
  try {
    const body = JSON.parse(raw), storeId = Number(body.storeId)
    if (!verifyEvent(storeId, raw, request.headers.get('x-push-timestamp') || '', request.headers.get('x-push-signature') || '')) return Response.json({ error: 'Assinatura inválida.' }, { status: 401 })
    const event = eventSchema.parse(body)
    const result = await mutateState(storeId, state => applyEvent(state, event))
    if (!result.duplicate) after(async () => { try { await processStore(storeId) } catch { console.error('[push] deferred event processing failed') } })
    return Response.json({ accepted: true, ...result }, { status: 202 })
  } catch (error) { return Response.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : error instanceof PushError ? error.message : 'Evento não processado.' }, { status: error instanceof z.ZodError || error instanceof SyntaxError ? 400 : error instanceof PushError ? error.status : 503 }) }
}
