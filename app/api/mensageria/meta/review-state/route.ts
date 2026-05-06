import { NextRequest, NextResponse } from 'next/server'
import {
  addIntegrationLog,
  getIntegrationLogs,
  getMetaReviewState,
  getWebhookEvents,
  updateMetaReviewState,
} from '@/lib/whatsapp/store'
import { maskId, maskPhone, META_REVIEW_REMOVED_SCOPES, META_REVIEW_SCOPES } from '@/lib/whatsapp/meta'
import type { WaMetaReviewSelection } from '@/lib/whatsapp/types'

export const dynamic = 'force-dynamic'

function sanitizeState() {
  const state = getMetaReviewState()
  const selection = state.selection ?? {}

  return {
    oauth: state.oauth
      ? {
          connected: true,
          profile: state.oauth.profile,
          connectedAt: state.oauth.connectedAt,
          expiresAt: state.oauth.expiresAt,
          tokenType: state.oauth.tokenType,
        }
      : null,
    selection,
    maskedSelection: {
      businessId: maskId(selection.businessId),
      wabaId: maskId(selection.wabaId),
      phoneNumberId: maskId(selection.phoneNumberId),
      phoneNumberDisplay: maskPhone(selection.phoneNumberDisplay),
    },
    serverToServerAuthConfigured: Boolean(process.env.FACEBOOK_SYSTEM_USER_TOKEN),
    requiredScopes: META_REVIEW_SCOPES,
    removedScopes: META_REVIEW_REMOVED_SCOPES,
    webhookEvents: getWebhookEvents(20).map((evt) => ({
      ...evt,
      fromMasked: maskPhone(evt.from),
      phoneNumberIdMasked: maskId(evt.phoneNumberId),
    })),
    integrationLogs: getIntegrationLogs(50),
  }
}

export async function GET() {
  return NextResponse.json(sanitizeState())
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { selection?: WaMetaReviewSelection }
  const selection = body.selection ?? {}
  const updated = updateMetaReviewState({ selection })

  if (selection.businessId) {
    addIntegrationLog({
      type: 'BUSINESS_SELECTED',
      label: 'Business selected',
      status: 'READY',
      detail: `${selection.businessName ?? 'Business'} (${maskId(selection.businessId)}) selected.`,
    })
  }
  if (selection.wabaId) {
    addIntegrationLog({
      type: 'WABA_SELECTED',
      label: 'WhatsApp Business Account selected',
      status: 'READY',
      detail: `${selection.wabaName ?? 'WABA'} (${maskId(selection.wabaId)}) selected.`,
    })
  }
  if (selection.phoneNumberId) {
    addIntegrationLog({
      type: 'PHONE_NUMBER_SELECTED',
      label: 'WhatsApp phone number selected',
      status: 'READY',
      detail: `${selection.phoneNumberDisplay ? maskPhone(selection.phoneNumberDisplay) : 'Phone'} (${maskId(selection.phoneNumberId)}) selected.`,
    })
  }

  return NextResponse.json({ ...sanitizeState(), selection: updated.selection ?? {} })
}
