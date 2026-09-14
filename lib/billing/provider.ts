import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { BillingError } from './types'
export function environment() {
  const env = process.env.ASAAS_ENVIRONMENT || 'sandbox'
  if (env !== 'sandbox' && env !== 'production') throw new BillingError(503, 'Configuração de cobrança indisponível.')
  return env
}
export function configured() {
  return Boolean(process.env.ASAAS_API_KEY && process.env.BILLING_TOKEN_ENCRYPTION_KEY?.match(/^[a-f\d]{64}$/i) && (process.env.DATABASE_URL || process.env.POSTGRES_URL))
}
export function cryptToken(value: string, storeId: number, decrypt = false) {
  const key = process.env.BILLING_TOKEN_ENCRYPTION_KEY || ''
  if (!/^[a-f\d]{64}$/i.test(key)) throw new BillingError(503, 'Cadastro de cartões indisponível.')
  const aad = Buffer.from(`billing:${environment()}:${storeId}`)
  if (!decrypt) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
    cipher.setAAD(aad)
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return [iv, cipher.getAuthTag(), data].map(v => v.toString('base64url')).join('.')
  }
  const [iv, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64url'))
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
  cipher.setAAD(aad); cipher.setAuthTag(tag)
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8')
}
export type Gateway = <T>(path: string, method?: string, body?: unknown) => Promise<T>
export const gateway: Gateway = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new BillingError(503, 'O serviço de cobrança ainda não está disponível. Entre em contato com o suporte.')
  const base = environment() === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3'
  let response: Response
  try {
    response = await fetch(`${base}${path}`, { method, headers: { access_token: key, 'Content-Type': 'application/json', 'User-Agent': 'UPZero-Billing/1.0' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(65000) })
  } catch { throw new BillingError(502, 'Não foi possível confirmar a operação. Atualize a página antes de tentar novamente.', method !== 'GET') }
  if (!response.ok) {
    // Never expose provider payloads: they can echo card/holder data or credentials.
    throw new BillingError(response.status >= 500 ? 502 : 422, response.status === 400 ? 'Não foi possível concluir. Confira os dados ou utilize outro cartão.' : 'O serviço de cobrança não concluiu a operação. Contate o suporte.', method !== 'GET' && (response.status >= 500 || response.status === 408))
  }
  try { return await response.json() as T } catch { throw new BillingError(502, 'A confirmação está pendente. Atualize a página.', method !== 'GET') }
}
