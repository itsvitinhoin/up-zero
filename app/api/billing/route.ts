import { ZodError } from 'zod'
import { requireBillingAdmin, payerIp } from '@/lib/billing/auth'
import { configured } from '@/lib/billing/provider'
import { BillingError, commandSchema } from '@/lib/billing/types'
import { billingView, executeBilling } from '@/lib/billing/service'
export const maxDuration = 300
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
async function body(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new BillingError(400, 'Solicitação vazia.')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 12000) { await reader.cancel(); throw new BillingError(413, 'Solicitação muito grande.') }; chunks.push(value) }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { reader.releaseLock() }
}
async function handle(request: Request) {
  try {
    const admin = await requireBillingAdmin(request)
    if (!configured()) {
      if (request.method !== 'GET') throw new BillingError(503, 'O serviço de assinatura ainda não está disponível. Entre em contato com o suporte.')
      return Response.json({ configured: false, canManage: admin.canManage, pending: false, methods: [], invoices: [] }, { headers })
    }
    if (request.method === 'POST') {
      const command = commandSchema.parse(await body(request))
      await executeBilling(admin.storeId, admin.userId, command, payerIp(request))
      // Never include card/token/provider data in mutation responses.
      return Response.json({ success: true }, { headers })
    }
    return Response.json(await billingView(admin.storeId, admin.canManage), { headers })
  } catch (error) {
    const status = error instanceof BillingError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 503
    return Response.json({ error: error instanceof BillingError ? error.message : status === 400 ? 'Confira os dados preenchidos.' : 'Não foi possível consultar a cobrança. Tente novamente mais tarde.', uncertain: error instanceof BillingError && error.uncertain }, { status, headers })
  }
}
export const GET = handle
export const POST = handle
