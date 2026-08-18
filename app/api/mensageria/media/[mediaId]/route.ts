import { NextResponse } from 'next/server'
import { checkUserPermission } from '@/lib/actions/permissions'
import { downloadMedia } from '@/lib/whatsapp/provider'

export async function GET(_request: Request, context: { params: Promise<{ mediaId: string }> }) {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar esta mídia.' }, { status: 403 })
  }

  const { mediaId } = await context.params
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(mediaId)) {
    return NextResponse.json({ error: 'Identificador de mídia inválido.' }, { status: 400 })
  }

  const result = await downloadMedia(mediaId)
  if (!result.ok || !result.data) {
    return NextResponse.json({ error: result.error?.message ?? 'Não foi possível baixar a mídia.' }, { status: 502 })
  }

  return new Response(result.data.bytes, {
    headers: {
      'Content-Type': result.data.mimeType,
      'Content-Length': String(result.data.bytes.byteLength),
      'Cache-Control': 'private, max-age=300',
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
