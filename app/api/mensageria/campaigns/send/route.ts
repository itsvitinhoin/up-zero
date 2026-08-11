import { NextRequest, NextResponse } from 'next/server'
import { addLog, getState, saveCampaign } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.send').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para enviar mensagens' }, { status: 403 })
  }

  const { campaignId } = await req.json().catch(() => ({})) as { campaignId?: string }
  const state = getState()
  const campaign = state.campaigns.find((item) => item.id === campaignId)
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })

  const list = state.contactLists.find((item) => item.id === campaign.listId)
  const template = state.templates.find((item) => item.id === campaign.templateId)
  const contacts = state.contacts.filter((contact) => list?.contactIds.includes(contact.id))
  const missingOptIn = contacts.filter((contact) => !contact.optInWhatsapp)

  if (!template || template.status !== 'APPROVED') {
    addLog({
      type: 'campaign_error',
      status: 'failed',
      description: 'Campaign send blocked because no approved template is selected.',
      safePayload: { campaign: campaign.name },
      recommendedAction: 'Select an APPROVED template before sending.',
    })
    return NextResponse.json({ error: 'Approved template is required.' }, { status: 400 })
  }

  if (missingOptIn.length > 0) {
    addLog({
      type: 'campaign_error',
      status: 'failed',
      description: 'Campaign send blocked because one or more contacts do not have WhatsApp opt-in.',
      safePayload: { campaign: campaign.name, missingOptIn: missingOptIn.length },
      recommendedAction: 'Remove contacts without opt-in or confirm opt-in before sending.',
    })
    return NextResponse.json({ error: 'Contacts without WhatsApp opt-in cannot receive campaigns.' }, { status: 400 })
  }

  const sent = contacts.length
  saveCampaign({
    ...campaign,
    status: 'Sent',
    metrics: {
      ...campaign.metrics,
      scheduled: 0,
      sent,
      delivered: 0,
      failed: 0,
      totalContacts: sent,
    },
    updatedAt: new Date().toISOString(),
  })
  addLog({
    type: 'campaign_sent',
    status: 'info',
    description: 'Campaign marked as sent in local workflow. Bulk Meta dispatch requires production send worker configuration.',
    safePayload: { campaign: campaign.name, recipients: sent, template: template.name },
    recommendedAction: 'Connect a production-safe send worker before high-volume dispatch.',
  })
  return NextResponse.json(getState())
}
