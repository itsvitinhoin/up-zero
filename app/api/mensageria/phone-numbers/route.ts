import { NextRequest, NextResponse } from 'next/server'
import { listPhoneNumbers } from '@/lib/whatsapp/provider'
import { addLog, getState, maskId, updateState } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function GET(req: NextRequest) {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const state = await getState()
  const wabaId = new URL(req.url).searchParams.get('wabaId') ?? state.integration.wabaId

  if (!wabaId) {
    return NextResponse.json({ data: state.phoneNumbers, error: { message: 'No WABA selected.' }, source: 'local' })
  }

  const result = await listPhoneNumbers(wabaId)

  if (!result.ok) {
    await addLog({
      type: 'phone_selected',
      status: 'failed',
      description: 'Failed: WhatsApp phone numbers could not be loaded from Meta.',
      safePayload: { wabaId: maskId(wabaId) },
      error: result.error,
      recommendedAction: result.error?.action,
    })
    return NextResponse.json({ data: state.phoneNumbers, error: result.error, source: 'local' })
  }

  await updateState((next) => {
    const removedIds = new Set(next.removedPhoneNumberIds)
    const incoming = (result.data ?? [])
      .filter((phone) => !removedIds.has(phone.id))
      .map((phone) => ({ ...phone, wabaId }))
    const incomingIds = new Set(incoming.map((phone) => phone.id))
    next.phoneNumbers = [
      ...incoming,
      ...next.phoneNumbers.filter((phone) => phone.wabaId !== wabaId && !incomingIds.has(phone.id)),
    ]
    next.integration.lastSyncAt = new Date().toISOString()
  })
  await addLog({ type: 'phone_selected', status: 'info', description: 'WhatsApp phone numbers loaded from Meta.', safePayload: { wabaId: maskId(wabaId), count: result.data?.length ?? 0 } })
  const next = await getState()
  return NextResponse.json({ data: next.phoneNumbers.filter((phone) => phone.wabaId === wabaId), source: 'meta' })
}
