export const OFFLINE_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

export function parseOfflinePageLimit(value?: string | number | null): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return OFFLINE_PAGE_SIZE_OPTIONS.includes(
    parsed as (typeof OFFLINE_PAGE_SIZE_OPTIONS)[number],
  )
    ? parsed
    : 20
}

export function firstSearchParam(value?: string | string[]): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export function parseOfflineListSearchParams(searchParams?: {
  page?: string | string[]
  limit?: string | string[]
  q?: string | string[]
}) {
  const resolved = searchParams ?? {}
  const requestedPage = Number.parseInt(firstSearchParam(resolved.page), 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = parseOfflinePageLimit(firstSearchParam(resolved.limit))
  const q = firstSearchParam(resolved.q).trim()

  return { page, limit, q }
}

export function formatOfflineDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR')
}

export function formatOfflineMoney(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
