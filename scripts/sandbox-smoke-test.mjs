import assert from 'node:assert/strict'
import { loadEnvFile } from 'node:process'

try {
  loadEnvFile('.env.local')
} catch {
  // The sandbox can also receive credentials from the parent process.
}

const base = 'http://localhost:8080'
const email = process.env.LOCAL_ADMIN_EMAIL
const password = process.env.LOCAL_ADMIN_PASSWORD

assert(email && password, 'LOCAL_ADMIN_EMAIL e LOCAL_ADMIN_PASSWORD são obrigatórios')

const request = async (pathname, init = {}) => {
  const response = await fetch(new URL(pathname, base), init)
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { response, payload }
}

const login = await request('/admin/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
assert.equal(login.response.status, 200, `Login local falhou: ${JSON.stringify(login.payload)}`)

const cookie = `adminAuthToken=${login.payload.token}`
const consumerEmail = 'smoke.consumer@sandbox.invalid'
const consumerPassword = 'sandbox123'
const identified = await request('/v1/clients/identify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: consumerEmail }),
})
assert.equal(identified.response.status, 200, 'Identificação de consumidor falhou')
if (!identified.payload.exists) {
  const registered = await request('/v1/clients', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      store_id: 1043,
      name: 'Consumidor Smoke Test',
      email: consumerEmail,
      cpf: '12345678909',
      phone: '11999990001',
      password: consumerPassword,
    }),
  })
  assert.equal(registered.response.status, 201, `Cadastro de consumidor falhou: ${JSON.stringify(registered.payload)}`)
}

const consumerLogin = await request('/v1/clients/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: consumerEmail, password: consumerPassword }),
})
assert.equal(consumerLogin.response.status, 200, `Login de consumidor falhou: ${JSON.stringify(consumerLogin.payload)}`)
const consumerCookie = consumerLogin.response.headers.get('set-cookie')?.split(';')[0]
assert(consumerCookie, 'Login do consumidor não retornou cookie')
const consumerMe = await request('/v1/clients/me', { headers: { cookie: consumerCookie } })
assert.equal(consumerMe.response.status, 200, 'Sessão do consumidor falhou')
assert.equal(consumerMe.payload.email, consumerEmail, 'Sessão retornou outro consumidor')

const suffix = Date.now().toString(36)
const productInput = {
  store_id: 1043,
  code: `TESTE-${suffix}`,
  slug: `produto-teste-local-${suffix}`,
  name: 'Produto Teste Local',
  description: 'Criado automaticamente para validar Admin → Vitrine.',
  composition: '100% ambiente sandbox',
  active: true,
  tags: ['teste-local'],
  variants: [{
    sku: `SKU-${suffix}`,
    price_cents: 15990,
    stock_qty: 12,
    active: true,
    attribute_values: [],
    images: [],
  }],
}

const created = await request('/products/sync', {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify(productInput),
})
assert.equal(created.response.status, 201, `Criação falhou: ${JSON.stringify(created.payload)}`)
const productId = created.payload?.product?.id
assert(productId, 'Produto criado sem ID')

const adminList = await request(`/internal/admin/products-paginated?store_id=1043&page=1&limit=24&search=${encodeURIComponent(productInput.code)}`, {
  headers: { cookie },
})
assert.equal(adminList.response.status, 200, `Listagem do Admin falhou: ${JSON.stringify(adminList.payload)}`)
assert(adminList.payload.items.some((product) => product.id === productId), 'Produto não apareceu no Admin')

const store = await request('/stores/1043')
assert.equal(store.response.status, 200, 'Loja sandbox não carregou')
assert(store.payload?.storefront_api_key, 'Loja sandbox sem chave pública da vitrine')

const storefrontHeaders = { 'x-api-key': store.payload.storefront_api_key }
const storefrontList = await request(`/v1/products/catalog?store_id=1043&page=1&limit=24&search=${encodeURIComponent(productInput.code)}`, {
  headers: storefrontHeaders,
})
assert.equal(storefrontList.response.status, 200, `Catálogo falhou: ${JSON.stringify(storefrontList.payload)}`)
assert(storefrontList.payload.items.some((product) => product.id === productId), 'Produto não apareceu na vitrine')

const detail = await request(`/v1/product/data/${productInput.slug}?store_id=1043`, {
  headers: storefrontHeaders,
})
assert.equal(detail.response.status, 200, `Detalhe falhou: ${JSON.stringify(detail.payload)}`)
assert.equal(detail.payload?.product?.id, productId, 'Detalhe retornou outro produto')

const updated = await request('/products/sync', {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ ...productInput, id: productId, name: 'Produto Teste Local Atualizado' }),
})
assert.equal(updated.response.status, 200, `Edição falhou: ${JSON.stringify(updated.payload)}`)
assert.equal(updated.payload?.product?.name, 'Produto Teste Local Atualizado', 'Nome não foi atualizado')

const removed = await request(`/products/${productId}`, {
  method: 'DELETE',
  headers: { cookie },
})
assert.equal(removed.response.status, 200, `Exclusão falhou: ${JSON.stringify(removed.payload)}`)

console.log(JSON.stringify({
  ok: true,
  checks: [
    'admin-login',
    'consumer-register-login-session',
    'product-create',
    'admin-list',
    'storefront-list',
    'product-detail',
    'product-update',
    'product-delete',
  ],
  productId,
}, null, 2))
