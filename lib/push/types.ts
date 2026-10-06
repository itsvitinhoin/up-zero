import { z } from 'zod'

const date = z.string().date().or(z.literal(''))
export const filtersSchema = z.object({
  name: z.string().max(160).default(''), document: z.string().max(30).default(''),
  status: z.enum(['ALL', 'PENDING', 'APPROVED', 'REJECTED']).default('ALL'),
  platform: z.enum(['ALL', 'ANDROID', 'IOS']).default('ALL'),
  installed: z.enum(['ALL', 'YES', 'NO']).default('YES'),
  downloadFrom: date.default(''), downloadTo: date.default(''),
  orderFrom: date.default(''), orderTo: date.default(''),
  orderLastDays: z.number().int().min(0).max(3650).default(0),
  hasOrdered: z.enum(['ALL', 'YES', 'NO']).default('ALL'),
  minPurchases: z.number().int().min(0).max(100000).nullable().default(null),
  maxPurchases: z.number().int().min(0).max(100000).nullable().default(null),
}).superRefine((f, ctx) => {
  if (f.minPurchases !== null && f.maxPurchases !== null && f.minPurchases > f.maxPurchases)
    ctx.addIssue({ code: 'custom', path: ['maxPurchases'], message: 'O máximo deve ser maior ou igual ao mínimo.' })
  for (const [from, to] of [[f.downloadFrom, f.downloadTo], [f.orderFrom, f.orderTo]])
    if (from && to && from > to) ctx.addIssue({ code: 'custom', message: 'A data final deve ser posterior à inicial.' })
})
export type AudienceFilters = z.infer<typeof filtersSchema>
export const emptyFilters: AudienceFilters = filtersSchema.parse({})
export const messageSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título.').max(100),
  body: z.string().trim().min(1, 'Informe a mensagem.').max(500),
  image: z.string().url().refine(v => v.startsWith('https://'), 'Use uma imagem HTTPS.').or(z.literal('')).default(''),
  destination: z.enum(['home', 'product', 'category', 'promotion', 'order', 'cart', 'review']),
  destinationId: z.string().trim().max(180).default(''),
}).superRefine((m, ctx) => {
  if (m.destination !== 'home' && !m.destinationId) ctx.addIssue({ code: 'custom', path: ['destinationId'], message: 'Informe o destino.' })
})
export type PushMessage = z.infer<typeof messageSchema>
export const automationKinds = ['BACK_IN_STOCK', 'ABANDONED_CART', 'POST_SALE', 'B2B2C_ORDER'] as const
export type AutomationKind = typeof automationKinds[number]
export const automationLabels: Record<AutomationKind, string> = {
  BACK_IN_STOCK: 'De volta no estoque', ABANDONED_CART: 'Carrinho abandonado',
  POST_SALE: 'Pós-venda', B2B2C_ORDER: 'B2B2C — Pedido recebido',
}
export const settingsSchema = z.object({
  enabled: z.boolean(), timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('pt-BR', { timeZone: v }); return true } catch { return false } }, 'Fuso inválido.'),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dailyLimit: z.number().int().min(1).max(20),
})
export type PushSettings = z.infer<typeof settingsSchema>
export interface Member { id: string; name: string; document: string; status: string; kind: 'CUSTOMER' | 'RESELLER' | 'ADMIN'; downloadedAt: string | null; updatedAt?: string }
export interface Device { id: string; memberId: string; token: string; platform: 'ANDROID' | 'IOS'; permission: 'GRANTED' | 'DENIED' | 'UNKNOWN'; active: boolean; seenAt: string }
export interface Purchase { id: string; memberId: string; status: string; paymentStatus: string; createdAt: string; cartId?: string; updatedAt?: string }
export interface Audience { id: string; name: string; filters: AudienceFilters; createdAt: string; updatedAt: string; archived: boolean }
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELED'
export interface Campaign { id: string; name: string; audienceId: string; message: PushMessage; status: CampaignStatus; scheduledAt: string | null; createdAt: string; createdBy: string; materializedAt: string | null }
export interface Automation { kind: AutomationKind; enabled: boolean; delayMinutes: number; orderStatus: 'CONFIRMED' | 'SHIPPED' | 'DELIVERED'; message: PushMessage; configured: boolean }
export interface Cart { id: string; memberId: string; updatedAt: string; converted: boolean }
export interface Subscription { id: string; memberId: string; variantId: string; notified: boolean }
export interface Assignment { orderId: string; memberId: string; assignmentId: string; updatedAt?: string }
export interface Job { id: string; memberId: string; deviceId: string; dueAt: string; status: 'PENDING' | 'SENDING' | 'ACCEPTED' | 'FAILED' | 'SKIPPED'; message: PushMessage; campaignId?: string; kind?: AutomationKind; reference?: string; eventId?: string; claimedAt?: string; finishedAt?: string; reason?: string }
export interface PushState { version: 1; settings: PushSettings; members: Member[]; devices: Device[]; orders: Purchase[]; audiences: Audience[]; campaigns: Campaign[]; automations: Automation[]; carts: Cart[]; subscriptions: Subscription[]; stocks: Record<string, number>; stockTimes: Record<string, string>; assignments: Assignment[]; jobs: Job[]; eventIds: string[] }
export interface PushView { settings: PushSettings; readiness: { provider: boolean; events: boolean; storage: boolean }; audiences: (Audience & { memberCount: number; deviceCount: number })[]; campaigns: (Campaign & { accepted: number; failed: number; pending: number; skipped: number })[]; automations: Automation[]; members: Member[]; devices: Omit<Device, 'token'>[]; orders: Purchase[]; logs: Omit<Job, 'message'>[]; canEdit: boolean; canSend: boolean }
export class PushError extends Error { constructor(public status: number, message: string) { super(message) } }
export function initialState(): PushState {
  const defaults: Record<AutomationKind, PushMessage> = {
    BACK_IN_STOCK: { title: 'Voltou ao estoque!', body: '{{produto}} já está disponível novamente.', image: '', destination: 'product', destinationId: '{{produto_id}}' },
    ABANDONED_CART: { title: 'Sua compra está esperando', body: '{{nome}}, continue sua compra pelo app.', image: '', destination: 'cart', destinationId: '{{carrinho_id}}' },
    POST_SALE: { title: 'Como foi sua compra?', body: '{{nome}}, conte como foi sua experiência com o pedido {{pedido}}.', image: '', destination: 'review', destinationId: '{{pedido_id}}' },
    B2B2C_ORDER: { title: 'Você recebeu um pedido!', body: 'O pedido {{pedido}} foi direcionado para você. Abra o app para atender.', image: '', destination: 'order', destinationId: '{{pedido_id}}' },
  }
  return { version: 1, settings: { enabled: false, timezone: 'America/Sao_Paulo', quietStart: '22:00', quietEnd: '08:00', dailyLimit: 2 }, members: [], devices: [], orders: [], audiences: [], campaigns: [], automations: automationKinds.map(kind => ({ kind, enabled: false, configured: false, delayMinutes: kind === 'ABANDONED_CART' ? 60 : kind === 'POST_SALE' ? 10080 : 0, orderStatus: 'DELIVERED', message: defaults[kind] })), carts: [], subscriptions: [], stocks: {}, stockTimes: {}, assignments: [], jobs: [], eventIds: [] }
}
