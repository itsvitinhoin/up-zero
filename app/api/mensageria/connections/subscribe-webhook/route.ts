import { NextResponse } from 'next/server'
import { subscribeWabaToApp } from '@/lib/whatsapp/provider'
import { addLog, getState, maskId, updateIntegration } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function POST() {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar configurações de mensageria' }, { status: 403 })
  }

  const state = getState()
  const wabaId = state.integration.wabaId

  if (!wabaId) {
    const error = 'No WhatsApp Business Account is selected.'
    addLog({
      type: 'webhook_received',
      status: 'needs_attention',
      description: `Needs attention: ${error}`,
      recommendedAction: 'Select a WABA before subscribing webhook events.',
    })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  const result = await subscribeWabaToApp(wabaId)

  if (!result.ok) {
    addLog({
      type: 'webhook_received',
      status: 'failed',
      description: 'Failed: the selected WABA was not subscribed to this Meta app.',
      safePayload: { wabaId: maskId(wabaId) },
      error: result.error,
      recommendedAction: 'Confirm the system user token has whatsapp_business_management and access to this WABA, then try again.',
    })
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
  }

  updateIntegration({ webhookSubscribedAt: new Date().toISOString() })
  addLog({
    type: 'webhook_received',
    status: 'success',
    description: 'Selected WABA subscribed to this Meta app for webhook events.',
    safePayload: { wabaId: maskId(wabaId) },
    recommendedAction: 'In Meta App Dashboard, keep WhatsApp > Webhooks subscribed to the messages field.',
  })

  return NextResponse.json({ ok: true })
}
