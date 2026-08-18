import { NextRequest, NextResponse } from 'next/server'
import { getState, updateState } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'
import type { LogStatus, WhatsAppLogType } from '@/lib/whatsapp/types'


export async function GET(req: NextRequest) {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const params = new URL(req.url).searchParams
  const status = params.get('status') as LogStatus | null
  const type = params.get('type') as WhatsAppLogType | null
  const limit = Math.min(Number(params.get('limit') ?? '300'), 1000)
  let logs = (await getState()).logs

  if (status) logs = logs.filter((log) => log.status === status)
  if (type) logs = logs.filter((log) => log.type === type)

  return NextResponse.json(logs.slice(0, limit))
}

export async function DELETE() {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar configurações de mensageria' }, { status: 403 })
  }

  await updateState((state) => {
    state.logs = []
  })
  return NextResponse.json({ ok: true })
}
