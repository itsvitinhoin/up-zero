import type { InboxConversation, WhatsAppAiAnalysis, WhatsAppState } from './types'
import { createId } from './store'

const OPENAI_API = 'https://api.openai.com/v1'

interface AnalysisFilters {
  phoneNumberId?: string
  dateFrom?: string
  dateTo?: string
}

interface OpenAiErrorBody {
  error?: { message?: string; code?: string }
}

function sanitizeOpenAiError(payload: OpenAiErrorBody, status: number): string {
  const message = payload.error?.message || `OpenAI HTTP ${status}`
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
}

export async function testOpenAiCredential(apiKey: string, model: string): Promise<void> {
  const response = await fetch(`${OPENAI_API}/models/${encodeURIComponent(model)}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (response.ok) return
  const payload = await response.json().catch(() => ({})) as OpenAiErrorBody
  throw new Error(sanitizeOpenAiError(payload, response.status))
}

function redactPersonalData(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[cpf]')
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[cnpj]')
    .replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g, '[telefone]')
    .replace(/\b\d{5}-?\d{3}\b/g, '[cep]')
    .slice(0, 900)
}

function inPeriod(conversation: InboxConversation, filters: AnalysisFilters): boolean {
  const timestamp = conversation.lastMessageAt ?? conversation.messages.at(-1)?.timestamp
  if (!timestamp) return false
  const time = new Date(timestamp).getTime()
  if (filters.dateFrom && time < new Date(`${filters.dateFrom}T00:00:00-03:00`).getTime()) return false
  if (filters.dateTo && time > new Date(`${filters.dateTo}T23:59:59.999-03:00`).getTime()) return false
  return true
}

function responseTimes(conversation: InboxConversation): number[] {
  return conversation.messages.flatMap((message, index) => {
    if (message.direction !== 'inbound') return []
    const reply = conversation.messages.slice(index + 1).find((candidate) => candidate.direction === 'outbound')
    if (!reply) return []
    const minutes = (new Date(reply.timestamp).getTime() - new Date(message.timestamp).getTime()) / 60000
    return minutes >= 0 ? [minutes] : []
  })
}

function percentile(values: number[], position: number): number {
  if (values.length === 0) return 0
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * position) - 1))]
}

function buildDataset(state: WhatsAppState, filters: AnalysisFilters) {
  const conversations = state.conversations
    .filter((conversation) => !filters.phoneNumberId || conversation.phoneNumberId === filters.phoneNumberId)
    .filter((conversation) => inPeriod(conversation, filters))
    .sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime())
    .slice(0, 100)

  const allResponseTimes = conversations.flatMap(responseTimes)
  const inboundCount = conversations.reduce((sum, conversation) => sum + conversation.messages.filter((message) => message.direction === 'inbound').length, 0)
  const outboundCount = conversations.reduce((sum, conversation) => sum + conversation.messages.filter((message) => message.direction === 'outbound').length, 0)
  const unanswered = conversations.filter((conversation) => conversation.messages.at(-1)?.direction === 'inbound').length
  const failed = conversations.reduce((sum, conversation) => sum + conversation.messages.filter((message) => message.status === 'failed').length, 0)
  const now = Date.now()
  const staleUnanswered = conversations.filter((conversation) => {
    const last = conversation.messages.at(-1)
    return last?.direction === 'inbound' && now - new Date(last.timestamp).getTime() > 60 * 60 * 1000
  }).length
  const avgResponseMinutes = allResponseTimes.length
    ? allResponseTimes.reduce((sum, value) => sum + value, 0) / allResponseTimes.length
    : 0

  const transcript = conversations.map((conversation, index) => ({
    conversation: `C${index + 1}`,
    phoneProfile: state.phoneNumbers.find((phone) => phone.id === conversation.phoneNumberId)?.verifiedName ?? 'WhatsApp',
    windowOpen: Boolean(conversation.windowExpiresAt && new Date(conversation.windowExpiresAt).getTime() > now),
    messages: conversation.messages.slice(-16).map((message) => ({
      at: message.timestamp,
      direction: message.direction === 'inbound' ? 'cliente' : 'atendimento',
      status: message.status,
      type: message.media?.type ?? 'text',
      text: redactPersonalData(message.media?.caption || message.text || ''),
    })),
  }))

  return {
    conversations,
    metrics: {
      conversationCount: conversations.length,
      messageCount: inboundCount + outboundCount,
      inboundCount,
      outboundCount,
      unanswered,
      staleUnanswered,
      failedMessages: failed,
      answerRate: conversations.length ? Math.round((conversations.length - unanswered) / conversations.length * 100) : 0,
      avgResponseMinutes: Math.round(avgResponseMinutes * 10) / 10,
      p90ResponseMinutes: Math.round(percentile(allResponseTimes, 0.9) * 10) / 10,
    },
    transcript,
  }
}

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    serviceScore: { type: 'number', minimum: 0, maximum: 100 },
    riskLevel: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    executiveSummary: { type: 'string' },
    bottlenecks: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          recommendedAction: { type: 'string' },
          metricName: { type: 'string' },
          metricValue: { type: 'string' },
        },
        required: ['title', 'severity', 'evidence', 'impact', 'recommendedAction', 'metricName', 'metricValue'],
      },
    },
    customerSignals: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          evidence: { type: 'string' },
          opportunity: { type: 'string' },
        },
        required: ['title', 'evidence', 'opportunity'],
      },
    },
    tone: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          share: { type: 'number', minimum: 0, maximum: 100 },
          explanation: { type: 'string' },
        },
        required: ['label', 'share', 'explanation'],
      },
    },
    priorities: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          owner: { type: 'string' },
          deadline: { type: 'string' },
          expectedImpact: { type: 'string' },
        },
        required: ['title', 'owner', 'deadline', 'expectedImpact'],
      },
    },
  },
  required: ['serviceScore', 'riskLevel', 'executiveSummary', 'bottlenecks', 'customerSignals', 'tone', 'priorities'],
} as const

function responseText(payload: unknown): string {
  const response = payload as {
    output_text?: string
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
  }
  if (response.output_text) return response.output_text
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === 'output_text')?.text ?? ''
}

export async function analyzeWhatsAppService(
  state: WhatsAppState,
  apiKey: string,
  model: string,
  filters: AnalysisFilters,
): Promise<WhatsAppAiAnalysis> {
  const dataset = buildDataset(state, filters)
  if (dataset.conversations.length === 0) {
    throw new Error('Não há conversas reais no período selecionado para analisar.')
  }

  const response = await fetch(`${OPENAI_API}/responses`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 2200,
      instructions: [
        'Você é um analista sênior de atendimento e comércio B2B/B2C via WhatsApp.',
        'Analise somente as métricas e transcrições anonimizadas fornecidas.',
        'Identifique gargalos comprovados, sinais de demanda, tom dos clientes e prioridades práticas.',
        'Não invente vendas, clientes, intenções ou métricas ausentes.',
        'Responda em português do Brasil, de forma objetiva e acionável.',
      ].join(' '),
      input: JSON.stringify({ metrics: dataset.metrics, conversations: dataset.transcript }),
      text: {
        format: {
          type: 'json_schema',
          name: 'whatsapp_service_analysis',
          strict: true,
          schema: analysisSchema,
        },
      },
    }),
  })

  const payload = await response.json().catch(() => ({})) as OpenAiErrorBody & Record<string, unknown>
  if (!response.ok) throw new Error(sanitizeOpenAiError(payload, response.status))
  const text = responseText(payload)
  if (!text) throw new Error('A OpenAI não retornou uma análise utilizável.')

  let parsed: Omit<WhatsAppAiAnalysis, 'id' | 'model' | 'analyzedAt' | 'periodStart' | 'periodEnd' | 'phoneNumberId' | 'conversationCount' | 'messageCount'>
  try {
    parsed = JSON.parse(text) as typeof parsed
  } catch {
    throw new Error('A resposta da IA não pôde ser interpretada. Tente novamente.')
  }

  const analyzedAt = new Date().toISOString()
  return {
    id: createId('ai-analysis'),
    model,
    analyzedAt,
    periodStart: filters.dateFrom || dataset.conversations.at(-1)?.lastMessageAt?.slice(0, 10) || analyzedAt.slice(0, 10),
    periodEnd: filters.dateTo || dataset.conversations[0]?.lastMessageAt?.slice(0, 10) || analyzedAt.slice(0, 10),
    phoneNumberId: filters.phoneNumberId,
    conversationCount: dataset.metrics.conversationCount,
    messageCount: dataset.metrics.messageCount,
    ...parsed,
  }
}
