import { cookies } from 'next/headers'
import { isIP } from 'node:net'
import { BillingError } from './types'
export async function requireBillingAdmin(request: Request) {
  if (request.method !== 'GET') {
    let origin: URL
    try { origin = new URL(request.headers.get('origin') || '') } catch { throw new BillingError(403, 'Origem inválida.') }
    if (origin.host !== request.headers.get('host') || request.headers.get('sec-fetch-site') === 'cross-site') throw new BillingError(403, 'Origem inválida.')
    if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') throw new BillingError(403, 'Utilize uma conexão segura.')
  }
  const token = (await cookies()).get('adminAuthToken')?.value, base = process.env.NEXT_PUBLIC_RUST_URL
  if (!token || !base) throw new BillingError(401, 'Entre no Admin para gerenciar sua assinatura.')
  const options = { headers: { cookie: `adminAuthToken=${token}` }, cache: 'no-store' as const, signal: AbortSignal.timeout(10000) }
  const response = await fetch(new URL('/admin/me', base), options)
  if (!response.ok) throw new BillingError(401, 'Sessão expirada.')
  const me = await response.json(), storeId = Number(me.store_id ?? me.storeId)
  if (me.authenticated === false || !Number.isSafeInteger(storeId) || storeId <= 0 || !(me.id ?? me.admin_id)) throw new BillingError(403, 'Não foi possível validar a loja.')
  const permission = async (code: string) => {
    const response = await fetch(new URL(`/permissions/check?code=${code}`, base), { ...options, signal: AbortSignal.timeout(10000) })
    return response.ok && (await response.json()).has_permission === true
  }
  const canManage = await permission('settings.edit')
  if ((request.method !== 'GET' && !canManage) || (request.method === 'GET' && !canManage && !(await permission('settings.view')))) throw new BillingError(403, 'Você não tem permissão para gerenciar a assinatura.')
  return { storeId, userId: String(me.id ?? me.admin_id), canManage }
}
export function payerIp(request: Request) {
  // Vercel owns this header. Other deployments must explicitly trust their sanitizing reverse proxy.
  const header = process.env.VERCEL === '1' ? 'x-vercel-forwarded-for' : process.env.BILLING_TRUST_PROXY === 'true' ? 'x-forwarded-for' : null
  const value = header ? request.headers.get(header)?.split(',')[0].trim() : undefined
  if (value && isIP(value)) return value
  if (process.env.NODE_ENV !== 'production' && process.env.ASAAS_ENVIRONMENT !== 'production') return '127.0.0.1'
  throw new BillingError(503, 'Não foi possível validar a conexão. Contate o suporte.')
}
