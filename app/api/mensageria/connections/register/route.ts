import { NextRequest, NextResponse } from 'next/server'

import { checkUserPermission } from '@/lib/actions/permissions'
import { getPhoneNumber, registerPhoneNumber } from '@/lib/whatsapp/provider'
import { addLog, getState, maskId, updateState } from '@/lib/whatsapp/store'

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para registrar números do WhatsApp' }, { status: 403 })
  }

  const pin = process.env.WHATSAPP_TWO_STEP_PIN?.trim() ?? ''
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({
      error: 'WHATSAPP_TWO_STEP_PIN não está configurado com exatamente 6 números.',
    }, { status: 503 })
  }

  const state = await getState()
  const body = await req.json().catch(() => ({})) as { phoneNumberId?: string }
  const phoneNumberId = body.phoneNumberId ?? state.integration.phoneNumberId
  const selectedPhone = state.phoneNumbers.find((phone) => phone.id === phoneNumberId)

  if (!phoneNumberId || !selectedPhone) {
    return NextResponse.json({ error: 'Selecione uma conexão válida antes de registrar o número.' }, { status: 400 })
  }

  const result = await registerPhoneNumber(phoneNumberId, pin)
  if (!result.ok) {
    await addLog({
      type: 'phone_selected',
      status: 'failed',
      description: 'A Meta recusou o registro do número na Cloud API.',
      safePayload: { phoneNumberId: maskId(phoneNumberId) },
      error: result.error,
      recommendedAction: result.error?.action ?? 'Confira o PIN, as permissões e o prazo do Embedded Signup.',
    })
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  const refreshed = await getPhoneNumber(phoneNumberId, selectedPhone.wabaId)
  if (refreshed.ok && refreshed.data) {
    await updateState((next) => {
      next.phoneNumbers = next.phoneNumbers.map((phone) => phone.id === phoneNumberId ? { ...phone, ...refreshed.data!, wabaId: phone.wabaId } : phone)
    })
  }

  await addLog({
    type: 'phone_selected',
    status: 'success',
    description: 'Número registrado na WhatsApp Cloud API com verificação em duas etapas.',
    safePayload: {
      phoneNumberId: maskId(phoneNumberId),
      status: refreshed.data?.status ?? 'REGISTERED',
      codeVerificationStatus: refreshed.data?.codeVerificationStatus,
    },
    recommendedAction: refreshed.data?.status === 'CONNECTED'
      ? 'O número está pronto para o teste de envio.'
      : 'Sincronize novamente em alguns instantes para confirmar o status CONNECTED.',
  })

  return NextResponse.json({
    ok: true,
    registered: result.data?.success === true || result.data?.success === 'true',
    status: refreshed.data?.status ?? 'REGISTERED',
    codeVerificationStatus: refreshed.data?.codeVerificationStatus,
  })
}
