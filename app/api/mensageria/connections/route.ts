import { NextRequest, NextResponse } from 'next/server'
import { META_REQUIRED_PERMISSIONS, type WhatsAppIntegration } from '@/lib/whatsapp/types'
import { addLog, getState, maskId, updateIntegration, updateState } from '@/lib/whatsapp/store'
import { getPhoneNumber, listBusinesses, listPhoneNumbers, listTemplates, listWabas } from '@/lib/whatsapp/provider'
import { checkUserPermission } from '@/lib/actions/permissions'


function computeMissing(granted: string[]) {
  return META_REQUIRED_PERMISSIONS.filter((permission) => !granted.includes(permission))
}

export async function GET() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const state = await getState()
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
    verifiedName?: string
    qualityRating?: string
    status?: string
    codeVerificationStatus?: string
    businessAccountId?: string
  }

  const grantedPermissions = body.metaUser?.grantedPermissions ?? body.grantedPermissions ?? []
  const missingPermissions = computeMissing(grantedPermissions)

  await updateIntegration({
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
    await updateState((state) => {
      if (!state.businesses.some((item) => item.id === body.businessId)) {
        state.businesses.unshift({ id: body.businessId!, name: `Business ${maskId(body.businessId)}` })
      }
    })
  }

  if (body.businessAccountId || body.wabaId) {
    const wabaId = body.wabaId ?? body.businessAccountId!
    await updateState((state) => {
      if (!state.wabas.some((item) => item.id === wabaId)) {
        state.wabas.unshift({ id: wabaId, name: `WABA ${maskId(wabaId)}`, businessId: body.businessId })
      }
    })
  }

  if (body.phoneNumberId) {
    await updateState((state) => {
      state.removedPhoneNumberIds = state.removedPhoneNumberIds.filter((id) => id !== body.phoneNumberId)
      if (!state.phoneNumbers.some((item) => item.id === body.phoneNumberId)) {
        state.phoneNumbers.unshift({
          id: body.phoneNumberId!,
          wabaId: body.wabaId ?? body.businessAccountId,
          businessId: body.businessId,
          displayPhoneNumber: body.phoneNumber || `Phone ${maskId(body.phoneNumberId)}`,
          verifiedName: body.verifiedName,
          qualityRating: body.qualityRating,
          status: body.status,
          codeVerificationStatus: body.codeVerificationStatus,
        })
      } else {
        state.phoneNumbers = state.phoneNumbers.map((phone) => phone.id === body.phoneNumberId
          ? {
              ...phone,
              wabaId: body.wabaId ?? body.businessAccountId ?? phone.wabaId,
              businessId: body.businessId ?? phone.businessId,
              displayPhoneNumber: body.phoneNumber || phone.displayPhoneNumber,
              verifiedName: body.verifiedName || phone.verifiedName,
              qualityRating: body.qualityRating || phone.qualityRating,
              status: body.status || phone.status,
              codeVerificationStatus: body.codeVerificationStatus || phone.codeVerificationStatus,
            }
          : phone)
      }
    })
  }

  await addLog({
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

  return NextResponse.json(await getState())
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
    fallbackPhoneNumberId?: string
    selectedTemplateId?: string
  }

  const integrationPatch: Partial<WhatsAppIntegration> = { lastError: undefined }
  if (body.businessId !== undefined) integrationPatch.businessId = body.businessId
  if (body.wabaId !== undefined) integrationPatch.wabaId = body.wabaId
  if (body.phoneNumberId !== undefined) {
    integrationPatch.phoneNumberId = body.phoneNumberId
    const phone = (await getState()).phoneNumbers.find((item) => item.id === body.phoneNumberId)
    if (phone?.wabaId) integrationPatch.wabaId = phone.wabaId
    if (phone?.businessId) integrationPatch.businessId = phone.businessId
  }
  if (body.fallbackPhoneNumberId !== undefined) integrationPatch.fallbackPhoneNumberId = body.fallbackPhoneNumberId
  if (body.selectedTemplateId !== undefined) integrationPatch.selectedTemplateId = body.selectedTemplateId
  await updateIntegration(integrationPatch)

  if (body.phoneNumberId) {
    await addLog({
      type: 'phone_selected',
      status: 'success',
      description: 'WhatsApp phone number selected for messaging.',
      safePayload: { phoneNumberId: maskId(body.phoneNumberId) },
      recommendedAction: 'Sync templates and select an approved template.',
    })
  }

  if (body.fallbackPhoneNumberId) {
    await addLog({
      type: 'phone_selected',
      status: 'success',
      description: 'Default fallback WhatsApp phone number selected.',
      safePayload: { fallbackPhoneNumberId: maskId(body.fallbackPhoneNumberId) },
      recommendedAction: 'Automations without a seller connection will use this number.',
    })
  }

  return NextResponse.json(await getState())
}

export async function PUT() {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar configurações de mensageria' }, { status: 403 })
  }

  const state = await getState()
  if (state.integration.phoneNumberId) {
    const selectedPhone = state.phoneNumbers.find((phone) => phone.id === state.integration.phoneNumberId)
    const phoneResult = await getPhoneNumber(state.integration.phoneNumberId, selectedPhone?.wabaId ?? state.integration.wabaId)
    if (phoneResult.ok && phoneResult.data) {
      await updateState((next) => {
        if (next.removedPhoneNumberIds.includes(phoneResult.data!.id)) return
        const existingIndex = next.phoneNumbers.findIndex((phone) => phone.id === phoneResult.data!.id)
        if (existingIndex >= 0) next.phoneNumbers[existingIndex] = phoneResult.data!
        else next.phoneNumbers.unshift(phoneResult.data!)
      })
      await addLog({
        type: 'phone_selected',
        status: 'success',
        description: 'WhatsApp phone-number health refreshed directly from Meta.',
        safePayload: {
          phoneNumberId: maskId(phoneResult.data.id),
          status: phoneResult.data.status,
          qualityRating: phoneResult.data.qualityRating,
          codeVerificationStatus: phoneResult.data.codeVerificationStatus,
        },
      })
    } else {
      await addLog({
        type: 'phone_selected',
        status: 'needs_attention',
        description: 'The selected phone-number health could not be refreshed from Meta.',
        error: phoneResult.error,
        recommendedAction: phoneResult.error?.action ?? 'Confirm that the System User token can access this Phone Number ID.',
      })
    }
  }

  const businessResult = await listBusinesses()
  if (businessResult.ok) {
    await updateState((next) => { next.businesses = businessResult.data ?? [] })
    await addLog({ type: 'business_loaded', status: 'success', description: 'Business Managers loaded from Meta.', safePayload: { count: businessResult.data?.length ?? 0 } })
  } else {
    await addLog({ type: 'business_loaded', status: 'needs_attention', description: 'Business discovery failed; known WABAs will still be synchronized.', error: businessResult.error, recommendedAction: businessResult.error?.action })
  }

  const knownBusinessIds = new Set([
    ...state.wabas.map((waba) => waba.businessId).filter((value): value is string => Boolean(value)),
    state.integration.businessId,
    ...(businessResult.data ?? []).map((business) => business.id),
  ].filter((value): value is string => Boolean(value)))

  for (const businessId of knownBusinessIds) {
    const wabaResult = await listWabas(businessId)
    if (wabaResult.ok) {
      await updateState((next) => {
        const discovered = (wabaResult.data ?? []).map((waba) => {
          const existing = next.wabas.find((item) => item.id === waba.id)
          return { ...existing, ...waba, webhookSubscribedAt: existing?.webhookSubscribedAt }
        })
        const discoveredIds = new Set(discovered.map((waba) => waba.id))
        next.wabas = [...discovered, ...next.wabas.filter((waba) => !discoveredIds.has(waba.id))]
      })
      await addLog({ type: 'waba_loaded', status: 'success', description: 'WABAs loaded from Meta.', safePayload: { businessId: maskId(businessId), count: wabaResult.data?.length ?? 0 } })
    }
  }

  const current = await getState()
  const knownWabaIds = [...new Set([
    ...current.wabas.map((waba) => waba.id),
    ...current.phoneNumbers.map((phone) => phone.wabaId).filter((value): value is string => Boolean(value)),
    current.integration.wabaId,
  ].filter((value): value is string => Boolean(value)))]

  for (const wabaId of knownWabaIds) {
    const [phonesResult, templatesResult] = await Promise.all([
      listPhoneNumbers(wabaId),
      listTemplates(wabaId),
    ])

    if (phonesResult.ok) {
      await updateState((next) => {
        const removedIds = new Set(next.removedPhoneNumberIds)
        const incoming = (phonesResult.data ?? [])
          .filter((phone) => !removedIds.has(phone.id))
          .map((phone) => ({ ...phone, wabaId }))
        const incomingIds = new Set(incoming.map((phone) => phone.id))
        next.phoneNumbers = [...incoming, ...next.phoneNumbers.filter((phone) => phone.wabaId !== wabaId && !incomingIds.has(phone.id))]
      })
      await addLog({ type: 'phone_selected', status: 'info', description: 'WhatsApp phone numbers loaded from Meta.', safePayload: { wabaId: maskId(wabaId), count: phonesResult.data?.length ?? 0 } })
    }

    if (templatesResult.ok) {
      await updateState((next) => {
        const incoming = (templatesResult.data ?? []).map((template) => ({ ...template, wabaId }))
        const incomingIds = new Set(incoming.map((template) => template.id))
        next.templates = [
          ...incoming,
          ...next.templates.filter((template) => (template.source === 'local_draft' || template.wabaId !== wabaId) && !incomingIds.has(template.id)),
        ]
      })
      await addLog({ type: 'templates_synced', status: 'success', description: 'Templates synced from Meta for WABA.', safePayload: { wabaId: maskId(wabaId), count: templatesResult.data?.length ?? 0 } })
    }
  }

  await updateIntegration({ lastSyncAt: new Date().toISOString(), lastError: undefined })
  return NextResponse.json(await getState())
}

export async function DELETE(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar configurações de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { phoneNumberId?: string }
  if (!body.phoneNumberId) {
    return NextResponse.json({ error: 'Phone Number ID is required.' }, { status: 400 })
  }

  await updateState((state) => {
    state.phoneNumbers = state.phoneNumbers.filter((phone) => phone.id !== body.phoneNumberId)
    state.removedPhoneNumberIds = [
      ...state.removedPhoneNumberIds.filter((id) => id !== body.phoneNumberId),
      body.phoneNumberId!,
    ].slice(-500)
    const nextPhoneNumberId = state.phoneNumbers[0]?.id

    if (state.integration.phoneNumberId === body.phoneNumberId) {
      state.integration.phoneNumberId = nextPhoneNumberId
    }
    if (state.integration.fallbackPhoneNumberId === body.phoneNumberId) {
      state.integration.fallbackPhoneNumberId = nextPhoneNumberId
    }

    state.automations = state.automations.map((automation) => (
      automation.phoneNumberId === body.phoneNumberId || automation.fallbackPhoneNumberId === body.phoneNumberId
        ? {
            ...automation,
            status: 'Paused',
            phoneNumberId: automation.phoneNumberId === body.phoneNumberId ? undefined : automation.phoneNumberId,
            fallbackPhoneNumberId: automation.fallbackPhoneNumberId === body.phoneNumberId ? undefined : automation.fallbackPhoneNumberId,
            updatedAt: new Date().toISOString(),
          }
        : automation
    ))

    if (state.phoneNumbers.length === 0) {
      state.integration.oauthStatus = 'not_started'
      state.integration.businessId = undefined
      state.integration.wabaId = undefined
      state.integration.phoneNumberId = undefined
      state.integration.fallbackPhoneNumberId = undefined
      state.integration.selectedTemplateId = undefined
      state.integration.webhookSubscribedAt = undefined
    }

    state.integration.status = state.phoneNumbers.length > 0 ? 'needs_attention' : 'not_started'
    state.integration.connectionStatus = state.phoneNumbers.length > 0 ? 'needs_attention' : 'not_started'
    state.integration.updatedAt = new Date().toISOString()
  })

  await addLog({
    type: 'connection_saved',
    status: 'info',
    description: 'WhatsApp phone number removed from this workspace.',
    safePayload: { phoneNumberId: maskId(body.phoneNumberId) },
    recommendedAction: 'Para restaurar este número, conecte-o novamente de forma explícita pelo Embedded Signup.',
  })

  return NextResponse.json(await getState())
}
