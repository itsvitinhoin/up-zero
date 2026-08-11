import { NextRequest, NextResponse } from 'next/server'
import { META_REQUIRED_PERMISSIONS } from '@/lib/whatsapp/types'
import { addLog, getState, maskId, updateIntegration, updateState } from '@/lib/whatsapp/store'
import { listBusinesses, listPhoneNumbers, listTemplates, listWabas } from '@/lib/whatsapp/provider'
import { checkUserPermission } from '@/lib/actions/permissions'


function computeMissing(granted: string[]) {
  return META_REQUIRED_PERMISSIONS.filter((permission) => !granted.includes(permission))
}

export async function GET() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const state = getState()
  return NextResponse.json({
    integration: state.integration,
    selectedBusiness: state.businesses.find((item) => item.id === state.integration.businessId),
    selectedWaba: state.wabas.find((item) => item.id === state.integration.wabaId),
    selectedPhoneNumber: state.phoneNumbers.find((item) => item.id === state.integration.phoneNumberId),
  })
}

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar configurações de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    metaUser?: { id?: string; name?: string; email?: string; grantedPermissions?: string[] }
    grantedPermissions?: string[]
    businessId?: string
    wabaId?: string
    phoneNumberId?: string
    phoneNumber?: string
    businessAccountId?: string
  }

  const grantedPermissions = body.metaUser?.grantedPermissions ?? body.grantedPermissions ?? []
  const missingPermissions = computeMissing(grantedPermissions)

  updateIntegration({
    oauthStatus: 'completed',
    metaUser: {
      id: body.metaUser?.id ?? 'meta-user',
      name: body.metaUser?.name,
      email: body.metaUser?.email,
      grantedPermissions,
      missingPermissions,
    },
    businessId: body.businessId,
    wabaId: body.wabaId ?? body.businessAccountId,
    phoneNumberId: body.phoneNumberId,
    lastError: undefined,
  })

  if (body.businessId) {
    updateState((state) => {
      if (!state.businesses.some((item) => item.id === body.businessId)) {
        state.businesses.unshift({ id: body.businessId!, name: `Business ${maskId(body.businessId)}` })
      }
    })
  }

  if (body.businessAccountId || body.wabaId) {
    const wabaId = body.wabaId ?? body.businessAccountId!
    updateState((state) => {
      if (!state.wabas.some((item) => item.id === wabaId)) {
        state.wabas.unshift({ id: wabaId, name: `WABA ${maskId(wabaId)}`, businessId: body.businessId })
      }
    })
  }

  if (body.phoneNumberId) {
    updateState((state) => {
      if (!state.phoneNumbers.some((item) => item.id === body.phoneNumberId)) {
        state.phoneNumbers.unshift({
          id: body.phoneNumberId!,
          displayPhoneNumber: body.phoneNumber || `Phone ${maskId(body.phoneNumberId)}`,
        })
      }
    })
  }

  addLog({
    type: missingPermissions.length > 0 ? 'permission_missing' : 'oauth_completed',
    status: missingPermissions.length > 0 ? 'needs_attention' : 'success',
    description: missingPermissions.length > 0
      ? `Failed: ${missingPermissions.join(', ')} permission was not granted.`
      : 'Connected: Meta OAuth completed and required permissions were granted.',
    safePayload: {
      businessId: maskId(body.businessId),
      wabaId: maskId(body.wabaId ?? body.businessAccountId),
      phoneNumberId: maskId(body.phoneNumberId),
      grantedPermissions,
      missingPermissions,
    },
    recommendedAction: missingPermissions.length > 0
      ? 'Reconnect with Meta and grant the required permissions.'
      : 'Select Business, WABA, phone number and an approved template.',
  })

  return NextResponse.json(getState())
}

export async function PATCH(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar configurações de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    businessId?: string
    wabaId?: string
    phoneNumberId?: string
    selectedTemplateId?: string
  }

  updateIntegration({
    businessId: body.businessId,
    wabaId: body.wabaId,
    phoneNumberId: body.phoneNumberId,
    selectedTemplateId: body.selectedTemplateId,
    lastError: undefined,
  })

  if (body.phoneNumberId) {
    addLog({
      type: 'phone_selected',
      status: 'success',
      description: 'WhatsApp phone number selected for messaging.',
      safePayload: { phoneNumberId: maskId(body.phoneNumberId) },
      recommendedAction: 'Sync templates and select an approved template.',
    })
  }

  return NextResponse.json(getState())
}

export async function PUT() {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar configurações de mensageria' }, { status: 403 })
  }

  const state = getState()
  const businessResult = await listBusinesses()

  if (!businessResult.ok) {
    updateIntegration({ lastError: businessResult.error, status: 'failed', connectionStatus: 'failed' })
    addLog({
      type: 'business_loaded',
      status: 'failed',
      description: 'Failed: Meta Business list could not be loaded.',
      error: businessResult.error,
      recommendedAction: businessResult.error?.action ?? 'Check Meta System User token and permissions.',
    })
    return NextResponse.json(getState(), { status: 200 })
  }

  updateState((next) => {
    next.businesses = businessResult.data ?? []
  })
  addLog({
    type: 'business_loaded',
    status: 'success',
    description: 'Business Managers loaded from Meta.',
    safePayload: { count: businessResult.data?.length ?? 0 },
  })

  const selectedBusinessId = state.integration.businessId ?? businessResult.data?.[0]?.id
  if (selectedBusinessId) {
    const wabaResult = await listWabas(selectedBusinessId)
    if (wabaResult.ok) {
      updateState((next) => {
        next.wabas = wabaResult.data ?? []
      })
      addLog({ type: 'waba_loaded', status: 'success', description: 'WABAs loaded from Meta.', safePayload: { count: wabaResult.data?.length ?? 0 } })
    } else {
      addLog({ type: 'waba_loaded', status: 'failed', description: 'Failed: WABAs could not be loaded.', error: wabaResult.error, recommendedAction: wabaResult.error?.action })
    }
  }

  const afterWaba = getState()
  const selectedWabaId = afterWaba.integration.wabaId ?? afterWaba.wabas[0]?.id
  if (selectedWabaId) {
    const phoneResult = await listPhoneNumbers(selectedWabaId)
    if (phoneResult.ok) {
      updateState((next) => {
        next.phoneNumbers = phoneResult.data ?? []
      })
      addLog({ type: 'phone_selected', status: 'info', description: 'WhatsApp phone numbers loaded from Meta.', safePayload: { count: phoneResult.data?.length ?? 0 } })
    }

    const templateResult = await listTemplates(selectedWabaId)
    if (templateResult.ok) {
      updateState((next) => {
        const localDrafts = next.templates.filter((template) => template.source === 'local_draft')
        next.templates = [...(templateResult.data ?? []), ...localDrafts]
      })
      addLog({ type: 'templates_synced', status: 'success', description: 'Templates synced from Meta.', safePayload: { count: templateResult.data?.length ?? 0 } })
    }
  }

  updateIntegration({ lastSyncAt: new Date().toISOString(), lastError: undefined })
  return NextResponse.json(getState())
}
