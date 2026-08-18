import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/whatsapp/engine'
import { sendMediaMessage, sendTextMessage, uploadMedia } from '@/lib/whatsapp/provider'
import { addInboxMessage, addLog, createId, getState, maskId, maskPhone } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'
import type { MessageMediaType } from '@/lib/whatsapp/types'

const MAX_MEDIA_BYTES = 4 * 1024 * 1024

function mediaTypeFor(mimeType: string): MessageMediaType | undefined {
  const normalized = mimeType.toLowerCase().split(';')[0]
  if (normalized.startsWith('image/')) return 'image'
  if (normalized.startsWith('video/')) return 'video'
  if (normalized.startsWith('audio/')) return 'audio'
  if (
    normalized === 'application/pdf'
    || normalized.startsWith('text/')
    || normalized.includes('word')
    || normalized.includes('excel')
    || normalized.includes('spreadsheet')
    || normalized.includes('presentation')
    || normalized.includes('officedocument')
  ) return 'document'
  return undefined
}


export async function GET() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  return NextResponse.json((await getState()).conversations)
}

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.send').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para enviar mensagens' }, { status: 403 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  let body: { conversationId?: string; phoneNumberId?: string; to?: string; text?: string } = {}
  let file: File | undefined
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    body = {
      conversationId: String(form.get('conversationId') ?? '') || undefined,
      phoneNumberId: String(form.get('phoneNumberId') ?? '') || undefined,
      to: String(form.get('to') ?? '') || undefined,
      text: String(form.get('text') ?? '') || undefined,
    }
    const candidate = form.get('file')
    if (candidate && typeof candidate !== 'string') file = candidate as File
  } else {
    body = await req.json().catch(() => ({})) as typeof body
  }
  const state = await getState()
  const conversation = state.conversations.find((item) => item.id === body.conversationId)
  const phoneNumberId = body.phoneNumberId
    ?? conversation?.phoneNumberId
    ?? conversation?.messages.find((message) => message.direction === 'inbound')?.to
    ?? conversation?.messages.find((message) => message.direction === 'outbound')?.from
    ?? state.integration.phoneNumberId
  const phoneNumber = state.phoneNumbers.find((item) => item.id === phoneNumberId)

  if (!conversation && !body.to) {
    return NextResponse.json({ error: 'conversationId or to is required.' }, { status: 400 })
  }

  if (!phoneNumberId || !phoneNumber) {
    const error = 'No WhatsApp phone number is selected.'
    await addLog({
      type: 'inbox_updated',
      status: 'failed',
      description: `Failed: ${error}`,
      recommendedAction: 'Select a connected WhatsApp phone number before replying from Inbox.',
    })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  const recipient = normalizePhone(body.to ?? conversation?.phone ?? '')
  if (!recipient) {
    const error = 'Recipient WhatsApp number is invalid.'
    await addLog({
      type: 'inbox_updated',
      status: 'failed',
      description: `Failed: ${error}`,
      recommendedAction: 'Use country code + area code + phone number.',
    })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  if (!body.text?.trim() && !file) return NextResponse.json({ error: 'Digite uma mensagem ou selecione um anexo.' }, { status: 400 })

  const windowOpen = Boolean(conversation?.windowExpiresAt && new Date(conversation.windowExpiresAt) > new Date())
  if (!windowOpen) {
    const error = 'Free-form WhatsApp replies require an open 24h customer service window.'
    await addLog({
      type: 'inbox_updated',
      status: 'needs_attention',
      description: `Needs attention: ${error}`,
      safePayload: { recipient: maskPhone(recipient) },
      recommendedAction: 'Ask the customer to reply first, or send an approved template from Envio de Teste/Campanhas.',
    })
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  let result: Awaited<ReturnType<typeof sendTextMessage>>
  let media: {
    type: MessageMediaType
    metaMediaId: string
    mimeType?: string
    filename?: string
    caption?: string
    size?: number
  } | undefined

  if (file) {
    if (file.size > MAX_MEDIA_BYTES) {
      return NextResponse.json({ error: 'O anexo deve ter no máximo 4 MB neste ambiente.' }, { status: 413 })
    }
    const mediaType = mediaTypeFor(file.type)
    if (!mediaType) {
      return NextResponse.json({ error: 'Formato não suportado. Envie imagem, vídeo, áudio, PDF ou documento Office.' }, { status: 415 })
    }
    const uploaded = await uploadMedia({
      phoneNumberId,
      file,
      filename: file.name || `anexo-${Date.now()}`,
      mimeType: file.type || 'application/octet-stream',
    })
    if (!uploaded.ok || !uploaded.data?.id) {
      await addLog({
        type: 'inbox_updated',
        status: 'failed',
        description: 'Falha ao enviar anexo para a Meta.',
        error: uploaded.error,
        recommendedAction: 'Confirme o formato e o tamanho do arquivo e tente novamente.',
      })
      return NextResponse.json({ error: uploaded.error?.message ?? 'A Meta recusou o upload do anexo.' }, { status: 502 })
    }
    media = {
      type: mediaType,
      metaMediaId: uploaded.data.id,
      mimeType: file.type,
      filename: file.name,
      caption: body.text?.trim() || undefined,
      size: file.size,
    }
    result = await sendMediaMessage({
      phoneNumberId,
      to: recipient,
      type: mediaType,
      mediaId: uploaded.data.id,
      caption: media.caption,
      filename: media.filename,
    })
  } else {
    result = await sendTextMessage({
      phoneNumberId,
      to: recipient,
      text: body.text!.trim(),
    })
  }

  if (!result.ok) {
    await addLog({
      type: 'inbox_updated',
      status: 'failed',
      description: 'Failed: Meta did not accept the Inbox reply.',
      safePayload: { recipient: maskPhone(recipient) },
      error: result.error,
      recommendedAction: 'Confirm the 24h window is open, the phone number is registered and whatsapp_business_messaging is granted.',
    })
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
  }

  const messageId = result.data?.messages?.[0]?.id ?? createId('wamid')

  await addInboxMessage({
    id: createId('msg'),
    metaMessageId: messageId,
    conversationId: conversation?.id ?? `conv-${phoneNumberId}-${recipient}`,
    direction: 'outbound',
    from: phoneNumberId,
    to: recipient,
    text: body.text?.trim() || media?.filename || `[${media?.type ?? 'anexo'}]`,
    status: 'sent',
    timestamp: new Date().toISOString(),
    media,
  })

  await addLog({
    type: 'inbox_updated',
    status: 'success',
    description: media ? 'Anexo enviado pelo Inbox através da Meta Cloud API.' : 'Inbox reply sent through Meta Cloud API.',
    safePayload: { messageId: maskId(messageId), recipient: maskPhone(recipient), phoneNumberId: maskId(phoneNumberId), wabaId: maskId(phoneNumber.wabaId), mediaType: media?.type },
    recommendedAction: 'Delivery/read status will appear when Meta sends status webhooks.',
  })

  return NextResponse.json({ ok: true, messageId, conversations: (await getState()).conversations })
}
