import { NextRequest, NextResponse } from 'next/server'
import { addLog, createId, getState, saveCampaign } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'
import type { Campaign, CampaignMetrics, CampaignStatus } from '@/lib/whatsapp/types'


function metrics(totalContacts: number, estimatedCost: number): CampaignMetrics {
  return {
    totalContacts,
    scheduled: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    replies: 0,
    estimatedCost,
    costPerMessage: totalContacts > 0 ? estimatedCost / totalContacts : 0,
    responseRate: 0,
  }
}

export async function GET() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  return NextResponse.json(getState().campaigns)
}

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    id?: string
    name?: string
    listId?: string
    templateId?: string
    variableMapping?: Record<string, string>
    scheduledAt?: string
    status?: CampaignStatus
    estimatedCost?: number
  }
  const state = getState()
  const list = state.contactLists.find((item) => item.id === body.listId)
  const totalContacts = list?.contactIds.length ?? 0
  const now = new Date().toISOString()

  const campaign: Campaign = {
    id: body.id ?? createId('campaign'),
    name: String(body.name ?? 'Nova campanha').trim(),
    listId: body.listId,
    templateId: body.templateId,
    variableMapping: body.variableMapping ?? {},
    scheduledAt: body.scheduledAt,
    status: body.status ?? 'Draft',
    estimatedCost: Number(body.estimatedCost ?? 0),
    metrics: metrics(totalContacts, Number(body.estimatedCost ?? 0)),
    createdAt: now,
    updatedAt: now,
  }

  saveCampaign(campaign)
  addLog({
    type: 'campaign_created',
    status: 'success',
    description: 'Campaign saved.',
    safePayload: { campaign: campaign.name, status: campaign.status, contacts: totalContacts },
    recommendedAction: 'Review opt-in, approved template and cost before sending.',
  })
  return NextResponse.json(getState(), { status: 201 })
}
