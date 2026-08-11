export function getStorefrontHref(storeId?: number | null): string {
  const configuredBaseUrl = (process.env.NEXT_PUBLIC_STORE_URL ?? '')
    .trim()
    .replace(/\/+$/, '')

  if (!configuredBaseUrl) {
    return storeId ? `/${storeId}` : '/'
  }

  return storeId ? `${configuredBaseUrl}/${storeId}` : configuredBaseUrl
}

export function buildStorefrontUrl(
  storefrontUrl: string | null | undefined,
  path = '',
  origin?: string,
): string {
  const rawBase = String(storefrontUrl || '/').trim() || '/'
  const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : ''

  if (/^https?:\/\//i.test(rawBase)) {
    return `${rawBase.replace(/\/+$/, '')}${normalizedPath}`
  }

  const relative = `${rawBase.startsWith('/') ? rawBase : `/${rawBase}`}`
    .replace(/\/+$/, '') + normalizedPath

  if (origin && /^https?:\/\//i.test(origin)) {
    return new URL(relative || '/', origin).toString()
  }

  return relative || '/'
}
