import { NextRequest, NextResponse } from 'next/server'
import { ECOMMERCE_EVENT_DEFINITIONS } from '@/lib/whatsapp/ecommerce-events'
import { addLog, createId, getState, nowIso, saveAutomation } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'
import type { AutomationRule, AutomationStatus, ECommerceEventType } from '@/lib/whatsapp/types'


export async function GET() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const state = getState()
  return NextResponse.json({
    automations: state.automations,
    automationLogs: state.automationLogs,
    events: ECOMMERCE_EVENT_DEFINITIONS,
  })
}

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Partial<AutomationRule> & {
    eventType?: ECommerceEventType
    status?: AutomationStatus
  }
  const now = nowIso()

  if (!body.name?.trim()) return NextResponse.json({ error: 'Automation name is required.' }, { status: 400 })
  if (!body.eventType) return NextResponse.json({ error: 'E-commerce event is required.' }, { status: 400 })

  const automation: AutomationRule = {
    id: body.id ?? createId('automation'),
    name: body.name.trim(),
    eventType: body.eventType,
    conditions: body.conditions ?? { onlyWithOptIn: true },
    templateId: body.templateId || undefined,
    variableMapping: body.variableMapping ?? {},
    delayMinutes: Number(body.delayMinutes ?? 0),
    allowedWindow: body.allowedWindow,
    status: body.status ?? 'Draft',
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    createdAt: now,
    updatedAt: now,
  }

  saveAutomation(automation)
  addLog({
    type: 'automation_created',
    status: automation.status === 'Active' ? 'success' : 'info',
    description: `Automation created for ${automation.eventType}.`,
    safePayload: { automation: automation.name, eventType: automation.eventType, status: automation.status },
    recommendedAction: automation.templateId ? 'Keep monitoring automation logs.' : 'Select an APPROVED template before activating real sends.',
  })

  return NextResponse.json(getState())
}

export async function PATCH(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Partial<AutomationRule> & { id?: string }
  if (!body.id) return NextResponse.json({ error: 'Automation id is required.' }, { status: 400 })

  const existing = getState().automations.find((automation) => automation.id === body.id)
  if (!existing) return NextResponse.json({ error: 'Automation not found.' }, { status: 404 })

  const next: AutomationRule = {
    ...existing,
    ...body,
    conditions: { ...existing.conditions, ...(body.conditions ?? {}) },
    variableMapping: { ...existing.variableMapping, ...(body.variableMapping ?? {}) },
    updatedAt: nowIso(),
  }

  saveAutomation(next)
  addLog({
    type: next.status === 'Paused' ? 'automation_paused' : 'automation_updated',
    status: next.status === 'Failed' ? 'failed' : next.status === 'Active' ? 'success' : 'info',
    description: `Automation ${next.name} updated.`,
    safePayload: { automation: next.name, eventType: next.eventType, status: next.status },
    recommendedAction: next.status === 'Active' ? 'Watch automation logs after e-commerce events arrive.' : 'Activate only after template, conditions and opt-in rules are ready.',
  })

  return NextResponse.json(getState())
}
