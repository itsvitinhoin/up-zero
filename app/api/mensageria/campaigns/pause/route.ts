import { NextRequest, NextResponse } from 'next/server'
import { addLog, getState, saveCampaign } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.send').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para enviar mensagens' }, { status: 403 })
  }

  const { campaignId } = await req.json().catch(() => ({})) as { campaignId?: string }
  const campaign = (await getState()).campaigns.find((item) => item.id === campaignId)
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })

  await saveCampaign({ ...campaign, status: 'Paused', updatedAt: new Date().toISOString() })
  await addLog({
    type: 'campaign_paused',
    status: 'success',
    description: 'Campaign paused.',
    safePayload: { campaign: campaign.name },
    recommendedAction: 'Resume only after reviewing audience, opt-in and template status.',
  })
  return NextResponse.json(await getState())
}
