'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle, Bug, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Info, Loader2, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WaOnboardingType } from '@/lib/whatsapp/types'
import type { WabaVerifyResult } from '@/app/api/mensageria/connections/verify-waba/route'

// ─── Required scopes for this flow ───────────────────────────────────────────
// These must be configured in Meta for Developers → Your App → Embedded Signup
// (under NEXT_PUBLIC_FACEBOOK_CONFIG_ID), AND must have Advanced Access approved
// in App Review for production traffic.

const REQUIRED_SCOPES = [
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'manage_app_solution',
  'whatsapp_business_manage_events',
]

// ─── Timeline types ───────────────────────────────────────────────────────────

type TimelineStatus = 'success' | 'warning' | 'failed' | 'info' | 'pending'

interface TimelineEntry {
  id: string
  stepNum: number
  title: string
  status: TimelineStatus
  ts: string
  details?: Record<string, string | boolean | null>
}

type OnboardingStatus =
  | 'NO_ONBOARDING_PAYLOAD'
  | 'WABA_CONNECTED_PHONE_PENDING'
  | 'FULLY_CONNECTED'

// ─── FB SDK types ─────────────────────────────────────────────────────────────

declare global {
  interface Window {
    FB?: {
      init(opts: { appId: string; cookie: boolean; xfbml: boolean; version: string }): void
      login(cb: (r: FBLoginResponse) => void, opts?: Record<string, unknown>): void
      AppEvents: { logPageView(): void }
    }
    fbAsyncInit?: () => void
  }
}

interface FBLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown'
  authResponse: {
    accessToken: string
    code?: string
    userID: string
    expiresIn: number
    signedRequest: string
  } | null
}

// ─── Embedded Signup session info ─────────────────────────────────────────────

interface SessionInfo {
  phone_number_id?: string
  waba_id?: string
  business_id?: string
}

interface EmbeddedSignupMessage {
  type: string
  event: 'FINISH' | 'CANCEL' | 'ERROR' | string
  data?: SessionInfo
  sessionInfo?: SessionInfo
  version?: string
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface WaOAuthCredentials {
  /** Auth code (exchanged server-side) or empty for partial connections */
  accessToken: string
  /** waba_id from Embedded Signup sessionInfo, confirmed via client_whatsapp_business_accounts */
  businessAccountId: string
  /** phone_number_id from Embedded Signup sessionInfo — empty when PHONE_NUMBER_PENDING */
  phoneNumberId: string
  phoneNumber: string
  verifiedName: string
  /** business_id from Embedded Signup sessionInfo */
  businessId?: string
  /** Onboarding scenario detected server-side */
  onboardingType: WaOnboardingType
  /** Raw platform_type from Meta phone number API */
  platformType?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onSuccess: (creds: WaOAuthCredentials) => void
  isReconnect?: boolean
  className?: string
}

type FlowStep = 'no-config' | 'ready' | 'authenticating' | 'verifying' | 'phone-pending' | 'migration' | 'error'

export function FacebookOAuthButton({ onSuccess, isReconnect = false, className }: Props) {
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
  const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID

  const [step, setStep] = useState<FlowStep>(!appId || !configId ? 'no-config' : 'ready')
  const [error, setError] = useState('')
  const [verifyResult, setVerifyResult] = useState<WabaVerifyResult | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [pendingCreds, setPendingCreds] = useState<WaOAuthCredentials | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const sessionInfoRef = useRef<SessionInfo | null>(null)

  // Use a ref so effects can call addStep without stale-closure issues
  const addStepRef = useRef<(
    stepNum: number, title: string, status: TimelineStatus,
    details?: Record<string, string | boolean | null>
  ) => void>()

  addStepRef.current = (stepNum, title, status, details) => {
    const entry: TimelineEntry = {
      id: `${stepNum}-${Date.now()}`,
      stepNum,
      title,
      status,
      ts: new Date().toISOString(),
      details,
    }
    setTimeline((prev) => {
      const without = prev.filter((e) => e.stepNum !== stepNum)
      return [...without, entry].sort((a, b) => a.stepNum - b.stepNum)
    })
  }

  function addStep(
    stepNum: number, title: string, status: TimelineStatus,
    details?: Record<string, string | boolean | null>,
  ) {
    addStepRef.current?.(stepNum, title, status, details)
  }

  // ── Capture WA_EMBEDDED_SIGNUP message from Facebook popup ────────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return
      try {
        const raw: unknown = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        const msg = raw as EmbeddedSignupMessage
        if (msg?.type !== 'WA_EMBEDDED_SIGNUP') return

        console.log('[FacebookOAuth] WA_EMBEDDED_SIGNUP message:', msg)

        if (msg.event === 'FINISH') {
          const info: SessionInfo = { ...(msg.data ?? {}), ...(msg.sessionInfo ?? {}) }
          console.log('[FacebookOAuth] sessionInfo merged:', info)

          // Step 3: Raw event received
          addStepRef.current?.(3, 'WA_EMBEDDED_SIGNUP recebido (FINISH)', 'success', {
            event: msg.event,
            version: msg.version ?? null,
            raw_waba_id: (msg.data?.waba_id ?? msg.sessionInfo?.waba_id) ?? null,
            raw_phone_number_id: (msg.data?.phone_number_id ?? msg.sessionInfo?.phone_number_id) ?? null,
            raw_business_id: (msg.data?.business_id ?? msg.sessionInfo?.business_id) ?? null,
          })

          // Step 4: Merged session info
          const hasPayload = !!(info.waba_id || info.phone_number_id)
          const step4Status: TimelineStatus = !hasPayload ? 'failed' : !info.phone_number_id ? 'warning' : 'success'
          addStepRef.current?.(4, 'Session info merged/parsed', step4Status, {
            waba_id: info.waba_id ?? null,
            business_id: info.business_id ?? null,
            phone_number_id: info.phone_number_id ?? null,
          })

          if (info.phone_number_id || info.waba_id) {
            sessionInfoRef.current = info
          } else {
            console.warn('[FacebookOAuth] FINISH event but no IDs in sessionInfo:', info)
          }
        } else {
          const evtStatus: TimelineStatus = msg.event === 'CANCEL' ? 'warning' : 'failed'
          addStepRef.current?.(3, `WA_EMBEDDED_SIGNUP recebido (${msg.event})`, evtStatus, {
            event: msg.event,
          })
        }
      } catch { /* not JSON or not a WA message */ }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── Wait for FB SDK ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!appId || step !== 'ready') return
    if (!window.FB) {
      const prev = window.fbAsyncInit
      window.fbAsyncInit = () => { prev?.(); setStep('ready') }
    }
  }, [appId, step])

  // ── Server-side WABA verification ────────────────────────────────────────
  async function verifyWithServer(code: string | null, info: SessionInfo) {
    setStep('verifying')
    setVerifyResult(null)

    // Step 7: Calling server
    addStep(7, 'Verificação no servidor iniciada', 'info', {
      has_code: !!code,
      waba_id: info.waba_id ?? null,
      business_id: info.business_id ?? null,
      phone_number_id: info.phone_number_id ?? null,
    })

    console.log('[FacebookOAuth] calling /api/mensageria/connections/verify-waba:', {
      has_code: !!code,
      phone_number_id: info.phone_number_id,
      waba_id: info.waba_id,
      business_id: info.business_id,
    })

    try {
      const res = await fetch('/api/mensageria/connections/verify-waba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          phone_number_id: info.phone_number_id,
          waba_id: info.waba_id,
          business_id: info.business_id,
        }),
      })

      const result = await res.json() as WabaVerifyResult
      console.log('[FacebookOAuth] verify-waba result:', result)

      // ── Token debug logging ───────────────────────────────────────────────
      if (result.tokenDiag) {
        const td = result.tokenDiag
        console.log('[FacebookOAuth] TOKEN_LOADED_FOR_REQUEST:', {
          source: td.tokenSource,
          type: td.tokenType,
          is_valid: td.isValid,
          app_id: td.appId,
        })
        console.log('[FacebookOAuth] TOKEN_SCOPES_PARSED:', td.grantedScopes)
        console.log('[FacebookOAuth] TOKEN_TYPE:', td.tokenType)
        console.log('[FacebookOAuth] VALIDATION_RESULT:', {
          has_business_management: td.hasBusinessManagement,
          missing_scopes: td.missingScopes,
          request_uses_this_token: false,
          note: 'WABA/phone API calls use the server-side FACEBOOK_SYSTEM_USER_TOKEN, not this token',
        })
      }

      setVerifyResult(result)
      setShowTimeline(true)

      if (result.ok) {
        const wabaId = result.confirmedWaba?.id ?? info.waba_id ?? ''
        const phoneId = info.phone_number_id ?? ''

        // ── PHONE_NUMBER_PENDING: WABA confirmed but phone step not done ─────
        if (result.phoneNumberPending || (!phoneId && wabaId)) {
          addStep(8, 'Status: WABA_CONNECTED_PHONE_PENDING', 'warning', {
            onboarding_status: 'WABA_CONNECTED_PHONE_PENDING' as OnboardingStatus,
            waba_id: wabaId || null,
            waba_name: result.confirmedWaba?.name ?? null,
            business_id: info.business_id ?? null,
            phone_number_id: null,
          })

          setPendingCreds({
            accessToken: code ?? '',
            businessAccountId: wabaId,
            phoneNumberId: '',
            phoneNumber: '',
            verifiedName: result.confirmedWaba?.name ?? '',
            businessId: info.business_id,
            onboardingType: 'new_number',
          })
          setStep('phone-pending')
          return
        }

        if (!wabaId) {
          addStep(8, 'Status: FAILED — waba_id ausente', 'failed', {
            reason: 'waba_id não retornado após verificação',
          })
          setError('Verificação concluída mas waba_id ausente.')
          setStep('error')
          return
        }

        const onboardingType = result.onboardingType ?? 'new_number'

        // ── Migration scenarios ───────────────────────────────────────────
        const creds: WaOAuthCredentials = {
          accessToken: code ?? '',
          businessAccountId: wabaId,
          phoneNumberId: phoneId,
          phoneNumber: result.phoneDetails?.displayPhone ?? '',
          verifiedName: result.confirmedWaba?.name ?? result.phoneDetails?.verifiedName ?? '',
          businessId: info.business_id,
          onboardingType,
          platformType: result.phoneDetails?.platformType,
        }

        if (onboardingType === 'existing_app_number' || onboardingType === 'migration_required') {
          addStep(8, `Status: ${onboardingType === 'existing_app_number' ? 'MIGRATION_APP_NUMBER' : 'MIGRATION_REQUIRED'}`, 'warning', {
            onboarding_type: onboardingType,
            phone_number: result.phoneDetails?.displayPhone ?? phoneId,
            platform_type: result.phoneDetails?.platformType ?? null,
          })
          setPendingCreds(creds)
          setStep('migration')
          return
        }

        // ── FULLY_CONNECTED ───────────────────────────────────────────────
        addStep(8, 'Status: FULLY_CONNECTED', 'success', {
          onboarding_status: 'FULLY_CONNECTED' as OnboardingStatus,
          onboarding_type: onboardingType,
          waba_id: wabaId,
          phone_number_id: phoneId,
          phone_number: result.phoneDetails?.displayPhone ?? null,
          verified_name: result.confirmedWaba?.name ?? result.phoneDetails?.verifiedName ?? null,
        })

        onSuccess(creds)
        setStep('ready')
      } else {
        addStep(8, 'Status: FAILED', 'failed', {
          reason: result.error ?? 'verify-waba retornou ok: false',
          failure_reason: result.failureReason ?? null,
        })
        setError(result.error ?? 'Verificação falhou.')
        setStep('error')
      }
    } catch (e) {
      console.error('[FacebookOAuth] verify-waba network error:', e)
      addStep(8, 'Status: FAILED — erro de rede', 'failed', {
        error: String(e),
      })
      setError(`Erro de rede ao verificar WABA: ${String(e)}`)
      setStep('error')
    }
  }

  function handleLogin() {
    if (window.location.protocol !== 'https:') {
      setError(
        'O Facebook Login exige HTTPS. Em desenvolvimento local use um túnel HTTPS: ' +
        'ngrok (ngrok http 3000) ou Cloudflare Tunnel (cloudflared tunnel --url http://localhost:3000). ' +
        'Em produção certifique-se de que o domínio usa HTTPS.',
      )
      setStep('error')
      return
    }

    if (!window.FB) {
      setError('Facebook SDK ainda não carregou. Recarregue a página e tente novamente.')
      setStep('error')
      return
    }

    // Reset state for this attempt
    setStep('authenticating')
    setError('')
    setVerifyResult(null)
    setShowDebug(false)
    setShowTimeline(false)
    setTimeline([])
    sessionInfoRef.current = null

    // Step 1: FB.login called
    addStep(1, 'FB.login chamado', 'info', {
      app_id: appId ?? null,
      config_id: configId ?? null,
      scope: REQUIRED_SCOPES.join(', '),
    })

    // Step 2: Embedded Signup popup will open
    addStep(2, 'Embedded Signup aberto', 'info', null)

    console.log('[FacebookOAuth] FB.login called:', { appId, configId })

    window.FB.login(
      (response) => {
        // Step 5: Login callback
        const cbStatus: TimelineStatus = response.status === 'connected' ? 'success' : 'warning'
        addStepRef.current?.(5, 'FB.login callback recebido', cbStatus, {
          status: response.status,
          has_auth_response: !!response.authResponse,
          has_code: !!response.authResponse?.code,
          has_access_token: !!response.authResponse?.accessToken,
        })

        console.log('[FacebookOAuth] FB.login callback:', {
          status: response.status,
          has_code: !!response.authResponse?.code,
          has_token: !!response.authResponse?.accessToken,
        })

        if (response.status === 'connected' && response.authResponse) {
          const code = response.authResponse.code ?? null
          const info = sessionInfoRef.current ?? {}

          console.log('[FacebookOAuth] sessionInfo at callback time:', info)

          // Step 6: Classify onboarding status from extracted identifiers
          const onboardingStatus: OnboardingStatus =
            !info.waba_id && !info.phone_number_id
              ? 'NO_ONBOARDING_PAYLOAD'
              : !info.phone_number_id
              ? 'WABA_CONNECTED_PHONE_PENDING'
              : 'FULLY_CONNECTED'

          const step6Status: TimelineStatus =
            onboardingStatus === 'FULLY_CONNECTED' ? 'success'
            : onboardingStatus === 'WABA_CONNECTED_PHONE_PENDING' ? 'warning'
            : 'failed'

          addStepRef.current?.(6, 'Identificadores extraídos', step6Status, {
            business_id: info.business_id ?? null,
            waba_id: info.waba_id ?? null,
            phone_number_id: info.phone_number_id ?? null,
            auth_code: code ? 'presente' : null,
            onboarding_status: onboardingStatus,
          })

          if (onboardingStatus === 'NO_ONBOARDING_PAYLOAD') {
            // Embedded Signup completed but returned no IDs at all
            // Don't blame config_id — the flow did start and finish
            setError(
              'Embedded Signup concluído, mas nenhum ID de conta WhatsApp Business foi retornado. ' +
              'Verifique se o usuário completou todas as etapas do fluxo e se o app tem acesso à WhatsApp Business API.',
            )
            setStep('error')
            return
          }

          // Proceed to server verification even if phone_number_id is missing —
          // the server will confirm the WABA and return phoneNumberPending: true
          void verifyWithServer(code, info)
        } else {
          console.log('[FacebookOAuth] login cancelled or denied')
          setStep('ready')
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        // Explicitly request all required scopes — merged with config_id's permissions
        scope: REQUIRED_SCOPES.join(','),
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      },
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (step === 'no-config') {
    const missing = !appId ? 'NEXT_PUBLIC_FACEBOOK_APP_ID' : 'NEXT_PUBLIC_FACEBOOK_CONFIG_ID'
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Variável ausente: <code className="font-mono">{missing}</code>.
          {!configId && (
            <> Crie a configuração em <strong>Meta for Developers → WhatsApp → Embedded Signup</strong> e defina <code className="font-mono">NEXT_PUBLIC_FACEBOOK_CONFIG_ID</code> no <code className="font-mono">.env.local</code>.</>
          )}
        </span>
      </div>
    )
  }

  // ── Phone number pending ──────────────────────────────────────────────────
  if (step === 'phone-pending' && pendingCreds) {
    return (
      <PhonePendingGuidance
        wabaId={pendingCreds.businessAccountId}
        wabaName={pendingCreds.verifiedName || undefined}
        businessId={pendingCreds.businessId}
        verifyResult={verifyResult}
        timeline={timeline}
        showTimeline={showTimeline}
        showDebug={showDebug}
        onToggleTimeline={() => setShowTimeline((p) => !p)}
        onToggleDebug={() => setShowDebug((p) => !p)}
        onSave={() => { onSuccess(pendingCreds); setStep('ready'); setPendingCreds(null) }}
        onCancel={() => { setStep('ready'); setPendingCreds(null); setVerifyResult(null) }}
      />
    )
  }

  // ── Migration guidance screen ─────────────────────────────────────────────
  if (step === 'migration' && pendingCreds) {
    const isAppNumber = pendingCreds.onboardingType === 'existing_app_number'
    return (
      <MigrationGuidance
        onboardingType={pendingCreds.onboardingType}
        phoneNumber={pendingCreds.phoneNumber || pendingCreds.phoneNumberId}
        verifyResult={verifyResult}
        timeline={timeline}
        showTimeline={showTimeline}
        showDebug={showDebug}
        onToggleTimeline={() => setShowTimeline((p) => !p)}
        onToggleDebug={() => setShowDebug((p) => !p)}
        onConfirm={() => { onSuccess(pendingCreds); setStep('ready'); setPendingCreds(null) }}
        onCancel={() => { setStep('ready'); setPendingCreds(null); setVerifyResult(null) }}
        isAppNumber={isAppNumber}
      />
    )
  }

  const busy = step === 'authenticating' || step === 'verifying'

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className={cn(
          'w-full h-10 gap-2.5 border-[#1877F2]/40 text-[#1877F2] hover:bg-[#1877F2]/5 hover:border-[#1877F2]/70 font-semibold',
          className,
        )}
        disabled={busy}
        onClick={handleLogin}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg className="h-4 w-4 fill-[#1877F2]" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        )}
        {step === 'authenticating' ? 'Aguardando Embedded Signup...' :
         step === 'verifying' ? 'Verificando conta WhatsApp...' :
         isReconnect ? 'Reconectar com Facebook' : 'Conectar com Facebook'}
      </Button>

      {step === 'error' && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-900/20 px-3 py-2.5 text-xs text-rose-800 dark:text-rose-300 leading-snug">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>

          {/* Diagnostic: business_management absent from code_exchange token — informational only */}
          {verifyResult?.tokenDiag?.hasBusinessManagement === false && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 leading-snug">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-medium">
                  <code className="font-mono">business_management</code> not found in the code_exchange token (diagnostic only).
                </span>
                <span className="block font-normal">
                  This token is used for diagnostics only — WABA API calls use <code className="font-mono">FACEBOOK_SYSTEM_USER_TOKEN</code>.
                  {' '}If the system user token has this scope, the connection may still succeed.
                  {' '}To resolve: ensure your Config ID requests <code className="font-mono">business_management</code> and Advanced Access is approved.
                </span>
              </div>
            </div>
          )}

          {/* Advanced Access warning — shown for explicit advanced_access_missing failure */}
          {verifyResult?.failureReason === 'advanced_access_missing' && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 leading-snug">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span><code className="font-mono">business_management</code> requires Advanced Access approval for this app. Request it at: <strong>Meta for Developers → App Review → Permissions and Features</strong>.</span>
            </div>
          )}

          {verifyResult && <VerifyDiagnosticPanel result={verifyResult} show={showDebug} onToggle={() => setShowDebug((p) => !p)} />}
        </div>
      )}

      {step === 'ready' && verifyResult && (
        <VerifyDiagnosticPanel result={verifyResult} show={showDebug} onToggle={() => setShowDebug((p) => !p)} />
      )}

      {step === 'ready' && !verifyResult && (
        <p className="text-xs text-muted-foreground text-center">
          O Embedded Signup guia o processo de conexão da conta WhatsApp Business.
        </p>
      )}

      {/* Onboarding debug timeline — shown whenever steps have been recorded */}
      {timeline.length > 0 && (
        <OnboardingTimeline entries={timeline} show={showTimeline} onToggle={() => setShowTimeline((p) => !p)} />
      )}
    </div>
  )
}

// ─── Phone number pending guidance ───────────────────────────────────────────

function PhonePendingGuidance({
  wabaId,
  wabaName,
  businessId,
  verifyResult,
  timeline,
  showTimeline,
  showDebug,
  onToggleTimeline,
  onToggleDebug,
  onSave,
  onCancel,
}: {
  wabaId: string
  wabaName?: string
  businessId?: string
  verifyResult: WabaVerifyResult | null
  timeline: TimelineEntry[]
  showTimeline: boolean
  showDebug: boolean
  onToggleTimeline: () => void
  onToggleDebug: () => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 px-3 py-3 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          WABA confirmada — número de telefone não vinculado
        </div>
        <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1.5 leading-relaxed">
          <p>
            A conta <strong>{wabaName ?? wabaId}</strong> foi verificada, mas o número de telefone não foi adicionado durante este fluxo.
          </p>

          {/* Structured ID debug block */}
          <div className="rounded bg-amber-100/60 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/40 px-2.5 py-2 font-mono text-[10px] space-y-0.5 mt-1">
            <div className="text-[9px] uppercase tracking-wide font-sans font-semibold text-amber-700 dark:text-amber-400 mb-1">Identifiers</div>
            <IdRow label="business_id" value={businessId ?? null} />
            <IdRow label="waba_id" value={wabaId} />
            <IdRow label="phone_number_id" value={null} missing />
            <IdRow label="onboarding_status" value="PHONE_NUMBER_PENDING" highlight />
          </div>

          <p className="font-semibold mt-1.5">Para adicionar o número de telefone:</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Acesse o <strong>WhatsApp Manager</strong> → Números de telefone</li>
            <li>Adicione e verifique o número desejado</li>
            <li>Volte aqui e clique em <strong>&quot;Reconectar com Facebook&quot;</strong></li>
          </ol>
          <p className="text-[11px] mt-1">Ou salve este registro agora e complete o número mais tarde.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" size="sm" className="flex-1 h-9 text-xs" onClick={onSave}>
          Salvar como pendente
        </Button>
      </div>

      {timeline.length > 0 && (
        <OnboardingTimeline entries={timeline} show={showTimeline} onToggle={onToggleTimeline} />
      )}
      {verifyResult && <VerifyDiagnosticPanel result={verifyResult} show={showDebug} onToggle={onToggleDebug} />}
    </div>
  )
}

// ─── Migration guidance ───────────────────────────────────────────────────────

function MigrationGuidance({
  onboardingType,
  phoneNumber,
  verifyResult,
  timeline,
  showTimeline,
  showDebug,
  onToggleTimeline,
  onToggleDebug,
  onConfirm,
  onCancel,
  isAppNumber,
}: {
  onboardingType: WaOnboardingType
  phoneNumber: string
  verifyResult: WabaVerifyResult | null
  timeline: TimelineEntry[]
  showTimeline: boolean
  showDebug: boolean
  onToggleTimeline: () => void
  onToggleDebug: () => void
  onConfirm: () => void
  onCancel: () => void
  isAppNumber: boolean
}) {
  if (isAppNumber) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 px-3 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Número no WhatsApp Business App — migração para Cloud API necessária
          </div>
          <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1 leading-relaxed">
            <p>O número <strong>{phoneNumber}</strong> está atualmente gerenciado pelo <strong>WhatsApp Business App</strong> (solução local/on-premise) e precisa ser migrado para a <strong>Cloud API</strong> para funcionar nesta plataforma.</p>
            <p className="font-semibold mt-2">O que acontece durante a migração:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>O WhatsApp Business App perde acesso ao número</li>
              <li>Histórico de mensagens no app não é transferido</li>
              <li>O número continua ativo e recebendo mensagens pela Cloud API</li>
            </ol>
            <p className="font-semibold mt-2">Para migrar:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>No WhatsApp Business App, vá em Configurações → Conta → Mudar número <strong>não</strong> é necessário</li>
              <li>Confirme a migração clicando em <strong>&quot;Registrar na Cloud API&quot;</strong> abaixo</li>
              <li>A verificação do número (código por SMS/chamada) será solicitada na primeira mensagem</li>
            </ol>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={onCancel}>Cancelar</Button>
          <Button type="button" size="sm" className="flex-1 h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white border-0" onClick={onConfirm}>
            Registrar na Cloud API
          </Button>
        </div>
        {timeline.length > 0 && <OnboardingTimeline entries={timeline} show={showTimeline} onToggle={onToggleTimeline} />}
        {verifyResult && <VerifyDiagnosticPanel result={verifyResult} show={showDebug} onToggle={onToggleDebug} />}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-900/20 px-3 py-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Número vinculado a outro provedor — migração necessária
        </div>
        <div className="text-xs text-rose-800 dark:text-rose-300 space-y-1 leading-relaxed">
          <p>O número <strong>{phoneNumber}</strong> está gerenciado por outro BSP (Business Solution Provider) ou provedor da Cloud API. Não é possível usar o número nesta plataforma sem antes migrá-lo.</p>
          <p className="font-semibold mt-2">Passos para migrar:</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Acesse o <strong>WhatsApp Manager</strong> da conta atual</li>
            <li>Vá em <strong>Números de telefone</strong> → selecione o número</li>
            <li>Clique em <strong>Remover</strong> ou solicite a migração ao provedor atual</li>
            <li>Aguarde a liberação (pode levar até 30 dias dependendo do provedor)</li>
            <li>Volte aqui e repita o processo de conexão</li>
          </ol>
          <p className="mt-2 font-semibold">Você pode salvar o registro agora com status pendente e atualizar depois.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={onCancel}>Cancelar</Button>
        <Button type="button" size="sm" className="flex-1 h-9 text-xs" onClick={onConfirm}>Salvar como pendente</Button>
      </div>
      {timeline.length > 0 && <OnboardingTimeline entries={timeline} show={showTimeline} onToggle={onToggleTimeline} />}
      {verifyResult && <VerifyDiagnosticPanel result={verifyResult} show={showDebug} onToggle={onToggleDebug} />}
    </div>
  )
}

// ─── Onboarding debug timeline ────────────────────────────────────────────────

function OnboardingTimeline({
  entries,
  show,
  onToggle,
}: {
  entries: TimelineEntry[]
  show: boolean
  onToggle: () => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleEntry(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const failCount = entries.filter((e) => e.status === 'failed').length
  const warnCount = entries.filter((e) => e.status === 'warning').length
  const headerStatus = failCount > 0 ? 'failed' : warnCount > 0 ? 'warning' : 'success'
  const headerIcon =
    headerStatus === 'failed' ? <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" /> :
    headerStatus === 'warning' ? <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" /> :
    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden text-xs">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        {headerIcon}
        <span>Onboarding Debug Timeline ({entries.length} etapas)</span>
        {failCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 text-[9px] font-bold">{failCount} falha{failCount > 1 ? 's' : ''}</span>
        )}
        {warnCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] font-bold">{warnCount} aviso{warnCount > 1 ? 's' : ''}</span>
        )}
        {show ? <ChevronDown className="h-3 w-3 ml-auto shrink-0" /> : <ChevronRight className="h-3 w-3 ml-auto shrink-0" />}
      </button>

      {show && (
        <div className="bg-muted/20 px-2 py-2 space-y-1">
          {entries.map((entry) => (
            <TimelineEntryRow
              key={entry.id}
              entry={entry}
              expanded={expandedIds.has(entry.id)}
              onToggle={() => toggleEntry(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TimelineEntryRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: TimelineEntry
  expanded: boolean
  onToggle: () => void
}) {
  const hasDetails = !!(entry.details && Object.keys(entry.details).length > 0)

  const STATUS = {
    success: {
      icon: <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />,
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      label: 'OK',
    },
    warning: {
      icon: <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />,
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      label: 'WARN',
    },
    failed: {
      icon: <XCircle className="h-3 w-3 text-rose-500 shrink-0" />,
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      label: 'FAIL',
    },
    info: {
      icon: <Info className="h-3 w-3 text-sky-500 shrink-0" />,
      badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
      label: 'INFO',
    },
    pending: {
      icon: <Loader2 className="h-3 w-3 text-muted-foreground shrink-0 animate-spin" />,
      badge: 'bg-muted text-muted-foreground',
      label: '...',
    },
  } as const

  const { icon, badge, label } = STATUS[entry.status]
  const time = entry.ts.split('T')[1]?.replace('Z', '').slice(0, 12) ?? entry.ts

  return (
    <div className="rounded border border-border/40 bg-background/60 overflow-hidden">
      <button
        type="button"
        className={cn(
          'w-full flex items-center gap-2 px-2.5 py-1.5 text-left',
          hasDetails ? 'cursor-pointer hover:bg-muted/30' : 'cursor-default',
        )}
        onClick={hasDetails ? onToggle : undefined}
      >
        {/* Step number */}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
          {entry.stepNum}
        </span>

        {/* Status icon */}
        {icon}

        {/* Title */}
        <span className="flex-1 font-medium text-foreground text-[10px] leading-tight min-w-0 truncate">
          {entry.title}
        </span>

        {/* Status badge */}
        <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0', badge)}>
          {label}
        </span>

        {/* Timestamp */}
        <span className="text-[9px] font-mono text-muted-foreground shrink-0 ml-1 tabular-nums">
          {time}
        </span>

        {/* Expand toggle */}
        {hasDetails && (
          expanded
            ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && hasDetails && (
        <div className="px-2.5 pb-2 pt-0.5">
          <div className="rounded bg-muted/40 dark:bg-muted/20 border border-border/30 px-2.5 py-2 font-mono text-[10px] space-y-0.5">
            {Object.entries(entry.details!).map(([k, v]) => {
              const isAbsent = v === null
              const isFail = !isAbsent && (v === false || (typeof v === 'string' && /ausente|missing|FAIL|null/i.test(v)))
              const isOk = !isAbsent && (v === true || (typeof v === 'string' && /presente|OK|CONNECTED|FULLY/i.test(v)))
              const isWarn = !isAbsent && typeof v === 'string' && /PENDING|WARN|migration/i.test(v)

              return (
                <div key={k} className="flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0" style={{ minWidth: '7.5rem' }}>{k}:</span>
                  <span className={cn(
                    'break-all',
                    isAbsent && 'text-muted-foreground italic',
                    isFail && 'text-rose-500',
                    isOk && 'text-emerald-600 dark:text-emerald-400',
                    isWarn && 'text-amber-600 dark:text-amber-400',
                    !isAbsent && !isFail && !isOk && !isWarn && 'text-foreground',
                  )}>
                    {isAbsent ? '(ausente)' : String(v)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Diagnostic panel (server-side token + WABA verification) ─────────────────

function VerifyDiagnosticPanel({
  result,
  show,
  onToggle,
}: {
  result: WabaVerifyResult
  show: boolean
  onToggle: () => void
}) {
  if (!result.steps?.length && !result.tokenDiag) return null

  const td = result.tokenDiag

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden text-xs">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <Bug className="h-3.5 w-3.5 shrink-0" />
        <span>Diagnóstico de verificação ({result.steps?.length ?? 0} etapas)</span>
        {show ? <ChevronDown className="h-3 w-3 ml-auto shrink-0" /> : <ChevronRight className="h-3 w-3 ml-auto shrink-0" />}
      </button>

      {show && (
        <div className="bg-muted/30 divide-y divide-border/40">

          {/* App ID verification */}
          {td && (
            <div className="px-3 py-2.5 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">App ID</div>
              <div className="font-mono text-[10px] space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground w-20 shrink-0">Configurado:</span>
                  <span className="text-foreground">{td.configuredAppId || '(não definido)'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground w-20 shrink-0">Token:</span>
                  <span className={cn('font-medium', td.appIdMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                    {td.appId}
                  </span>
                  {td.appId !== '(não retornado)' && (
                    td.appIdMatch
                      ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      : <XCircle className="h-3 w-3 text-rose-500 shrink-0" />
                  )}
                </div>
              </div>
              {!td.appIdMatch && td.appId !== '(não retornado)' && (
                <p className="text-[10px] text-rose-500 mt-0.5">
                  App IDs não conferem — o flow pode estar usando um app diferente do que está em App Review.
                </p>
              )}
            </div>
          )}

          {/* Token info */}
          {td && (
            <div className="px-3 py-2.5 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Token</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px]">
                <TokenRow label="Tipo" value={td.tokenType} />
                <TokenRow label="Fonte" value={td.tokenSource} />
                <TokenRow label="Válido" value={td.isValid ? 'sim' : 'não'} ok={td.isValid} />
                <TokenRow label="Expira" value={td.expiresAt} />
              </div>
              <div className="rounded bg-sky-50 dark:bg-sky-900/20 border border-sky-200/60 dark:border-sky-700/40 px-2 py-1.5 text-[10px] text-sky-700 dark:text-sky-300 leading-snug mt-1">
                <span className="font-semibold">Token do code_exchange (diagnóstico)</span> — obtido via troca de auth code.
                {' '}As chamadas à API WABA e de números usam o <code className="font-mono">FACEBOOK_SYSTEM_USER_TOKEN</code> do servidor, <strong>não este token</strong>.
                {td.tokenType === 'SYSTEM_USER' && (
                  <span className="block mt-0.5 text-emerald-700 dark:text-emerald-400">
                    Tipo <code className="font-mono">SYSTEM_USER</code> — usando SYSTEM_USER token para chamadas de API no servidor (comportamento esperado).
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Scopes */}
          {td && (
            <div className="px-3 py-2.5 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Escopos</div>
              <div className="space-y-0.5 font-mono text-[10px]">
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">Solicitados / Concedidos</div>
                <ScopeRow label="business_management" granted={td.hasBusinessManagement} note={!td.hasBusinessManagement ? 'Advanced Access required' : undefined} />
                <ScopeRow label="whatsapp_business_management" granted={td.hasWhatsappManagement} />
                <ScopeRow label="whatsapp_business_messaging" granted={td.hasWhatsappMessaging} />
                <ScopeRow label="manage_app_solution" granted={td.hasManageAppSolution ?? false} />
                <ScopeRow label="whatsapp_business_manage_events" granted={td.hasWabaManageEvents ?? false} />
              </div>
              {td.grantedScopes.length > 0 && (
                <div className="mt-1">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-0.5">Todos os concedidos pelo token</div>
                  <div className="font-mono text-[10px] text-muted-foreground break-all leading-relaxed">
                    {td.grantedScopes.join(', ')}
                  </div>
                </div>
              )}
              {td.missingScopes.length > 0 && (
                <div className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[10px]">
                  <span className="font-semibold">Ausentes:</span> {td.missingScopes.join(', ')}
                </div>
              )}
              {td.missingScopes.includes('business_management') && (
                <div className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-[10px] leading-snug">
                  <span className="font-semibold">business_management requires Advanced Access approval for this app.</span>{' '}
                  Request it at: Meta for Developers → App Review → Permissions and Features.
                </div>
              )}
            </div>
          )}

          {/* Step-by-step log */}
          <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
            {(result.steps ?? []).map((s, i) => (
              <div key={i} className="px-3 py-1.5 flex items-start gap-2 font-mono text-[10px] leading-relaxed">
                {s.ok
                  ? <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-emerald-500" />
                  : <XCircle className="h-3 w-3 shrink-0 mt-0.5 text-rose-500" />}
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">{i + 1}. {s.step}</div>
                  {s.detail && <div className="text-muted-foreground break-all">{s.detail}</div>}
                </div>
              </div>
            ))}
          </div>

          {result.allWabaIds && result.allWabaIds.length > 0 && (
            <div className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
              WABAs disponíveis: {result.allWabaIds.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function IdRow({ label, value, missing, highlight }: { label: string; value: string | null; missing?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0" style={{ minWidth: '7.5rem' }}>{label}:</span>
      <span className={cn(
        missing ? 'text-rose-500' : highlight ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-foreground',
      )}>
        {missing ? '(ausente)' : value}
      </span>
    </div>
  )
}

function TokenRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <>
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn('truncate', ok === false ? 'text-rose-500' : ok === true ? 'text-emerald-600' : 'text-foreground')}>
        {value}
      </span>
    </>
  )
}

function ScopeRow({ label, granted, note }: { label: string; granted: boolean; note?: string }) {
  return (
    <div className="flex items-start gap-1.5">
      {granted
        ? <CheckCircle2 className="h-2.5 w-2.5 shrink-0 mt-0.5 text-emerald-500" />
        : <XCircle className="h-2.5 w-2.5 shrink-0 mt-0.5 text-rose-400" />}
      <div>
        <span className={granted ? 'text-foreground' : 'text-rose-400'}>{label}</span>
        {note && !granted && (
          <span className="ml-1 text-amber-600 dark:text-amber-400">— {note}</span>
        )}
      </div>
    </div>
  )
}
