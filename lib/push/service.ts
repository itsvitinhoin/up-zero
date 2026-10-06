import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { audienceSize } from './audience'
import { mutateState, readState, storageReady } from './repository'
import { providerReady, sendPush } from './provider'
import { storeEventSecret } from './auth'
import { automationKinds, filtersSchema, messageSchema, settingsSchema, PushError, type PushView, type PushState } from './types'

const audienceSchema = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(120), filters: filtersSchema })
const campaignSchema = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(120), audienceId: z.string().min(1), message: messageSchema, scheduledAt: z.string().datetime({ offset: true }).nullable().default(null) })
const ruleSchema = z.object({ kind: z.enum(automationKinds), enabled: z.boolean(), delayMinutes: z.number().int().min(0).max(43200), orderStatus: z.enum(['CONFIRMED', 'SHIPPED', 'DELIVERED']), message: messageSchema })
function available(storeId: number, state: PushState) {
  if (!state.settings.enabled) throw new PushError(409, 'Ative o canal em Configurações > Push.')
  if (!providerReady(storeId)) throw new PushError(409, 'O serviço de Push desta loja ainda não está configurado.')
  if (!storeEventSecret(storeId)) throw new PushError(409, 'A integração de eventos do app ainda não está configurada.')
}
export async function getPushView(storeId: number, canSend: boolean, userId?: string): Promise<PushView> {
  const state = await readState(storeId), now = new Date()
  return {
    settings: state.settings, readiness: { provider: providerReady(storeId), events: !!storeEventSecret(storeId), storage: storageReady() },
    audiences: state.audiences.filter(a => !a.archived).map(a => ({ ...a, ...audienceSize(a.filters, state, now) })),
    campaigns: state.campaigns.map(c => { const jobs = state.jobs.filter(j => j.campaignId === c.id); return { ...c, accepted: jobs.filter(j => j.status === 'ACCEPTED').length, failed: jobs.filter(j => j.status === 'FAILED').length, pending: jobs.filter(j => ['PENDING', 'SENDING'].includes(j.status)).length, skipped: jobs.filter(j => j.status === 'SKIPPED').length } }),
    automations: state.automations, members: state.members, orders: state.orders,
    devices: state.devices.filter(d => !d.memberId.startsWith('admin:') || d.memberId === `admin:${userId}`).map(({ token: _token, ...d }) => d), logs: state.jobs.slice(-100).reverse().map(({ message: _message, ...job }) => job), canEdit: canSend, canSend,
  }
}
export async function command(storeId: number, userId: string, action: string, input: unknown) {
  if (action === 'audience.save') {
    const value = audienceSchema.parse(input), now = new Date().toISOString(), newId = value.id || randomUUID()
    return mutateState(storeId, state => {
      const old = value.id ? state.audiences.find(a => a.id === value.id && !a.archived) : undefined
      if (value.id && !old) throw new PushError(404, 'Público não encontrado.')
      const audience = { id: newId, name: value.name, filters: value.filters, archived: false, createdAt: old?.createdAt || now, updatedAt: now }
      if (old) Object.assign(old, audience); else state.audiences.push(audience)
      return audience
    })
  }
  if (action === 'campaign.save') {
    const value = campaignSchema.parse(input), newId = value.id || randomUUID()
    if ([value.message.title, value.message.body, value.message.destinationId].some(text => [...text.matchAll(/\{\{([a-z_]+)\}\}/g)].some(match => match[1] !== 'nome'))) throw new PushError(400, 'Em campanhas, somente a variável {{nome}} está disponível.')
    if (value.scheduledAt && Date.parse(value.scheduledAt) <= Date.now()) throw new PushError(400, 'Escolha um horário futuro.')
    return mutateState(storeId, state => {
      if (!state.audiences.some(a => a.id === value.audienceId && !a.archived)) throw new PushError(400, 'Selecione um público válido.')
      const old = value.id ? state.campaigns.find(c => c.id === value.id) : undefined
      if (value.id && !old) throw new PushError(404, 'Campanha não encontrada.')
      if (old && old.status !== 'DRAFT') throw new PushError(409, 'Somente rascunhos podem ser editados.')
      const campaign = { ...value, id: newId, status: 'DRAFT' as const, createdAt: old?.createdAt || new Date().toISOString(), createdBy: old?.createdBy || userId, materializedAt: null }
      if (old) Object.assign(old, campaign); else state.campaigns.push(campaign)
      return campaign
    })
  }
  if (action === 'campaign.send' || action === 'campaign.cancel') {
    const { id } = z.object({ id: z.string().min(1) }).parse(input)
    return mutateState(storeId, state => {
      const campaign = state.campaigns.find(c => c.id === id)
      if (!campaign) throw new PushError(404, 'Campanha não encontrada.')
      if (action === 'campaign.cancel') {
        if (!['DRAFT', 'SCHEDULED', 'QUEUED'].includes(campaign.status)) throw new PushError(409, 'O disparo já começou e não pode ser cancelado.')
        campaign.status = 'CANCELED'
      } else {
        available(storeId, state)
        if (campaign.status !== 'DRAFT') throw new PushError(409, 'Esta campanha já foi encaminhada para envio.')
        if (campaign.scheduledAt && Date.parse(campaign.scheduledAt) <= Date.now()) throw new PushError(400, 'O horário agendado passou. Edite o rascunho.')
        const audience = state.audiences.find(a => a.id === campaign.audienceId && !a.archived)
        if (!audience || !audienceSize(audience.filters, state).deviceCount) throw new PushError(409, 'O público não possui dispositivos elegíveis.')
        campaign.status = campaign.scheduledAt ? 'SCHEDULED' : 'QUEUED'
      }
      return campaign
    })
  }
  if (action === 'automation.save') {
    const value = ruleSchema.parse(input)
    if (value.kind === 'ABANDONED_CART' && value.delayMinutes < 1) throw new PushError(400, 'Informe pelo menos um minuto de inatividade.')
    const variables = /\{\{([a-z_]+)\}\}/g
    const allowed: Record<string, string[]> = { BACK_IN_STOCK: ['nome','produto','produto_id'], ABANDONED_CART: ['nome','carrinho_id'], POST_SALE: ['nome','pedido','pedido_id'], B2B2C_ORDER: ['nome','pedido','pedido_id'] }
    for (const text of [value.message.title, value.message.body, value.message.destinationId]) for (const match of text.matchAll(variables)) if (!allowed[value.kind].includes(match[1])) throw new PushError(400, `Variável indisponível: ${match[1]}.`)
    return mutateState(storeId, state => {
      if (value.enabled) available(storeId, state)
      const rule = state.automations.find(a => a.kind === value.kind)!
      Object.assign(rule, value, { configured: true, delayMinutes: value.kind === 'B2B2C_ORDER' ? 0 : value.delayMinutes })
      if (!rule.enabled) for (const job of state.jobs) if (job.kind === rule.kind && job.status === 'PENDING') { job.status = 'SKIPPED'; job.reason = 'Automação pausada.' }
      return rule
    })
  }
  if (action === 'settings.save') {
    const value = settingsSchema.parse(input)
    if (value.enabled && (!providerReady(storeId) || !storeEventSecret(storeId))) throw new PushError(409, 'Configure o serviço de Push e a integração de eventos antes de ativar o canal.')
    return mutateState(storeId, state => { state.settings = value; return value })
  }
  if (action === 'test.send') {
    const { deviceId, message } = z.object({ deviceId: z.string().min(1), message: messageSchema }).parse(input), state = await readState(storeId)
    available(storeId, state)
    const device = state.devices.find(d => d.id === deviceId && d.memberId === `admin:${userId}` && d.active && d.permission === 'GRANTED')
    if (!device) throw new PushError(400, 'Selecione um dispositivo de teste vinculado ao seu usuário.')
    const result = await sendPush(storeId, device.token, message, randomUUID())
    if (!result.accepted) throw new PushError(502, result.reason || 'Falha ao enviar teste.')
    return { message: 'Teste aceito pelo serviço de Push.' }
  }
  throw new PushError(404, 'Ação não encontrada.')
}
