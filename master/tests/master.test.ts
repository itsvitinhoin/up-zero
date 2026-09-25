import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemo, deleteDemo, demoWorkspace, mutateDemo } from '../lib/demo'
import { MasterError, moduleEnabled, mutationSchema, storeSchema } from '../lib/contracts'

test('store DTO never includes API keys or unknown secret fields', async () => {
  const { token } = await createDemo('owner')
  try {
    const store = (await demoWorkspace(token)).stores[0]
    const publicStore = storeSchema.parse({ ...store, api_key: 'secret', storefront_api_key: 'secret', meta: { apiKey: 'secret' } })
    assert.equal(JSON.stringify(publicStore).includes('secret'), false)
  } finally { await deleteDemo(token) }
})
test('viewer cannot reveal, copy or mutate; financial and audit data are withheld', async () => {
  const { token } = await createDemo('viewer')
  try {
    const workspace = await demoWorkspace(token)
    assert.equal(workspace.invoices.length + workspace.audit.length + workspace.team.length, 0)
    for (const action of ['key.reveal', 'key.copy'] as const) await assert.rejects(mutateDemo(token, 2001, { action }), error => error instanceof MasterError && error.status === 403)
    await assert.rejects(mutateDemo(token, 2001, { action: 'store.update', revision: 0, status: 'suspended', plan: 'pro', reason: 'Permission test' }), error => error instanceof MasterError && error.status === 403)
  } finally { await deleteDemo(token) }
})
test('key accesses are audited without saving credential contents', async () => {
  const { token } = await createDemo('owner')
  try {
    for (const action of ['key.reveal', 'key.copy'] as const) {
      const result = await mutateDemo(token, 2001, { action })
      assert.ok(typeof result.key === 'string' && result.key.startsWith('DEMO_ONLY_NOT_VALID_'))
    }
    const workspace = await demoWorkspace(token)
    assert.equal(workspace.audit.length, 2)
    assert.equal(JSON.stringify(workspace).includes('DEMO_ONLY_NOT_VALID'), false)
    assert.equal(workspace.audit[0].storeId, 2001)
  } finally { await deleteDemo(token) }
})
test('changes persist, reject stale edits and do not modify another session or subscription', async () => {
  const first = await createDemo('owner'), second = await createDemo('owner')
  try {
    const input = { action: 'store.update' as const, revision: 0, status: 'suspended' as const, plan: 'pro' as const, reason: 'Revisão de cadastro' }
    await mutateDemo(first.token, 2001, input)
    await assert.rejects(mutateDemo(first.token, 2001, input), error => error instanceof MasterError && error.status === 409)
    const changed = (await demoWorkspace(first.token)).stores[0]
    assert.equal(changed.status, 'suspended'); assert.equal(changed.subscription, 'active'); assert.equal(changed.revision, 1)
    assert.equal((await demoWorkspace(second.token)).stores[0].status, 'active')
  } finally { await deleteDemo(first.token); await deleteDemo(second.token) }
})
test('module exceptions expire back to the plan and past dates are rejected', async () => {
  const { token } = await createDemo('owner')
  try {
    await mutateDemo(token, 2001, { action: 'module.update', revision: 0, code: 'wms', override: 'enabled', expiresAt: new Date(Date.now() + 86400000).toISOString(), reason: 'Teste comercial de WMS' })
    const store = (await demoWorkspace(token)).stores[0], grant = store.modules.find(item => item.code === 'wms')!
    assert.equal(moduleEnabled(store, grant, Date.now()), true)
    assert.equal(moduleEnabled(store, grant, Date.now() + 2 * 86400000), false)
    await assert.rejects(mutateDemo(token, 2001, { action: 'module.update', revision: 1, code: 'wms', override: 'enabled', expiresAt: '2020-01-01T00:00:00Z', reason: 'Data inválida' }), error => error instanceof MasterError && error.status === 422)
  } finally { await deleteDemo(token) }
})
test('missing stores, absent keys and revoked sessions fail closed', async () => {
  const { token } = await createDemo('owner')
  try {
    await assert.rejects(mutateDemo(token, 9999, { action: 'key.reveal' }), error => error instanceof MasterError && error.status === 404)
    await assert.rejects(mutateDemo(token, 2010, { action: 'key.copy' }), error => error instanceof MasterError && error.status === 404)
  } finally { await deleteDemo(token) }
  await assert.rejects(demoWorkspace(token), error => error instanceof MasterError && error.status === 401)
})
test('action schema rejects client-supplied actor, credentials and invalid reasons', () => {
  assert.equal(mutationSchema.safeParse({ action: 'key.copy', actor: 'owner', apiKey: 'secret' }).success, false)
  assert.equal(mutationSchema.safeParse({ action: 'store.update', revision: 0, status: 'active', plan: 'pro', reason: '  ' }).success, false)
})
