// Run only against the dedicated local demo, never production.
import assert from 'node:assert/strict'
const base = 'http://127.0.0.1:3010'
async function call(path, method = 'GET', cookie = '', input, origin = base) {
  return fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}) }, body: input === undefined ? undefined : JSON.stringify(input), redirect: 'manual' })
}
assert.equal((await call('/api/workspace')).status, 401)
assert.equal((await call('/api/session', 'POST', '', { demo: true, role: 'owner' }, 'https://other.example')).status, 403)
const response = await call('/api/session', 'POST', '', { demo: true, role: 'viewer' })
assert.equal(response.status, 200)
const session = await response.json()
assert.equal(session.mode, 'demo')
const cookie = response.headers.get('set-cookie').split(';')[0]
try {
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i)
  const workspace = await call('/api/workspace', 'GET', cookie)
  assert.match(workspace.headers.get('cache-control'), /no-store/)
  const data = await workspace.json()
  assert.equal(data.stores.length, 12); assert.deepEqual(data.invoices, [])
  assert.equal((await call('/api/stores/2001/actions', 'POST', cookie, { action: 'key.reveal' })).status, 403)
  assert.equal((await call('/api/stores/2001/actions', 'POST', cookie, { action: 'key.copy', actor: 'admin' })).status, 422)
} finally {
  assert.equal((await call('/api/session', 'DELETE', cookie)).status, 200)
}
assert.equal((await call('/api/workspace', 'GET', cookie)).status, 401)
console.log('HTTP: sessão, CSRF, no-store, permissões, dados restritos, validação e logout aprovados.')
