import { NextRequest } from 'next/server'
import { getAttributesWithValuesByStore, getStoreIdFromToken } from '@/lib/actions/attributes'
import { getOrderDetailAction } from '@/lib/actions/orders'
import { cfImageUrl } from '@/lib/cf-image-url'
import type { Customer, Order, OrderItem } from '@/lib/types'

type PrintableOrder = Order & {
  items?: OrderItem[]
  customer?: Customer | null
}

type ColorHexMap = Record<string, string>

type MatrixCell = {
  requestedQty: number
  attendedQty: number
  unitPrice: number
  total: number
}

type ProductGroup = {
  key: string
  name: string
  sku: string
  groupDimensions: VariantDimension[]
  imageUrl: string
  requestedQty: number
  attendedQty: number
  subtotal: number
  colors: Map<string, Map<string, MatrixCell>>
}

type VariantDimension = {
  rawKey: string
  normalizedKey: string
  label: string
  rawValue: string
  displayValue: string
}

function isItemPrintable(item: OrderItem): boolean {
  return String(item.status || 'active').toLowerCase() !== 'removed'
}

const COLOR_FALLBACKS: Record<string, string> = {
  rosa: '#f9a8d4', pink: '#f9a8d4', vermelho: '#ef4444', red: '#ef4444',
  azul: '#3b82f6', blue: '#3b82f6', verde: '#22c55e', green: '#22c55e',
  preto: '#1f2937', black: '#1f2937', branco: '#f8fafc', white: '#f8fafc',
  cinza: '#9ca3af', gray: '#9ca3af', amarelo: '#facc15', yellow: '#facc15',
  laranja: '#f97316', orange: '#f97316', roxo: '#a855f7', purple: '#a855f7',
  marrom: '#92400e', brown: '#92400e', bege: '#d4a96a', beige: '#d4a96a',
  caramelo: '#b45309', nude: '#e8c4a0', vinho: '#7f1d1d', burgundy: '#7f1d1d',
  dourado: '#d97706', gold: '#d97706', prata: '#94a3b8', silver: '#94a3b8',
  coral: '#fb7185', salmao: '#fca5a5', taupe: '#b49152', cream: '#f3efe7',
}

const SIZE_ORDER = ['PP', 'XS', 'P', 'P 38', '38', 'S', 'M', 'M 40', '40', 'G', 'G 42', '42', 'GG', 'GG 44', '44', 'G1', 'G2', 'G3', 'EG', 'EGG', 'XL', 'XXL']

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function compact(parts: unknown[]): string {
  return parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
}

function formatCurrency(value: unknown): string {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatDateTime(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function normalizeSkuPrefix(value: unknown): string {
  const raw = String(value || '').trim()
  return raw.split(/[-_]/)[0]?.trim() || raw
}

function normalizeVariantAttributeKind(key: string): string {
  const normalized = key.trim().toLowerCase()
  if (normalized === 'cor' || normalized === 'color') return 'color'
  if (normalized === 'tam' || normalized === 'tamanho' || normalized === 'size') return 'size'
  return normalized
}

function formatVariantAttributeLabel(key: string): string {
  const normalized = normalizeVariantAttributeKind(key)
  if (normalized === 'color') return 'Cor'
  if (normalized === 'size') return 'Tamanho'
  return key.replace(/[_-]+/g, ' ').trim().replace(/^\w/, (char) => char.toUpperCase())
}

function getVariantDimensions(item: OrderItem): VariantDimension[] {
  const raw = String(item.variantCombinationKey || '').trim()
  if (raw) {
    const keyValueMatches = Array.from(raw.matchAll(/([^|,;:]+):([^|,;]+)/g))
    if (keyValueMatches.length > 0) {
      const parsed = keyValueMatches
        .map((match) => {
          const rawKey = String(match[1] || '').trim()
          const rawValue = String(match[2] || '').trim()
          if (!rawKey || !rawValue) return null

          const normalizedKey = normalizeVariantAttributeKind(rawKey)
          return {
            rawKey,
            normalizedKey,
            label: formatVariantAttributeLabel(rawKey),
            rawValue,
            displayValue: formatVariantLabel(rawValue),
          }
        })
        .filter((entry): entry is VariantDimension => Boolean(entry))

      if (parsed.length > 0) return parsed
    }
  }

  const fallback: VariantDimension[] = []
  const colorRaw = String(item.colorSnapshot || '').trim()
  const sizeRaw = String(item.sizeSnapshot || '').trim()

  if (colorRaw) {
    fallback.push({
      rawKey: 'color',
      normalizedKey: 'color',
      label: 'Cor',
      rawValue: colorRaw,
      displayValue: formatVariantLabel(colorRaw),
    })
  }

  if (sizeRaw) {
    fallback.push({
      rawKey: 'size',
      normalizedKey: 'size',
      label: 'Tamanho',
      rawValue: sizeRaw,
      displayValue: formatVariantLabel(sizeRaw),
    })
  }

  return fallback
}

function compareVariantDimensionValues(a: VariantDimension, b: VariantDimension): number {
  if (a.normalizedKey === 'size' && b.normalizedKey === 'size') {
    const ai = SIZE_ORDER.indexOf(a.rawValue.toUpperCase())
    const bi = SIZE_ORDER.indexOf(b.rawValue.toUpperCase())
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
  }
  return a.displayValue.localeCompare(b.displayValue)
}

function resolveProductSku(item: OrderItem): string {
  const productSku = String(item.productSkuSnapshot || '').trim()
  if (productSku) return productSku
  return '-'
}

function parseVariantValue(combinationKey: string | null | undefined, wanted: 'color' | 'size', fallback: string | null): string {
  const raw = String(combinationKey || '').trim()
  if (raw) {
    for (const part of raw.split(/[|,;]/)) {
      const [key, ...rest] = part.split(':')
      const value = rest.join(':').trim()
      const normalizedKey = String(key || '').trim().toLowerCase()
      if (!value) continue
      if (wanted === 'color' && (normalizedKey.includes('cor') || normalizedKey.includes('color'))) return formatVariantLabel(value)
      if (wanted === 'size' && (normalizedKey.includes('tamanho') || normalizedKey.includes('size'))) return formatVariantLabel(value)
    }
  }
  return String(fallback || (wanted === 'color' ? 'Sem cor' : 'Unico')).trim()
}

function formatVariantLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => (part.length <= 3 || /^\d+$/.test(part) ? part.toUpperCase() : `${part[0]?.toUpperCase() || ''}${part.slice(1).toLowerCase()}`))
    .join(' ')
}

function sizeSortValue(size: string): number {
  const index = SIZE_ORDER.indexOf(size.toUpperCase())
  return index >= 0 ? index : 999
}

function colorDot(colorName: string, colorHex: ColorHexMap): string {
  const raw = String(colorName || '').trim()
  const direct = colorHex[raw] || colorHex[raw.toLowerCase()] || colorHex[raw.toUpperCase()]
  if (direct) return direct
  const key = raw.toLowerCase()
  if (COLOR_FALLBACKS[key]) return COLOR_FALLBACKS[key]
  for (const [name, hex] of Object.entries(COLOR_FALLBACKS)) {
    if (key.includes(name) || name.includes(key)) return hex
  }
  return '#94a3b8'
}

function groupItems(items: OrderItem[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>()

  for (const item of items) {
    const name = String(item.nameSnapshot || 'Produto').trim()
    const sku = resolveProductSku(item)
    const dimensions = getVariantDimensions(item)
    const groupDimensions = dimensions.length > 2 ? dimensions.slice(0, -2) : []
    const groupDimensionKey = groupDimensions
      .map((dimension) => `${dimension.normalizedKey}:${dimension.rawValue}`)
      .join('|') || '__base__'
    const assetKey = String(item.assetId || '-').trim()
    const key = `${item.productId}::${assetKey}::${groupDimensionKey}`

    const sizeDimension = [...dimensions].reverse().find((dimension) => dimension.normalizedKey === 'size')
    const colorDimension = [...dimensions].reverse().find((dimension) => dimension.normalizedKey === 'color')
    const color = colorDimension?.displayValue || parseVariantValue(item.variantCombinationKey, 'color', item.colorSnapshot)
    const size = sizeDimension?.displayValue || parseVariantValue(item.variantCombinationKey, 'size', item.sizeSnapshot)
    const requestedQty = Number(item.originalQty ?? item.qty ?? 0)
    const attendedQty = Number(item.qty ?? 0)
    const unitPrice = Number(item.unitPrice || 0)
    const total = unitPrice * requestedQty

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        sku,
        groupDimensions,
        imageUrl: item.assetImageUrl || item.imageUrl || '',
        requestedQty: 0,
        attendedQty: 0,
        subtotal: 0,
        colors: new Map(),
      })
    }

    const group = groups.get(key)!
    if (!group.imageUrl && (item.assetImageUrl || item.imageUrl)) {
      group.imageUrl = item.assetImageUrl || item.imageUrl || ''
    }
    group.requestedQty += requestedQty
    group.attendedQty += attendedQty
    group.subtotal += total

    if (!group.colors.has(color)) group.colors.set(color, new Map())
    const sizes = group.colors.get(color)!
    const current = sizes.get(size)
    if (current) {
      current.requestedQty += requestedQty
      current.attendedQty += attendedQty
      current.total += total
    } else {
      sizes.set(size, { requestedQty, attendedQty, unitPrice, total })
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    const skuCompare = String(a.sku || '').localeCompare(String(b.sku || ''), 'pt-BR', {
      sensitivity: 'base',
      numeric: true,
    })
    if (skuCompare !== 0) return skuCompare
    return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' })
  })
}

function renderInfo(label: string, value: unknown): string {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return `<div class="info"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`
}

function summarizeColorRow(sizeMap: Map<string, MatrixCell>): { unitPrice: number; promoPrice: number; total: number } {
  let requestedQty = 0
  let listTotal = 0
  let promoTotal = 0

  for (const cell of sizeMap.values()) {
    requestedQty += cell.requestedQty
    listTotal += cell.unitPrice * cell.requestedQty
    promoTotal += cell.total
  }

  const safeQty = requestedQty > 0 ? requestedQty : 1
  return {
    unitPrice: listTotal / safeQty,
    promoPrice: promoTotal / safeQty,
    total: promoTotal,
  }
}

function renderProducts(items: OrderItem[], colorHex: ColorHexMap): string {
  const groups = groupItems(items)
  if (groups.length === 0) return '<div class="empty">Nenhum item no pedido.</div>'

  return groups.map((group) => {
    const colors = Array.from(group.colors.keys()).sort((a, b) => a.localeCompare(b))
    const sizes = Array.from(new Set(colors.flatMap((color) => Array.from(group.colors.get(color)?.keys() || []))))
      .sort((a, b) => sizeSortValue(a) - sizeSortValue(b) || a.localeCompare(b))
    const imageUrl = group.imageUrl ? cfImageUrl(group.imageUrl, { width: 120, height: 150, fit: 'cover', quality: 70, format: 'auto' }) : ''
    const groupSummary = group.groupDimensions
      .slice()
      .sort(compareVariantDimensionValues)
      .map((dimension) => `${dimension.label}: ${dimension.displayValue}`)
      .join(' · ')

    return `<section class="product-card">
      <header class="product-head">
        <div class="product-main">
          <div class="thumb">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="eager" />` : '<span>Sem imagem</span>'}</div>
          <div>
            <h3>${escapeHtml(group.name)}</h3>
            <p>SKU: ${escapeHtml(normalizeSkuPrefix(group.sku))}${groupSummary ? ` | ${escapeHtml(groupSummary)}` : ''}</p>
          </div>
        </div>
        <div class="product-money">${formatCurrency(group.subtotal)}</div>
      </header>
      <table class="matrix">
        <thead><tr><th>Cor</th>${sizes.map((size) => `<th>${escapeHtml(size)}</th>`).join('')}<th class="money-head">unitario</th><th class="money-head">promo</th><th class="money-head">Total</th></tr></thead>
        <tbody>
          ${colors.map((color) => {
            const colorSizes = group.colors.get(color) || new Map<string, MatrixCell>()
            const money = summarizeColorRow(colorSizes)
            return `<tr>
            <td class="color-cell"><span class="dot" style="background:${escapeHtml(colorDot(color, colorHex))}"></span><strong>${escapeHtml(color)}</strong></td>
            ${sizes.map((size) => {
              const cell = group.colors.get(color)?.get(size)
              if (!cell) return '<td class="missing">-</td>'
              return `<td class="qty"><small>${cell.requestedQty}</small><strong>${cell.attendedQty}</strong></td>`
            }).join('')}
            <td class="money">${escapeHtml(formatCurrency(money.unitPrice))}</td>
            <td class="money promo">${escapeHtml(formatCurrency(money.promoPrice))}</td>
            <td class="money total">${escapeHtml(formatCurrency(money.total))}</td>
          </tr>`
          }).join('')}
        </tbody>
      </table>
    </section>`
  }).join('')
}

async function loadColorHexMap(): Promise<ColorHexMap> {
  const storeId = await getStoreIdFromToken()
  if (!storeId) return {}
  const result = await getAttributesWithValuesByStore(storeId)
  if (!result.success || !Array.isArray(result.data)) return {}

  const colorHex: ColorHexMap = {}
  for (const attr of result.data) {
    if (String(attr?.code || '').toLowerCase() !== 'color') continue
    for (const value of attr.values || []) {
      const hex = value?.meta?.rgb || value?.meta?.hex || null
      const name = String(value?.name || '').trim()
      const code = String(value?.code || '').trim()
      if (!name || typeof hex !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(hex)) continue
      colorHex[name] = hex
      colorHex[name.toLowerCase()] = hex
      colorHex[name.toUpperCase()] = hex
      if (code) {
        colorHex[code] = hex
        colorHex[code.toLowerCase()] = hex
        colorHex[code.toUpperCase()] = hex
      }
    }
  }
  return colorHex
}

function renderHtml(order: PrintableOrder, colorHex: ColorHexMap): string {
  const items = Array.isArray(order.items) ? order.items : []
  const attendedItems = items.filter(isItemPrintable)
  const customer = order.customer || null
  const orderCode = String(order.code || order.id || '').trim()
  const customerName = compact([customer?.companyName || customer?.tradeName || customer?.contactName]) || compact([order.customerName]) || 'Cliente'
  const totalPieces = attendedItems.reduce((sum, item) => sum + Number(item.originalQty ?? item.qty ?? 0), 0)
  const addressLine = compact([order.shippingStreet, order.shippingNumber, order.shippingComplement ? `- ${order.shippingComplement}` : ''])
  const cityLine = compact([order.shippingNeighborhood, order.shippingCity ? `- ${order.shippingCity}` : '', order.shippingState ? `/ ${order.shippingState}` : ''])
  const discounts = Number(order.discountTotal || 0) + Number(order.manualDiscount || 0)

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pedido ${escapeHtml(orderCode)}</title>
  <style>
    :root { --ink:#171717; --muted:#737373; --line:#e5e7eb; --soft:#f8fafc; --green:#059669; }
    * { box-sizing:border-box; }
    body { margin:0; background:#edf0f4; color:var(--ink); font-family: Arial, Helvetica, sans-serif; font-size:12px; }
    .toolbar { position:sticky; top:0; z-index:10; display:flex; justify-content:flex-end; gap:8px; padding:12px 18px; background:#ffffffdd; border-bottom:1px solid var(--line); backdrop-filter:blur(10px); }
    .toolbar button { border:0; border-radius:10px; padding:10px 14px; background:#111827; color:#fff; font-weight:800; cursor:pointer; }
    .sheet { width:210mm; min-height:297mm; margin:18px auto; padding:12mm; background:white; box-shadow:0 12px 36px #11182722; }
    .top { display:flex; justify-content:space-between; gap:20px; padding-bottom:10px; border-bottom:2px solid #111827; break-inside:avoid; }
    .brand h1 { margin:0; font-size:18px; letter-spacing:.02em; text-transform:uppercase; }
    .brand p { margin:3px 0 0; color:var(--muted); }
    .order-code { text-align:right; }
    .order-code span { color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:.12em; }
    .order-code strong { display:block; margin-top:2px; font-size:25px; }
    .cards { display:grid; grid-template-columns:1.35fr 1fr 1fr; gap:10px; margin-top:12px; break-inside:avoid; }
    .card { border:1px solid var(--line); border-radius:14px; padding:11px; break-inside:avoid; }
    .card h2 { margin:0 0 8px; color:var(--muted); font-size:10px; letter-spacing:.14em; text-transform:uppercase; }
    .customer { font-size:15px; font-weight:900; }
    .info { display:flex; justify-content:space-between; gap:12px; padding:2px 0; }
    .info span { color:var(--muted); }
    .info strong { text-align:right; }
    .section-title { display:flex; justify-content:space-between; align-items:end; margin:16px 0 8px; break-after:avoid; }
    .section-title h2 { margin:0; font-size:13px; letter-spacing:.14em; text-transform:uppercase; }
    .section-title span { color:var(--muted); }
    .product-card { border:1px solid var(--line); border-radius:16px; overflow:hidden; margin-bottom:12px; break-inside:avoid; page-break-inside:avoid; }
    .product-head { display:flex; justify-content:space-between; align-items:center; gap:14px; padding:10px 12px; border-bottom:1px solid var(--line); background:#fff; }
    .product-main { display:flex; align-items:center; gap:12px; min-width:0; }
    .thumb { width:56px; height:70px; flex:0 0 56px; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid var(--line); border-radius:10px; background:var(--soft); color:var(--muted); font-size:9px; }
    .thumb img { width:100%; height:100%; object-fit:cover; }
    .product-main h3 { margin:0; font-size:15px; text-transform:uppercase; }
    .product-main p { margin:4px 0 0; color:var(--muted); }
    .product-money { font-size:14px; font-weight:900; white-space:nowrap; }
    .matrix { width:100%; border-collapse:collapse; table-layout:fixed; }
    .matrix th { padding:9px 10px; background:#fafafa; border-bottom:1px solid #edf0f3; color:var(--muted); font-weight:900; text-align:center; }
    .matrix th:first-child { text-align:left; width:24%; }
    .matrix td { padding:10px; border-bottom:1px solid #f1f3f5; text-align:center; vertical-align:middle; }
    .matrix tr:last-child td { border-bottom:0; }
    .color-cell { display:flex; align-items:center; gap:9px; text-align:left !important; }
    .dot { width:14px; height:14px; border-radius:999px; flex:0 0 14px; border:1px solid #00000022; }
    .qty { background:#f1fbf7; }
    .qty small { display:block; color:#9ca3af; line-height:1; }
    .qty strong { display:block; margin-top:2px; color:var(--green); font-size:16px; line-height:1; }
    .money-head { width:10%; white-space:nowrap; }
    .money { white-space:nowrap; font-weight:700; font-size:11px; }
    .money.promo { color:var(--green); background:#f1fbf7; }
    .money.total { font-weight:900; }
    .missing { color:#c7cbd1; }
    .summary-wrap { display:grid; grid-template-columns:1fr 82mm; gap:12px; margin-top:14px; break-inside:avoid; }
    .note { border:1px solid var(--line); border-radius:14px; padding:12px; min-height:68px; }
    .summary { border:1px solid var(--line); border-radius:14px; overflow:hidden; }
    .summary-row { display:flex; justify-content:space-between; padding:9px 12px; border-bottom:1px solid var(--line); }
    .summary-row:last-child { border-bottom:0; }
    .summary-row.grand { background:#111827; color:white; font-weight:900; font-size:14px; }
    .footer { margin-top:14px; padding-top:8px; border-top:1px solid var(--line); color:var(--muted); display:flex; justify-content:space-between; font-size:10px; }
    @media print {
      @page { size:A4; margin:8mm; }
      body { background:white; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .toolbar { display:none; }
      .sheet { width:auto; min-height:auto; margin:0; padding:0; box-shadow:none; }
      .top, .cards, .card, .section-title, .product-card, .summary-wrap { break-inside:avoid; page-break-inside:avoid; }
      .product-card { margin-bottom:8mm; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / salvar PDF</button></div>
  <main class="sheet">
    <header class="top">
      <div class="brand"><h1>Pedido de venda</h1><p>Conferencia, separacao e faturamento</p></div>
      <div class="order-code"><span>Pedido</span><strong>#${escapeHtml(orderCode)}</strong><p>${escapeHtml(formatDateTime(order.createdAt))}</p></div>
    </header>
    <section class="cards">
      <div class="card"><h2>Cliente</h2><div class="customer">${escapeHtml(customerName)}</div><p>${escapeHtml(customer?.cnpj || '')}</p><p>${escapeHtml(customer?.email || '')}</p><p>${escapeHtml(customer?.phone || order.customerPhone || '')}</p></div>
      <div class="card"><h2>Pedido</h2>${renderInfo('Data', formatDate(order.createdAt))}${renderInfo('Pecas', totalPieces)}${renderInfo('Pagamento', order.paymentMethod || order.paymentStatus)}</div>
      <div class="card"><h2>Entrega</h2>${renderInfo('Frete', order.shippingName || order.shippingMethodCode || '-')}${renderInfo('Rastreio', order.trackingCode || '')}${renderInfo('Valor', formatCurrency(order.shippingPrice))}</div>
    </section>
    <section class="card" style="margin-top:10px"><h2>Endereco</h2><div>${escapeHtml(addressLine || '-')}</div><p>${escapeHtml(cityLine)}${order.shippingZipCode ? ` - CEP ${escapeHtml(order.shippingZipCode)}` : ''}</p></section>
    <div class="section-title"><h2>Itens do pedido</h2><span>${totalPieces} pecas</span></div>
    ${renderProducts(attendedItems, colorHex)}
    <section class="summary-wrap">
      <div class="note"><h2>Observacoes</h2><p>${escapeHtml(order.notes || order.shippingNote || '-')}</p></div>
      <div class="summary">
        <div class="summary-row"><span>Subtotal</span><strong>${formatCurrency(order.subtotal)}</strong></div>
        <div class="summary-row"><span>Frete</span><strong>${formatCurrency(order.shippingPrice)}</strong></div>
        <div class="summary-row"><span>Descontos</span><strong>${formatCurrency(discounts)}</strong></div>
        <div class="summary-row grand"><span>Total</span><strong>${formatCurrency(order.total)}</strong></div>
      </div>
    </section>
    <footer class="footer"><span>Emitido em ${escapeHtml(formatDateTime(new Date()))}</span><span>Pedido #${escapeHtml(orderCode)}</span></footer>
  </main>
</body>
</html>`
}

async function renderPdfWithService(html: string, baseUrl: string, filename: string): Promise<Response> {
  const serviceUrl = (process.env.PDF_RENDERER_URL || '').trim()
  if (!serviceUrl) {
    return new Response('PDF_RENDERER_URL nao configurada no servidor', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  let endpoint: URL
  try {
    endpoint = new URL('/render', serviceUrl)
  } catch {
    return new Response('PDF_RENDERER_URL invalida', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }

  const token = (process.env.PDF_RENDERER_API_TOKEN || '').trim()
  if (token) headers.authorization = `Bearer ${token}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ html, base_url: baseUrl, filename }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    return new Response(
      `Falha no servico PDF (${response.status}). ${details}`.trim(),
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    )
  }

  const bytes = await response.arrayBuffer()
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'no-store',
      'content-disposition': `inline; filename="${filename}"`,
    },
  })
}

export async function GET(request: NextRequest) {
  const orderId = (request.nextUrl.searchParams.get('orderId') || '').trim()
  if (!orderId) return new Response('orderId e obrigatorio', { status: 400 })
  const format = (request.nextUrl.searchParams.get('format') || 'html').trim().toLowerCase()

  const [orderResult, colorHex] = await Promise.all([
    getOrderDetailAction(orderId),
    loadColorHexMap(),
  ])

  if (!orderResult.success || !orderResult.data) {
    return new Response(orderResult.error || 'Pedido nao encontrado', { status: 404 })
  }

  const html = renderHtml(orderResult.data as PrintableOrder, colorHex)

  if (format === 'pdf') {
    return renderPdfWithService(html, request.nextUrl.origin, `pedido-${orderId}.pdf`)
  }

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}