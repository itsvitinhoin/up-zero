'use server'

import { cookies } from 'next/headers'

type GenerateAbandonedCartRecoveryLinkInput = {
  cartId: string
  customerId: number
  storefrontBaseUrl?: string | null
}

type GenerateAbandonedCartRecoveryLinkResult = {
  recoveryUrl: string
  hadValidToken: boolean
  revokedTokensCount: number
  expiresAt: string
  maxUses: number
}

type DispatchCartWebhookInput = {
  cartId: string
  event: 'cart_created' | 'cart_abandoned' | 'cart_converted'
  storefrontBaseUrl?: string | null
}

type DispatchCartWebhookResult = {
  success: boolean
  message: string
  event: string
  cartId: number
  storeId: number
  payload: unknown
}

function resolveBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function buildAdminCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const adminAuthToken = cookieStore.get('adminAuthToken')?.value
  if (!adminAuthToken) return undefined
  return `adminAuthToken=${adminAuthToken}`
}

async function readBackendErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => '')
  if (!text) return fallback

  try {
    const payload = JSON.parse(text) as { message?: string; error?: string }
    if (payload?.message && typeof payload.message === 'string') return payload.message
    if (payload?.error && typeof payload.error === 'string') return payload.error
  } catch {
    // Body is not JSON; use raw text below.
  }

  return text.trim() || fallback
}

export async function generateAbandonedCartRecoveryLinkAction(
  input: GenerateAbandonedCartRecoveryLinkInput,
): Promise<{ success: true; data: GenerateAbandonedCartRecoveryLinkResult } | { success: false; error: string }> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const cartIdNum = Number.parseInt(String(input.cartId || '').trim(), 10)
  if (!Number.isFinite(cartIdNum) || cartIdNum <= 0) {
    return { success: false, error: 'Carrinho inválido para geração de link' }
  }

  if (!Number.isFinite(input.customerId) || input.customerId <= 0) {
    return { success: false, error: 'Cliente inválido para geração de link' }
  }

  try {
    const cookieHeader = await buildAdminCookieHeader()

    const response = await fetch(`${baseUrl}/v1/cart/recovery-tokens`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        customer_id: input.customerId,
        cart_id: cartIdNum,
        storefront_base_url: (input.storefrontBaseUrl || '').trim() || undefined,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao gerar link de recuperação')
      return { success: false, error }
    }

    const payload = (await response.json()) as {
      recovery_url?: string
      had_valid_token?: boolean
      revoked_tokens_count?: number
      expires_at?: string
      max_uses?: number
    }

    const recoveryUrl = String(payload.recovery_url || '').trim()
    if (!recoveryUrl) {
      return { success: false, error: 'A API não retornou URL de recuperação' }
    }

    return {
      success: true,
      data: {
        recoveryUrl,
        hadValidToken: Boolean(payload.had_valid_token),
        revokedTokensCount: Number(payload.revoked_tokens_count || 0),
        expiresAt: String(payload.expires_at || ''),
        maxUses: Number(payload.max_uses || 0),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado ao gerar link de recuperação',
    }
  }
}

export async function dispatchCartWebhookAction(
  input: DispatchCartWebhookInput,
): Promise<{ success: true; data: DispatchCartWebhookResult } | { success: false; error: string }> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'NEXT_PUBLIC_RUST_URL não configurado' }
  }

  const cartIdNum = Number.parseInt(String(input.cartId || '').trim(), 10)
  if (!Number.isFinite(cartIdNum) || cartIdNum <= 0) {
    return { success: false, error: 'Carrinho inválido para disparo de webhook' }
  }

  const event = String(input.event || '').trim()
  if (!['cart_created', 'cart_abandoned', 'cart_converted'].includes(event)) {
    return { success: false, error: 'Evento de webhook inválido para carrinho' }
  }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/admin/carts/${cartIdNum}/webhooks/dispatch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        event,
        storefront_base_url: (input.storefrontBaseUrl || '').trim() || undefined,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao disparar webhook do carrinho')
      return { success: false, error }
    }

    const payload = (await response.json()) as {
      success?: boolean
      message?: string
      event?: string
      cart_id?: number
      store_id?: number
      payload?: unknown
    }

    return {
      success: true,
      data: {
        success: Boolean(payload.success),
        message: String(payload.message || ''),
        event: String(payload.event || event),
        cartId: Number(payload.cart_id || cartIdNum),
        storeId: Number(payload.store_id || 0),
        payload: payload.payload,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado ao disparar webhook do carrinho',
    }
  }
}
