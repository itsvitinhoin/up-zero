import { z } from 'zod'
import { after } from 'next/server'
import { requirePushAdmin } from '@/lib/push/auth'
import { getPushView, command } from '@/lib/push/service'
import { PushError } from '@/lib/push/types'
import { processStore } from '@/lib/push/worker'

export const maxDuration = 300
function errorResponse(error: unknown) {
  if (error instanceof SyntaxError) return Response.json({ error: 'Dados JSON inválidos.' }, { status: 400 })
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || 'Dados inválidos.' }, { status: 400 })
  if (error instanceof PushError) return Response.json({ error: error.message }, { status: error.status })
  console.error('[push] request failed', error instanceof Error ? error.name : 'UnknownError')
  return Response.json({ error: 'Não foi possível carregar ou salvar os dados de Push.' }, { status: 503 })
}
export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path.join('/')
    if (path !== 'state' && path !== 'settings') throw new PushError(404, 'Página não encontrada.')
    const admin = await requirePushAdmin(request, path === 'settings' ? 'settings.view' : 'messaging.view')
    const canSend = await admin.check(path === 'settings' ? 'settings.edit' : 'messaging.send')
    const view = await getPushView(admin.storeId, canSend, admin.userId)
    return Response.json(path === 'settings' ? { settings: view.settings, readiness: view.readiness, canEdit: canSend, canSend: false, audiences: [], campaigns: [], automations: [], members: [], orders: [], devices: [], logs: [] } : view, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return errorResponse(error) }
}
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path.join('/'), action = path.replace('/', '.')
    const admin = await requirePushAdmin(request, action === 'settings.save' ? 'settings.edit' : 'messaging.send')
    const raw = await request.text()
    if (Buffer.byteLength(raw) > 24000) throw new PushError(413, 'Solicitação muito grande.')
    const value = await command(admin.storeId, admin.userId, action, JSON.parse(raw))
    if (action === 'campaign.send') after(async () => { try { await processStore(admin.storeId) } catch { console.error('[push] deferred processing failed') } })
    return Response.json({ data: value })
  } catch (error) { return errorResponse(error) }
}
