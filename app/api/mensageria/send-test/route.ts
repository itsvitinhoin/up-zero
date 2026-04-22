import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/whatsapp/store'
import { getProvider } from '@/lib/whatsapp/provider'
import { normalizePhone } from '@/lib/whatsapp/engine'

export async function POST(req: NextRequest) {
  let body: { connectionId?: string; phone?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { connectionId, phone, message } = body

  if (!connectionId) return NextResponse.json({ ok: false, error: 'connectionId é obrigatório' }, { status: 400 })
  if (!phone) return NextResponse.json({ ok: false, error: 'phone é obrigatório' }, { status: 400 })
  if (!message?.trim()) return NextResponse.json({ ok: false, error: 'message é obrigatório' }, { status: 400 })

  const connection = getConnection(connectionId)
  if (!connection) return NextResponse.json({ ok: false, error: 'Conexão não encontrada' }, { status: 404 })

  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) {
    return NextResponse.json({
      ok: false,
      error: `Número "${phone}" inválido. Use o formato: 11999990001 (DDD + número, sem +55).`,
    }, { status: 400 })
  }

  const provider = getProvider(connection.provider)
  const result = await provider.send(connection, normalizedPhone, message)

  return NextResponse.json({ ok: result.success, messageId: result.messageId, error: result.error })
}
