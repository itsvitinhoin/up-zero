import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getCampaigns, upsertCampaign } from '@/lib/campaigns/store'
import type { Campaign } from '@/lib/campaigns/types'

export const dynamic = 'force-dynamic'

function decodeJwtStoreId(token: string): number | null {
  try {
    const b64 = token.split('.')[1]
      .replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(Math.ceil(token.split('.')[1].length / 4) * 4, '=')
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString()) as Record<string, unknown>
    const raw = payload.store_id ?? payload.storeId ?? payload.store ?? payload.storeID
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

async function getRequestStoreId(): Promise<number> {
  const cookieStore = await cookies()
  const token = cookieStore.get('adminAuthToken')?.value
  if (token) {
    const fromJwt = decodeJwtStoreId(token)
    if (fromJwt) return fromJwt
  }
  const fromEnv = Number(process.env.STORE_ID)
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : 1
}

export async function GET() {
  const storeId = await getRequestStoreId()
  const campaigns = getCampaigns(storeId)
  return NextResponse.json(campaigns)
}

export async function POST(req: NextRequest) {
  const storeId = await getRequestStoreId()
  const body = await req.json() as Partial<Campaign>

  const now = new Date()
  const campaign: Campaign = {
    id: `camp-${Date.now()}`,
    storeId,
    name: body.name ?? 'Nova Campanha',
    description: body.description ?? '',
    status: 'DRAFT',
    audienceSourceType: body.audienceSourceType ?? 'SMART_LIST',
    smartListId: body.smartListId ?? null,
    wabaId: body.wabaId ?? '',
    phoneNumberId: body.phoneNumberId ?? '',
    connectionId: body.connectionId ?? '',
    whatsappTemplateId: body.whatsappTemplateId ?? '',
    templateName: body.templateName ?? '',
    templateCategory: body.templateCategory ?? 'MARKETING',
    templateLanguage: body.templateLanguage ?? 'pt_BR',
    templateVariables: body.templateVariables ?? {},
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    startedAt: null,
    finishedAt: null,
    createdBy: body.createdBy ?? 'admin',
    pricingSnapshotId: body.pricingSnapshotId ?? '',
    estimatedAudienceCount: body.estimatedAudienceCount ?? 0,
    eligibleAudienceCount: body.eligibleAudienceCount ?? 0,
    excludedCount: body.excludedCount ?? 0,
    invalidCount: body.invalidCount ?? 0,
    estimatedUnitCost: body.estimatedUnitCost ?? 0,
    estimatedTotalCost: body.estimatedTotalCost ?? 0,
    actualDeliveredCount: 0,
    actualTotalCost: 0,
    attributedOrderCount: 0,
    attributedRevenue: 0,
    attributionWindowDays: body.attributionWindowDays ?? 7,
    roi: 0,
    createdAt: now,
    updatedAt: now,
    performance: null,
    timeline: [
      {
        id: `tl-${Date.now()}`,
        campaignId: `camp-${Date.now()}`,
        event: 'CREATED',
        description: 'Campanha criada',
        occurredAt: now,
      },
    ],
    recipients: [],
  }

  upsertCampaign(campaign)
  return NextResponse.json(campaign, { status: 201 })
}
