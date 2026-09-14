import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { executeBilling, publicAccount, billingView } from '../lib/billing/service'
import { BillingError, commandSchema, type AccountState } from '../lib/billing/types'
import { cryptToken, gateway, type Gateway } from '../lib/billing/provider'
import { estimateBilling } from '../lib/billing/catalog'

const cardId = 'd43f9d4f-6ddd-488f-b7c0-ea71de56cd36'
const secondId = '847953a6-6a55-4e91-9e2a-837f1c44f56d'
const seed = (): AccountState => ({ customerId: 'cus_test', cards: [{ id: cardId, last4: '1234', brand: 'VISA', expiryMonth: '12', expiryYear: '2035', token: 'encrypted-token' }], defaultMethodId: cardId })
function harness(initial = seed()) {
  let state = structuredClone(initial), lock: string | null = null
  const operations = new Map<string, { status: string; fingerprint: string }>()
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = []
  let fail: BillingError | null = null
  const api: Gateway = async <T>(path: string, method = 'GET', input?: unknown) => {
    const body = (input || {}) as Record<string, unknown>; calls.push({ path, method, body })
    if (fail && method !== 'GET') throw fail
    if (path.startsWith('/payments')) return { data: [{ id:'pay_test', customer:'cus_test', value:899, status:'CONFIRMED', dueDate:'2026-09-15' }, { id:'pay_other', customer:'cus_other', value:100, status:'PENDING', dueDate:'2026-09-15' }] } as T
    if (method === 'DELETE') return { deleted: true } as T
    return { id: 'sub_test', customer: 'cus_test', status: body.status ?? 'ACTIVE', nextDueDate:'2026-09-15', value: body.value ?? 899 } as T
  }
  const repo = {
    async read() { return { state: structuredClone(state), operation_id: lock } },
    async begin(id: string, _actor: string, _action: string, fingerprint: string) {
      const existing = operations.get(id)
      if (existing) { if (existing.fingerprint !== fingerprint || existing.status !== 'done') throw new BillingError(409,'Bloqueado'); return null }
      if (lock) throw new BillingError(409,'Bloqueado')
      lock = id; operations.set(id,{ status:'pending', fingerprint }); return structuredClone(state)
    },
    async checkpoint(_id: string, next: AccountState) { state = structuredClone(next) },
    async finish(id: string, next: AccountState, error?: string) { state = structuredClone(next); lock = null; operations.get(id)!.status = error ? 'failed' : 'done' },
  }
  return { deps: { repo, api, encrypt: (v: string) => `encrypted:${v}`, decrypt: () => 'provider-token' }, calls, fail: (v: BillingError) => { fail = v } }
}

test('commercial prices and strict commands reject client amount/store/token injection', () => {
  assert.equal(estimateBilling('plan_starter',2,10).total,119700)
  assert.equal(estimateBilling('plan_profissional',2,10).total,149700)
  const command = { action:'subscribe', requestId:randomUUID(), plan:'plan_starter', methodId:cardId, consent:true }
  assert.equal(commandSchema.safeParse(command).success,true)
  for (const extra of [{ value: 1 }, { storeId: 99 }, { creditCardToken: 'other' }, { consent:false }, { plan:'plan_multiloja' }]) assert.equal(commandSchema.safeParse({ ...command,...extra }).success,false)
})
test('subscription uses server price and token; repeated request cannot charge twice', async () => {
  const h = harness(), command = commandSchema.parse({ action:'subscribe', requestId:randomUUID(), plan:'plan_profissional', methodId:cardId, consent:true })
  await executeBilling(1,'admin',command,'203.0.113.1',h.deps)
  await executeBilling(1,'admin',command,'203.0.113.1',h.deps)
  const writes = h.calls.filter(c => c.method === 'POST')
  assert.equal(writes.length,1); assert.equal(writes[0].body.value,1199)
  assert.equal(writes[0].body.creditCardToken,'provider-token')
  assert.equal(writes[0].body.remoteIp,'203.0.113.1')
  const another = { ...command, requestId:randomUUID() }
  await assert.rejects(executeBilling(1,'admin',another,'203.0.113.1',h.deps), /já possui/)
  assert.equal(h.calls.filter(c => c.method === 'POST').length,1)
})
test('card from another store cannot be used to subscribe', async () => {
  const h = harness()
  await assert.rejects(executeBilling(1,'admin',{ action:'subscribe', requestId:randomUUID(), plan:'plan_starter',methodId:secondId,consent:true },'203.0.113.1',h.deps), /nesta loja/)
  assert.equal(h.calls.length,0)
})
test('ambiguous creation stays locked and never automatically repeats the payment', async () => {
  const h = harness(); h.fail(new BillingError(502,'Timeout',true))
  const command = { action:'subscribe' as const, requestId:randomUUID(),plan:'plan_starter' as const,methodId:cardId,consent:true as const }
  await assert.rejects(executeBilling(1,'admin',command,'203.0.113.1',h.deps))
  await assert.rejects(executeBilling(1,'admin',{ ...command,requestId:randomUUID() },'203.0.113.1',h.deps))
  assert.equal(h.calls.length,1); assert.ok((await h.deps.repo.read()).operation_id)
})
test('definitive rejection releases lock without adding a subscription', async () => {
  const h = harness(); h.fail(new BillingError(422,'Recusado'))
  await assert.rejects(executeBilling(1,'admin',{ action:'subscribe',requestId:randomUUID(),plan:'plan_starter',methodId:cardId,consent:true },'203.0.113.1',h.deps))
  const account = await h.deps.repo.read(); assert.equal(account.operation_id,null); assert.equal(account.state.subscription,undefined)
})
test('switch default updates subscription card without creating a payment; in-use card cannot be removed', async () => {
  const state = seed(); state.cards.push({ ...state.cards[0], id:secondId, last4:'9876' }); state.subscription = { id:'sub_test',plan:'plan_starter',status:'ACTIVE',nextDueDate:'2026-09-15',value:899,methodId:cardId }
  const h = harness(state)
  await assert.rejects(executeBilling(1,'admin',{ action:'remove-card',requestId:randomUUID(),methodId:cardId },'203.0.113.1',h.deps), /Troque/)
  await executeBilling(1,'admin',{ action:'default-card',requestId:randomUUID(),methodId:secondId,consent:true },'203.0.113.1',h.deps)
  assert.ok(h.calls.some(c => c.path === '/subscriptions/sub_test/creditCard' && c.method === 'PUT'))
  assert.ok(!h.calls.some(c => c.method === 'POST'))
  assert.equal((await h.deps.repo.read()).state.subscription?.methodId,secondId)
})
test('plan change preserves issued invoices and cancellation is persisted', async () => {
  const state = seed(); state.subscription = { id:'sub_test',plan:'plan_starter',status:'ACTIVE',nextDueDate:'2026-09-15',value:899,methodId:cardId }
  const h = harness(state)
  await executeBilling(1,'admin',{ action:'change-plan',requestId:randomUUID(),plan:'plan_profissional',consent:true },'203.0.113.1',h.deps)
  const update = h.calls.find(c => c.method === 'PUT')!; assert.equal(update.body.value,1199); assert.equal(update.body.updatePendingPayments,false)
  await executeBilling(1,'admin',{ action:'cancel',requestId:randomUUID(),consent:true },'203.0.113.1',h.deps)
  assert.equal((await h.deps.repo.read()).state.subscription?.status,'CANCELLED')
})
test('public view exposes masked cards and only the customer invoices', async () => {
  const h = harness(), view = await billingView(1,true,h.deps)
  assert.equal(JSON.stringify(publicAccount(seed())).includes('encrypted-token'),false)
  assert.equal(view.invoices.length,1); assert.equal(view.invoices[0].amount,89900)
  assert.equal('customerId' in view,false)
})
test('tokens are encrypted and bound to store and environment', () => {
  const previous = process.env.BILLING_TOKEN_ENCRYPTION_KEY, env = process.env.ASAAS_ENVIRONMENT
  process.env.BILLING_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32); process.env.ASAAS_ENVIRONMENT='sandbox'
  try {
    const encrypted = cryptToken('secret-provider-token',1)
    assert.ok(!encrypted.includes('secret-provider-token')); assert.equal(cryptToken(encrypted,1,true),'secret-provider-token')
    assert.throws(() => cryptToken(encrypted,2,true))
    process.env.ASAAS_ENVIRONMENT='production'; assert.throws(() => cryptToken(encrypted,1,true))
  } finally { if (previous === undefined) delete process.env.BILLING_TOKEN_ENCRYPTION_KEY; else process.env.BILLING_TOKEN_ENCRYPTION_KEY=previous; if (env === undefined) delete process.env.ASAAS_ENVIRONMENT; else process.env.ASAAS_ENVIRONMENT=env }
})
test('gateway never leaks provider error payloads to the customer', async () => {
  const original = globalThis.fetch, key = process.env.ASAAS_API_KEY
  process.env.ASAAS_API_KEY='test-only'
  globalThis.fetch=async () => new Response(JSON.stringify({ errors:[{ description:'Asaas secret 4111111111111111 CVV 123' }] }), {status:400})
  try { await assert.rejects(gateway('/subscriptions','POST',{}), error => error instanceof BillingError && !error.message.includes('4111') && !error.message.includes('Asaas')) }
  finally { globalThis.fetch=original; if (key === undefined) delete process.env.ASAAS_API_KEY; else process.env.ASAAS_API_KEY=key }
})

test('adding a card saves only encrypted token and masked metadata, without charging', async () => {
  const h = harness({ cards: [] })
  const calls: { path: string; body: unknown }[] = []
  h.deps.api = async <T>(path: string, _method = 'GET', body?: unknown) => {
    calls.push({path,body})
    if (path.startsWith('/customers?')) return {data:[]} as T
    if (path === '/customers') return {id:'cus_test'} as T
    if (path === '/creditCard/tokenizeCreditCard') return {creditCardToken:'new-token',creditCardBrand:'VISA',creditCardNumber:'1111'} as T
    throw new Error('Unexpected endpoint')
  }
  const command = commandSchema.parse({ action:'add-card',requestId:randomUUID(),consent:true,
    card:{holderName:'Sandbox Test',number:'4111111111111111',expiryMonth:'12',expiryYear:'2035',ccv:'123'},
    holder:{name:'Sandbox Test',email:'test@example.com',cpfCnpj:'12345678901',postalCode:'01001000',addressNumber:'1',phone:'11999999999'} })
  await executeBilling(1,'admin',command,'203.0.113.1',h.deps)
  const account = await h.deps.repo.read(), serialized = JSON.stringify(account)
  assert.equal(account.state.cards[0].last4,'1111')
  assert.equal(account.state.cards[0].token,'encrypted:new-token')
  assert.ok(!serialized.includes('4111111111111111')); assert.ok(!serialized.includes('ccv')); assert.ok(!serialized.includes('test@example.com'))
  assert.ok(!calls.some(c => c.path.includes('subscriptions') || c.path.includes('payments')))
})

test('failed persistence after a successful provider charge keeps operation locked', async () => {
  const h = harness()
  h.deps.repo.checkpoint = async () => { throw new Error('Database temporarily unavailable') }
  const command = { action:'subscribe' as const,requestId:randomUUID(),plan:'plan_starter' as const,methodId:cardId,consent:true as const }
  await assert.rejects(executeBilling(1,'admin',command,'203.0.113.1',h.deps))
  assert.ok((await h.deps.repo.read()).operation_id)
  await assert.rejects(executeBilling(1,'admin',{...command,requestId:randomUUID()},'203.0.113.1',h.deps))
  assert.equal(h.calls.filter(c => c.method === 'POST').length,1)
})
