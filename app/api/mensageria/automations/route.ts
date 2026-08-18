import { NextRequest, NextResponse } from 'next/server'
import { ECOMMERCE_EVENT_DEFINITIONS } from '@/lib/whatsapp/ecommerce-events'
import { addLog, createId, getState, maskId, nowIso, saveAutomation, updateState } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'
import type { AutomationRule, AutomationStatus, ECommerceEventType } from '@/lib/whatsapp/types'

function withoutOptInCondition(conditions?: AutomationRule['conditions']): AutomationRule['conditions'] {
  const next = { ...(conditions ?? {}) } as AutomationRule['conditions'] & Record<string, unknown>
  delete next.onlyWithOptIn
  delete next.optInWhatsapp
  return next
}

export async function GET() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const state = await getState()
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

  const state = await getState()
  const template = state.templates.find((item) => item.id === body.templateId)
  const phoneNumberId = body.phoneNumberId ?? body.fallbackPhoneNumberId ?? state.integration.phoneNumberId
  const phoneNumber = state.phoneNumbers.find((item) => item.id === phoneNumberId)
  if (!phoneNumberId || !phoneNumber) {
    return NextResponse.json({ error: 'Selecione o número conectado que enviará esta automação.' }, { status: 400 })
  }
  if (template?.wabaId && phoneNumber.wabaId && template.wabaId !== phoneNumber.wabaId) {
    return NextResponse.json({ error: 'O template selecionado pertence a outra WABA. Escolha um template do número emissor.' }, { status: 409 })
  }
  if (body.status === 'Active' && (!template || template.status !== 'APPROVED')) {
    return NextResponse.json({ error: 'A automação só pode ser ativada com um template aprovado pela Meta.' }, { status: 409 })
  }

  const automation: AutomationRule = {
    id: body.id ?? createId('automation'),
    name: body.name.trim(),
    eventType: body.eventType,
    conditions: withoutOptInCondition(body.conditions),
    templateId: body.templateId || undefined,
    phoneNumberId,
    wabaId: phoneNumber.wabaId,
    variableMapping: body.variableMapping ?? {},
    delayMinutes: Number(body.delayMinutes ?? 0),
    activateWhenTemplateApproved: Boolean(body.activateWhenTemplateApproved),
    senderStrategy: body.senderStrategy ?? 'fixed_phone',
    fallbackPhoneNumberId: body.fallbackPhoneNumberId || phoneNumberId,
    allowedWindow: body.allowedWindow,
    status: body.status ?? 'Draft',
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    createdAt: now,
    updatedAt: now,
  }

  await saveAutomation(automation)
  await addLog({
    type: 'automation_created',
    status: automation.status === 'Active' ? 'success' : 'info',
    description: `Automation created for ${automation.eventType}.`,
    safePayload: { automation: automation.name, eventType: automation.eventType, status: automation.status, phoneNumberId: maskId(phoneNumber.id), wabaId: maskId(phoneNumber.wabaId) },
    recommendedAction: automation.templateId ? 'Keep monitoring automation logs.' : 'Select an APPROVED template before activating real sends.',
  })

  return NextResponse.json(await getState())
}

export async function PATCH(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Partial<AutomationRule> & { id?: string }
  if (!body.id) return NextResponse.json({ error: 'Automation id is required.' }, { status: 400 })

  const existing = (await getState()).automations.find((automation) => automation.id === body.id)
  if (!existing) return NextResponse.json({ error: 'Automation not found.' }, { status: 404 })

  const requestedTemplateId = body.templateId ?? existing.templateId
  const requestedStatus = body.status ?? existing.status
  const state = await getState()
  const template = state.templates.find((item) => item.id === requestedTemplateId)
  const requestedPhoneNumberId = body.phoneNumberId ?? existing.phoneNumberId ?? existing.fallbackPhoneNumberId ?? state.integration.phoneNumberId
  const phoneNumber = state.phoneNumbers.find((item) => item.id === requestedPhoneNumberId)
  if (!requestedPhoneNumberId || !phoneNumber) {
    return NextResponse.json({ error: 'Selecione um número conectado para esta automação.' }, { status: 400 })
  }
  if (template?.wabaId && phoneNumber.wabaId && template.wabaId !== phoneNumber.wabaId) {
    return NextResponse.json({ error: 'O template selecionado pertence a outra WABA.' }, { status: 409 })
  }
  if (requestedStatus === 'Active' && (!template || template.status !== 'APPROVED')) {
    return NextResponse.json({ error: 'Aguarde a aprovação do template pela Meta antes de ativar.' }, { status: 409 })
  }

  const next: AutomationRule = {
    ...existing,
    ...body,
    phoneNumberId: requestedPhoneNumberId,
    wabaId: phoneNumber.wabaId,
    conditions: withoutOptInCondition({ ...existing.conditions, ...(body.conditions ?? {}) }),
    variableMapping: { ...existing.variableMapping, ...(body.variableMapping ?? {}) },
    updatedAt: nowIso(),
  }

  await saveAutomation(next)
  await addLog({
    type: next.status === 'Paused' ? 'automation_paused' : 'automation_updated',
    status: next.status === 'Failed' ? 'failed' : next.status === 'Active' ? 'success' : 'info',
    description: `Automation ${next.name} updated.`,
    safePayload: { automation: next.name, eventType: next.eventType, status: next.status },
    recommendedAction: next.status === 'Active' ? 'Watch automation logs after e-commerce events arrive.' : 'Activate after the template and automation conditions are ready.',
  })

  return NextResponse.json(await getState())
}

export async function DELETE(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar automações de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { id?: string }
  if (!body.id) return NextResponse.json({ error: 'Automation id is required.' }, { status: 400 })

  const current = await getState()
  const automation = current.automations.find((item) => item.id === body.id)
  if (!automation) return NextResponse.json({ error: 'Automation not found.' }, { status: 404 })

  const deletedAt = nowIso()
  await updateState((state) => {
    state.automations = state.automations.filter((item) => item.id !== body.id)
    state.automationJobs = state.automationJobs.map((job) => (
      job.automationId === body.id && ['scheduled', 'processing'].includes(job.status)
        ? {
            ...job,
            status: 'cancelled',
            cancelReason: 'automation_deleted',
            processedAt: deletedAt,
            updatedAt: deletedAt,
          }
        : job
    ))
  })

  await addLog({
    type: 'automation_deleted',
    status: 'info',
    description: `Automação removida: ${automation.name}.`,
    safePayload: { automationId: maskId(automation.id), eventType: automation.eventType },
    recommendedAction: 'Crie uma nova automação caso esse evento volte a precisar de disparo.',
  })

  return NextResponse.json(await getState())
}
