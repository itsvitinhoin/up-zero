import http from 'node:http'
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
      b2cLeads: Array.isArray(parsed.b2cLeads) ? parsed.b2cLeads : [],
      b2cSettings: normalizeB2CSettings(parsed.b2cSettings),
    }
  } catch {
    return { store: {}, b2cLeads: [], b2cSettings: normalizeB2CSettings(null) }
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
  const allowed = origin === 'http://localhost:3000' || origin === 'http://localhost:3001'
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

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://localhost:${PORT}`)
    const method = String(req.method || 'GET').toUpperCase()

    if (method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req))
      return res.end()
    }

    if (requestUrl.pathname === '/sandbox/status') {
      return sendJson(req, res, 200, {
        environment: 'sandbox',
        isolated: true,
        sandbox_store_id: SANDBOX_STORE_ID,
        source_store_id: SOURCE_STORE_ID,
        upstream_write_policy: 'blocked',
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

    if (requestUrl.pathname === '/b2c/settings' && method === 'GET') {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      return sendJson(req, res, 200, state.b2cSettings)
    }

    if (requestUrl.pathname === '/b2c/settings' && (method === 'PATCH' || method === 'PUT')) {
      if (!isAuthenticated(req)) return sendJson(req, res, 401, { error: 'Não autenticado' })
      const body = await readJson(req)
      state.b2cSettings = normalizeB2CSettings({ ...body, updatedAt: new Date().toISOString() })
      saveState(state)
      return sendJson(req, res, 200, state.b2cSettings)
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
