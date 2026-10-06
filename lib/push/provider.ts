import { createSign } from 'node:crypto'
import { PushError, type PushMessage } from './types'

type ServiceAccount = { project_id: string; client_email: string; private_key: string }
function account(storeId: number): ServiceAccount | null {
  try {
    const value = JSON.parse(process.env.PUSH_FCM_SERVICE_ACCOUNTS || '{}')[String(storeId)]
    return value?.project_id && value?.client_email && value?.private_key ? value : null
  } catch { return null }
}
export function providerReady(storeId: number) { return !!account(storeId) }
const accessTokens = new Map<number, { token: string; expires: number }>()
async function accessToken(storeId: number, credentials: ServiceAccount) {
  const cached = accessTokens.get(storeId)
  if (cached && cached.expires > Date.now() + 60000) return cached.token
  const now = Math.floor(Date.now() / 1000), encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const claims = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`
  const signature = createSign('RSA-SHA256').update(claims).sign(credentials.private_key, 'base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${claims}.${signature}` }), signal: AbortSignal.timeout(10000) })
  const payload = await response.json()
  if (!response.ok || !payload.access_token) throw new PushError(503, 'Não foi possível autenticar o serviço de Push.')
  accessTokens.set(storeId, { token: payload.access_token, expires: Date.now() + Number(payload.expires_in || 3600) * 1000 })
  return String(payload.access_token)
}
export async function sendPush(storeId: number, token: string, message: PushMessage, jobId: string) {
  const credentials = account(storeId)
  if (!credentials) throw new PushError(503, 'O serviço de Push desta loja ainda não foi configurado.')
  const bearer = await accessToken(storeId, credentials)
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credentials.project_id)}/messages:send`, {
    method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ message: { token, notification: { title: message.title, body: message.body, ...(message.image ? { image: message.image } : {}) }, data: { push_job_id: jobId, destination: message.destination, destination_id: message.destinationId }, android: { ttl: '3600s' }, apns: { headers: { 'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600) }, payload: { aps: { ...(message.image ? { 'mutable-content': 1 } : {}) } } } } }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const invalid = payload.error?.details?.some((d: { errorCode?: string }) => d.errorCode === 'UNREGISTERED') === true
    return { accepted: false, invalid, reason: invalid ? 'Dispositivo não registrado; token desativado.' : 'O serviço de Push recusou o envio.' }
  }
  return { accepted: true, invalid: false, reason: undefined }
}
