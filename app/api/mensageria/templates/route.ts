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

  const state = getState()
  const searchParams = new URL(req.url).searchParams
  const shouldSync = searchParams.get('sync') === '1'
  const wabaId = searchParams.get('wabaId') ?? state.integration.wabaId

  if (!shouldSync || !wabaId) {
    return NextResponse.json(state.templates)
  }

  const result = await listTemplates(wabaId)

  if (!result.ok) {
    addLog({
      type: 'templates_synced',
      status: 'failed',
      description: 'Failed: templates could not be synced from Meta.',
      safePayload: { wabaId: maskId(wabaId) },
      error: result.error,
      recommendedAction: result.error?.action,
    })
    return NextResponse.json(state.templates)
  }

  updateState((next) => {
    const localDrafts = next.templates.filter((template) => template.source === 'local_draft')
    next.templates = [...(result.data ?? []), ...localDrafts]
    next.integration.lastSyncAt = new Date().toISOString()
  })
  addLog({ type: 'templates_synced', status: 'success', description: 'Templates synced from Meta.', safePayload: { count: result.data?.length ?? 0 } })
  return NextResponse.json(getState().templates)
}

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const state = getState()
  const body = await req.json().catch(() => ({})) as {
    name?: string
    category?: TemplateCategory
    language?: string
    body?: string
    footer?: string
    buttons?: TemplateButton[]
    exampleValues?: Record<string, string>
    submitToMeta?: boolean
  }

  const templateBody = String(body.body ?? '').trim()
  const variables = extractTemplateVariables(templateBody)
  const now = new Date().toISOString()
  const components: TemplateComponent[] = [{ type: 'BODY', text: templateBody }]
  if (body.footer) components.push({ type: 'FOOTER', text: body.footer })
  if (body.buttons?.length) components.push({ type: 'BUTTONS', buttons: body.buttons })

  const template: WhatsAppTemplate = {
    id: createId('tpl'),
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
    source: 'local_draft',
    createdAt: now,
    updatedAt: now,
  }

  if (!template.name || !template.body) {
    return NextResponse.json({ error: 'Template name and body are required.' }, { status: 400 })
  }

  if (body.submitToMeta) {
    if (!state.integration.wabaId) {
      saveTemplate({ ...template, status: 'UNKNOWN' })
      addLog({
        type: 'template_created',
        status: 'needs_attention',
        description: 'Template draft saved locally. Submit failed because no WABA is selected.',
        recommendedAction: 'Select a WABA and submit the template again.',
      })
      return NextResponse.json({ template: { ...template, status: 'UNKNOWN' }, error: 'No WABA selected. Draft saved locally.' }, { status: 202 })
    }

    const result = await createMetaTemplate(state.integration.wabaId, template)
    if (!result.ok) {
      saveTemplate({ ...template, status: 'UNKNOWN' })
      addLog({
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

  saveTemplate(template)
  addLog({
    type: 'template_created',
    status: body.submitToMeta ? 'success' : 'info',
    description: body.submitToMeta ? 'Template submitted to Meta for approval.' : 'Template draft saved locally.',
    safePayload: { template: template.name, status: template.status },
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

  const state = getState()
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

  saveTemplate(updated)

  if (body.select) {
    if (updated.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only APPROVED templates can be selected for sending.' }, { status: 400 })
    }
    updateIntegration({ selectedTemplateId: updated.id })
  }

  addLog({
    type: updated.status === 'APPROVED' ? 'template_approved' : updated.status === 'REJECTED' ? 'template_rejected' : 'template_created',
    status: updated.status === 'REJECTED' ? 'needs_attention' : 'info',
    description: `Template ${updated.name} updated with status ${updated.status}.`,
    safePayload: { templateId: maskId(updated.id), status: updated.status },
    recommendedAction: updated.status === 'APPROVED' ? 'Use this template for test sends or campaigns.' : undefined,
  })

  return NextResponse.json(getState())
}
