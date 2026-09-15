import { cookies } from 'next/headers'
import { z } from 'zod'
import { MasterError, sessionSchema, workspaceSchema, requirePermission, type Mutation } from './contracts'
import { createDemo, deleteDemo, demoSession, demoWorkspace, mutateDemo } from './demo'

export const COOKIE = 'upzero_master_session'
export const demoEnabled = () => process.env.NODE_ENV === 'development' && process.env.MASTER_DEMO_MODE === 'true'
export const configured = () => Boolean(process.env.MASTER_API_URL) || demoEnabled()
export const privateHeaders = { 'Cache-Control': 'no-store, private, max-age=0', Pragma: 'no-cache', Vary: 'Cookie' }
export function assertOrigin(request: Request) {
  let origin: URL
  try { origin = new URL(request.headers.get('origin') || '') } catch { throw new MasterError(403, 'Origem não autorizada.') }
  if (origin.host !== request.headers.get('host') || !['http:', 'https:'].includes(origin.protocol) || request.headers.get('sec-fetch-site') === 'cross-site' || (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) throw new MasterError(403, 'Origem não autorizada.')
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new MasterError(415, 'Envie dados JSON.')
  const reader = request.body?.getReader()
  if (!reader) throw new MasterError(400, 'Solicitação inválida.')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    size += part.value.byteLength
    if (size > 8192) { await reader.cancel(); throw new MasterError(413, 'Solicitação muito grande.') }
    chunks.push(part.value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown } catch { throw new MasterError(400, 'Solicitação inválida.') }
}
export async function upstream(path: string, token?: string, method = 'GET', payload?: unknown) {
  const raw = process.env.MASTER_API_URL
  if (!raw) throw new MasterError(503, 'O acesso global às lojas ainda não foi conectado.')
  let url: URL
  try { url = new URL(`${raw.replace(/\/$/, '')}${path}`) } catch { throw new MasterError(503, 'Configuração do Master indisponível.') }
  if (!['http:', 'https:'].includes(url.protocol) || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new MasterError(503, 'O Master exige uma conexão HTTPS.')
  let response: Response
  try {
    response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: payload === undefined ? undefined : JSON.stringify(payload), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) })
  } catch { throw new MasterError(503, 'Não foi possível conectar ao Master. Atualize para conferir o resultado antes de repetir uma alteração.') }
  if (!response.ok) throw new MasterError([401, 403, 404, 409, 422, 429].includes(response.status) ? response.status : 502,
    response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : response.status === 403 ? 'Seu perfil não tem permissão para esta ação.' : response.status === 409 ? 'Dados alterados por outro operador. Atualize a página.' : 'Não foi possível concluir a solicitação. Confira os dados e tente novamente.')
  if (response.status === 204) return null
  return response.json() as Promise<unknown>
}
export async function token() {
  const value = (await cookies()).get(COOKIE)?.value
  if (!value) throw new MasterError(401, 'Entre no Master para continuar.')
  return value
}
export async function getMasterSession() {
  const value = await token()
  if (demoEnabled()) return demoSession(value)
  const session = sessionSchema.parse(await upstream('/auth/me', value))
  if (session.mode !== 'live') throw new MasterError(403, 'Sessão Master inválida.')
  return session
}
export async function getWorkspace() {
  const session = await getMasterSession(), value = await token()
  requirePermission(session, 'stores.read')
  const data = workspaceSchema.parse(demoEnabled() ? await demoWorkspace(value) : await upstream('/workspace', value))
  // Explicit DTO schemas drop unknown fields, including raw API credentials.
  return { ...data, sales: session.permissions.includes('sales.read') ? data.sales : null, invoices: session.permissions.includes('billing.read') ? data.invoices : [], audit: session.permissions.includes('audit.read') ? data.audit : [], team: session.permissions.includes('team.read') ? data.team : [] }
}
const credentials = z.object({ email: z.email(), password: z.string().min(1).max(256) }).strict()
export async function login(input: unknown) {
  if (demoEnabled()) {
    const parsed = z.object({ demo: z.literal(true), role: z.enum(['owner', 'viewer']) }).strict().parse(input)
    return createDemo(parsed.role)
  }
  const result = z.object({ token: z.string().min(16).max(4096), session: sessionSchema }).parse(await upstream('/auth/login', undefined, 'POST', credentials.parse(input)))
  if (result.session.mode !== 'live') throw new MasterError(403, 'Sessão Master inválida.')
  return result
}
export async function logout() {
  const value = await token()
  if (demoEnabled()) await deleteDemo(value)
  else await upstream('/auth/logout', value, 'POST', {})
}
export async function mutateStore(storeId: number, input: Mutation) {
  const session = await getMasterSession(), value = await token()
  requirePermission(session, input.action.startsWith('key.') ? 'keys.read' : input.action === 'module.update' ? 'modules.write' : 'stores.write')
  const result = demoEnabled() ? await mutateDemo(value, storeId, input) : await upstream(`/stores/${storeId}/actions`, value, 'POST', input)
  return input.action.startsWith('key.') ? z.object({ key: z.string().min(1).max(4096), auditId: z.string().min(1) }).parse(result) : z.object({ success: z.literal(true) }).parse(result)
}
export function errorResponse(error: unknown) {
  const status = error instanceof MasterError ? error.status : error instanceof z.ZodError ? 422 : 500
  return Response.json({ error: error instanceof MasterError ? error.message : status === 422 ? 'Os dados recebidos não correspondem ao formato esperado.' : 'Não foi possível concluir a solicitação.' }, { status, headers: privateHeaders })
}
