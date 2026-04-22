import { NextRequest, NextResponse } from 'next/server'
import {
  getActivePricingSnapshot,
  getPricingSnapshots,
  upsertPricingSnapshot,
} from '@/lib/campaigns/store'
import type { CampaignPricingSnapshot, MessageCategory } from '@/lib/campaigns/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const market = searchParams.get('market') ?? undefined
  const category = searchParams.get('category') as MessageCategory | null

  if (market && category) {
    const active = getActivePricingSnapshot(market, category)
    return NextResponse.json(active ?? null)
  }

  const snapshots = getPricingSnapshots(market)
  return NextResponse.json(snapshots)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<CampaignPricingSnapshot>

  const snapshot: CampaignPricingSnapshot = {
    id: `pricing-${Date.now()}`,
    source: body.source ?? 'MANUAL',
    market: body.market ?? 'BR',
    currency: body.currency ?? 'BRL',
    category: body.category ?? 'MARKETING',
    unitPrice: body.unitPrice ?? 0,
    effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
    effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
    rawSourcePayload: body.rawSourcePayload ?? {},
    createdAt: new Date(),
  }

  upsertPricingSnapshot(snapshot)
  return NextResponse.json(snapshot, { status: 201 })
}
