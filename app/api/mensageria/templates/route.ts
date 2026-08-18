import { NextRequest, NextResponse } from 'next/server'
import { createMetaTemplate, listTemplates } from '@/lib/whatsapp/provider'
import { extractTemplateVariables } from '@/lib/whatsapp/engine'
import { addLog, createId, getState, maskId, saveTemplate, updateIntegration, updateState } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'
import type { TemplateButton, TemplateCategory, TemplateComponent, TemplateStatus, WhatsAppTemplate } from '@/lib/whatsapp/types'


function validCategory(value: unknown): TemplateCategory {
  return value === 'UTILITY' || value === 'AUTHENTICATION' ? value : 'MARKETING'
}

function validStatus(value: unknown): TemplateStatus {
  return value === 'APPROVED' || value === 'PENDING' || value === 'REJECTED' || value === 'PAUSED' ? value : 'UNKNOWN'
}

export async function GET(req: NextRequest) {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const state = await getState()
  const searchParams = new URL(req.url).searchParams
  const shouldSync = searchParams.get('sync') === '1'
  const phoneNumberId = searchParams.get('phoneNumberId')
  const selectedPhone = phoneNumberId ? state.phoneNumbers.find((phone) => phone.id === phoneNumberId) : undefined
  const wabaId = selectedPhone?.wabaId ?? searchParams.get('wabaId') ?? state.integration.wabaId

  if (!shouldSync || !wabaId) {
    return NextResponse.json(state.templates)
  }

  const result = await listTemplates(wabaId)

  if (!result.ok) {
    await addLog({
      type: 'templates_synced',
      status: 'failed',
      description: 'Failed: templates could not be synced from Meta.',
      safePayload: { wabaId: maskId(wabaId) },
      error: result.error,
      recommendedAction: result.error?.action,
    })
    return NextResponse.json(state.templates)
  }

  let automaticallyActivated = 0
  await updateState((next) => {
    const incoming = (result.data ?? []).map((template) => ({ ...template, wabaId }))
    const incomingIds = new Set(incoming.map((template) => template.id))
    next.templates = [
      ...incoming,
      ...next.templates.filter((template) => (template.source === 'local_draft' || template.wabaId !== wabaId) && !incomingIds.has(template.id)),
    ]
    next.integration.lastSyncAt = new Date().toISOString()
    const approvedTemplateIds = new Set(next.templates.filter((template) => template.status === 'APPROVED').map((template) => template.id))
    for (const automation of next.automations) {
      if (automation.status === 'Draft' && automation.activateWhenTemplateApproved && automation.templateId && approvedTemplateIds.has(automation.templateId)) {
        automation.status = 'Active'
        automation.activateWhenTemplateApproved = false
        automation.updatedAt = new Date().toISOString()
        automaticallyActivated += 1
      }
    }
  })
  await addLog({
    type: 'templates_synced',
    status: 'success',
    description: automaticallyActivated > 0
      ? 'Templates sincronizados e automações pendentes ativadas.'
      : 'Templates synced from Meta.',
    safePayload: { wabaId: maskId(wabaId), phoneNumberId: maskId(phoneNumberId), count: result.data?.length ?? 0, automaticallyActivated },
  })
  return NextResponse.json((await getState()).templates)
}

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const state = await getState()
  const body = await req.json().catch(() => ({})) as {
    name?: string
    category?: TemplateCategory
    language?: string
    body?: string
    footer?: string
    buttons?: TemplateButton[]
    exampleValues?: Record<string, string>
    variableMapping?: Record<string, string>
    submitToMeta?: boolean
    phoneNumberId?: string
  }
  const selectedPhone = body.phoneNumberId
    ? state.phoneNumbers.find((phone) => phone.id === body.phoneNumberId)
    : undefined
  const targetWabaId = selectedPhone?.wabaId ?? state.integration.wabaId

  if (body.phoneNumberId && !selectedPhone) {
    return NextResponse.json({ error: 'O número selecionado não está mais conectado.' }, { status: 400 })
  }

  const templateBody = String(body.body ?? '').trim()
  const variables = extractTemplateVariables(templateBody)
  const invalidVariableOrder = variables.some((variable, index) => variable !== String(index + 1))
  if (invalidVariableOrder) {
    return NextResponse.json({ error: 'As variáveis do template devem seguir a ordem numérica {{1}}, {{2}}, {{3}}.' }, { status: 400 })
  }

  const missingPayloadMapping = variables.some((variable) => !body.variableMapping?.[variable])
  if (missingPayloadMapping) {
    return NextResponse.json({ error: 'Selecione o campo do payload para todas as variáveis do template.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const components: TemplateComponent[] = [{ type: 'BODY', text: templateBody }]
  if (body.footer) components.push({ type: 'FOOTER', text: body.footer })
  if (body.buttons?.length) components.push({ type: 'BUTTONS', buttons: body.buttons })

  const template: WhatsAppTemplate = {
    id: createId('tpl'),
    wabaId: targetWabaId,
    name: String(body.name ?? 'new_template').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    category: validCategory(body.category),
    language: String(body.language ?? 'en_US'),
    status: body.submitToMeta ? 'PENDING' : 'UNKNOWN',
    components,
    body: templateBody,
    variables,
    footer: body.footer,
    buttons: body.buttons ?? [],
    exampleValues: body.exampleValues ?? {},
    variableMapping: body.variableMapping ?? {},
    source: 'local_draft',
    createdAt: now,
    updatedAt: now,
  }

  if (!template.name || !template.body) {
    return NextResponse.json({ error: 'Template name and body are required.' }, { status: 400 })
  }

  if (body.submitToMeta) {
    if (!targetWabaId) {
      await saveTemplate({ ...template, status: 'UNKNOWN' })
      await addLog({
        type: 'template_created',
        status: 'needs_attention',
        description: 'Template draft saved locally. Submit failed because no WABA is selected.',
        recommendedAction: 'Select a WABA and submit the template again.',
      })
      return NextResponse.json({ template: { ...template, status: 'UNKNOWN' }, error: 'No WABA selected. Draft saved locally.' }, { status: 202 })
    }

    const result = await createMetaTemplate(targetWabaId, template)
    if (!result.ok) {
      await saveTemplate({ ...template, status: 'UNKNOWN' })
      await addLog({
        type: 'template_created',
        status: 'failed',
        description: 'Template draft saved locally, but Meta submission failed.',
        error: result.error,
        recommendedAction: result.error?.action ?? 'Review template content and Meta permissions.',
      })
      return NextResponse.json({ template: { ...template, status: 'UNKNOWN' }, error: result.error }, { status: 202 })
    }

    template.metaTemplateId = result.data?.id
    template.source = 'meta'
    template.status = 'PENDING'
  }

  await saveTemplate(template)
  await addLog({
    type: 'template_created',
    status: body.submitToMeta ? 'success' : 'info',
    description: body.submitToMeta ? 'Template submitted to Meta for approval.' : 'Template draft saved locally.',
    safePayload: { template: template.name, status: template.status, wabaId: maskId(targetWabaId), phoneNumberId: maskId(body.phoneNumberId) },
    recommendedAction: body.submitToMeta ? 'Wait for Meta approval before sending.' : 'Submit to Meta when ready.',
  })
  return NextResponse.json(template, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Partial<WhatsAppTemplate> & { id?: string; select?: boolean }
  if (!body.id) return NextResponse.json({ error: 'Template id is required.' }, { status: 400 })

  const state = await getState()
  const existing = state.templates.find((template) => template.id === body.id)
  if (!existing) return NextResponse.json({ error: 'Template not found.' }, { status: 404 })

  const bodyText = body.body ?? existing.body
  const updated: WhatsAppTemplate = {
    ...existing,
    ...body,
    category: validCategory(body.category ?? existing.category),
    status: validStatus(body.status ?? existing.status),
    body: bodyText,
    variables: extractTemplateVariables(bodyText),
    updatedAt: new Date().toISOString(),
  }

  await saveTemplate(updated)

  if (body.select) {
    if (updated.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only APPROVED templates can be selected for sending.' }, { status: 400 })
    }
    await updateIntegration({ selectedTemplateId: updated.id })
  }

  await addLog({
    type: updated.status === 'APPROVED' ? 'template_approved' : updated.status === 'REJECTED' ? 'template_rejected' : 'template_created',
    status: updated.status === 'REJECTED' ? 'needs_attention' : 'info',
    description: `Template ${updated.name} updated with status ${updated.status}.`,
    safePayload: { templateId: maskId(updated.id), status: updated.status },
    recommendedAction: updated.status === 'APPROVED' ? 'Use this template for test sends or campaigns.' : undefined,
  })

  return NextResponse.json(await getState())
}
