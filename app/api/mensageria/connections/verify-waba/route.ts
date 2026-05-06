/**
 * POST /api/mensageria/connections/verify-waba
 *
 * Server-side WABA + phone number verification after WhatsApp Embedded Signup.
 *
 * Token strategy:
 *   - Auth code exchange  → produces a token (USER or SYSTEM_USER depending on FB app config).
 *     This token is inspected via /debug_token for diagnostics only — it is NOT used for API calls.
 *   - FACEBOOK_SYSTEM_USER_TOKEN → used for all Graph API calls (client_whatsapp_business_accounts,
 *     phone number lookup). SYSTEM_USER is the expected token type for server-side calls.
 *   - Never return raw tokens to the client.
 *
 * Source of truth for onboarding:
 *   The Embedded Signup payload (waba_id, phone_number_id, business_id) is the authoritative
 *   signal of onboarding success. API discovery (client_whatsapp_business_accounts) enriches
 *   the result but never blocks onboarding when waba_id is already present in the payload.
 *
 * Onboarding states:
 *   waba_id + phone_number_id  → proceed to phone lookup → classify by platform_type
 *   waba_id only               → phoneNumberPending: true (PHONE_NUMBER_PENDING)
 *   neither                    → FAILED
 *
 * Advanced Access:
 *   Missing Advanced Access (empty WABA list or code 2388074) is a WARNING, not a blocker.
 *   Onboarding continues via the Embedded Signup payload.
 */

import type { WaOnboardingType } from '@/lib/whatsapp/types'
import { maskId, META_REVIEW_SCOPES } from '@/lib/whatsapp/meta'
import { NextRequest, NextResponse } from 'next/server'

const GRAPH = 'https://graph.facebook.com/v19.0'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphError {
  message: string
  type?: string
  code?: number
  error_subcode?: number
  fbtrace_id?: string
}

interface TokenDebugData {
  app_id?: string
  type?: string
  application?: string
  expires_at?: number
  is_valid?: boolean
  scopes?: string[]
  user_id?: string
  error?: GraphError
}

interface WabaRecord {
  id: string
  name?: string
  currency?: string
  owner_business_info?: { id: string; name: string }
}

interface PhoneNumberData {
  id?: string
  display_phone_number?: string
  verified_name?: string
  code_verification_status?: string  // VERIFIED | NOT_VERIFIED | EXPIRED
  quality_rating?: string            // GREEN | YELLOW | RED
  platform_type?: string             // CLOUD_API | ON_PREMISE
  account_mode?: string              // SANDBOX | LIVE
  status?: string
  error?: GraphError
}

export type VerifyFailureReason =
  | 'no_app_secret'
  | 'code_exchange_failed'
  | 'token_invalid'
  | 'no_system_token'
  | 'waba_not_found'
  | 'api_error'
  | 'wrong_business_id'
  | 'missing_scopes'
  | 'advanced_access_missing'
  | 'migration_required'

export interface WabaVerifyResult {
  ok: boolean
  failureReason?: VerifyFailureReason
  error?: string
  /** Which onboarding scenario was detected */
  onboardingType?: WaOnboardingType
  /** Sanitised token diagnostics — safe to display, no raw token values */
  tokenDiag?: {
    tokenType: string
    /**
     * How this token was obtained.
     * 'code_exchange' → FB auth code exchanged via POST /oauth/access_token.
     * The resulting type (USER or SYSTEM_USER) depends on the FB app configuration.
     * Actual WABA/phone API calls use FACEBOOK_SYSTEM_USER_TOKEN, not this token.
     */
    tokenSource: 'code_exchange'
    isValid: boolean
    grantedScopes: string[]
    missingScopes: string[]
    /** app_id from the token (what was used in the OAuth flow) */
    appId: string
    /** NEXT_PUBLIC_FACEBOOK_APP_ID — what we expect the flow to use */
    configuredAppId: string
    /** true when appId === configuredAppId */
    appIdMatch: boolean
    expiresAt: string
    hasWhatsappManagement: boolean
    hasBusinessManagement: boolean
    hasWhatsappMessaging: boolean
    hasAdvancedAccess: boolean
  }
  /** WABA confirmed from client_whatsapp_business_accounts or Embedded Signup payload */
  confirmedWaba?: {
    id: string
    name?: string
    currency?: string
    ownerBusinessId?: string
    ownerBusinessName?: string
  }
  /** Phone number details (no credentials) */
  phoneDetails?: {
    displayPhone: string
    verifiedName: string
    platformType: string        // CLOUD_API | ON_PREMISE | unknown
    codeVerificationStatus: string
    qualityRating: string
    accountMode: string
    status: string
  }
  allWabaIds?: string[]
  /** true when WABA was confirmed but phone_number_id was absent — UI should show PHONE_NUMBER_PENDING state */
  phoneNumberPending?: boolean
  steps: { step: string; ok: boolean; detail?: string }[]
}

// ─── Graph helpers ────────────────────────────────────────────────────────────

async function graphGet<T>(path: string, token: string): Promise<{ data: T; url: string }> {
  const url = `${GRAPH}${path}`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const raw = await res.json() as T & { error?: GraphError }
  return { data: raw, url }
}

async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
): Promise<{ access_token?: string; error?: string }> {
  // For FB.login (JS SDK) with response_type:'code', the redirect_uri must be
  // empty string — Meta accepts this for the client-side Embedded Signup flow.
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
    redirect_uri: '',
  })
  const res = await fetch(`${GRAPH}/oauth/access_token`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const data = await res.json() as { access_token?: string; error_description?: string; error?: { message: string } }
  if (data.error) return { error: data.error.message }
  if (data.error_description) return { error: data.error_description }
  return { access_token: data.access_token }
}

/** Classify the onboarding scenario from the phone's platform_type field */
function classifyOnboarding(
  platformType: string | undefined,
  phoneAccessible: boolean,
): WaOnboardingType {
  if (!phoneAccessible) return 'migration_required'
  if (!platformType || platformType === '') return 'new_number'
  if (platformType === 'CLOUD_API') return 'connected'
  if (platformType === 'ON_PREMISE') return 'existing_app_number'
  // Any other value (e.g. a future Meta platform) → treat as connected
  return 'connected'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<WabaVerifyResult>> {
  const body = await req.json() as {
    code?: string
    phone_number_id?: string
    waba_id?: string
    business_id?: string
  }

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? ''
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? ''
  const systemUserToken = process.env.FACEBOOK_SYSTEM_USER_TOKEN ?? ''

  const steps: WabaVerifyResult['steps'] = []
  const requiredScopes = [...META_REVIEW_SCOPES]

  console.log('[verify-waba] incoming request:', {
    has_code: !!body.code,
    phone_number_id: maskId(body.phone_number_id),
    waba_id: maskId(body.waba_id),
    business_id: maskId(body.business_id),
    has_app_secret: !!appSecret,
    has_system_token: !!systemUserToken,
  })

  // ── Step 1: Server config ────────────────────────────────────────────────
  if (!appSecret) {
    const detail = 'FACEBOOK_APP_SECRET não configurado. Necessário para trocar o auth code por token.'
    steps.push({ step: 'App Secret', ok: false, detail })
    console.warn('[verify-waba] FACEBOOK_APP_SECRET not set')
    return NextResponse.json({
      ok: false,
      failureReason: 'no_app_secret',
      error: 'FACEBOOK_APP_SECRET não configurado no servidor. Adicione em .env.local (nunca use NEXT_PUBLIC_).',
      steps,
    })
  }
  steps.push({ step: 'App Secret', ok: true })
  steps.push({
    step: 'System User Token',
    ok: !!systemUserToken,
    detail: systemUserToken
      ? 'FACEBOOK_SYSTEM_USER_TOKEN configurado — usado para chamadas à API WABA/phone (comportamento esperado).'
      : 'FACEBOOK_SYSTEM_USER_TOKEN não configurado. Verificação de WABA e phone não será possível.',
  })

  // ── Step 2: Exchange auth code → token ───────────────────────────────────
  // The resulting token (USER or SYSTEM_USER) is used only for /debug_token diagnostics.
  // All Graph API calls use FACEBOOK_SYSTEM_USER_TOKEN, not this token.
  let userToken = ''

  if (body.code) {
    const exchangeResult = await exchangeCodeForToken(body.code, appId, appSecret)
    if (exchangeResult.error || !exchangeResult.access_token) {
      const detail = exchangeResult.error ?? 'Resposta inválida do endpoint de token'
      steps.push({ step: 'Troca de auth code → token', ok: false, detail })
      console.error('[verify-waba] code exchange failed:', detail)
      return NextResponse.json({
        ok: false,
        failureReason: 'code_exchange_failed',
        error: `Falha ao trocar o auth code: ${detail}`,
        steps,
      })
    }
    userToken = exchangeResult.access_token
    steps.push({ step: 'Troca de auth code → token', ok: true, detail: 'Token obtido com sucesso (usado apenas para diagnóstico)' })
    console.log('[verify-waba] code exchanged OK')
  } else {
    steps.push({ step: 'Troca de auth code → token', ok: false, detail: 'Nenhum auth code no payload — inspeção de token ignorada' })
  }

  // ── Step 3: Inspect token via /debug_token (informational only) ──────────
  // This is diagnostic only — it does NOT gate the onboarding flow.
  // SYSTEM_USER and USER tokens are both valid outcomes of the code exchange.
  let tokenDiag: WabaVerifyResult['tokenDiag'] | undefined

  if (userToken && systemUserToken) {
    try {
      const { data: debugData } = await graphGet<{ data: TokenDebugData }>(
        `/debug_token?input_token=${userToken}`,
        systemUserToken,
      )
      const td = debugData.data ?? {}
      const grantedScopes = td.scopes ?? []
      const missingScopes = requiredScopes.filter((s) => !grantedScopes.includes(s))
      const expiresAt = td.expires_at
        ? (td.expires_at === 0 ? 'nunca (system user)' : new Date(td.expires_at * 1000).toISOString())
        : 'desconhecido'

      const tokenAppId = td.app_id ?? ''
      const appIdMatch = !!tokenAppId && tokenAppId === appId

      tokenDiag = {
        tokenType: td.type ?? 'desconhecido',
        tokenSource: 'code_exchange' as const,
        isValid: td.is_valid ?? false,
        grantedScopes,
        missingScopes,
        appId: tokenAppId || '(não retornado)',
        configuredAppId: appId,
        appIdMatch,
        expiresAt,
        hasWhatsappManagement: grantedScopes.includes('whatsapp_business_management'),
        hasBusinessManagement: grantedScopes.includes('business_management'),
        hasWhatsappMessaging: grantedScopes.includes('whatsapp_business_messaging'),
        hasAdvancedAccess: false,
      }

      console.log('[verify-waba] TOKEN_LOADED_FOR_REQUEST:', {
        source: 'code_exchange',
        note: 'Diagnostic only — WABA/phone API calls use FACEBOOK_SYSTEM_USER_TOKEN.',
        token_type: td.type,
        is_valid: td.is_valid,
        app_id: tokenAppId,
      })
      console.log('[verify-waba] TOKEN_SCOPES_PARSED:', grantedScopes)
      console.log('[verify-waba] TOKEN_TYPE:', td.type)
      console.log('[verify-waba] VALIDATION_RESULT:', {
        has_business_management: grantedScopes.includes('business_management'),
        missing_scopes: missingScopes,
        token_type: td.type,
        app_id_match: appIdMatch,
        expires_at: expiresAt,
      })

      steps.push({
        step: 'Inspeção do token (/debug_token)',
        ok: td.is_valid ?? false,
        detail: `Fonte: code_exchange | Tipo: ${td.type ?? '?'} | Válido: ${td.is_valid} | App ID: ${tokenAppId || '?'} | Escopos: ${grantedScopes.join(', ') || 'nenhum'} | Expiração: ${expiresAt}`,
      })

      // SYSTEM_USER token from code exchange is expected — not an error
      if (td.type === 'SYSTEM_USER') {
        console.log('[verify-waba] SYSTEM_USER token from code exchange — expected behavior for server-side API calls')
        steps.push({
          step: 'Tipo de token: SYSTEM_USER',
          ok: true,
          detail: 'Usando SYSTEM_USER token para chamadas de API no servidor (comportamento esperado). As chamadas à API WABA/phone usam FACEBOOK_SYSTEM_USER_TOKEN.',
        })
      }

      // App ID match check (informational)
      if (tokenAppId) {
        steps.push({
          step: 'Verificação do App ID',
          ok: appIdMatch,
          detail: appIdMatch
            ? `App ID confere: ${tokenAppId}`
            : `App ID do token (${tokenAppId}) ≠ app configurado (${appId}). O flow OAuth pode estar usando um app diferente do que está em App Review.`,
        })
      }

      // Token validity — hard fail only when no waba_id in payload (no fallback)
      if (!td.is_valid) {
        if (!body.waba_id) {
          return NextResponse.json({
            ok: false, failureReason: 'token_invalid',
            error: `Token inválido (tipo: ${td.type ?? 'desconhecido'}). Verifique se o Embedded Signup foi concluído corretamente.`,
            tokenDiag, steps,
          })
        }
        steps.push({
          step: 'Token inválido — continuando com Embedded Signup payload',
          ok: false,
          detail: `Token inválido mas waba_id "${maskId(body.waba_id)}" presente no payload. Onboarding continua via Embedded Signup.`,
        })
      }

      // Scope check — informational only, does not block onboarding
      // API calls use FACEBOOK_SYSTEM_USER_TOKEN; user token scopes are advisory
      if (missingScopes.length > 0) {
        steps.push({
          step: 'Verificação de escopos (informativo)',
          ok: false,
          detail: `Escopos não encontrados no token do code_exchange: ${missingScopes.join(', ')}. As chamadas à API usam FACEBOOK_SYSTEM_USER_TOKEN — verifique as permissões do System User se necessário.`,
        })
      } else if (grantedScopes.length > 0) {
        steps.push({ step: 'Verificação de escopos', ok: true, detail: `Escopos concedidos: ${grantedScopes.join(', ')}` })
      }
    } catch (e) {
      console.error('[verify-waba] /debug_token error:', e)
      steps.push({ step: 'Inspeção do token (/debug_token)', ok: false, detail: `Erro: ${String(e)} — continuando com Embedded Signup payload` })
    }
  } else if (systemUserToken && !userToken) {
    steps.push({ step: 'Inspeção do token (/debug_token)', ok: false, detail: 'Sem auth code — inspeção de token ignorada. Usando Embedded Signup payload.' })
  }

  // ── Step 4: WABA discovery via client_whatsapp_business_accounts ─────────
  // Advisory only — waba_id from the Embedded Signup payload is the source of truth.
  // API failures and empty results do NOT block onboarding when waba_id is in the payload.

  if (!systemUserToken) {
    steps.push({
      step: 'client_whatsapp_business_accounts',
      ok: false,
      detail: 'Ignorado — FACEBOOK_SYSTEM_USER_TOKEN não configurado',
    })
    if (body.waba_id) {
      // Proceed with Embedded Signup payload
      const hasPhone = !!body.phone_number_id
      return NextResponse.json({
        ok: true,
        onboardingType: 'new_number',
        phoneNumberPending: !hasPhone || undefined,
        error: 'Verificação parcial: IDs aceitos do Embedded Signup sem confirmação via API (FACEBOOK_SYSTEM_USER_TOKEN não configurado).',
        tokenDiag,
        confirmedWaba: { id: body.waba_id },
        steps,
      })
    }
    return NextResponse.json({
      ok: false, failureReason: 'no_system_token',
      error: 'FACEBOOK_SYSTEM_USER_TOKEN não configurado. Configure o token do System User da plataforma.',
      tokenDiag, steps,
    })
  }

  const businessId = body.business_id
  if (!businessId) {
    steps.push({
      step: 'client_whatsapp_business_accounts',
      ok: false,
      detail: 'business_id ausente no payload do Embedded Signup — descoberta de WABA via API ignorada',
    })
    if (body.waba_id) {
      // Embedded Signup payload is source of truth
      if (tokenDiag) tokenDiag.hasAdvancedAccess = true
      const hasPhone = !!body.phone_number_id
      return NextResponse.json({
        ok: true,
        onboardingType: 'new_number',
        phoneNumberPending: !hasPhone || undefined,
        error: 'business_id não retornado — WABA aceita via Embedded Signup payload.',
        tokenDiag, confirmedWaba: { id: body.waba_id }, steps,
      })
    }
    return NextResponse.json({ ok: false, failureReason: 'api_error', error: 'business_id e waba_id ausentes no payload.', tokenDiag, steps })
  }

  const wabaPath = `/${businessId}/client_whatsapp_business_accounts?fields=id,name,currency,owner_business_info&limit=20`
  console.log('[verify-waba] GET client_whatsapp_business_accounts:', { businessId: maskId(businessId) })

  let matchedWaba: WabaRecord | undefined
  let allWabaIds: string[] = []

  try {
    const { data: wabaRes } = await graphGet<{ data?: WabaRecord[]; error?: GraphError }>(wabaPath, systemUserToken)

    console.log('[verify-waba] client_whatsapp_business_accounts:', {
      count: wabaRes.data?.length ?? 0,
      error: wabaRes.error,
    })

    if (wabaRes.error) {
      const err = wabaRes.error
      let failureReason: VerifyFailureReason = 'api_error'
      let hint = ''
      let isAdvancedAccessIssue = false

      if (err.code === 200 || err.code === 10) {
        failureReason = 'missing_scopes'
        hint = 'O System User Token não tem as permissões necessárias (whatsapp_business_management + business_management).'
      } else if (err.code === 100 && err.error_subcode === 2388074) {
        failureReason = 'advanced_access_missing'
        isAdvancedAccessIssue = true
        hint = 'Advanced Access não aprovado para whatsapp_business_management — aviso apenas, onboarding continua via Embedded Signup payload.'
      } else if (err.code === 803 || err.code === 100) {
        failureReason = 'wrong_business_id'
        hint = `business_id "${maskId(businessId)}" não acessível com este System User Token.`
      }

      steps.push({
        step: `GET /${maskId(businessId)}/client_whatsapp_business_accounts`,
        ok: false,
        detail: `Erro ${err.code}${err.error_subcode ? `/${err.error_subcode}` : ''}: ${err.message}${hint ? ` → ${hint}` : ''}${err.fbtrace_id ? ` [trace: ${err.fbtrace_id}]` : ''}`,
      })

      if (!body.waba_id) {
        // No fallback available — hard failure
        return NextResponse.json({ ok: false, failureReason, error: hint || `Erro Meta (${err.code}): ${err.message}`, tokenDiag, steps })
      }

      // Embedded Signup payload is source of truth — continue with payload waba_id
      steps.push({
        step: 'WABA do Embedded Signup — fallback',
        ok: true,
        detail: `API retornou erro (${isAdvancedAccessIssue ? 'Advanced Access não aprovado' : `código ${err.code}`}) mas waba_id "${maskId(body.waba_id)}" presente no Embedded Signup. Onboarding continua.`,
      })
      matchedWaba = { id: body.waba_id }
    } else {
      allWabaIds = (wabaRes.data ?? []).map((w) => w.id)
      steps.push({
        step: `GET /${maskId(businessId)}/client_whatsapp_business_accounts`,
        ok: true,
        detail: `${allWabaIds.length} WABA(s): ${allWabaIds.map(maskId).join(', ') || '(nenhuma)'}`,
      })

      if (allWabaIds.length === 0) {
        // Advanced Access may not be approved yet — warn only, do not block
        if (tokenDiag) tokenDiag.hasAdvancedAccess = false
        steps.push({
          step: 'Advanced Access — aviso',
          ok: false,
          detail: 'Nenhuma WABA retornada via API. Possível causa: Advanced Access não aprovado ainda. Onboarding continua via Embedded Signup payload.',
        })
        if (!body.waba_id) {
          return NextResponse.json({
            ok: false, failureReason: 'advanced_access_missing',
            error: `Nenhuma WABA para business_id "${maskId(businessId)}" e waba_id não presente no payload do Embedded Signup.`,
            tokenDiag, allWabaIds: [], steps,
          })
        }
        // Embedded Signup payload is source of truth
        matchedWaba = { id: body.waba_id }
        steps.push({
          step: 'WABA do Embedded Signup — fallback',
          ok: true,
          detail: `Usando waba_id "${maskId(body.waba_id)}" do Embedded Signup (API retornou 0 WABAs — Advanced Access pode não estar aprovado).`,
        })
      } else {
        if (tokenDiag) tokenDiag.hasAdvancedAccess = true

        const targetWabaId = body.waba_id
        matchedWaba = targetWabaId
          ? (wabaRes.data ?? []).find((w) => w.id === targetWabaId)
          : (wabaRes.data ?? [])[0]

        if (targetWabaId && !matchedWaba) {
          // waba_id from payload not in API results — warn but use payload as source of truth
          steps.push({
            step: 'Correspondência waba_id — aviso',
            ok: false,
            detail: `waba_id "${maskId(targetWabaId)}" não encontrado na API (disponíveis: ${allWabaIds.map(maskId).join(', ')}) — usando waba_id do Embedded Signup como fonte de verdade.`,
          })
          matchedWaba = { id: targetWabaId }
        } else {
          steps.push({
            step: 'Correspondência waba_id',
            ok: true,
            detail: `WABA "${maskId(matchedWaba?.id)}" confirmada: ${matchedWaba?.name ?? '(sem nome)'}`,
          })
        }
      }
    }
  } catch (e) {
    console.error('[verify-waba] client_whatsapp_business_accounts error:', e)
    steps.push({ step: `GET /${maskId(businessId)}/client_whatsapp_business_accounts`, ok: false, detail: `Erro de rede: ${String(e)}` })
    if (!body.waba_id) {
      return NextResponse.json({ ok: false, failureReason: 'api_error', error: `Erro de rede: ${String(e)}`, tokenDiag, steps })
    }
    matchedWaba = { id: body.waba_id }
    steps.push({
      step: 'WABA do Embedded Signup — fallback',
      ok: true,
      detail: `Erro de rede mas waba_id "${maskId(body.waba_id)}" presente no Embedded Signup. Onboarding continua.`,
    })
  }

  // Hard failure only when we have no WABA from any source
  if (!matchedWaba) {
    return NextResponse.json({
      ok: false, failureReason: 'waba_not_found',
      error: 'Nenhum waba_id disponível no payload do Embedded Signup e nenhuma WABA encontrada via API.',
      tokenDiag, allWabaIds, steps,
    })
  }

  // ── Step 5: Phone number details + onboarding classification ────────────
  let phoneDetails: WabaVerifyResult['phoneDetails'] | undefined
  let onboardingType: WaOnboardingType = 'new_number'
  let phoneNumberPending = false

  const phoneNumberId = body.phone_number_id
  if (phoneNumberId) {
    const phonePath = `/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,account_mode,status`
    console.log('[verify-waba] GET phone number details:', maskId(phoneNumberId))

    try {
      const { data: phoneData } = await graphGet<PhoneNumberData>(phonePath, systemUserToken)

      console.log('[verify-waba] phone number data:', {
        id: maskId(phoneData.id),
        display_phone_number: phoneData.display_phone_number,
        platform_type: phoneData.platform_type,
        code_verification_status: phoneData.code_verification_status,
        quality_rating: phoneData.quality_rating,
        status: phoneData.status,
        error: phoneData.error,
      })

      if (phoneData.error) {
        // Phone not accessible via system user token — likely owned by another BSP
        const err = phoneData.error
        console.warn('[verify-waba] phone lookup error (possible migration required):', err)

        steps.push({
          step: `GET /${maskId(phoneNumberId)} (phone details)`,
          ok: false,
          detail: `Erro ${err.code}${err.error_subcode ? `/${err.error_subcode}` : ''}: ${err.message}. O número pode estar vinculado a outro provedor BSP.`,
        })

        onboardingType = 'migration_required'
        steps.push({
          step: 'Classificação do onboarding',
          ok: false,
          detail: 'migration_required — o número não está acessível com o System User Token desta plataforma. Pode estar gerenciado por outro BSP/provedor.',
        })
      } else {
        const platformType = phoneData.platform_type ?? ''
        phoneDetails = {
          displayPhone: phoneData.display_phone_number ?? '',
          verifiedName: phoneData.verified_name ?? '',
          platformType,
          codeVerificationStatus: phoneData.code_verification_status ?? 'UNKNOWN',
          qualityRating: phoneData.quality_rating ?? 'UNKNOWN',
          accountMode: phoneData.account_mode ?? 'UNKNOWN',
          status: phoneData.status ?? 'UNKNOWN',
        }

        onboardingType = classifyOnboarding(platformType, true)

        steps.push({
          step: `GET /${maskId(phoneNumberId)} (phone details)`,
          ok: true,
          detail: `Número: ${phoneData.display_phone_number ?? '?'} | Phone ID: ${maskId(phoneNumberId)} | Plataforma: ${platformType || '(não definido)'} | Status: ${phoneData.status ?? '?'} | Qualidade: ${phoneData.quality_rating ?? '?'}`,
        })
        steps.push({
          step: 'Classificação do onboarding',
          ok: onboardingType !== 'migration_required',
          detail: `Tipo detectado: ${onboardingType}${
            onboardingType === 'existing_app_number'
              ? ' — número está no WhatsApp Business App (ON_PREMISE). Migração para Cloud API necessária.'
              : onboardingType === 'connected'
              ? ' — número já está na Cloud API desta plataforma.'
              : onboardingType === 'migration_required'
              ? ' — número controlado por outro provedor.'
              : ' — novo número, pronto para configurar na Cloud API.'
          }`,
        })
      }
    } catch (e) {
      console.error('[verify-waba] phone lookup network error:', e)
      steps.push({ step: `GET /${maskId(phoneNumberId)} (phone details)`, ok: false, detail: `Erro de rede: ${String(e)}` })
      // Assume new_number if we can't reach the phone endpoint
      onboardingType = 'new_number'
    }
  } else {
    // waba_id present but no phone_number_id — PHONE_NUMBER_PENDING
    phoneNumberPending = true
    steps.push({
      step: 'Detalhes do número',
      ok: false,
      detail: 'phone_number_id ausente — WABA confirmada, número ainda pendente de atribuição (PHONE_NUMBER_PENDING)',
    })
  }

  // ── Return result ────────────────────────────────────────────────────────

  // migration_required is a non-fatal special case — return ok:true so the UI
  // can guide the user into the migration flow rather than blocking the dialog.
  const isMigrationCase = onboardingType === 'migration_required'

  console.log('[verify-waba] final result:', {
    onboardingType,
    waba: maskId(matchedWaba.id),
    phone: phoneDetails?.displayPhone ? 'display_phone_number returned' : maskId(phoneNumberId),
    phoneNumberPending,
  })

  return NextResponse.json({
    ok: true,                         // true even for migration/pending — UI decides next step
    onboardingType,
    failureReason: isMigrationCase ? 'migration_required' : undefined,
    phoneNumberPending: phoneNumberPending || undefined,
    error: isMigrationCase
      ? `O número está vinculado a outro provedor. Para migrá-lo para esta plataforma: (1) no WhatsApp Manager, remova o número da WABA atual, (2) aguarde a liberação (pode levar até 30 dias), (3) refaça o Embedded Signup.`
      : undefined,
    tokenDiag,
    confirmedWaba: {
      id: matchedWaba.id,
      name: matchedWaba.name,
      currency: matchedWaba.currency,
      ownerBusinessId: matchedWaba.owner_business_info?.id,
      ownerBusinessName: matchedWaba.owner_business_info?.name,
    },
    phoneDetails,
    allWabaIds,
    steps,
  })
}
