import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  addCampaignTimelineEvent,
  deleteCampaign,
  getCampaign,
  upsertCampaign,
} from '@/lib/campaigns/store'

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const storeId = await getRequestStoreId()
  const campaign = getCampaign(id, storeId)
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const storeId = await getRequestStoreId()
  const existing = getCampaign(id, storeId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as Record<string, unknown>
  const now = new Date()

  // Status transition actions
  if (body.action === 'schedule') {
    const updated = {
      ...existing,
      status: 'SCHEDULED' as const,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt as string) : now,
      updatedAt: now,
    }
    upsertCampaign(updated)
    addCampaignTimelineEvent(id, storeId, 'SCHEDULED', 'Campanha agendada')
    return NextResponse.json(updated)
  }

  if (body.action === 'send') {
    const updated = {
      ...existing,
      status: 'RUNNING' as const,
      startedAt: now,
      updatedAt: now,
    }
    upsertCampaign(updated)
    addCampaignTimelineEvent(id, storeId, 'STARTED', 'Envio iniciado')
    return NextResponse.json(updated)
  }

  if (body.action === 'pause') {
    const updated = { ...existing, status: 'PAUSED' as const, updatedAt: now }
    upsertCampaign(updated)
    addCampaignTimelineEvent(id, storeId, 'PAUSED', 'Campanha pausada')
    return NextResponse.json(updated)
  }

  if (body.action === 'cancel') {
    const updated = { ...existing, status: 'CANCELED' as const, finishedAt: now, updatedAt: now }
    upsertCampaign(updated)
    addCampaignTimelineEvent(id, storeId, 'CANCELED', 'Campanha cancelada')
    return NextResponse.json(updated)
  }

  const updated = { ...existing, ...body, id, storeId, updatedAt: now }
  upsertCampaign(updated)
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const storeId = await getRequestStoreId()
  const existing = getCampaign(id, storeId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'RUNNING') {
    return NextResponse.json({ error: 'Cannot delete a running campaign' }, { status: 409 })
  }
  deleteCampaign(id, storeId)
  return NextResponse.json({ ok: true })
}
