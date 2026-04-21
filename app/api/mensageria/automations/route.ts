import { NextRequest, NextResponse } from 'next/server'
import { deleteRule, getRule, getRules, upsertRule } from '@/lib/whatsapp/store'
import type { WaAutomationRule } from '@/lib/whatsapp/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const list = getRules().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return NextResponse.json(list)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<WaAutomationRule>
  const id = `rule-${Date.now()}`
  const rule: WaAutomationRule = {
    id,
    name: body.name ?? 'Nova Automação',
    trigger: body.trigger ?? 'CUSTOMER_APPROVED',
    conditions: body.conditions ?? [],
    templateId: body.templateId ?? '',
    connectionId: body.connectionId ?? '',
    isActive: body.isActive ?? true,
    cooldownMinutes: body.cooldownMinutes ?? 0,
    dailyLimit: body.dailyLimit ?? 200,
    allowedHoursStart: body.allowedHoursStart ?? 8,
    allowedHoursEnd: body.allowedHoursEnd ?? 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  upsertRule(rule)
  return NextResponse.json(rule, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: string } & Partial<WaAutomationRule>
  const existing = getRule(body.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated: WaAutomationRule = { ...existing, ...body, updatedAt: new Date() }
  upsertRule(updated)
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteRule(id)
  return NextResponse.json({ ok: true })
}
