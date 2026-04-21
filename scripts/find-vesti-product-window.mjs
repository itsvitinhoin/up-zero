const base = process.env.VESTI_BASE_URL || 'https://integracao.meuvesti.com/api'
const apiKey = process.env.VESTI_API_KEY || ''
const company = process.env.VESTI_COMPANY_ID || ''
const hasCategory = process.env.HAS_CATEGORY || '1'
const perPage = process.env.PERPAGE || '1'
const maxWindows = Number.parseInt(process.env.MAX_WINDOWS || '24', 10)

if (!apiKey || !company) {
  console.error('Faltam VESTI_API_KEY e/ou VESTI_COMPANY_ID no ambiente')
  process.exit(1)
}

function formatDate(date, endOfDay = false) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day} ${endOfDay ? '23:59:59' : '00:00:00'}`
}

function buildWindows() {
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

for (const window of buildWindows()) {
  const params = new URLSearchParams({
    start_date: window.startDate,
    end_date: window.endDate,
    page: '1',
    perpage: perPage,
    has_category: hasCategory,
  })

  const url = `${base.replace(/\/$/, '')}/v2/products/company/${company}?${params.toString()}`
  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const items = extractItems(payload)

  console.log(JSON.stringify({
    startDate: window.startDate,
    endDate: window.endDate,
    httpStatus: response.status,
    statusCode: payload?.statusCode ?? null,
    itemCount: items.length,
    result: payload?.result ?? null,
  }))

  if (items.length > 0) {
    console.log('FOUND_WINDOW')
    console.log(JSON.stringify({
      startDate: window.startDate,
      endDate: window.endDate,
      firstItem: items[0],
      meta: payload?.meta ?? null,
      links: payload?.links ?? null,
    }, null, 2))
    process.exit(0)
  }
}

console.log('NO_PRODUCTS_FOUND')