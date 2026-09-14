import { timingSafeEqual } from 'node:crypto'
import { billingSql } from '@/lib/billing/repository'
import { environment } from '@/lib/billing/provider'
export async function POST(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN || '', received = request.headers.get('asaas-access-token') || ''
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(received) || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) return new Response(null, { status: 401 })
  const reader = request.body?.getReader(); if (!reader) return new Response(null, { status: 400 })
  let size = 0; const parts: Uint8Array[] = []
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 100000) { await reader.cancel(); return new Response(null, { status: 413 }) }; parts.push(value) }
    const event = JSON.parse(Buffer.concat(parts).toString('utf8'))
    if (typeof event.id !== 'string' || event.id.length > 200 || typeof event.event !== 'string' || event.event.length > 100) return new Response(null, { status: 400 })
    const rawResource = event.payment?.id ?? event.subscription?.id
    const resource = typeof rawResource === 'string' ? rawResource.slice(0, 200) : null
    const sql = billingSql()
    // Persist only event identity; the Billing view reads authoritative current provider state.
    // Reordered/duplicate events cannot regress subscription/payment status or create charges.
    await sql`INSERT INTO platform_billing_events(environment,event_id,event_type,resource_id) VALUES(${environment()},${event.id},${event.event},${resource}) ON CONFLICT DO NOTHING`
    return Response.json({ received: true })
  } catch { return new Response(null, { status: 503 }) }
  finally { reader.releaseLock() }
}
