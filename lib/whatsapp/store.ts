import type {
  WaAutomationRule,
  WaConnection,
  WaEvent,
  WaIntegrationLog,
  WaMessageLog,
  WaMetaReviewState,
  WaSettings,
  WaTemplate,
  WaWebhookEvent,
} from './types'
import { loadFromDisk, saveToDisk, type PersistedData } from './persist'

// ─── runtime-only state (never persisted) ─────────────────────────────────────

const events: WaEvent[] = []
const cooldowns = new Map<string, Date>()
const dailyCounts = new Map<string, number>()
let _lastResetDay = new Date().toISOString().slice(0, 10)

// ─── default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: WaSettings = {
  defaultConnectionId: null,
  globalDailyLimit: 500,
  defaultAllowedHoursStart: 8,
  defaultAllowedHoursEnd: 20,
  timezone: 'America/Sao_Paulo',
}

// ─── disk read (always fresh — no in-memory cache) ────────────────────────────
// Each call reads the file so all API route instances share the same state.

function read(): PersistedData {
  const saved = loadFromDisk()
  if (saved && (saved.seeded || saved.connections.length > 0)) {
    if (!saved.settings) saved.settings = { ...DEFAULT_SETTINGS }
    if (!saved.webhookEvents) saved.webhookEvents = []
    if (!saved.integrationLogs) saved.integrationLogs = []
    if (!saved.metaReview) saved.metaReview = {}
    return saved
  }

  // First run — seed demo data
  const now = new Date()
  const d = (offsetDays: number) => new Date(now.getTime() - offsetDays * 86_400_000)

  const initial: PersistedData = {
    connections: [
      {
        id: 'conn-1',
        name: 'Principal (Mock)',
        provider: 'MOCK',
        phoneNumber: '+55 11 99999-0001',
        phoneNumberId: '109876543210',
        accessToken: 'mock-token',
        businessAccountId: '9988776655',
        webhookVerifyToken: 'mock-verify-token',
        status: 'CONNECTED',
        connectedAt: d(30),
        lastMessageAt: d(0),
        messagesSentToday: 12,
        messagesTotal: 847,
      },
    ],
    templates: [
      {
        id: 'tpl-1',
        name: 'Boas-vindas – Cadastro Aprovado',
        body: 'Olá, {{customerName}}! 🎉 Seu cadastro foi aprovado. Acesse nossa loja e faça seu primeiro pedido.',
        variables: ['customerName'],
        isActive: true,
        createdAt: d(15),
        updatedAt: d(15),
      },
      {
        id: 'tpl-2',
        name: 'Pedido Recebido',
        body: 'Olá, {{customerName}}! Recebemos seu pedido #{{orderId}} no valor de {{orderTotal}}. Em breve entraremos em contato.',
        variables: ['customerName', 'orderId', 'orderTotal'],
        isActive: true,
        createdAt: d(15),
        updatedAt: d(15),
      },
      {
        id: 'tpl-3',
        name: 'Pagamento Confirmado',
        body: '✅ {{customerName}}, seu pagamento do pedido #{{orderId}} foi confirmado! Já estamos separando seus produtos.',
        variables: ['customerName', 'orderId'],
        isActive: true,
        createdAt: d(12),
        updatedAt: d(12),
      },
      {
        id: 'tpl-4',
        name: 'Pedido Enviado',
        body: '🚚 {{customerName}}, seu pedido #{{orderId}} foi enviado!',
        variables: ['customerName', 'orderId'],
        isActive: true,
        createdAt: d(10),
        updatedAt: d(10),
      },
      {
        id: 'tpl-5',
        name: 'Carrinho Abandonado',
        body: 'Ei, {{customerName}}! Você deixou {{cartValue}} no carrinho. Que tal finalizar seu pedido? 😊',
        variables: ['customerName', 'cartValue'],
        isActive: true,
        createdAt: d(8),
        updatedAt: d(8),
      },
      {
        id: 'tpl-6',
        name: 'Cadastro Rejeitado',
        body: 'Olá, {{customerName}}. Infelizmente seu cadastro não foi aprovado. Entre em contato conosco para mais informações.',
        variables: ['customerName'],
        isActive: true,
        createdAt: d(8),
        updatedAt: d(8),
      },
    ],
    rules: [
      {
        id: 'rule-1',
        name: 'Boas-vindas – Aprovação de Cadastro',
        trigger: 'CUSTOMER_APPROVED',
        conditions: [],
        templateId: 'tpl-1',
        connectionId: 'conn-1',
        isActive: true,
        cooldownMinutes: 0,
        dailyLimit: 200,
        allowedHoursStart: 8,
        allowedHoursEnd: 20,
        createdAt: d(14),
        updatedAt: d(14),
      },
      {
        id: 'rule-2',
        name: 'Confirmação de Pedido',
        trigger: 'ORDER_RECEIVED',
        conditions: [],
        templateId: 'tpl-2',
        connectionId: 'conn-1',
        isActive: true,
        cooldownMinutes: 0,
        dailyLimit: 500,
        allowedHoursStart: 0,
        allowedHoursEnd: 23,
        createdAt: d(13),
        updatedAt: d(13),
      },
      {
        id: 'rule-3',
        name: 'Pagamento Confirmado',
        trigger: 'ORDER_PAID',
        conditions: [],
        templateId: 'tpl-3',
        connectionId: 'conn-1',
        isActive: true,
        cooldownMinutes: 0,
        dailyLimit: 500,
        allowedHoursStart: 0,
        allowedHoursEnd: 23,
        createdAt: d(12),
        updatedAt: d(12),
      },
      {
        id: 'rule-4',
        name: 'Notificação de Envio',
        trigger: 'ORDER_SHIPPED',
        conditions: [],
        templateId: 'tpl-4',
        connectionId: 'conn-1',
        isActive: true,
        cooldownMinutes: 0,
        dailyLimit: 500,
        allowedHoursStart: 8,
        allowedHoursEnd: 20,
        createdAt: d(10),
        updatedAt: d(10),
      },
      {
        id: 'rule-5',
        name: 'Recuperação de Carrinho Abandonado',
        trigger: 'CART_ABANDONED',
        conditions: [{ field: 'cartValue', op: 'gte', value: 50 }],
        templateId: 'tpl-5',
        connectionId: 'conn-1',
        isActive: true,
        cooldownMinutes: 1440,
        dailyLimit: 100,
        allowedHoursStart: 9,
        allowedHoursEnd: 18,
        createdAt: d(9),
        updatedAt: d(9),
      },
      {
        id: 'rule-6',
        name: 'Rejeição de Cadastro',
        trigger: 'CUSTOMER_REJECTED',
        conditions: [],
        templateId: 'tpl-6',
        connectionId: 'conn-1',
        isActive: false,
        cooldownMinutes: 0,
        dailyLimit: 100,
        allowedHoursStart: 8,
        allowedHoursEnd: 18,
        createdAt: d(8),
        updatedAt: d(8),
      },
    ],
    logs: [],
    webhookEvents: [],
    integrationLogs: [],
    metaReview: {},
    settings: {
      ...DEFAULT_SETTINGS,
      defaultConnectionId: 'conn-1',
    },
    seeded: true,
  }

  saveToDisk(initial)
  return initial
}

// ─── daily reset helper ───────────────────────────────────────────────────────

function maybeDailyReset(state: PersistedData): PersistedData {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== _lastResetDay) {
    _lastResetDay = today
    state.connections = state.connections.map((c) => ({ ...c, messagesSentToday: 0 }))
    saveToDisk(state)
  }
  return state
}

// ─── connections CRUD ──────────────────────────────────────────────────────────

export function getConnections(storeId?: number): WaConnection[] {
  const state = maybeDailyReset(read())
  const all = state.connections
  if (!storeId) return all
  return all.filter((c) => !c.storeId || c.storeId === storeId)
}

export function getConnection(id: string): WaConnection | undefined {
  return read().connections.find((c) => c.id === id)
}

export function upsertConnection(conn: WaConnection): void {
  const state = read()
  const idx = state.connections.findIndex((c) => c.id === conn.id)
  if (idx >= 0) state.connections[idx] = conn
  else state.connections.push(conn)
  saveToDisk(state)
}

export function deleteConnection(id: string): void {
  const state = read()
  state.connections = state.connections.filter((c) => c.id !== id)
  if (state.settings?.defaultConnectionId === id) {
    state.settings.defaultConnectionId = state.connections[0]?.id ?? null
  }
  saveToDisk(state)
}

// ─── rules CRUD ───────────────────────────────────────────────────────────────

export function getRules(): WaAutomationRule[] {
  return read().rules
}

export function getRule(id: string): WaAutomationRule | undefined {
  return read().rules.find((r) => r.id === id)
}

export function upsertRule(rule: WaAutomationRule): void {
  const state = read()
  const idx = state.rules.findIndex((r) => r.id === rule.id)
  if (idx >= 0) state.rules[idx] = rule
  else state.rules.push(rule)
  saveToDisk(state)
}

export function deleteRule(id: string): void {
  const state = read()
  state.rules = state.rules.filter((r) => r.id !== id)
  saveToDisk(state)
}

// ─── templates CRUD ───────────────────────────────────────────────────────────

export function getTemplates(): WaTemplate[] {
  return read().templates
}

export function getTemplate(id: string): WaTemplate | undefined {
  return read().templates.find((t) => t.id === id)
}

export function upsertTemplate(tpl: WaTemplate): void {
  const state = read()
  const idx = state.templates.findIndex((t) => t.id === tpl.id)
  if (idx >= 0) state.templates[idx] = tpl
  else state.templates.push(tpl)
  saveToDisk(state)
}

export function deleteTemplate(id: string): void {
  const state = read()
  state.templates = state.templates.filter((t) => t.id !== id)
  saveToDisk(state)
}

// ─── logs ─────────────────────────────────────────────────────────────────────

export function getLogs(): WaMessageLog[] {
  return read().logs
}

export function addLog(log: WaMessageLog): void {
  const state = read()
  state.logs.unshift(log)
  if (state.logs.length > 1000) state.logs.pop()
  saveToDisk(state)
}

export function clearLogs(): void {
  const state = read()
  state.logs = []
  saveToDisk(state)
}

// ─── webhook inbox ───────────────────────────────────────────────────────────

export function getWebhookEvents(limit = 100): WaWebhookEvent[] {
  return (read().webhookEvents ?? []).slice(0, limit)
}

export function addWebhookEvent(evt: WaWebhookEvent): void {
  const state = read()
  state.webhookEvents = [evt, ...(state.webhookEvents ?? [])]
  if (state.webhookEvents.length > 500) state.webhookEvents.length = 500
  saveToDisk(state)
}

// ─── Meta review state + integration logs ────────────────────────────────────

export function getMetaReviewState(): WaMetaReviewState {
  return read().metaReview ?? {}
}

export function updateMetaReviewState(patch: Partial<WaMetaReviewState>): WaMetaReviewState {
  const state = read()
  state.metaReview = {
    ...(state.metaReview ?? {}),
    ...patch,
    selection: {
      ...(state.metaReview?.selection ?? {}),
      ...(patch.selection ?? {}),
    },
  }
  saveToDisk(state)
  return state.metaReview
}

export function clearMetaReviewOAuth(): WaMetaReviewState {
  const state = read()
  state.metaReview = {
    ...(state.metaReview ?? {}),
    oauth: undefined,
  }
  saveToDisk(state)
  return state.metaReview
}

export function getIntegrationLogs(limit = 100): WaIntegrationLog[] {
  return (read().integrationLogs ?? []).slice(0, limit)
}

export function addIntegrationLog(log: Omit<WaIntegrationLog, 'id' | 'createdAt'>): WaIntegrationLog {
  const state = read()
  const entry: WaIntegrationLog = {
    ...log,
    id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date(),
  }
  state.integrationLogs = [entry, ...(state.integrationLogs ?? [])]
  if (state.integrationLogs.length > 500) state.integrationLogs.length = 500
  saveToDisk(state)
  return entry
}

// ─── events (runtime only — not persisted) ────────────────────────────────────

export function getEvents(): WaEvent[] {
  return [...events]
}

export function addEvent(evt: WaEvent): void {
  events.unshift(evt)
  if (events.length > 500) events.pop()
}

// ─── settings ─────────────────────────────────────────────────────────────────

export function getSettings(): WaSettings {
  return read().settings ?? { ...DEFAULT_SETTINGS }
}

export function updateSettings(patch: Partial<WaSettings>): WaSettings {
  const state = read()
  state.settings = { ...(state.settings ?? DEFAULT_SETTINGS), ...patch }
  saveToDisk(state)
  return state.settings
}

// ─── runtime-only helpers (cooldown / daily counts) ───────────────────────────

export function getCooldown(key: string): Date | undefined {
  return cooldowns.get(key)
}

export function setCooldown(key: string, date: Date): void {
  cooldowns.set(key, date)
}

export function getDailyCount(key: string): number {
  return dailyCounts.get(key) ?? 0
}

export function setDailyCount(key: string, count: number): void {
  dailyCounts.set(key, count)
}
