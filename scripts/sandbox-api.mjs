import http from 'node:http'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_FILE = resolve(ROOT, '.sandbox/state.json')
const PORT = 8080
const UPSTREAM = 'https://api.upzero.com.br'
const SOURCE_STORE_ID = 8
const SANDBOX_STORE_ID = 1043
const SANDBOX_NAME = 'UP Zero Sandbox Local'
const SANDBOX_SLUG = 'up-zero-sandbox-local'

const DEFAULT_B2C_SETTINGS = {
  mode: 'MANUAL',
  resellerLists: [
    {
      id: 'list-active-resellers',
      name: 'Revendedores ativos',
      description: 'Parceiros aprovados que compraram nos últimos 90 dias.',
      enabled: true,
      priority: 'BRONZE',
      filters: {
        requireApproved: true,
        requirePreviousOrder: true,
        maxDaysSinceLastOrder: 90,
        minOrders: 1,
        minTotalSpent: 0,
        states: [],
      },
      includedResellerIds: [],
      excludedResellerIds: [],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    },
  ],
  enabledResellerIds: [],
  preferredResellerIds: [],
  resellerLevels: {},
  filters: {
    requireApproved: true,
    requirePreviousOrder: true,
    maxDaysSinceLastOrder: 90,
    minOrders: 1,
    minTotalSpent: 0,
    prioritizeSameState: true,
  },
  resellerDirectory: [],
  updatedAt: null,
}

try {
  loadEnvFile(resolve(ROOT, '.env.local'))
} catch {
  // The startup validation below reports missing local credentials.
}

const adminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
const adminPassword = process.env.LOCAL_ADMIN_PASSWORD?.trim()

if (!adminEmail || !adminPassword) {
  throw new Error('LOCAL_ADMIN_EMAIL e LOCAL_ADMIN_PASSWORD são obrigatórios em .env.local')
}

const tokenPayload = Buffer.from(JSON.stringify({
  sub: 'sandbox-admin',
  id: 'sandbox-admin',
  email: adminEmail,
  role: 'ADMIN',
  store_id: SANDBOX_STORE_ID,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
})).toString('base64url')
const sandboxToken = `sandbox.${tokenPayload}.local`

const SANDBOX_PERMISSION_CODES = [
  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'products.manage_categories',
  'products.manage_images',
  'products.manage_variants',
  'products.manage_videos',
  'orders.view',
  'orders.create',
  'orders.edit',
  'orders.cancel',
  'orders.manage_returns',
  'orders.manage_shipping',
  'orders.mark_paid',
  'orders.view_assigned_only',
  'customers.view',
  'customers.create',
  'customers.edit',
  'customers.delete',
  'customers.assign_seller',
  'customers.manage_addresses',
  'customers.manage_support_tickets',
  'customers.support',
  'customers.view_assigned_only',
  'offline.view_customers',
  'offline.view_sellers',
  'offline.view_orders',
  'offline.view_assignment',
  'reports.view',
  'reports.export',
  'settings.view',
  'settings.edit',
  'settings.manage_roles',
  'settings.manage_team',
  'inventory.view',
  'inventory.edit',
  'inventory.manage_movements',
  'custom_links.view',
  'custom_links.create',
  'custom_links.edit',
  'custom_links.delete',
  'messaging.view',
  'messaging.send',
  'messaging.manage_settings',
  'messaging.manage_templates',
  'assets.view',
  'assets.create',
  'assets.edit',
  'assets.delete',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'prices.view',
  'prices.edit',
  'pages.view',
  'pages.create',
  'pages.edit',
  'pages.delete',
]

const SANDBOX_PERMISSIONS = SANDBOX_PERMISSION_CODES.map((code, index) => ({
  id: index + 1,
  code,
  description: `Permissão Sandbox: ${code}`,
  group: code.split('.')[0],
  created_at: '2026-08-10T00:00:00.000Z',
}))

const SANDBOX_ROLE = {
  id: 1043,
  store_id: SANDBOX_STORE_ID,
  name: 'Administrador Sandbox',
  description: 'Acesso total ao ambiente Sandbox local',
  is_system: true,
  color: '#111827',
  created_at: '2026-08-10T00:00:00.000Z',
  updated_at: '2026-08-10T00:00:00.000Z',
}

function sandboxPermissionSummary() {
  return {
    user_id: 1043,
    role_id: SANDBOX_ROLE.id,
    role_name: SANDBOX_ROLE.name,
    is_system_role: true,
    permissions_from_role: SANDBOX_PERMISSIONS,
    permission_overrides: [],
    total_permissions: SANDBOX_PERMISSIONS.length,
  }
}

function loadState() {
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    return {
      ...parsed,
      store: parsed.store || {},
      products: Array.isArray(parsed.products) ? parsed.products : [],
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      b2cLeads: Array.isArray(parsed.b2cLeads) ? parsed.b2cLeads : [],
      b2cSettings: normalizeB2CSettings(parsed.b2cSettings),
    }
  } catch {
    return {
      store: {},
      products: [],
      clients: [],
      b2cLeads: [],
      b2cSettings: normalizeB2CSettings(null),
    }
  }
}

function saveState(state) {
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
}

let state = loadState()

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeText(value) {
  return String(value || '').trim()
}

function uniqueStrings(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((entry) => normalizeText(entry)).filter(Boolean))]
}

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function positiveInteger(value, fallback = null) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

function slugify(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SAFE_RESELLER_CITY_COORDINATES = {
  'sao paulo|SP': [-23.5505, -46.6333],
  'campinas|SP': [-22.9056, -47.0608],
  'rio de janeiro|RJ': [-22.9068, -43.1729],
  'belo horizonte|MG': [-19.9167, -43.9345],
  'salvador|BA': [-12.9777, -38.5016],
  'recife|PE': [-8.0476, -34.877],
  'fortaleza|CE': [-3.7319, -38.5267],
  'brasilia|DF': [-15.7939, -47.8828],
  'curitiba|PR': [-25.4284, -49.2733],
  'porto alegre|RS': [-30.0346, -51.2177],
}

const SAFE_SANDBOX_RESELLERS = [
  {
    id: '9001',
    name: 'Cliente Demo B2B',
    email: 'cliente.demo@upvitrine.local',
    phone: '11999999999',
    city: 'São Paulo',
    state: 'SP',
    address: 'Avenida Paulista, 1000',
    neighborhood: 'Bela Vista',
    latitude: -23.5642,
    longitude: -46.6527,
    specialties: ['Conjuntos', 'Vestidos', 'Lançamentos'],
    orderedProducts: ['03021-conjunto', '03042-vestido', '03019-blusa'],
    ordersCount: 12,
    totalSpent: 18940,
    lastOrderAt: '2026-08-05T12:00:00.000Z',
    eligible: true,
    eligibilityReason: 'Conta local conectada à caixa de oportunidades da vitrine',
  },
  {
    id: 'safe-reseller-2',
    name: 'Aurora Concept',
    email: 'aurora@sandbox.local',
    phone: '11987654321',
    city: 'São Paulo',
    state: 'SP',
    address: 'Rua das Palmeiras, 245',
    neighborhood: 'Jardins',
    latitude: -23.5614,
    longitude: -46.6726,
    specialties: ['Moda feminina', 'Festa', 'Conjuntos'],
    orderedProducts: ['03021-conjunto', '03042-vestido', '03073-blusa'],
    ordersCount: 5,
    totalSpent: 8420,
    lastOrderAt: '2026-07-29T12:00:00.000Z',
    eligible: true,
    eligibilityReason: 'Revendedor simulado aprovado e com pedidos',
  },
  {
    id: 'safe-reseller-3',
    name: 'Casa Nativa',
    email: 'casa.nativa@sandbox.local',
    phone: '31988776655',
    city: 'Belo Horizonte',
    state: 'MG',
    address: 'Rua da Bahia, 1200',
    neighborhood: 'Centro',
    latitude: -19.9256,
    longitude: -43.9387,
    specialties: ['Multimarcas', 'Vestidos', 'Linha nobre'],
    orderedProducts: ['03042-vestido', '03019-blusa', '03024-blusa'],
    ordersCount: 9,
    totalSpent: 15490,
    lastOrderAt: '2026-07-17T12:00:00.000Z',
    eligible: true,
    eligibilityReason: 'Revendedor simulado aprovado e com pedidos',
  },
]

function normalizeLookup(value) {
  return normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function safeResellerConfig() {
  const mode = normalizeText(process.env.SAFE_RESELLER_MODE).toLowerCase() === 'api' ? 'API' : 'SANDBOX'
  const apiUrl = normalizeText(process.env.SAFE_RESELLER_API_URL)
  const apiKey = normalizeText(process.env.SAFE_RESELLER_API_KEY || process.env.UPZERO_API_KEY)
  const authMode = normalizeText(process.env.SAFE_RESELLER_API_AUTH).toLowerCase() === 'bearer' ? 'bearer' : 'x-api-key'
  const storeId = normalizeText(process.env.SAFE_RESELLER_API_STORE_ID)
  return {
    mode,
    apiUrl,
    apiKey,
    authMode,
    storeId,
    configured: mode === 'API' && Boolean(apiUrl && apiKey),
  }
}

function safeCollection(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['items', 'data', 'customers', 'resellers', 'results']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  return []
}

function safeResellerCoordinates(city, state, index) {
  const key = `${normalizeLookup(city)}|${normalizeText(state).toUpperCase()}`
  const center = SAFE_RESELLER_CITY_COORDINATES[key] || SAFE_RESELLER_CITY_COORDINATES['sao paulo|SP']
  const offset = ((index % 7) - 3) * 0.006
  return { latitude: center[0] + offset, longitude: center[1] - offset }
}

function normalizeSafeReseller(customer, index) {
  const wholesale = customer?.wholesale_profile || customer?.wholesaleProfile || customer?.profile || {}
  const id = normalizeText(customer?.id || customer?.customer_id || wholesale?.customer_id)
  const name = normalizeText(
    wholesale?.trade_name
    || wholesale?.tradeName
    || wholesale?.company_name
    || wholesale?.companyName
    || customer?.trade_name
    || customer?.company_name
    || customer?.name,
  )
  if (!id || !name) return null

  const city = normalizeText(wholesale?.address_city || wholesale?.city || customer?.address_city || customer?.city)
  const stateCode = normalizeText(wholesale?.address_state || wholesale?.state || customer?.address_state || customer?.state).toUpperCase().slice(0, 2)
  const coordinates = safeResellerCoordinates(city, stateCode, index)
  const status = normalizeText(customer?.status || wholesale?.status || 'APPROVED').toUpperCase()
  const ordersCount = finiteNonNegative(customer?.orders_count ?? customer?.ordersCount ?? customer?.order_count)
  const totalSpent = finiteNonNegative(customer?.total_spent ?? customer?.totalSpent ?? customer?.lifetime_value)
  const lastOrderAt = customer?.last_order_at || customer?.lastOrderAt || null
  const specialties = uniqueStrings(customer?.specialties || wholesale?.specialties || customer?.segments || wholesale?.segment)
  const orderedProducts = uniqueStrings(customer?.ordered_products || customer?.orderedProducts || customer?.product_slugs)
  const eligible = status === 'APPROVED'

  return {
    id,
    name,
    email: normalizeText(customer?.email) || null,
    phone: digitsOnly(customer?.phone || wholesale?.phone) || null,
    city: city || null,
    state: stateCode || null,
    document: '',
    address: normalizeText(wholesale?.address_street || customer?.address_street || customer?.address) || (city ? `Atendimento em ${city}` : 'Atendimento online'),
    neighborhood: normalizeText(wholesale?.address_neighborhood || customer?.address_neighborhood || customer?.neighborhood) || 'Revendedor autorizado',
    latitude: Number.isFinite(Number(customer?.latitude || wholesale?.latitude)) ? Number(customer?.latitude || wholesale?.latitude) : coordinates.latitude,
    longitude: Number.isFinite(Number(customer?.longitude || wholesale?.longitude)) ? Number(customer?.longitude || wholesale?.longitude) : coordinates.longitude,
    specialties: specialties.length > 0 ? specialties : ['Revendedor autorizado'],
    orderedProducts,
    ordersCount,
    totalSpent,
    lastOrderAt,
    eligible,
    eligibilityReason: eligible ? 'Cadastro aprovado na fonte somente leitura' : `Status na fonte: ${status || 'não informado'}`,
  }
}

function safeDirectoryFallback() {
  const saved = state.b2cSettings?.resellerDirectory || []
  const byId = new Map(SAFE_SANDBOX_RESELLERS.map((reseller) => [String(reseller.id), reseller]))
  for (const reseller of saved) {
    const id = String(reseller.id)
    byId.set(id, { ...(byId.get(id) || {}), ...reseller })
  }
  return [...byId.values()]
}

async function readSafeResellerDirectory({ requireApi = false } = {}) {
  const config = safeResellerConfig()
  if (!config.configured) {
    if (requireApi) {
      return {
        ok: false,
        source: 'SANDBOX',
        configured: false,
        error: 'Configure SAFE_RESELLER_MODE=api, SAFE_RESELLER_API_URL e a chave local para sincronizar.',
        resellers: safeDirectoryFallback(),
      }
    }
    return { ok: true, source: 'SANDBOX', configured: false, resellers: safeDirectoryFallback() }
  }

  try {
    const url = new URL(config.apiUrl)
    if (url.protocol !== 'https:') throw new Error('A URL da fonte real precisa usar HTTPS.')
    if (config.storeId && !url.searchParams.has('store_id')) url.searchParams.set('store_id', config.storeId)
    const headers = { Accept: 'application/json' }
    if (config.authMode === 'bearer') headers.Authorization = `Bearer ${config.apiKey}`
    else headers['x-api-key'] = config.apiKey

    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`A fonte respondeu HTTP ${response.status}.`)
    const payload = await response.json()
    const resellers = safeCollection(payload)
      .map((customer, index) => normalizeSafeReseller(customer, index))
      .filter(Boolean)
    if (resellers.length === 0) throw new Error('A fonte não retornou revendedores reconhecíveis.')
    return { ok: true, source: 'API_READ_ONLY', configured: true, resellers }
  } catch (error) {
    return {
      ok: false,
      source: 'SANDBOX',
      configured: true,
      error: error instanceof Error ? error.message : 'Falha ao consultar a fonte somente leitura.',
      resellers: safeDirectoryFallback(),
    }
  }
}

function publicSafeReseller(reseller) {
  return {
    id: String(reseller.id),
    name: normalizeText(reseller.name),
    phone: digitsOnly(reseller.phone),
    city: normalizeText(reseller.city),
    state: normalizeText(reseller.state).toUpperCase().slice(0, 2),
    address: normalizeText(reseller.address) || (reseller.city ? `Atendimento em ${reseller.city}` : 'Atendimento online'),
    neighborhood: normalizeText(reseller.neighborhood) || 'Revendedor autorizado',
    latitude: Number(reseller.latitude),
    longitude: Number(reseller.longitude),
    online: reseller.online !== false,
    specialties: uniqueStrings(reseller.specialties),
    orderedProducts: uniqueStrings(reseller.orderedProducts),
    ordersCount: finiteNonNegative(reseller.ordersCount),
  }
}

function nextStateId(collection, floor) {
  const highest = (Array.isArray(collection) ? collection : []).reduce((max, entry) => {
    const id = positiveInteger(entry?.id, 0)
    return Math.max(max, id)
  }, floor)
  return highest + 1
}

function hashSandboxPassword(password) {
  const salt = randomBytes(16)
  const digest = scryptSync(String(password), salt, 32)
  return `${salt.toString('hex')}:${digest.toString('hex')}`
}

function verifySandboxPassword(password, storedHash) {
  try {
    const [saltHex, digestHex] = String(storedHash || '').split(':')
    if (!saltHex || !digestHex) return false
    const expected = Buffer.from(digestHex, 'hex')
    const actual = scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

function createSandboxClientToken(client) {
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    sub: String(client.id),
    email: client.email,
    store_id: SANDBOX_STORE_ID,
    customer_type: client.customer_type,
    iat: now,
    exp: now + (7 * 24 * 60 * 60),
  })).toString('base64url')
  const signature = createHmac('sha256', adminPassword).update(payload).digest('base64url')
  return `sandbox-client.${payload}.${signature}`
}

function readSandboxClientFromRequest(req) {
  const cookie = String(req.headers.cookie || '')
  const cookieToken = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('clientAuthToken='))
    ?.slice('clientAuthToken='.length)
  const authorization = String(req.headers.authorization || '')
  const bearerToken = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : ''
  const token = cookieToken || bearerToken
  if (!token) return null

  try {
    const [prefix, payloadPart, signature] = token.split('.')
    if (prefix !== 'sandbox-client' || !payloadPart || !signature) return null
    const expected = createHmac('sha256', adminPassword).update(payloadPart).digest('base64url')
    const expectedBuffer = Buffer.from(expected)
    const actualBuffer = Buffer.from(signature)
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      return null
    }
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
    if (
      Number(payload?.store_id) !== SANDBOX_STORE_ID
      || Number(payload?.exp) <= Math.floor(Date.now() / 1000)
    ) {
      return null
    }
    return state.clients.find((client) => String(client.id) === String(payload.sub)) || null
  } catch {
    return null
  }
}

function publicSandboxClient(client) {
  return {
    id: client.id,
    store_id: SANDBOX_STORE_ID,
    name: client.name,
    email: client.email,
    phone: client.phone || null,
    cpf: client.cpf_cnpj || null,
    cpf_cnpj: client.cpf_cnpj || null,
    customer_type: client.customer_type || 'RETAIL',
    account_type: client.customer_type || 'RETAIL',
    status: client.status || 'APPROVED',
    address_zip: client.address_zip || null,
    address_street: client.address_street || null,
    address_number: client.address_number || null,
    address_complement: client.address_complement || null,
    address_neighborhood: client.address_neighborhood || null,
    address_city: client.address_city || null,
    address_state: client.address_state || null,
    created_at: client.created_at,
    updated_at: client.updated_at,
  }
}

let sourceStorePromise = null
let sourceAttributeIndexPromise = null

async function getSourceStore() {
  if (!sourceStorePromise) {
    sourceStorePromise = fetch(`${UPSTREAM}/stores/${SOURCE_STORE_ID}`, {
      headers: { Accept: 'application/json' },
    }).then(async (response) => {
      if (!response.ok) throw new Error('Não foi possível carregar a loja de referência')
      return response.json()
    }).catch((error) => {
      sourceStorePromise = null
      throw error
    })
  }
  return sourceStorePromise
}

async function getSourceAttributeValueIndex() {
  if (!sourceAttributeIndexPromise) {
    sourceAttributeIndexPromise = (async () => {
      const sourceStore = await getSourceStore()
      const apiKey = normalizeText(sourceStore?.storefront_api_key)
      if (!apiKey) return new Map()

      const url = new URL('/v1/product-attributes/with-values', UPSTREAM)
      url.searchParams.set('store_id', String(SOURCE_STORE_ID))
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'x-api-key': apiKey },
      })
      if (!response.ok) return new Map()

      const attributes = await response.json()
      const index = new Map()
      for (const attribute of Array.isArray(attributes) ? attributes : []) {
        for (const value of Array.isArray(attribute?.values) ? attribute.values : []) {
          const valueId = positiveInteger(value?.id)
          if (!valueId) continue
          index.set(valueId, {
            id: valueId,
            value_id: valueId,
            attribute_id: positiveInteger(attribute?.id),
            attribute_code: normalizeText(attribute?.code) || normalizeText(attribute?.name),
            attribute_name: normalizeText(attribute?.name) || normalizeText(attribute?.code),
            value_name: normalizeText(value?.name) || normalizeText(value?.code),
            value_code: normalizeText(value?.code) || normalizeText(value?.name),
            value_meta: value?.meta && typeof value.meta === 'object' ? value.meta : {},
            value_sort_order: finiteNonNegative(value?.sort_order),
          })
        }
      }
      return index
    })().catch((error) => {
      sourceAttributeIndexPromise = null
      throw error
    })
  }
  return sourceAttributeIndexPromise
}

function fallbackVariantAttributes() {
  return [
    {
      id: 9_910_001,
      value_id: 9_910_001,
      attribute_id: 9_900_001,
      attribute_code: 'color',
      attribute_name: 'Cor',
      value_name: 'Padrão',
      value_code: 'padrao',
      value_meta: { hex: '#9CA3AF' },
      value_sort_order: 0,
    },
    {
      id: 9_920_001,
      value_id: 9_920_001,
      attribute_id: 9_900_002,
      attribute_code: 'size',
      attribute_name: 'Tamanho',
      value_name: 'Único',
      value_code: 'unico',
      value_meta: {},
      value_sort_order: 0,
    },
  ]
}

async function normalizeLocalProduct(input, existing = null) {
  const attributeIndex = await getSourceAttributeValueIndex().catch(() => new Map())
  const now = new Date().toISOString()
  const productId = positiveInteger(input?.id)
    || positiveInteger(existing?.id)
    || nextStateId(state.products, 9_000_000)
  const code = normalizeText(input?.code) || normalizeText(existing?.code) || `LOCAL-${productId}`
  const name = normalizeText(input?.name) || normalizeText(existing?.name) || code
  const slug = slugify(input?.slug || `${code}-${name}`) || `produto-${productId}`
  const rawVariants = Array.isArray(input?.variants) && input.variants.length > 0
    ? input.variants
    : Array.isArray(existing?.variants) && existing.variants.length > 0
      ? existing.variants
      : [{ sku: code, price_cents: 0, stock_qty: 999, active: true, attribute_values: [] }]

  let nextVariantId = nextStateId(
    state.products.flatMap((product) => Array.isArray(product?.variants) ? product.variants : []),
    9_100_000,
  )
  const variants = rawVariants.map((variant, index) => {
    const rawAttributes = Array.isArray(variant?.attribute_values) ? variant.attribute_values : []
    let attributeValues = rawAttributes.map((entry) => {
      if (entry && typeof entry === 'object') return entry
      return attributeIndex.get(positiveInteger(entry)) || null
    }).filter(Boolean)
    if (attributeValues.length === 0) attributeValues = fallbackVariantAttributes()

    const variantId = positiveInteger(variant?.id) || nextVariantId++
    const images = uniqueStrings(variant?.images)
    return {
      id: variantId,
      product_id: productId,
      sku: normalizeText(variant?.sku) || `${code}-${index + 1}`,
      price_cents: Math.round(finiteNonNegative(variant?.price_cents)),
      cost_cents: Math.round(finiteNonNegative(variant?.cost_cents)),
      promo_cents: Math.round(finiteNonNegative(variant?.promo_cents)),
      stock_qty: Math.round(finiteNonNegative(variant?.stock_qty, 999)),
      reserved_qty: Math.round(finiteNonNegative(variant?.reserved_qty)),
      active: variant?.active !== false,
      is_highlighted: variant?.is_highlighted === true,
      ncm: normalizeText(variant?.ncm) || null,
      barcode: normalizeText(variant?.barcode) || null,
      weight_grams: finiteNonNegative(variant?.weight_grams) || null,
      combination_key: attributeValues.map((entry) => entry.value_id || entry.id).join(','),
      meta: variant?.meta && typeof variant.meta === 'object' ? variant.meta : {},
      attribute_values: attributeValues,
      images,
    }
  })

  return {
    id: productId,
    store_id: SANDBOX_STORE_ID,
    code,
    slug,
    name,
    description: normalizeText(input?.description) || null,
    composition: normalizeText(input?.composition) || null,
    location: normalizeText(input?.location) || null,
    measurement_table_id: positiveInteger(input?.measurement_table_id),
    active: input?.active !== false,
    category_ids: (Array.isArray(input?.category_ids) ? input.category_ids : [])
      .map((value) => positiveInteger(value))
      .filter(Boolean),
    tags: uniqueStrings(input?.tags),
    meta: input?.meta && typeof input.meta === 'object' ? input.meta : {},
    image_grouping_rule: input?.image_grouping_rule || JSON.stringify({ type: 'product' }),
    video_grouping_rule: input?.video_grouping_rule || JSON.stringify({ type: 'product' }),
    variants,
    created_at: existing?.created_at || now,
    updated_at: now,
  }
}

function localProductFull(product) {
  const productImages = uniqueStrings(product?.variants?.flatMap((variant) => variant.images || []))
  return {
    product: { ...product, variants: undefined },
    variants: product.variants || [],
    image_groups: productImages.length > 0
      ? [{ id: `local-images-${product.id}`, image_key: 'product', images: productImages, variants: [] }]
      : [],
    video_groups: [],
  }
}

function matchesLocalProduct(product, requestUrl) {
  const search = normalizeText(requestUrl.searchParams.get('search')).toLowerCase()
  const status = normalizeText(requestUrl.searchParams.get('status')).toLowerCase()
  const categoryId = positiveInteger(requestUrl.searchParams.get('category_id'))
  const categorySlug = normalizeText(requestUrl.searchParams.get('category_slug')).toLowerCase()

  if (status === 'active' && product.active === false) return false
  if (status === 'inactive' && product.active !== false) return false
  if (categoryId && !(product.category_ids || []).includes(categoryId)) return false
  if (categorySlug && !product.tags?.some((tag) => slugify(tag) === categorySlug)) return false
  if (search) {
    const haystack = `${product.name} ${product.code} ${product.slug}`.toLowerCase()
    if (!haystack.includes(search)) return false
  }
  return true
}

function normalizeB2CSettings(value) {
  const input = value && typeof value === 'object' ? value : {}
  const mode = ['MANUAL', 'AUTOMATIC', 'TIERED'].includes(input.mode) ? input.mode : DEFAULT_B2C_SETTINGS.mode
  const resellerLevels = input.resellerLevels && typeof input.resellerLevels === 'object'
    ? Object.fromEntries(Object.entries(input.resellerLevels).map(([id, level]) => [id, ['GOLD', 'SILVER', 'BRONZE'].includes(level) ? level : 'BRONZE']))
    : {}
  const directory = (Array.isArray(input.resellerDirectory) ? input.resellerDirectory : [])
    .filter((reseller) => reseller?.id && reseller?.name)
    .map((reseller) => ({
      id: String(reseller.id),
      name: normalizeText(reseller.name),
      email: normalizeText(reseller.email) || null,
      phone: digitsOnly(reseller.phone) || null,
      city: normalizeText(reseller.city) || null,
      state: normalizeText(reseller.state).toUpperCase().slice(0, 2) || null,
      document: digitsOnly(reseller.document),
      ordersCount: finiteNonNegative(reseller.ordersCount),
      totalSpent: finiteNonNegative(reseller.totalSpent),
      lastOrderAt: reseller.lastOrderAt || null,
      eligible: reseller.eligible === true,
      eligibilityReason: normalizeText(reseller.eligibilityReason),
      level: ['GOLD', 'SILVER', 'BRONZE'].includes(reseller.level) ? reseller.level : (resellerLevels[String(reseller.id)] || 'BRONZE'),
    }))
  const filters = input.filters && typeof input.filters === 'object' ? input.filters : {}
  const rawMaxDays = filters.maxDaysSinceLastOrder
  const normalizedGlobalFilters = {
    requireApproved: filters.requireApproved !== false,
    requirePreviousOrder: filters.requirePreviousOrder !== false,
    maxDaysSinceLastOrder: rawMaxDays === null || rawMaxDays === '' ? null : finiteNonNegative(rawMaxDays, 90),
    minOrders: finiteNonNegative(filters.minOrders),
    minTotalSpent: finiteNonNegative(filters.minTotalSpent),
    prioritizeSameState: filters.prioritizeSameState !== false,
  }
  const sourceLists = Array.isArray(input.resellerLists) && input.resellerLists.length > 0
    ? input.resellerLists
    : [{
        ...DEFAULT_B2C_SETTINGS.resellerLists[0],
        filters: {
          ...DEFAULT_B2C_SETTINGS.resellerLists[0].filters,
          ...normalizedGlobalFilters,
          states: [],
        },
        includedResellerIds: uniqueStrings(input.enabledResellerIds),
      }]
  const resellerLists = sourceLists.map((list, index) => {
    const listFilters = list?.filters && typeof list.filters === 'object' ? list.filters : {}
    const listMaxDays = listFilters.maxDaysSinceLastOrder
    return {
      id: normalizeText(list?.id) || `list-${index + 1}`,
      name: normalizeText(list?.name) || `Lista ${index + 1}`,
      description: normalizeText(list?.description),
      enabled: list?.enabled !== false,
      priority: ['PREFERRED', 'GOLD', 'SILVER', 'BRONZE'].includes(list?.priority) ? list.priority : 'BRONZE',
      filters: {
        requireApproved: listFilters.requireApproved !== false,
        requirePreviousOrder: listFilters.requirePreviousOrder !== false,
        maxDaysSinceLastOrder: listMaxDays === null || listMaxDays === '' ? null : finiteNonNegative(listMaxDays, 90),
        minOrders: finiteNonNegative(listFilters.minOrders),
        minTotalSpent: finiteNonNegative(listFilters.minTotalSpent),
        states: uniqueStrings(listFilters.states).map((state) => state.toUpperCase().slice(0, 2)).filter((state) => state.length === 2),
      },
      includedResellerIds: uniqueStrings(list?.includedResellerIds),
      excludedResellerIds: uniqueStrings(list?.excludedResellerIds),
      createdAt: list?.createdAt || new Date().toISOString(),
      updatedAt: list?.updatedAt || new Date().toISOString(),
    }
  })
  return {
    mode,
    resellerLists,
    enabledResellerIds: uniqueStrings(input.enabledResellerIds),
    preferredResellerIds: uniqueStrings(input.preferredResellerIds),
    resellerLevels,
    filters: normalizedGlobalFilters,
    resellerDirectory: directory,
    resellerSourceSyncedAt: input.resellerSourceSyncedAt || null,
    updatedAt: input.updatedAt || null,
  }
}

function resellerPassesB2CListFilters(reseller, filters) {
  if (filters.requireApproved && !reseller.eligible) return false
  if (filters.requirePreviousOrder && reseller.ordersCount < 1) return false
  if (reseller.ordersCount < filters.minOrders || reseller.totalSpent < filters.minTotalSpent) return false
  if (filters.states.length > 0 && (!reseller.state || !filters.states.includes(reseller.state))) return false
  if (filters.maxDaysSinceLastOrder !== null) {
    if (!reseller.lastOrderAt) return false
    const age = Date.now() - new Date(reseller.lastOrderAt).getTime()
    if (!Number.isFinite(age) || age > filters.maxDaysSinceLastOrder * 86_400_000) return false
  }
  return true
}

function resellerMatchesB2CList(reseller, list) {
  if (!list.enabled || list.excludedResellerIds.includes(reseller.id)) return false
  if (list.includedResellerIds.includes(reseller.id)) return true
  return resellerPassesB2CListFilters(reseller, list.filters)
}

function resellerPriorityInLists(reseller, settings) {
  const weight = { PREFERRED: 4, GOLD: 3, SILVER: 2, BRONZE: 1 }
  return settings.resellerLists
    .filter((list) => resellerMatchesB2CList(reseller, list))
    .sort((left, right) => weight[right.priority] - weight[left.priority])[0]?.priority || null
}

function chooseB2CReseller(lead, settings) {
  const assignedCounts = state.b2cLeads.reduce((counts, entry) => {
    const id = entry.assignedReseller?.id
    if (id) counts[id] = (counts[id] || 0) + 1
    return counts
  }, {})
  const levelWeight = { PREFERRED: 4, GOLD: 3, SILVER: 2, BRONZE: 1 }
  return settings.resellerDirectory
    .map((reseller) => ({ reseller, priority: resellerPriorityInLists(reseller, settings) }))
    .filter((entry) => entry.priority)
    .sort((left, right) => {
      const priorityDiff = (levelWeight[right.priority] || 0) - (levelWeight[left.priority] || 0)
      if (priorityDiff) return priorityDiff
      if (settings.filters.prioritizeSameState) {
        const stateDiff = Number(Boolean(lead.state && right.reseller.state === lead.state)) - Number(Boolean(lead.state && left.reseller.state === lead.state))
        if (stateDiff) return stateDiff
      }
      const loadDiff = (assignedCounts[left.reseller.id] || 0) - (assignedCounts[right.reseller.id] || 0)
      if (loadDiff) return loadDiff
      return right.reseller.ordersCount - left.reseller.ordersCount
    })[0]?.reseller || null
}

function assignB2CLeadToReseller(lead, reseller, mode) {
  lead.assignedReseller = {
    id: reseller.id,
    name: reseller.name,
    email: reseller.email,
    phone: reseller.phone,
    city: reseller.city,
    state: reseller.state,
  }
  lead.assignmentMode = mode
  lead.assignedAt = new Date().toISOString()
  lead.status = 'ASSIGNED'
  lead.resellerResponse = 'PENDING'
  lead.resellerRespondedAt = null
  addLeadEvent(lead, 'ASSIGNED', `Lead atribuído para ${reseller.name}.`, { resellerId: reseller.id, mode })
}

function newLeadId() {
  return `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function newRequestCode() {
  return `SOL-${String(Date.now()).slice(-6)}`
}

function normalizeLeadItems(value) {
  if (!Array.isArray(value)) return []

  return value.slice(0, 20).map((item, index) => {
    const quantity = Math.min(99, Math.max(1, Number.parseInt(item?.quantity, 10) || 1))
    const unitPrice = Number(item?.unit_price)
    return {
      id: `item-${Date.now().toString(36)}-${index}`,
      productId: normalizeText(item?.product_id),
      productName: normalizeText(item?.product_name) || 'Produto',
      productSlug: normalizeText(item?.product_slug) || null,
      sku: normalizeText(item?.sku) || null,
      imageUrl: normalizeText(item?.image_url) || null,
      variantId: normalizeText(item?.variant_id) || null,
      color: normalizeText(item?.color) || null,
      size: normalizeText(item?.size) || null,
      quantity,
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : null,
    }
  }).filter((item) => item.productId && item.productName)
}

function calculateRequestValue(items) {
  if (!items.length || items.some((item) => typeof item.unitPrice !== 'number')) return null
  return items.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
}

function addLeadEvent(lead, type, description, metadata = {}) {
  const now = new Date().toISOString()
  lead.events = [
    ...(Array.isArray(lead.events) ? lead.events : []),
    {
      id: `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      description,
      metadata,
      createdAt: now,
    },
  ]
  lead.updatedAt = now
}

function findDuplicateLead(input) {
  const phone = digitsOnly(input.phone)
  const document = digitsOnly(input.document)
  const email = normalizeText(input.email).toLowerCase()

  return state.b2cLeads.find((lead) => {
    if (Number(lead.storeId) !== Number(input.store_id)) return false
    if (['CONVERTED', 'LOST', 'INVALID'].includes(lead.status)) return false
    return Boolean(
      (phone && digitsOnly(lead.phone) === phone) ||
      (document && digitsOnly(lead.document) === document) ||
      (email && normalizeText(lead.email).toLowerCase() === email)
    )
  })
}

function corsHeaders(req) {
  const origin = req.headers.origin
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ])
  const allowed = allowedOrigins.has(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Store-API-Key',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  }
}

function sendJson(req, res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    ...corsHeaders(req),
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 2_000_000) throw new Error('Payload excede 2 MB')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function isAuthenticated(req) {
  const cookie = String(req.headers.cookie || '')
  const rawToken = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('adminAuthToken='))
    ?.slice('adminAuthToken='.length)

  if (!rawToken) return false
  if (rawToken === sandboxToken) return true

  try {
    const [prefix, payloadPart, suffix] = rawToken.split('.')
    if (prefix !== 'sandbox' || suffix !== 'local' || !payloadPart) return false

    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
    const expiresAt = Number(payload?.exp)

    return payload?.role === 'ADMIN'
      && Number(payload?.store_id) === SANDBOX_STORE_ID
      && String(payload?.email || '').trim() === adminEmail
      && Number.isFinite(expiresAt)
      && expiresAt > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

function remapUrl(inputUrl) {
  const localUrl = inputUrl instanceof URL
    ? inputUrl
    : new URL(inputUrl, `http://localhost:${PORT}`)
  const url = new URL(`${localUrl.pathname}${localUrl.search}`, UPSTREAM)
  url.pathname = url.pathname.replace(
    new RegExp(`(^|/)${SANDBOX_STORE_ID}(?=/|$)`, 'g'),
    `$1${SOURCE_STORE_ID}`,
  )
  for (const [key, value] of url.searchParams.entries()) {
    if ((key === 'store_id' || key === 'storeId') && value === String(SANDBOX_STORE_ID)) {
      url.searchParams.set(key, String(SOURCE_STORE_ID))
    }
  }
  return url
}

function remapJson(value) {
  if (Array.isArray(value)) return value.map(remapJson)
  if (!value || typeof value !== 'object') return value

  const output = {}
  for (const [key, entry] of Object.entries(value)) {
    if ((key === 'store_id' || key === 'storeId') && Number(entry) === SOURCE_STORE_ID) {
      output[key] = SANDBOX_STORE_ID
    } else {
      output[key] = remapJson(entry)
    }
  }
  return output
}

async function fetchSandboxStore(req, res) {
  const upstreamResponse = await fetch(`${UPSTREAM}/stores/${SOURCE_STORE_ID}`, {
    headers: { Accept: 'application/json' },
  })
  if (!upstreamResponse.ok) {
    return sendJson(req, res, 502, { error: 'Não foi possível carregar a referência da loja 8' })
  }

  const sourceStore = await upstreamResponse.json()
  const sandboxStore = {
    ...sourceStore,
    ...state.store,
    id: SANDBOX_STORE_ID,
    name: state.store.name || SANDBOX_NAME,
    slug: SANDBOX_SLUG,
    email: state.store.email || 'sandbox-local@upzero.invalid',
    description: state.store.description || 'Ambiente local isolado; nenhuma gravação chega à produção.',
    meta: {
      ...(sourceStore.meta || {}),
      ...(state.store.meta || {}),
      environment: 'sandbox',
      isolated: true,
      source_store_id: SOURCE_STORE_ID,
    },
  }
  return sendJson(req, res, 200, sandboxStore)
}

async function proxyRead(req, res, requestUrl) {
  const upstreamUrl = remapUrl(requestUrl)
  const headers = { ...req.headers }
  delete headers.host
  delete headers.cookie
  delete headers.origin
  delete headers.referer
  delete headers['content-length']

  const upstreamResponse = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    redirect: 'manual',
  })
  const contentType = upstreamResponse.headers.get('content-type') || 'application/octet-stream'
  const raw = Buffer.from(await upstreamResponse.arrayBuffer())

  if (contentType.includes('application/json')) {
    try {
      const mapped = remapJson(JSON.parse(raw.toString('utf8')))
      return sendJson(req, res, upstreamResponse.status, mapped)
    } catch {
      // Fall through and return the original upstream body.
    }
  }

  res.writeHead(upstreamResponse.status, {
    ...corsHeaders(req),
    'Content-Type': contentType,
  })
  res.end(raw)
}

async function fetchMappedJson(req, requestUrl) {
  const upstreamUrl = remapUrl(requestUrl)
  const headers = { ...req.headers }
  delete headers.host
  delete headers.cookie
  delete headers.origin
  delete headers.referer
  delete headers['content-length']

  const response = await fetch(upstreamUrl, {
    method: 'GET',
    headers,
    redirect: 'manual',
  })
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || !contentType.includes('application/json')) {
    return { response, payload: null }
  }

  return {
    response,
    payload: remapJson(await response.json()),
  }
}

function mergeProductsByIdentity(localProducts, upstreamProducts) {
  const localIdentity = new Set(
    localProducts.flatMap((product) => [
      `id:${product.id}`,
      `code:${normalizeText(product.code).toLowerCase()}`,
      `slug:${normalizeText(product.slug).toLowerCase()}`,
    ]),
  )
  const filteredUpstream = upstreamProducts.filter((product) => {
    const identities = [
      `id:${product?.id}`,
      `code:${normalizeText(product?.code).toLowerCase()}`,
      `slug:${normalizeText(product?.slug).toLowerCase()}`,
    ]
    return !identities.some((identity) => localIdentity.has(identity))
  })
  return [...localProducts, ...filteredUpstream]
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://localhost:${PORT}`)
    const method = String(req.method || 'GET').toUpperCase()

    if (method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req))
      return res.end()
    }

    if (requestUrl.pathname === '/sandbox/status') {
      const resellerConfig = safeResellerConfig()
      return sendJson(req, res, 200, {
        environment: 'sandbox',
        isolated: true,
        sandbox_store_id: SANDBOX_STORE_ID,
        source_store_id: SOURCE_STORE_ID,
        upstream_write_policy: 'blocked',
        reseller_data: {
          mode: resellerConfig.mode,
          configured: resellerConfig.configured,
          upstream_method: 'GET_ONLY',
          raw_payload_persisted: false,
        },
        counts: {
          products: state.products.length,
          clients: state.clients.length,
          b2c_leads: state.b2cLeads.length,
          b2c_orders: state.b2cLeads.filter((lead) => Array.isArray(lead.items) && lead.items.length > 0).length,
        },
      })
    }

    if (requestUrl.pathname === '/admin/login' && method === 'POST') {
      const body = await readJson(req)
      if (body.email !== adminEmail || body.password !== adminPassword) {
        return sendJson(req, res, 401, { error: 'E-mail ou senha inválidos' })
      }
      return sendJson(req, res, 200, {
        token: sandboxToken,
        admin: {
          id: 1043,
          name: 'Admin Sandbox',
          email: adminEmail,
          role: 'ADMIN',
          store_id: SANDBOX_STORE_ID,
        },
      })
    }

    if (requestUrl.pathname === '/admin/me' && method === 'GET') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      return sendJson(req, res, 200, {
        id: 1043,
        name: 'Admin Sandbox',
        email: adminEmail,
        role: 'ADMIN',
        store_id: SANDBOX_STORE_ID,
        is_system_role: true,
        permission_codes: SANDBOX_PERMISSION_CODES,
      })
    }

    if (requestUrl.pathname === '/permissions/check' && method === 'GET') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      return sendJson(req, res, 200, {
        has_permission: true,
        source: 'system_role',
      })
    }

    const userPermissionsMatch = requestUrl.pathname.match(/^\/permissions\/user\/(\d+)\/permissions$/)
    if (userPermissionsMatch && method === 'GET') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      return sendJson(req, res, 200, sandboxPermissionSummary())
    }

    if (requestUrl.pathname === '/permissions' && method === 'GET') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      return sendJson(req, res, 200, SANDBOX_PERMISSIONS)
    }

    if (requestUrl.pathname === '/permissions/groups' && method === 'GET') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      return sendJson(req, res, 200, [SANDBOX_ROLE])
    }

    if (requestUrl.pathname === `/permissions/groups/${SANDBOX_ROLE.id}` && method === 'GET') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      return sendJson(req, res, 200, {
        role: SANDBOX_ROLE,
        permissions: SANDBOX_PERMISSIONS,
        permission_count: SANDBOX_PERMISSIONS.length,
      })
    }

    if (requestUrl.pathname === `/stores/${SANDBOX_STORE_ID}` && (method === 'GET' || method === 'HEAD')) {
      return fetchSandboxStore(req, res)
    }

    if (requestUrl.pathname === `/stores/${SANDBOX_STORE_ID}` && (method === 'PUT' || method === 'PATCH')) {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      const body = await readJson(req)
      state = { ...state, store: { ...state.store, ...body, id: SANDBOX_STORE_ID, slug: SANDBOX_SLUG } }
      saveState(state)
      return fetchSandboxStore(req, res)
    }

    if (requestUrl.pathname === '/v1/clients/identify' && method === 'POST') {
      const body = await readJson(req)
      const identifier = normalizeText(body.identifier).toLowerCase()
      const identifierDigits = digitsOnly(identifier)
      const client = state.clients.find((entry) =>
        normalizeText(entry.email).toLowerCase() === identifier
        || (identifierDigits && digitsOnly(entry.cpf_cnpj) === identifierDigits),
      )
      return sendJson(req, res, 200, client
        ? {
          exists: true,
          email: client.email,
          name: client.name,
          cpfCnpj: client.cpf_cnpj,
          cpf_cnpj: client.cpf_cnpj,
          customer_type: client.customer_type,
          account_type: client.customer_type,
        }
        : { exists: false })
    }

    if (requestUrl.pathname === '/v1/clients' && method === 'POST') {
      const body = await readJson(req)
      if (body.store_id != null && Number(body.store_id) !== SANDBOX_STORE_ID) {
        return sendJson(req, res, 409, { error: 'Cadastro permitido apenas na loja sandbox 1043.' })
      }

      const name = normalizeText(body.name)
      const email = normalizeText(body.email).toLowerCase()
      const cpfCnpj = digitsOnly(body.cpf || body.cpf_cnpj)
      const phone = digitsOnly(body.phone)
      const password = normalizeText(body.password)
      if (!name || !email || cpfCnpj.length !== 11 || password.length < 6) {
        return sendJson(req, res, 400, {
          error: 'INVALID_CLIENT',
          message: 'Nome, e-mail, CPF e senha com ao menos 6 caracteres são obrigatórios.',
        })
      }
      if (state.clients.some((entry) =>
        normalizeText(entry.email).toLowerCase() === email || digitsOnly(entry.cpf_cnpj) === cpfCnpj,
      )) {
        return sendJson(req, res, 409, { error: 'CLIENT_ALREADY_EXISTS', message: 'Consumidor já cadastrado.' })
      }

      const now = new Date().toISOString()
      const client = {
        id: nextStateId(state.clients, 9_500_000),
        store_id: SANDBOX_STORE_ID,
        name,
        email,
        phone: phone || null,
        cpf_cnpj: cpfCnpj,
        password_hash: hashSandboxPassword(password),
        customer_type: 'RETAIL',
        status: 'APPROVED',
        extra_fields: body.extra_fields && typeof body.extra_fields === 'object' ? body.extra_fields : {},
        created_at: now,
        updated_at: now,
      }
      state.clients.unshift(client)
      saveState(state)
      return sendJson(req, res, 201, publicSandboxClient(client))
    }

    if (requestUrl.pathname === '/v1/clients/login' && method === 'POST') {
      const body = await readJson(req)
      const email = normalizeText(body.email).toLowerCase()
      const client = state.clients.find((entry) => normalizeText(entry.email).toLowerCase() === email)
      if (!client || !verifySandboxPassword(body.password, client.password_hash)) {
        return sendJson(req, res, 401, { error: 'E-mail ou senha inválidos' })
      }
      const token = createSandboxClientToken(client)
      return sendJson(req, res, 200, { data: publicSandboxClient(client) }, {
        'Set-Cookie': `clientAuthToken=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
      })
    }

    if (requestUrl.pathname === '/v1/clients/me' && method === 'GET') {
      const client = readSandboxClientFromRequest(req)
      if (!client) return sendJson(req, res, 401, { error: 'Não autenticado' })
      return sendJson(req, res, 200, publicSandboxClient(client))
    }

    if (requestUrl.pathname === '/v1/storefront/clients/recover-password' && method === 'POST') {
      return sendJson(req, res, 200, {
        ok: true,
        message: 'Em ambiente local nenhum e-mail é enviado. Use novamente a senha cadastrada.',
      })
    }

    if (requestUrl.pathname === '/products/sync' && method === 'POST') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      const body = await readJson(req)
      if (body.store_id != null && Number(body.store_id) !== SANDBOX_STORE_ID) {
        return sendJson(req, res, 409, { error: 'Apenas a loja sandbox 1043 aceita gravações locais.' })
      }

      const existing = state.products.find((product) =>
        (positiveInteger(body.id) && Number(product.id) === Number(body.id))
        || (normalizeText(body.code) && normalizeText(product.code).toLowerCase() === normalizeText(body.code).toLowerCase()),
      ) || null
      const product = await normalizeLocalProduct({ ...body, store_id: SANDBOX_STORE_ID }, existing)
      const slugConflict = state.products.find((entry) =>
        Number(entry.id) !== Number(product.id)
        && normalizeText(entry.slug).toLowerCase() === normalizeText(product.slug).toLowerCase(),
      )
      if (slugConflict) {
        return sendJson(req, res, 409, { error: `Já existe um produto local com o slug ${product.slug}` })
      }

      const existingIndex = state.products.findIndex((entry) => Number(entry.id) === Number(product.id))
      if (existingIndex >= 0) state.products[existingIndex] = product
      else state.products.unshift(product)
      saveState(state)
      return sendJson(req, res, existing ? 200 : 201, localProductFull(product))
    }

    const productFullMatch = requestUrl.pathname.match(/^\/products\/([^/]+)\/full$/)
    if (productFullMatch && method === 'GET') {
      const lookup = decodeURIComponent(productFullMatch[1])
      const localProduct = state.products.find((product) =>
        String(product.id) === lookup
        || normalizeText(product.code).toLowerCase() === lookup.toLowerCase()
        || normalizeText(product.slug).toLowerCase() === lookup.toLowerCase(),
      )
      if (localProduct) return sendJson(req, res, 200, localProductFull(localProduct))
      return proxyRead(req, res, requestUrl)
    }

    const productDeleteMatch = requestUrl.pathname.match(/^\/products\/([^/]+)$/)
    if (productDeleteMatch && method === 'DELETE') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      const lookup = decodeURIComponent(productDeleteMatch[1])
      const before = state.products.length
      state.products = state.products.filter((product) =>
        String(product.id) !== lookup
        && normalizeText(product.code).toLowerCase() !== lookup.toLowerCase(),
      )
      if (state.products.length === before) {
        return sendJson(req, res, 404, { error: 'Produto local não encontrado' })
      }
      saveState(state)
      return sendJson(req, res, 200, { deleted: true })
    }

    if (requestUrl.pathname === '/products' && method === 'GET') {
      const page = Math.max(1, positiveInteger(requestUrl.searchParams.get('page'), 1))
      const localProducts = state.products.filter((product) => matchesLocalProduct(product, requestUrl))
      const { response, payload } = await fetchMappedJson(req, requestUrl)
      const upstreamProducts = Array.isArray(payload) ? payload : []
      const items = mergeProductsByIdentity(page === 1 ? localProducts : [], upstreamProducts)
      const upstreamTotal = Number(response.headers.get('x-total-count'))
      const total = (Number.isFinite(upstreamTotal) ? upstreamTotal : upstreamProducts.length) + localProducts.length
      return sendJson(req, res, 200, items, { 'X-Total-Count': String(total) })
    }

    if (
      (requestUrl.pathname === '/products-paginated'
        || requestUrl.pathname === '/internal/admin/products-paginated')
      && method === 'GET'
    ) {
      const page = Math.max(1, positiveInteger(requestUrl.searchParams.get('page'), 1))
      const limit = Math.max(1, positiveInteger(requestUrl.searchParams.get('limit'), 24))
      const localProducts = state.products.filter((product) => matchesLocalProduct(product, requestUrl))
      const { payload } = await fetchMappedJson(req, requestUrl)
      const upstreamItems = Array.isArray(payload?.items) ? payload.items : []
      const upstreamTotal = Number(payload?.total)
      const items = mergeProductsByIdentity(page === 1 ? localProducts : [], upstreamItems)
      const total = (Number.isFinite(upstreamTotal) ? upstreamTotal : upstreamItems.length) + localProducts.length
      const upstreamSummary = payload?.summary && typeof payload.summary === 'object' ? payload.summary : {}
      const localActive = localProducts.filter((product) => product.active !== false).length
      const localInactive = localProducts.length - localActive
      const localFeatured = localProducts.filter((product) =>
        product.meta?.is_featured === true
        || product.variants?.some((variant) => variant.is_highlighted === true),
      ).length
      return sendJson(req, res, 200, {
        ...(payload && typeof payload === 'object' ? payload : {}),
        items,
        total,
        page,
        limit,
        summary: {
          ...upstreamSummary,
          total: finiteNonNegative(upstreamSummary.total, Number.isFinite(upstreamTotal) ? upstreamTotal : upstreamItems.length) + localProducts.length,
          active: finiteNonNegative(upstreamSummary.active) + localActive,
          inactive: finiteNonNegative(upstreamSummary.inactive) + localInactive,
          featured: finiteNonNegative(upstreamSummary.featured) + localFeatured,
        },
      })
    }

    if ((requestUrl.pathname === '/v1/products/catalog' || requestUrl.pathname === '/v1/products') && method === 'GET') {
      const page = Math.max(1, positiveInteger(requestUrl.searchParams.get('page'), 1))
      const limit = Math.max(1, positiveInteger(requestUrl.searchParams.get('limit'), 24))
      const localProducts = state.products
        .filter((product) => product.active !== false)
        .filter((product) => matchesLocalProduct(product, requestUrl))
      const { payload } = await fetchMappedJson(req, requestUrl)
      const upstreamItems = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : []
      const items = mergeProductsByIdentity(page === 1 ? localProducts : [], upstreamItems)
      const upstreamTotal = Number(payload?.total)
      const total = (Number.isFinite(upstreamTotal) ? upstreamTotal : upstreamItems.length) + localProducts.length
      return sendJson(req, res, 200, {
        ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}),
        items,
        total,
        page,
        limit,
      })
    }

    const storefrontProductMatch = requestUrl.pathname.match(/^\/v1\/product\/data\/([^/]+)$/)
    if (storefrontProductMatch && method === 'GET') {
      const lookup = decodeURIComponent(storefrontProductMatch[1]).toLowerCase()
      const localProduct = state.products.find((product) =>
        String(product.id) === lookup
        || normalizeText(product.code).toLowerCase() === lookup
        || normalizeText(product.slug).toLowerCase() === lookup,
      )
      if (localProduct) return sendJson(req, res, 200, localProductFull(localProduct))
      return proxyRead(req, res, requestUrl)
    }

    if (requestUrl.pathname === '/b2c/settings' && method === 'GET') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      return sendJson(req, res, 200, state.b2cSettings)
    }

    if (requestUrl.pathname === '/b2c/resellers' && method === 'GET') {
      const isAdmin = isAuthenticated(req)
      const isConsumerPortal = req.headers['x-sandbox-consumer-portal'] === 'upzero-local'
      if (!isAdmin && !isConsumerPortal) return sendJson(req, res, 401, { error: 'Acesso inválido' })

      const result = await readSafeResellerDirectory()
      const resellers = isAdmin
        ? result.resellers.map((reseller) => ({
            id: String(reseller.id),
            name: normalizeText(reseller.name),
            email: normalizeText(reseller.email) || null,
            phone: digitsOnly(reseller.phone) || null,
            city: normalizeText(reseller.city) || null,
            state: normalizeText(reseller.state).toUpperCase().slice(0, 2) || null,
            document: '',
            ordersCount: finiteNonNegative(reseller.ordersCount),
            totalSpent: finiteNonNegative(reseller.totalSpent),
            lastOrderAt: reseller.lastOrderAt || null,
            eligible: reseller.eligible === true,
            eligibilityReason: normalizeText(reseller.eligibilityReason),
            level: state.b2cSettings.resellerLevels?.[String(reseller.id)] || reseller.level || 'BRONZE',
          }))
        : result.resellers.map(publicSafeReseller)

      return sendJson(req, res, 200, {
        mode: 'SAFE_READ_ONLY',
        source: result.source,
        configured: result.configured,
        readOnly: true,
        rawPayloadPersisted: false,
        count: resellers.length,
        lastSyncAt: state.b2cSettings.resellerSourceSyncedAt || null,
        error: result.error || null,
        resellers,
      })
    }

    if (requestUrl.pathname === '/b2c/resellers/sync' && method === 'POST') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      const result = await readSafeResellerDirectory({ requireApi: true })
      if (!result.ok) {
        return sendJson(req, res, 409, {
          error: 'SAFE_RESELLER_SYNC_UNAVAILABLE',
          message: result.error,
          source: result.source,
          configured: result.configured,
        })
      }

      const syncedAt = new Date().toISOString()
      state.b2cSettings = normalizeB2CSettings({
        ...state.b2cSettings,
        resellerDirectory: result.resellers.map((reseller) => ({
          ...reseller,
          level: state.b2cSettings.resellerLevels?.[String(reseller.id)] || 'BRONZE',
        })),
        resellerSourceSyncedAt: syncedAt,
      })
      state.b2cSettings.resellerSourceSyncedAt = syncedAt
      saveState(state)
      return sendJson(req, res, 200, {
        mode: 'SAFE_READ_ONLY',
        source: result.source,
        configured: true,
        readOnly: true,
        rawPayloadPersisted: false,
        count: result.resellers.length,
        lastSyncAt: syncedAt,
      })
    }

    if (requestUrl.pathname === '/b2c/settings' && (method === 'PATCH' || method === 'PUT')) {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      const body = await readJson(req)
      state.b2cSettings = normalizeB2CSettings({ ...body, updatedAt: new Date().toISOString() })
      saveState(state)
      return sendJson(req, res, 200, state.b2cSettings)
    }

    if (requestUrl.pathname === '/b2c/consumer-requests' && method === 'GET') {
      if (req.headers['x-sandbox-consumer-portal'] !== 'upzero-local') {
        return sendJson(req, res, 401, { error: 'Acesso de consumidor inválido' })
      }
      const email = normalizeText(requestUrl.searchParams.get('email')).toLowerCase()
      const document = digitsOnly(requestUrl.searchParams.get('document'))
      if (!email && !document) {
        return sendJson(req, res, 400, { error: 'E-mail ou documento é obrigatório' })
      }
      const requests = state.b2cLeads
        .filter((lead) =>
          Number(lead.storeId) === SANDBOX_STORE_ID
          && Array.isArray(lead.items)
          && lead.items.length > 0
          && (
            (email && normalizeText(lead.email).toLowerCase() === email)
            || (document && digitsOnly(lead.document) === document)
          ),
        )
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      return sendJson(req, res, 200, requests)
    }

    if (requestUrl.pathname === '/b2c/leads' && method === 'GET') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      const leads = [...state.b2cLeads]
        .filter((lead) => Number(lead.storeId) === SANDBOX_STORE_ID)
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      return sendJson(req, res, 200, leads)
    }

    if (requestUrl.pathname === '/b2c/leads' && method === 'POST') {
      const body = await readJson(req)
      if (Number(body.store_id) !== SANDBOX_STORE_ID) {
        return sendJson(req, res, 409, {
          error: 'SANDBOX_STORE_REQUIRED',
          message: 'O protótipo de Leads B2C aceita somente a loja sandbox local.',
        })
      }

      const name = normalizeText(body.name)
      const email = normalizeText(body.email).toLowerCase()
      const phone = digitsOnly(body.phone)
      const document = digitsOnly(body.document)
      const consentAccepted = body.consent_accepted === true
      const items = normalizeLeadItems(body.items)

      if (!name || !email || phone.length < 10 || !consentAccepted) {
        return sendJson(req, res, 400, {
          error: 'INVALID_LEAD',
          message: 'Nome, e-mail, celular válido e consentimento são obrigatórios.',
        })
      }

      const duplicate = items.length === 0 ? findDuplicateLead(body) : null
      if (duplicate) {
        addLeadEvent(duplicate, 'DUPLICATE_SUBMISSION', 'Novo envio identificado e anexado ao lead existente.')
        saveState(state)
        return sendJson(req, res, 200, { lead: duplicate, duplicate: true })
      }

      const now = new Date().toISOString()
      const lead = {
        id: newLeadId(),
        storeId: SANDBOX_STORE_ID,
        branchId: normalizeText(body.branch_id) || null,
        source: normalizeText(body.source) || 'STOREFRONT_REGISTRATION',
        name,
        email,
        phone,
        document: document || null,
        documentType: document.length === 11 ? 'CPF' : document.length === 14 ? 'CNPJ' : null,
        zipCode: digitsOnly(body.zip_code) || null,
        city: normalizeText(body.city) || null,
        state: normalizeText(body.state).toUpperCase().slice(0, 2) || null,
        interest: normalizeText(body.interest) || null,
        requestCode: items.length > 0 ? newRequestCode() : null,
        items,
        requestValue: calculateRequestValue(items),
        preferredChannel: normalizeText(body.preferred_channel).toUpperCase() || 'WHATSAPP',
        consent: {
          accepted: true,
          version: 'sandbox-v1',
          acceptedAt: now,
        },
        status: 'NEW',
        assignedReseller: null,
        assignmentMode: null,
        assignedAt: null,
        contactedAt: null,
        convertedAt: null,
        lostReason: null,
        resellerResponse: null,
        resellerRespondedAt: null,
        createdAt: now,
        updatedAt: now,
        events: [{
          id: `event-${Date.now().toString(36)}`,
          type: 'CREATED',
          description: items.length > 0
            ? `Solicitação de compra criada com ${items.reduce((total, item) => total + item.quantity, 0)} item(ns).`
            : 'Lead criado pelo formulário de consumidor da vitrine.',
          metadata: {
            source: normalizeText(body.source) || 'STOREFRONT_REGISTRATION',
            itemCount: items.reduce((total, item) => total + item.quantity, 0),
          },
          createdAt: now,
        }],
      }

      state.b2cLeads.push(lead)
      if (items.length > 0 && ['AUTOMATIC', 'TIERED'].includes(state.b2cSettings.mode)) {
        const reseller = chooseB2CReseller(lead, state.b2cSettings)
        if (reseller) assignB2CLeadToReseller(lead, reseller, 'AUTO')
      }
      saveState(state)
      return sendJson(req, res, 201, { lead, duplicate: false })
    }

    const leadMatch = requestUrl.pathname.match(/^\/b2c\/leads\/([^/]+)$/)
    if (leadMatch && (method === 'PATCH' || method === 'POST')) {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      const lead = state.b2cLeads.find((entry) => entry.id === leadMatch[1])
      if (!lead) return sendJson(req, res, 404, { error: 'Lead não encontrado' })

      const body = await readJson(req)
      if (body.action === 'ASSIGN') {
        const reseller = body.reseller
        if (!reseller?.id || !reseller?.name) {
          return sendJson(req, res, 400, { error: 'Revendedor inválido' })
        }
        lead.assignedReseller = {
          id: String(reseller.id),
          name: normalizeText(reseller.name),
          email: normalizeText(reseller.email) || null,
          phone: digitsOnly(reseller.phone) || null,
          city: normalizeText(reseller.city) || null,
          state: normalizeText(reseller.state).toUpperCase().slice(0, 2) || null,
        }
        lead.assignmentMode = body.mode === 'AUTO' ? 'AUTO' : 'MANUAL'
        lead.assignedAt = new Date().toISOString()
        lead.status = 'ASSIGNED'
        lead.resellerResponse = 'PENDING'
        lead.resellerRespondedAt = null
        addLeadEvent(
          lead,
          'ASSIGNED',
          `Lead atribuído para ${lead.assignedReseller.name}.`,
          { resellerId: lead.assignedReseller.id, mode: lead.assignmentMode },
        )
      } else if (body.action === 'STATUS') {
        const allowedStatuses = ['NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST', 'INVALID']
        const nextStatus = normalizeText(body.status).toUpperCase()
        if (!allowedStatuses.includes(nextStatus)) {
          return sendJson(req, res, 400, { error: 'Status inválido' })
        }
        lead.status = nextStatus
        if (nextStatus === 'CONTACTED') lead.contactedAt = new Date().toISOString()
        if (nextStatus === 'CONVERTED') lead.convertedAt = new Date().toISOString()
        if (nextStatus === 'LOST') lead.lostReason = normalizeText(body.reason) || 'Não informado'
        addLeadEvent(lead, `STATUS_${nextStatus}`, `Status alterado para ${nextStatus}.`, {
          reason: normalizeText(body.reason) || null,
        })
      } else if (body.action === 'UNASSIGN') {
        const previousReseller = lead.assignedReseller?.name || 'revendedor anterior'
        lead.assignedReseller = null
        lead.assignmentMode = null
        lead.assignedAt = null
        lead.status = 'NEW'
        lead.resellerResponse = null
        lead.resellerRespondedAt = null
        addLeadEvent(lead, 'UNASSIGNED', `Atribuição de ${previousReseller} removida.`)
      } else {
        return sendJson(req, res, 400, { error: 'Ação inválida' })
      }

      saveState(state)
      return sendJson(req, res, 200, lead)
    }

    const resellerLeadsMatch = requestUrl.pathname.match(/^\/b2c\/resellers\/([^/]+)\/leads$/)
    if (resellerLeadsMatch && method === 'GET') {
      if (req.headers['x-sandbox-reseller-portal'] !== 'upzero-local') {
        return sendJson(req, res, 401, { error: 'Acesso de revendedor inválido' })
      }
      const resellerId = decodeURIComponent(resellerLeadsMatch[1])
      const leads = state.b2cLeads
        .filter((lead) => Number(lead.storeId) === SANDBOX_STORE_ID && String(lead.assignedReseller?.id) === resellerId)
        .sort((left, right) => String(right.assignedAt || right.createdAt).localeCompare(String(left.assignedAt || left.createdAt)))
      return sendJson(req, res, 200, leads)
    }

    const resellerLeadActionMatch = requestUrl.pathname.match(/^\/b2c\/resellers\/([^/]+)\/leads\/([^/]+)$/)
    if (resellerLeadActionMatch && method === 'PATCH') {
      if (req.headers['x-sandbox-reseller-portal'] !== 'upzero-local') {
        return sendJson(req, res, 401, { error: 'Acesso de revendedor inválido' })
      }
      const resellerId = decodeURIComponent(resellerLeadActionMatch[1])
      const lead = state.b2cLeads.find((entry) => entry.id === resellerLeadActionMatch[2])
      if (!lead || String(lead.assignedReseller?.id) !== resellerId) {
        return sendJson(req, res, 404, { error: 'Solicitação não encontrada para este revendedor' })
      }

      const body = await readJson(req)
      const action = normalizeText(body.action).toUpperCase()
      if (action === 'ACCEPT') {
        lead.resellerResponse = 'ACCEPTED'
        lead.resellerRespondedAt = new Date().toISOString()
        addLeadEvent(lead, 'RESELLER_ACCEPTED', `${lead.assignedReseller.name} aceitou a oportunidade.`)
      } else if (action === 'REJECT') {
        const previousReseller = lead.assignedReseller.name
        lead.assignedReseller = null
        lead.assignmentMode = null
        lead.assignedAt = null
        lead.resellerResponse = 'REJECTED'
        lead.resellerRespondedAt = new Date().toISOString()
        lead.status = 'NEW'
        addLeadEvent(lead, 'RESELLER_REJECTED', `${previousReseller} recusou a oportunidade; ela voltou para a fila.`)
      } else if (action === 'CONTACTED') {
        lead.status = 'CONTACTED'
        lead.contactedAt = new Date().toISOString()
        addLeadEvent(lead, 'STATUS_CONTACTED', 'Revendedor registrou contato com o consumidor.')
      } else if (action === 'CONVERTED') {
        lead.status = 'CONVERTED'
        lead.convertedAt = new Date().toISOString()
        addLeadEvent(lead, 'STATUS_CONVERTED', 'Revendedor registrou a venda como convertida.')
      } else {
        return sendJson(req, res, 400, { error: 'Ação de revendedor inválida' })
      }

      saveState(state)
      return sendJson(req, res, 200, lead)
    }

    const insightsMatch = requestUrl.pathname.match(/^\/b2c\/products\/([^/]+)\/insights$/)
    if (insightsMatch && method === 'GET') {
      const productId = decodeURIComponent(insightsMatch[1])
      const matchingLeads = state.b2cLeads.filter((lead) =>
        Number(lead.storeId) === SANDBOX_STORE_ID
        && Array.isArray(lead.items)
        && lead.items.some((item) => String(item.productId) === productId),
      )
      const seed = [...productId].reduce((total, char) => total + char.charCodeAt(0), 0)
      const requestUnits = matchingLeads.reduce((total, lead) => total + lead.items
        .filter((item) => String(item.productId) === productId)
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0), 0)
      return sendJson(req, res, 200, {
        productId,
        retailRequests: 24 + (seed % 47) + requestUnits,
        productViews: 620 + (seed % 1800) + matchingLeads.length * 7,
        weeklyGrowth: 12 + (seed % 31),
        resellersOrdered: 7 + (seed % 28),
        wishlisted: 18 + (seed % 96),
        ranking: 1 + (seed % 8),
        category: 'categoria',
        signal: seed % 3 === 0 ? 'HOT' : 'RISING',
        isSandboxEstimate: true,
      })
    }

    if (method !== 'GET' && method !== 'HEAD') {
      return sendJson(req, res, 409, {
        error: 'SANDBOX_WRITE_BLOCKED',
        message: 'Esta operação ainda não possui persistência local e foi bloqueada antes de chegar à produção.',
        method,
        path: requestUrl.pathname,
      })
    }

    return proxyRead(req, res, requestUrl)
  } catch (error) {
    return sendJson(req, res, 500, {
      error: 'SANDBOX_PROXY_ERROR',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[sandbox] API local em http://localhost:${PORT}`)
  console.log(`[sandbox] loja ${SANDBOX_STORE_ID} espelha leituras da loja ${SOURCE_STORE_ID}`)
  console.log('[sandbox] gravações na produção: BLOQUEADAS')
})
