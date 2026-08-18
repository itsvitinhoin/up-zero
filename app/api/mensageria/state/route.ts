import { NextResponse } from 'next/server'
import { buildReviewChecklist, getState } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function GET() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const state = await getState()
  return NextResponse.json({
    ...state,
    reviewChecklist: buildReviewChecklist(state),
  })
}
