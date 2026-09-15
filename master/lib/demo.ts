import { createDemoSales } from './demo-sales'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { MasterError, moduleCodes, requirePermission, workspaceSchema, type MasterSession, type Mutation, type Workspace } from './contracts'

const directory = path.join(process.cwd(), '.data', 'master-demo')
type State = { session: MasterSession; expiresAt: number; workspace: Workspace }
// Single-process local demo only. The live backend owns transactions and concurrency.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work)
  queue = result.catch(() => undefined)
  return result
}
function file(token: string) {
  if (!/^[a-f0-9-]{36}$/.test(token)) throw new MasterError(401, 'Entre no Master para continuar.')
  return path.join(directory, `${token}.json`)
}
async function read(token: string): Promise<State> {
  try {
    const state = JSON.parse(await readFile(file(token), 'utf8')) as State
    if (state.expiresAt <= Date.now()) throw new Error('expired')
    return state
  } catch { throw new MasterError(401, 'Sua sessão expirou. Entre novamente.') }
}
async function save(token: string, state: State) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const destination = file(token), temporary = `${destination}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 })
  await rename(temporary, destination)
}
export async function createDemo(role: 'owner' | 'viewer') {
  const token = randomUUID(), now = new Date().toISOString()
  const session: MasterSession = {
    id: 'demo-operator', name: role === 'owner' ? 'Operador de demonstração' : 'Consulta de demonstração',
    email: 'operador@example.test', role: role === 'owner' ? 'Administrador Master' : 'Consulta', mode: 'demo',
    permissions: role === 'owner' ? ['stores.read', 'stores.write', 'keys.read', 'modules.write', 'billing.read', 'audit.read', 'team.read', 'sales.read'] : ['stores.read'],
  }
  const names = ['Aurora Atelier', 'Casa Nativa', 'Forma Essencial', 'Vértice Denim', 'Lume Concept', 'Brisa Beachwear', 'Origem Basics', 'Oliva Moda', 'Alma Urbana', 'Solar Kids', 'Linha & Trama', 'Norte Studio']
  const stores: Workspace['stores'] = names.map((name, index) => ({
    id: 2001 + index, name, domain: `loja-${index + 1}.example.test`, owner: ['Marina Costa', 'Lucas Almeida', 'Ana Martins'][index % 3], email: `contato${index + 1}@example.test`,
    status: index === 3 ? 'suspended' : index === 5 || index === 9 ? 'trial' : 'active',
    plan: index % 3 === 0 ? 'starter' : 'pro', subscription: index === 3 ? 'cancelled' : index === 5 || index === 9 ? 'trial' : 'active',
    createdAt: new Date(Date.now() - (index + 1) * 86400000 * 9).toISOString(), hasApiKey: index !== 9,
    modules: moduleCodes.map(code => ({ code, override: 'plan', expiresAt: null })), revision: 0,
  }))
  const invoices: Workspace['invoices'] = stores.filter(store => store.subscription !== 'trial').flatMap((store, index) => [0, 1, 2].map(month => {
    const due = new Date(); due.setUTCMonth(due.getUTCMonth() - month); due.setUTCDate(5); due.setUTCHours(15, 0, 0, 0)
    const status = month === 0 && index === 3 ? 'overdue' : month === 0 && index === 1 ? 'pending' : 'paid'
    return { id: `DEMO-${store.id}-${month}`, storeId: store.id, description: `Mensalidade ${store.plan === 'pro' ? 'Pro' : 'Starter'}`, amount: store.plan === 'pro' ? 119900 : 89900, dueAt: due.toISOString(), paidAt: status === 'paid' ? due.toISOString() : null, status }
  }))
  const workspace = workspaceSchema.parse({ stores, invoices, audit: [], team: [session], updatedAt: now })
  await save(token, { session, workspace, expiresAt: Date.now() + 8 * 3600000 })
  return { token, session }
}
export async function demoSession(token: string) {
  const { session } = await read(token)
  // Upgrade existing owner demo sessions without changing saved stores or audit history.
  if (session.role === 'Administrador Master' && !session.permissions.includes('sales.read'))
    return { ...session, permissions: [...session.permissions, 'sales.read' as const] }
  return session
}
export async function demoWorkspace(token: string) {
  const { workspace } = await read(token)
  const session = await demoSession(token)
  requirePermission(session, 'stores.read')
  return { ...workspace, sales: session.permissions.includes('sales.read') ? createDemoSales(workspace.stores, new Date().toISOString()) : null, updatedAt: new Date().toISOString(), invoices: session.permissions.includes('billing.read') ? workspace.invoices : [], audit: session.permissions.includes('audit.read') ? workspace.audit : [], team: session.permissions.includes('team.read') ? workspace.team : [] }
}
export async function deleteDemo(token: string) { await unlink(file(token)).catch(() => undefined) }
export async function mutateDemo(token: string, storeId: number, input: Mutation) {
  return serial(async () => {
    const state = await read(token), { session, workspace } = state
    requirePermission(session, input.action.startsWith('key.') ? 'keys.read' : input.action === 'module.update' ? 'modules.write' : 'stores.write')
    const store = workspace.stores.find(item => item.id === storeId)
    if (!store) throw new MasterError(404, 'Loja não encontrada.')
    if ('revision' in input && input.revision !== store.revision) throw new MasterError(409, 'Esta loja foi atualizada. Atualize a página antes de salvar.')
    let before: string | null = null, after: string | null = null
    if (input.action === 'store.update') {
      before = `${store.status} / ${store.plan}`; after = `${input.status} / ${input.plan}`
      store.status = input.status; store.plan = input.plan; store.revision++
    } else if (input.action === 'module.update') {
      if (input.expiresAt && Date.parse(input.expiresAt) <= Date.now()) throw new MasterError(422, 'O vencimento precisa estar no futuro.')
      const grant = store.modules.find(item => item.code === input.code)
      if (!grant) throw new MasterError(404, 'Módulo não encontrado.')
      before = JSON.stringify(grant)
      grant.override = input.override; grant.expiresAt = input.override === 'plan' ? null : input.expiresAt
      after = JSON.stringify(grant); store.revision++
    } else if (!store.hasApiKey) throw new MasterError(404, 'Esta loja não possui chave disponível.')
    const id = randomUUID()
    workspace.audit.unshift({ id, actor: session.name, storeId, action: input.action, reason: 'reason' in input ? input.reason : 'Acesso autorizado à chave de demonstração', before, after, createdAt: new Date().toISOString() })
    workspace.updatedAt = new Date().toISOString()
    await save(token, state)
    // No operational credentials: example.test stores and deliberately invalid keys.
    return input.action.startsWith('key.') ? { key: `DEMO_ONLY_NOT_VALID_${store.id}_integration_example`, auditId: id } : { success: true }
  })
}
