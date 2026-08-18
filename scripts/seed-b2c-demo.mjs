import assert from 'node:assert/strict'
import { loadEnvFile } from 'node:process'

try {
  loadEnvFile('.env.local')
} catch {
  // As credenciais também podem vir do processo pai.
}

const base = 'http://localhost:8080'
const adminEmail = process.env.LOCAL_ADMIN_EMAIL
const adminPassword = process.env.LOCAL_ADMIN_PASSWORD
const consumer = {
  name: 'Consumidor B2C Demo',
  email: 'consumidor.b2c@upzero.local',
  cpf: '52998224725',
  phone: '11988887777',
  password: '123456',
}
const reseller = {
  id: '9001',
  name: 'Cliente Demo B2B',
  email: 'cliente.demo@upvitrine.local',
  phone: '11999999999',
  city: 'São Paulo',
  state: 'SP',
}

assert(adminEmail && adminPassword, 'LOCAL_ADMIN_EMAIL e LOCAL_ADMIN_PASSWORD são obrigatórios')

async function jsonRequest(pathname, init = {}) {
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
  body: JSON.stringify({ email: adminEmail, password: adminPassword }),
})
const adminHeaders = {
  cookie: `adminAuthToken=${login.token}`,
  'content-type': 'application/json',
}

const identified = await jsonRequest('/v1/clients/identify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: consumer.email }),
})

if (!identified.exists) {
  await jsonRequest('/v1/clients', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      store_id: 1043,
      name: consumer.name,
      email: consumer.email,
      cpf: consumer.cpf,
      phone: consumer.phone,
      password: consumer.password,
    }),
  })
}

const consumerLogin = await jsonRequest('/v1/clients/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: consumer.email, password: consumer.password }),
})
assert(consumerLogin?.data?.id, 'A conta consumidora não retornou sessão válida')

const leads = await jsonRequest('/b2c/leads', { headers: adminHeaders })
let request = leads.find((lead) => lead.source === 'B2C_LINKED_DEMO' && lead.email === consumer.email)

if (!request) {
  const created = await jsonRequest('/b2c/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      store_id: 1043,
      source: 'B2C_LINKED_DEMO',
      name: consumer.name,
      email: consumer.email,
      phone: consumer.phone,
      document: consumer.cpf,
      zip_code: '01001000',
      city: 'São Paulo',
      state: 'SP',
      preferred_channel: 'WHATSAPP',
      consent_accepted: true,
      items: [{
        product_id: '9000001',
        product_name: 'Produto Demo Sandbox',
        product_slug: 'demo-local-001-produto-demo-sandbox',
        sku: 'DEMO-LOCAL-001',
        variant_id: '9100001',
        color: 'Preto',
        size: 'M',
        quantity: 1,
      }],
    }),
  })
  request = created.lead
}

if (request.assignedReseller?.id !== reseller.id) {
  request = await jsonRequest(`/b2c/leads/${encodeURIComponent(request.id)}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'ASSIGN', mode: 'MANUAL', reseller }),
  })
}

console.log(JSON.stringify({
  ok: true,
  consumer: { email: consumer.email, cpf: consumer.cpf, password: consumer.password },
  reseller: { email: reseller.email, password: '123456' },
  request: {
    code: request.requestCode,
    status: request.status,
    assignedReseller: request.assignedReseller?.name || null,
    items: request.items?.length || 0,
  },
}, null, 2))
