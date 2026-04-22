import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const vestiBaseUrl = process.env.VESTI_BASE_URL || 'https://integracao.meuvesti.com/api'
const vestiApiKey = process.env.VESTI_API_KEY || ''
const vestiCompanyId = process.env.VESTI_COMPANY_ID || ''
const rustBaseUrl = (process.env.EXTERNAL_BASE_URL || process.env.NEXT_PUBLIC_RUST_URL || 'http://localhost:8080').replace(/\/$/, '')
const externalApiKey = process.env.EXTERNAL_API_KEY || ''
const perPage = Number.parseInt(process.env.PERPAGE || '50', 10)
const hasCategory = process.env.HAS_CATEGORY || '1'
const maxWindows = Number.parseInt(process.env.MAX_WINDOWS || '24', 10)
const maxProducts = Number.parseInt(process.env.MAX_PRODUCTS || '0', 10)
const dryRun = process.env.DRY_RUN === '1'
const activeOnly = process.env.ACTIVE_ONLY === '1'
const productCodeFilter = (process.env.PRODUCT_CODE || '').trim()
const startDateEnv = (process.env.START_DATE || '').trim()
const endDateEnv = (process.env.END_DATE || '').trim()

if (!vestiApiKey || !vestiCompanyId) {
  console.error('Faltam VESTI_API_KEY e/ou VESTI_COMPANY_ID no ambiente')
  process.exit(1)
}

if (!externalApiKey) {
  console.error('Falta EXTERNAL_API_KEY no ambiente para resolver a store e criar termos ausentes')
  process.exit(1)
}

function formatDate(date, endOfDay = false) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day} ${endOfDay ? '23:59:59' : '00:00:00'}`
}

function parseDateString(value) {
  const normalized = value.replace(' ', 'T')
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data invalida: ${value}`)
  }
  return parsed
}

function buildWindows() {
  if (startDateEnv || endDateEnv) {
    if (!startDateEnv || !endDateEnv) {
      throw new Error('START_DATE e END_DATE devem ser informadas juntas')
    }

    const startDate = parseDateString(startDateEnv)
    const endDate = parseDateString(endDateEnv)
    const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 30) {
      throw new Error('A janela informada nao pode exceder 30 dias')
    }

    return [{
      startDate: startDateEnv,
      endDate: endDateEnv,
    }]
  }

  const now = new Date()
  const windows = []
  for (let index = 0; index < maxWindows; index += 1) {
    const end = new Date(now)
    end.setDate(end.getDate() - (index * 30))
    const start = new Date(end)
    start.setDate(start.getDate() - 29)
    windows.push({
      startDate: formatDate(start),
      endDate: formatDate(end, true),
    })
  }
  return windows
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.response)) return payload.response
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.products)) return payload.products
  return []
}

function normalizeMatch(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function buildCode(value, fallbackPrefix) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (normalized) return normalized
  return `${fallbackPrefix}_${Date.now()}`
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init)
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
    throw new Error(`HTTP ${response.status} em ${url}: ${message}`)
  }

  return payload
}

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const envPath = path.resolve(process.cwd(), '../rust-binext/.env')
  const envText = fs.readFileSync(envPath, 'utf8')
  const match = envText.match(/^DATABASE_URL=(.+)$/m)
  if (!match) {
    throw new Error(`Nao foi possivel localizar DATABASE_URL em ${envPath}`)
  }

  return match[1].trim()
}

function resolvePsqlBin() {
  const explicit = process.env.PSQL_BIN
  if (explicit) return explicit

  const probe = spawnSync('which', ['psql'], { encoding: 'utf8' })
  if (probe.status === 0) {
    const detected = probe.stdout.trim()
    if (detected) return detected
  }

  return '/opt/homebrew/opt/libpq/bin/psql'
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function runSql(sql) {
  const result = spawnSync(resolvePsqlBin(), [
    readDatabaseUrl(),
    '-P', 'pager=off',
    '-A',
    '-F', '\t',
    '-c', sql,
  ], {
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Falha ao executar psql')
  }

  return result.stdout
}

function parseTabular(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^\(\d+ rows?\)$/.test(line.trim()))

  if (lines.length === 0) return []

  const headers = lines[0].split('\t')
  return lines.slice(1).map((line) => {
    const cells = line.split('\t')
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
  })
}

function resolveStore() {
  const sql = `
    SELECT id, name
    FROM stores
    WHERE external_api_key = ${sqlLiteral(externalApiKey)}
    ORDER BY id DESC
    LIMIT 1;
  `

  const rows = parseTabular(runSql(sql))
  if (rows.length === 0) {
    throw new Error('Nenhuma store encontrada para a EXTERNAL_API_KEY informada')
  }

  return {
    id: Number(rows[0].id),
    name: rows[0].name,
  }
}

function flattenCategories(nodes, target = []) {
  for (const node of nodes || []) {
    target.push(node)
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenCategories(node.children, target)
    }
  }
  return target
}

async function fetchCategoryCache(storeId) {
  const tree = await fetchJson(`${rustBaseUrl}/categories/tree`)
  const flattened = flattenCategories(Array.isArray(tree) ? tree : [])
  return flattened.filter((item) => Number(item.store_id) === storeId)
}

async function createCategory(storeId, category) {
  const payload = {
    name: category.name,
    status: true,
    sort_order: 0,
    parent_id: null,
    store_id: storeId,
    external_ref: {
      integration: 'vesti',
      external_id: String(category.integration_id || category.id || category.name),
    },
  }

  if (dryRun) {
    console.log(`[DRY_RUN] Criaria categoria ${category.name}`)
    return {
      id: -1,
      ...payload,
      slug: null,
    }
  }

  return fetchJson(`${rustBaseUrl}/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

async function resolveCategoryIds(storeId, categoryCache, categories) {
  const ids = []

  for (const category of categories || []) {
    const key = normalizeMatch(category?.name)
    if (!key) continue

    let existing = categoryCache.find((item) => normalizeMatch(item.name) === key)
    if (!existing) {
      existing = await createCategory(storeId, category)
      categoryCache.push(existing)
      console.log(`Categoria criada: ${category.name}`)
    }

    const categoryId = Number(existing.id)
    if (Number.isFinite(categoryId) && categoryId > 0 && !ids.includes(categoryId)) {
      ids.push(categoryId)
    }
  }

  return ids
}

async function fetchAttributeCache(storeId) {
  const attributes = await fetchJson(`${rustBaseUrl}/v1/product-attributes/store/${storeId}/with-values`)
  if (!Array.isArray(attributes)) {
    throw new Error('Resposta inesperada em /v1/product-attributes/store/:id/with-values')
  }
  return attributes
}

function selectAttributeValue(attribute, rawValue) {
  const desired = normalizeMatch(rawValue)
  if (!desired || !attribute || !Array.isArray(attribute.values)) return null

  const scored = attribute.values.map((value) => {
    const codeKey = normalizeMatch(value.code)
    const nameKey = normalizeMatch(value.name)
    let score = 99
    if (codeKey === desired) score = 0
    else if (nameKey === desired) score = 1
    else if (codeKey.includes(desired) || desired.includes(codeKey)) score = 2
    else if (nameKey.includes(desired) || desired.includes(nameKey)) score = 3

    return {
      score,
      value,
    }
  }).filter((item) => item.score < 99)

  if (scored.length === 0) return null

  scored.sort((left, right) => {
    if (left.score !== right.score) return left.score - right.score
    if ((left.value.sort_order ?? 0) !== (right.value.sort_order ?? 0)) {
      return (left.value.sort_order ?? 0) - (right.value.sort_order ?? 0)
    }
    return (left.value.id ?? 0) - (right.value.id ?? 0)
  })

  return scored[0].value
}

async function createMissingTerm(attributeCode, name, colorHex) {
  const payload = {
    code: buildCode(name, attributeCode.toUpperCase()),
    name,
    sort_order: 999,
  }

  if (attributeCode === 'color') {
    payload.meta = {
      hex: colorHex || '#FFFFFF',
      group_name: null,
    }
  }

  if (dryRun) {
    console.log(`[DRY_RUN] Criaria termo ${attributeCode}: ${name}`)
    return
  }

  await fetchJson(`${rustBaseUrl}/external/v1/attributes/by-code/${attributeCode}/terms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': externalApiKey,
    },
    body: JSON.stringify(payload),
  })

  console.log(`Termo criado em ${attributeCode}: ${name}`)
}

async function ensureAttributeTerms(storeId, attributeCache, products) {
  let colorAttribute = attributeCache.find((attribute) => attribute.code === 'color')
  let sizeAttribute = attributeCache.find((attribute) => attribute.code === 'size')

  if (!colorAttribute || !sizeAttribute) {
    throw new Error('Atributos color/size nao encontrados. Rode sync:vesti:attributes antes do sync de produtos.')
  }

  const missingColors = new Map()
  const missingSizes = new Map()

  for (const product of products) {
    for (const color of product.colors || []) {
      if (!selectAttributeValue(colorAttribute, color.name)) {
        missingColors.set(normalizeMatch(color.name), {
          name: color.name,
          hex: color.code,
        })
      }
    }

    for (const size of product.sizes || []) {
      if (!selectAttributeValue(sizeAttribute, size.name)) {
        missingSizes.set(normalizeMatch(size.name), {
          name: size.name,
        })
      }
    }
  }

  if (missingColors.size === 0 && missingSizes.size === 0) {
    return attributeCache
  }

  for (const color of missingColors.values()) {
    await createMissingTerm('color', color.name, color.hex)
  }

  for (const size of missingSizes.values()) {
    await createMissingTerm('size', size.name)
  }

  return fetchAttributeCache(storeId)
}

function extractUrlsFromMediaItems(mediaInput) {
  const mediaItems = Array.isArray(mediaInput)
    ? mediaInput
    : (mediaInput && typeof mediaInput === 'object' ? [mediaInput] : [])

  const urls = []
  const seen = new Set()

  for (const item of mediaItems) {
    const normal = item?.normal || {}
    const zoom = item?.zoom || {}
    const candidates = [
      zoom.url,
      zoom.fallback,
      normal.url,
      normal.fallback,
    ]

    const selected = candidates
      .map((candidate) => String(candidate || '').trim())
      .find((url) => Boolean(url))

    if (!selected || seen.has(selected)) continue
    seen.add(selected)
    urls.push(selected)
  }

  return urls
}

function extractProductImages(product) {
  const productMediaUrls = extractUrlsFromMediaItems(product?.media)
  if (productMediaUrls.length > 0) {
    return productMediaUrls
  }

  // Fallback para payloads legados sem `media` no nível do produto.
  const fallback = []
  const seen = new Set()
  for (const color of product?.colors || []) {
    const urls = extractUrlsFromMediaItems(color?.media)
    for (const url of urls) {
      if (seen.has(url)) continue
      seen.add(url)
      fallback.push(url)
    }
  }

  return fallback
}

function buildVariants(product, attributeCache) {
  const colorAttribute = attributeCache.find((attribute) => attribute.code === 'color')
  const sizeAttribute = attributeCache.find((attribute) => attribute.code === 'size')
  const productImages = extractProductImages(product)
  const variantsByKey = new Map()

  for (const stock of product.stocks || []) {
    const attributeValues = []

    const color = (product.colors || []).find((item) => item.id === stock.color_id)
    const size = (product.sizes || []).find((item) => item.id === stock.size_id)

    if (color) {
      const colorValue = selectAttributeValue(colorAttribute, color.name)
      if (!colorValue) {
        throw new Error(`Nao foi possivel mapear a cor ${color.name} do produto ${product.code}`)
      }
      attributeValues.push(Number(colorValue.id))
    }

    if (size) {
      const sizeValue = selectAttributeValue(sizeAttribute, size.name)
      if (!sizeValue) {
        throw new Error(`Nao foi possivel mapear o tamanho ${size.name} do produto ${product.code}`)
      }
      attributeValues.push(Number(sizeValue.id))
    }

    attributeValues.sort((left, right) => left - right)
    const key = attributeValues.join(',') || String(stock.sku || stock.id || `${product.code}-sem-atributo`)

    variantsByKey.set(key, {
      sku: stock.sku || product.code,
      price_cents: Math.round(Number(stock.price ?? product.price ?? 0) * 100),
      cost_cents: null,
      promo_cents: Number(stock.price_promotional || 0) > 0 ? Math.round(Number(stock.price_promotional) * 100) : null,
      stock_qty: Number.parseInt(String(stock.quantity ?? 0), 10) || 0,
      active: Boolean(product.active),
      is_highlighted: false,
      attribute_values: attributeValues,
      images: productImages,
    })
  }

  return Array.from(variantsByKey.values())
}

function buildProductPayload(product, storeId, categoryIds, attributeCache) {
  return {
    store_id: storeId,
    code: String(product.code || '').trim(),
    slug: product.slug || null,
    name: product.name || String(product.code || '').trim(),
    description: product.full_description || product.description || null,
    weight_grams: Number(product.weight || 0),
    active: Boolean(product.active),
    composition: product.composition || null,
    location: null,
    image_grouping_rule: JSON.stringify({ type: 'product' }),
    tags: ['vesti'],
    category_ids: categoryIds,
    variants: buildVariants(product, attributeCache),
    prune_missing: true,
    meta: {
      source: 'vesti',
      vesti_product_id: product.id || null,
      vesti_updated_at: product.updated_at || null,
    },
  }
}

async function syncProduct(payload) {
  if (dryRun) {
    console.log(`[DRY_RUN] Produto ${payload.code} com ${payload.variants.length} variantes pronto para sync`)
    return { dryRun: true, product: payload }
  }

  return fetchJson(`${rustBaseUrl}/products/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

async function fetchWindowPage(window, page) {
  const params = new URLSearchParams({
    start_date: window.startDate,
    end_date: window.endDate,
    page: String(page),
    perpage: String(perPage),
    has_category: hasCategory,
  })

  const url = `${vestiBaseUrl.replace(/\/$/, '')}/v2/products/company/${vestiCompanyId}?${params.toString()}`
  const payload = await fetchJson(url, {
    headers: {
      apikey: vestiApiKey,
      'Content-Type': 'application/json',
    },
  })

  return {
    payload,
    items: extractItems(payload),
  }
}

async function main() {
  const store = resolveStore()
  console.log(`Store alvo: ${store.id} - ${store.name}`)

  let categoryCache = await fetchCategoryCache(store.id)
  let attributeCache = await fetchAttributeCache(store.id)
  let processed = 0
  let synced = 0

  for (const window of buildWindows()) {
    console.log(`Janela: ${window.startDate} -> ${window.endDate}`)

    let page = 1
    while (true) {
      if (maxProducts > 0 && synced >= maxProducts) {
        console.log(`Limite de produtos atingido: ${maxProducts}`)
        return
      }

      if (productCodeFilter && synced > 0) {
        console.log(`Produto alvo ${productCodeFilter} ja sincronizado`)
        return
      }

      const { payload, items } = await fetchWindowPage(window, page)
      console.log(`  Pagina ${page}: ${items.length} produto(s)`)

      if (items.length === 0) {
        break
      }

      const filteredItems = productCodeFilter
        ? items.filter((item) => String(item.code || '').trim() === productCodeFilter)
        : items

      const syncItems = activeOnly
        ? filteredItems.filter((item) => Boolean(item?.active))
        : filteredItems

      if (syncItems.length > 0) {
        if (activeOnly) {
          console.log(`  Filtro ACTIVE_ONLY=1 aplicado: ${syncItems.length}/${filteredItems.length} produto(s) ativos`) 
        }

        attributeCache = await ensureAttributeTerms(store.id, attributeCache, syncItems)

        for (const product of syncItems) {
          if (maxProducts > 0 && synced >= maxProducts) {
            console.log(`Limite de produtos atingido: ${maxProducts}`)
            return
          }

          processed += 1
          const categoryIds = await resolveCategoryIds(store.id, categoryCache, product.categories || [])
          const syncPayload = buildProductPayload(product, store.id, categoryIds, attributeCache)
          
          try {
            const syncResult = await syncProduct(syncPayload)
            synced += 1

            if (dryRun) {
              console.log(`  [DRY_RUN] ${product.code} -> categorias=${categoryIds.join(',') || 'nenhuma'} variantes=${syncPayload.variants.length}`)
            } else {
              console.log(`  OK ${product.code} -> produto=${syncResult.product.id} variantes=${syncResult.created_variants + syncResult.updated_variants}`)
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            // Continur com 409 (Product code already exists - já importado)
            if (errorMsg.includes('HTTP 409') || errorMsg.includes('already exists')) {
              console.log(`  SKIP ${product.code} -> produto já existe (importado anteriormente)`)
            } else {
              // Outros erros: relançar
              throw error
            }
          }

          if (maxProducts > 0 && synced >= maxProducts) {
            console.log(`Limite de produtos atingido: ${maxProducts}`)
            return
          }

          if (productCodeFilter) {
            console.log(`Produto alvo ${productCodeFilter} sincronizado`)
            return
          }
        }
      }

      const hasNext = Boolean(payload?.links?.next)
      if (!hasNext && items.length < perPage) {
        break
      }

      page += 1
    }
  }

  console.log(`Sincronizacao finalizada. produtos_processados=${processed} produtos_enviados=${synced} dry_run=${dryRun ? '1' : '0'}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})