import {
  addEvent,
  addLog,
  getCooldown,
  getDailyCount,
  getConnection,
  getRules,
  getTemplate,
  setCooldown,
  setDailyCount,
  getConnections,
  getLogs,
  getEvents,
} from './store'
import type { WaAutomationRule, WaCondition, WaEvent, WaEventPayload, WaMessageLog } from './types'
import { getProvider } from './provider'

// ─── phone normalization ──────────────────────────────────────────────────────
// Returns digits only (no +), ready for Meta API, or null if invalid.

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  // Already has country code 55 (13 = mobile, 12 = landline)
  if ((digits.length === 13 || digits.length === 12) && digits.startsWith('55')) return digits
  // DDD + 9-digit mobile (11 digits) → add 55
  if (digits.length === 11) return `55${digits}`
  // DDD + 8-digit landline (10 digits) → add 55
  if (digits.length === 10) return `55${digits}`
  return null
}

// ─── interpolation ────────────────────────────────────────────────────────────

function interpolate(body: string, payload: WaEventPayload): string {
  return body
    .replace(/{{customerName}}/g, payload.customerName ?? 'Cliente')
    .replace(/{{orderId}}/g, payload.orderId ?? '')
    .replace(/{{orderTotal}}/g, payload.orderTotal != null ? `R$ ${payload.orderTotal.toFixed(2)}` : '')
    .replace(/{{cartValue}}/g, payload.cartValue != null ? `R$ ${payload.cartValue.toFixed(2)}` : '')
    .replace(/{{storeUrl}}/g, process.env.NEXT_PUBLIC_STORE_URL ?? 'https://loja.exemplo.com')
    .replace(/{{trackingCode}}/g, 'BR000000000BR')
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function evalCondition(cond: WaCondition, payload: WaEventPayload): boolean {
  const val: number | string | undefined = (() => {
    switch (cond.field) {
      case 'orderTotal': return payload.orderTotal
      case 'cartValue': return payload.cartValue
      case 'hourOfDay': return new Date().getHours()
      case 'dayOfWeek': return new Date().getDay()
      default: return undefined
    }
  })()
  if (val == null) return false
  const refNum = Number(cond.value)
  const valNum = Number(val)
  switch (cond.op) {
    case 'eq': return String(val) === String(cond.value)
    case 'neq': return String(val) !== String(cond.value)
    case 'gt': return valNum > refNum
    case 'gte': return valNum >= refNum
    case 'lt': return valNum < refNum
    case 'lte': return valNum <= refNum
    case 'in': return Array.isArray(cond.value) && (cond.value as string[]).includes(String(val))
    default: return true
  }
}

// ─── result types ─────────────────────────────────────────────────────────────

export interface RuleResult {
  ruleId: string
  ruleName: string
  status: 'DELIVERED' | 'FAILED' | 'SKIPPED'
  skipReason?: string
  errorMessage?: string
  phone?: string
  message?: string
}

export interface FireEventResult {
  eventId: string
  rulesMatched: number
  results: RuleResult[]
}

// ─── public fire function ─────────────────────────────────────────────────────

export async function fireEvent(event: WaEvent): Promise<FireEventResult> {
  addEvent(event)

  const matchingRules = getRules().filter((r) => r.trigger === event.type)
  const results: RuleResult[] = []

  for (const rule of matchingRules) {
    const result = await processRule(rule, event)
    results.push(result)
  }

  return { eventId: event.id, rulesMatched: matchingRules.length, results }
}

async function processRule(rule: WaAutomationRule, event: WaEvent): Promise<RuleResult> {
  const phone = normalizePhone(event.payload.customerPhone ?? '')
  const recipientName = event.payload.customerName ?? 'Cliente'

  const base: Omit<WaMessageLog, 'status' | 'skipReason' | 'errorMessage' | 'deliveredAt'> = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ruleId: rule.id,
    ruleName: rule.name,
    connectionId: rule.connectionId,
    templateId: rule.templateId,
    eventType: event.type,
    recipientPhone: phone ? `+${phone}` : '',
    recipientName,
    message: '',
    sentAt: new Date(),
  }

  function skip(skipReason: WaMessageLog['skipReason'], detail: string): RuleResult {
    addLog({ ...base, status: 'SKIPPED', skipReason })
    return { ruleId: rule.id, ruleName: rule.name, status: 'SKIPPED', skipReason: detail, phone: phone ? `+${phone}` : undefined }
  }

  function fail(errorMessage: string): RuleResult {
    addLog({ ...base, status: 'FAILED', errorMessage })
    return { ruleId: rule.id, ruleName: rule.name, status: 'FAILED', errorMessage, phone: phone ? `+${phone}` : undefined }
  }

  // ── guards ────────────────────────────────────────────────────────────────

  if (!rule.isActive) {
    return skip('RULE_INACTIVE', 'Automação está inativa. Ative-a na aba Automações.')
  }

  if (!phone) {
    const raw = event.payload.customerPhone
    return skip(
      'NO_PHONE',
      raw
        ? `Número "${raw}" inválido. Use o formato: 11999990001 (DDD + número, sem +55).`
        : 'Campo "customerPhone" ausente no payload.',
    )
  }

  if (!rule.conditions.every((c) => evalCondition(c, event.payload))) {
    return skip('CONDITION_FAILED', 'Condições da regra não foram atendidas pelo payload fornecido.')
  }


  if (rule.cooldownMinutes > 0) {
    const lastSent = getCooldown(`${rule.id}:${phone}`)
    if (lastSent) {
      const diffMin = (Date.now() - lastSent.getTime()) / 60_000
      if (diffMin < rule.cooldownMinutes) {
        const remaining = Math.ceil(rule.cooldownMinutes - diffMin)
        return skip('COOLDOWN', `Cooldown ativo para este número. Aguarde ${remaining} min para enviar novamente.`)
      }
    }
  }

  const dailyKey = `${rule.id}:${todayKey()}`
  const count = getDailyCount(dailyKey)
  if (rule.dailyLimit > 0 && count >= rule.dailyLimit) {
    return skip('DAILY_LIMIT', `Limite diário de ${rule.dailyLimit} mensagens atingido para esta regra. Reinicia amanhã.`)
  }

  const template = getTemplate(rule.templateId)
  if (!template) {
    return fail(
      `Modelo de mensagem não encontrado (ID: ${rule.templateId}). Selecione um modelo válido na aba Automações → Editar regra.`,
    )
  }
  if (!template.isActive) {
    return fail(`Modelo "${template.name}" está inativo. Ative-o na aba Modelos.`)
  }

  const message = interpolate(template.body, event.payload)

  const connection = getConnection(rule.connectionId)
  if (!connection) {
    return fail(
      `Conexão não encontrada (ID: ${rule.connectionId}). Selecione uma conexão válida na aba Automações → Editar regra.`,
    )
  }
  if (connection.status !== 'CONNECTED') {
    return fail(
      `Conexão "${connection.name}" está ${connection.status === 'DISCONNECTED' ? 'desconectada' : 'com erro'}. Clique em "Testar" na aba Conexões para reconectar.`,
    )
  }

  // ── send ─────────────────────────────────────────────────────────────────

  const provider = getProvider(connection.provider)
  const result = await provider.send(connection, phone, message)

  if (result.success) {
    setCooldown(`${rule.id}:${phone}`, new Date())
    setDailyCount(dailyKey, count + 1)
    const { upsertConnection } = await import('./store')
    upsertConnection({
      ...connection,
      messagesSentToday: connection.messagesSentToday + 1,
      messagesTotal: connection.messagesTotal + 1,
      lastMessageAt: new Date(),
    })
    addLog({ ...base, message, status: 'DELIVERED', deliveredAt: new Date() })
    return { ruleId: rule.id, ruleName: rule.name, status: 'DELIVERED', phone: `+${phone}`, message }
  } else {
    addLog({ ...base, message, status: 'FAILED', errorMessage: result.error })
    return { ruleId: rule.id, ruleName: rule.name, status: 'FAILED', errorMessage: result.error, phone: `+${phone}`, message }
  }
}

// ─── stats ────────────────────────────────────────────────────────────────────

export function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getStats() {
  const logs = getLogs()
  const rules = getRules()
  const conns = getConnections()
  const today = new Date().toISOString().slice(0, 10)

  return {
    totalSent: logs.filter((l) => l.status === 'DELIVERED').length,
    totalFailed: logs.filter((l) => l.status === 'FAILED').length,
    totalSkipped: logs.filter((l) => l.status === 'SKIPPED').length,
    todaySent: logs.filter((l) => l.status === 'DELIVERED' && l.sentAt.toISOString().slice(0, 10) === today).length,
    activeRules: rules.filter((r) => r.isActive).length,
    activeConnections: conns.filter((c) => c.status === 'CONNECTED').length,
    recentEvents: getEvents().slice(0, 30),
  }
}
