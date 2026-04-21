'use server'

import { cookies } from 'next/headers'
import { appendStoreScopeParam, resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from '@/lib/actions/storefront-scope'
import type { ApiResponse, StorefrontFilterAttribute } from '@/lib/types'

async function buildStorefrontAuthHeaders(storeId?: number | string): Promise<Record<string, string>> {
  const cookieStore = await cookies()
  const clientToken =
    cookieStore.get('clientAuthToken')?.value ?? cookieStore.get('b2bAuthToken')?.value

  const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)
  const headers: Record<string, string> = {}
  const scopedHeaders = withStorefrontScopeHeaders(headers, storefrontApiKey)

  if (!clientToken) {
    return scopedHeaders
  }

  scopedHeaders.cookie = `clientAuthToken=${clientToken}`
  scopedHeaders.authorization = `Bearer ${clientToken}`
  return scopedHeaders
}

function normalizeAttributeMeta(meta: unknown): Record<string, unknown> | undefined {
  if (!meta) return undefined
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta)
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined
    } catch {
      return undefined
    }
  }
  return typeof meta === 'object' ? meta as Record<string, unknown> : undefined
}

export async function getStorefrontAttributesWithValuesAction(
  storeId?: number | string,
): Promise<ApiResponse<StorefrontFilterAttribute[]>> {
  try {
    const base = process.env.NEXT_PUBLIC_RUST_URL
    if (!base) {
      return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
    }

    const storefrontApiKey = await resolveStorefrontApiKeyFromRequest(storeId)
    const headers = await buildStorefrontAuthHeaders(storeId)

    const url = new URL('/v1/product-attributes/with-values', base)
    appendStoreScopeParam(url, { apiKey: storefrontApiKey, storeId })

    const res = await fetch(url, {
      headers,
      cache: 'no-store',
    })

    if (!res.ok) {
      const backendMessage = await res.text().catch(() => '')
      return {
        success: false,
        error: backendMessage || `Erro ao buscar atributos (status ${res.status})`,
      }
    }

    const payload = await res.json()
    const items: StorefrontFilterAttribute[] = Array.isArray(payload)
      ? payload.map((attr: any) => ({
          id: Number(attr.id),
          store_id: attr.store_id ?? null,
          code: String(attr.code || ''),
          name: String(attr.name || ''),
          sort_order: Number(attr.sort_order || 0),
          values: Array.isArray(attr.values)
            ? attr.values.map((value: any) => ({
                id: Number(value.id),
                code: String(value.code || ''),
                name: String(value.name || ''),
                sort_order: Number(value.sort_order || 0),
                meta: normalizeAttributeMeta(value.meta),
              }))
            : [],
        }))
      : []

    return { success: true, data: items }
  } catch (error) {
    return {
      success: false,
      error: `Erro ao processar atributos: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
    }
  }
}
