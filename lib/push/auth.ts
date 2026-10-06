import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { PushError } from './types'

export async function requirePushAdmin(request: Request, permission = 'messaging.view') {
  if (request.method !== 'GET') {
    let origin: URL
    try { origin = new URL(request.headers.get('origin') || '') } catch { throw new PushError(403, 'Origem inválida.') }
    if (origin.host !== request.headers.get('host') || request.headers.get('sec-fetch-site') === 'cross-site' || (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) throw new PushError(403, 'Origem inválida.')
  }
  const token = (await cookies()).get('adminAuthToken')?.value, base = process.env.NEXT_PUBLIC_RUST_URL
  if (!token || !base) throw new PushError(401, 'Entre no Admin para acessar Push.')
  const options = { headers: { cookie: `adminAuthToken=${token}` }, cache: 'no-store' as const, signal: AbortSignal.timeout(10000) }
  const response = await fetch(new URL('/admin/me', base), options)
  if (!response.ok) throw new PushError(401, 'Sessão expirada.')
  const me = await response.json(), storeId = Number(me.store_id ?? me.storeId), userId = String(me.id ?? me.admin_id ?? '')
  if (me.authenticated === false || !Number.isSafeInteger(storeId) || storeId <= 0 || !userId) throw new PushError(403, 'Loja inválida.')
  const check = async (code: string) => {
    const url = new URL('/permissions/check', base); url.searchParams.set('code', code)
    const result = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) })
    return result.ok && (await result.json()).has_permission === true
  }
  if (!await check(permission)) throw new PushError(403, 'Você não tem permissão para esta ação.')
  return { storeId, userId, check }
}
export function storeEventSecret(storeId: number): string | undefined {
  try { return JSON.parse(process.env.PUSH_EVENT_SECRETS || '{}')[String(storeId)] } catch { return undefined }
}
export function safeEqual(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
export function verifyEvent(storeId: number, body: string, timestamp: string, signature: string, now = Date.now()) {
  const secret = storeEventSecret(storeId), seconds = Number(timestamp)
  if (!secret || !Number.isFinite(seconds) || Math.abs(now - seconds * 1000) > 300000) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return safeEqual(expected, signature.replace(/^sha256=/, ''))
}
