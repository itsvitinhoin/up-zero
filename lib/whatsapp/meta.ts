import { getMetaReviewState } from './store'

export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? 'v19.0'
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`

export const META_REVIEW_SCOPES = [
  'public_profile',
  'email',
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
] as const

export const META_REVIEW_REMOVED_SCOPES = [
  'manage_app_solution',
  'whatsapp_business_manage_events',
] as const

export interface MetaGraphError {
  message: string
  type?: string
  code?: number
  error_subcode?: number
  fbtrace_id?: string
}

export function maskId(value?: string | null): string {
  if (!value) return 'Not available'
  const clean = String(value)
  if (clean.length <= 8) return `${clean.slice(0, 2)}...${clean.slice(-2)}`
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`
}

export function maskPhone(value?: string | null): string {
  if (!value) return 'Not available'
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 4) return '...'
  return `${value.includes('+') ? '+' : ''}${digits.slice(0, 2)}...${digits.slice(-4)}`
}

export function safeMetaError(error?: MetaGraphError, fallback = 'Meta Graph API request failed'): string {
  if (!error) return fallback
  const code = error.code ? `Meta error ${error.code}` : 'Meta error'
  const subcode = error.error_subcode ? `/${error.error_subcode}` : ''
  const trace = error.fbtrace_id ? ` Trace: ${error.fbtrace_id}.` : ''
  return `${code}${subcode}: ${error.message}.${trace}`
}

export function getMetaAccessToken(): { token: string; source: 'oauth_user' | 'system_user' } | null {
  const reviewToken = getMetaReviewState().oauth?.accessToken
  if (reviewToken) return { token: reviewToken, source: 'oauth_user' }
  const systemToken = process.env.FACEBOOK_SYSTEM_USER_TOKEN
  if (systemToken) return { token: systemToken, source: 'system_user' }
  return null
}

export async function metaGraphGet<T>(
  path: string,
  token: string,
): Promise<{ ok: true; data: T } | { ok: false; error: MetaGraphError; status: number }> {
  const url = new URL(`${META_GRAPH_BASE}${path}`)

  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await res.json().catch(() => ({})) as T & { error?: MetaGraphError }

  if (!res.ok || data.error) {
    return {
      ok: false,
      status: res.status,
      error: data.error ?? { message: `HTTP ${res.status}` },
    }
  }

  return { ok: true, data }
}

export async function metaGraphPost<T>(
  path: string,
  token: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: MetaGraphError; status: number }> {
  const res = await fetch(`${META_GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({})) as T & { error?: MetaGraphError }

  if (!res.ok || data.error) {
    return {
      ok: false,
      status: res.status,
      error: data.error ?? { message: `HTTP ${res.status}` },
    }
  }

  return { ok: true, data }
}
