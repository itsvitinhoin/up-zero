import assert from 'node:assert/strict'
import { loadEnvFile } from 'node:process'

try {
  loadEnvFile('.env.local')
} catch {
  // Credentials can also be provided by the parent process.
}

const base = 'http://localhost:8080'
const email = process.env.LOCAL_ADMIN_EMAIL
const password = process.env.LOCAL_ADMIN_PASSWORD
assert(email && password, 'Credenciais locais do Admin não configuradas')

const jsonRequest = async (pathname, init = {}) => {
  const response = await fetch(new URL(pathname, base), init)
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`${response.status} ${pathname}: ${JSON.stringify(payload)}`)
  }
  return payload
}

const login = await jsonRequest('/admin/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const adminHeaders = { cookie: `adminAuthToken=${login.token}` }
const leads = await jsonRequest('/b2c/leads', { headers: adminHeaders })
const existing = leads.find((lead) => lead.source === 'LOCAL_DEMO_ORDER')

if (existing) {
  console.log(JSON.stringify({ ok: true, created: false, requestCode: existing.requestCode }, null, 2))
  process.exit(0)
}

const products = await jsonRequest('/products?store_id=1043&page=1&limit=24&search=DEMO-LOCAL-001', {
  headers: adminHeaders,
})
const product = products.find((entry) => entry.code === 'DEMO-LOCAL-001')
assert(product, 'Crie primeiro o Produto Demo Sandbox no Admin')
const variant = product.variants?.[0]
assert(variant, 'Produto demo sem variante')

const result = await jsonRequest('/b2c/leads', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    store_id: 1043,
    source: 'LOCAL_DEMO_ORDER',
    name: 'Consumidor Teste Local',
    email: 'consumidor.teste@sandbox.invalid',
    phone: '11999990000',
    document: '00000000191',
    zip_code: '01001000',
    city: 'São Paulo',
    state: 'SP',
    consent_accepted: true,
    preferred_channel: 'WHATSAPP',
    items: [{
      product_id: String(product.id),
      product_name: product.name,
      product_slug: product.slug,
      sku: variant.sku,
      variant_id: String(variant.id),
      color: variant.attribute_values?.find((entry) => entry.attribute_code === 'color')?.value_name || 'Padrão',
      size: variant.attribute_values?.find((entry) => entry.attribute_code === 'size')?.value_name || 'Único',
      quantity: 2,
      unit_price: Number(variant.price_cents || 0) / 100,
    }],
  }),
})

console.log(JSON.stringify({
  ok: true,
  created: true,
  requestCode: result.lead?.requestCode,
  items: result.lead?.items?.length || 0,
}, null, 2))
