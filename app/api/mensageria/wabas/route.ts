import { NextRequest, NextResponse } from 'next/server'
import { listWabas } from '@/lib/whatsapp/provider'
import { addLog, getState, maskId, updateState } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function GET(req: NextRequest) {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const state = await getState()
  const businessId = new URL(req.url).searchParams.get('businessId') ?? state.integration.businessId

  if (!businessId) {
    return NextResponse.json({ data: state.wabas, error: { message: 'No Business selected.' }, source: 'local' })
  }

  const result = await listWabas(businessId)

  if (!result.ok) {
    await addLog({
      type: 'waba_loaded',
      status: 'failed',
      description: 'Failed: WhatsApp Business Accounts could not be loaded from Meta.',
      safePayload: { businessId: maskId(businessId) },
      error: result.error,
      recommendedAction: result.error?.action,
    })
    return NextResponse.json({ data: state.wabas, error: result.error, source: 'local' })
  }

  await updateState((next) => {
    const incoming = (result.data ?? []).map((waba) => {
      const existing = next.wabas.find((item) => item.id === waba.id)
      return { ...existing, ...waba, webhookSubscribedAt: existing?.webhookSubscribedAt }
    })
    const incomingIds = new Set(incoming.map((waba) => waba.id))
    next.wabas = [...incoming, ...next.wabas.filter((waba) => waba.businessId !== businessId && !incomingIds.has(waba.id))]
    next.integration.lastSyncAt = new Date().toISOString()
  })
  await addLog({ type: 'waba_loaded', status: 'success', description: 'WABAs loaded from Meta.', safePayload: { businessId: maskId(businessId), count: result.data?.length ?? 0 } })
  return NextResponse.json({ data: result.data ?? [], source: 'meta' })
}
