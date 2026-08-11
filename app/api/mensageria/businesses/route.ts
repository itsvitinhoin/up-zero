import { NextResponse } from 'next/server'
import { listBusinesses } from '@/lib/whatsapp/provider'
import { addLog, getState, updateState } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function GET() {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar configurações de mensageria' }, { status: 403 })
  }

  const result = await listBusinesses()

  if (!result.ok) {
    addLog({
      type: 'business_loaded',
      status: 'failed',
      description: 'Failed: Business Managers could not be loaded from Meta.',
      error: result.error,
      recommendedAction: result.error?.action,
    })
    return NextResponse.json({ data: getState().businesses, error: result.error, source: 'local' })
  }

  updateState((state) => {
    state.businesses = result.data ?? []
    state.integration.lastSyncAt = new Date().toISOString()
  })
  addLog({ type: 'business_loaded', status: 'success', description: 'Business Managers loaded from Meta.', safePayload: { count: result.data?.length ?? 0 } })
  return NextResponse.json({ data: result.data ?? [], source: 'meta' })
}
