import { headers } from 'next/headers'

function asNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStoreId(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function extractRouteStoreId(pathname: string | null | undefined): number | null {
  if (!pathname) return null
  const first = pathname.split('/').filter(Boolean)[0] ?? ''
  return normalizeStoreId(first)
}

function pickApiKeyFromRecord(record: Record<string, unknown>): string {
  const directCandidates = [
    record.api_key,
    record.apiKey,
    record.storefront_api_key,
    record.storefrontApiKey,
    record.x_api_key,
    record.xApiKey,
  ]

  for (const candidate of directCandidates) {
    const normalized = asNonEmptyString(candidate)
    if (normalized) return normalized
  }

  const metaRaw = record.meta
  if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
    return pickApiKeyFromRecord(metaRaw as Record<string, unknown>)
  }

  return ''
}

async function resolveStoreIdFromRequest(preferredStoreId?: number | string | null): Promise<number | null> {
  const directStoreId = normalizeStoreId(preferredStoreId)
  if (directStoreId) return directStoreId

  try {
    const headerStore = await headers()
    const fromNextUrl = extractRouteStoreId(headerStore.get('x-next-url') || headerStore.get('next-url'))
    if (fromNextUrl) return fromNextUrl

    const referer = headerStore.get('referer')
    if (!referer) return null

    try {
      const fromReferer = extractRouteStoreId(new URL(referer).pathname)
      if (fromReferer) return fromReferer
    } catch {
      const fromRawReferer = extractRouteStoreId(referer)
      if (fromRawReferer) return fromRawReferer
    }
  } catch {
    return null
  }

  return null
}

export async function resolveStorefrontApiKeyFromRequest(
  preferredStoreId?: number | string | null,
): Promise<string> {
  const storeId = await resolveStoreIdFromRequest(preferredStoreId)
  if (!storeId) return ''

  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim().replace(/\/$/, '')
  if (!base) return ''

  try {
    const response = await fetch(`${base}/stores/${storeId}`, {
      method: 'GET',
      cache: 'no-store',
    })
    if (!response.ok) return ''

    const payload = (await response.json()) as Record<string, unknown>
    return pickApiKeyFromRecord(payload)
  } catch {
    return ''
  }
}

export function appendStoreScopeParam(url: URL, options: { apiKey?: string | null; storeId?: number | string | null }) {
  void url
  void options
}

export function withStorefrontScopeHeaders<T extends Record<string, string>>(
  headers: T,
  apiKey?: string | null,
): T {
  if (apiKey && apiKey.trim()) {
    return {
      ...headers,
      'X-API-Key': apiKey.trim(),
    }
  }

  return headers
}
