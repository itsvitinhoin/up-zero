import { isPersistedStateConflict, loadPersistedState, persistenceBackend, savePersistedState } from './persist'
import {
  META_REQUIRED_PERMISSIONS,
  type AutomationRule,
  type AutomationJob,
  type AutomationRunLog,
  type AutomationRunStatus,
  type Campaign,
  type Contact,
  type ContactList,
  type ECommerceWebhookEvent,
  type InboxConversation,
  type InboxMessage,
  type LogStatus,
  type MetaBusiness,
  type ReviewChecklistItem,
  type SafeError,
  type WhatsAppBusinessAccount,
  type WhatsAppIntegration,
  type WhatsAppLog,
  type WhatsAppLogType,
  type WhatsAppPhoneNumber,
  type WhatsAppState,
  type WhatsAppTemplate,
} from './types'

function nowIso() {
  return new Date().toISOString()
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function maskId(value?: string | null): string {
  const raw = String(value ?? '').trim()
  if (!raw) return 'not selected'
  if (raw.length <= 6) return `${raw.slice(0, 2)}***`
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`
}

export function maskPhone(value?: string | null): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return 'not selected'
  if (digits.length <= 4) return '****'
  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} *****-${digits.slice(-4)}`
}

export function sanitizeError(error: unknown, action?: string): SafeError {
  if (!error) return { message: 'Unknown error', action }

  if (typeof error === 'string') {
    return { message: redactSecretLikeValues(error), action }
  }

  if (error instanceof Error) {
    return { message: redactSecretLikeValues(error.message), action }
  }

  const maybe = error as {
    message?: unknown
    code?: unknown
    error_subcode?: unknown
    fbtrace_id?: unknown
  }

  const message = redactSecretLikeValues(String(maybe.message ?? 'Unexpected error'))
  const code = typeof maybe.code === 'string' || typeof maybe.code === 'number' ? maybe.code : undefined

  return {
    message,
    code,
    traceId: typeof maybe.fbtrace_id === 'string' ? maybe.fbtrace_id : undefined,
    action: inferErrorAction(message, code, action),
  }
}

function inferErrorAction(message: string, code: string | number | undefined, existingAction?: string): string | undefined {
  if (existingAction) return existingAction

  const normalized = message.toLowerCase()
  if (
    String(code) === '190'
    && (normalized.includes('could not be decrypted') || normalized.includes('not be decrypted'))
  ) {
    return 'Regenerate Meta System User token in Business Settings, replace FACEBOOK_SYSTEM_USER_TOKEN in server env, and restart Next.js server.'
  }

  if (String(code) === '131042') {
    return 'No WhatsApp Manager da Meta, vincule uma forma de pagamento válida à WABA e confirme moeda, fuso horário, limite de crédito e status da conta de pagamento.'
  }

  return existingAction
}

export function redactSecretLikeValues(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .replace(/access_token=([^&\s]+)/gi, 'access_token=[redacted]')
    .replace(/(token|secret|client_secret|app_secret)["'=:]+[A-Za-z0-9._~/-]+/gi, '$1=[redacted]')
}

function safeObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  return JSON.parse(
    JSON.stringify(value, (key, val) => {
      if (/token|secret|authorization|bearer|password/i.test(key)) return '[redacted]'
      if (typeof val === 'string') return redactSecretLikeValues(val)
      return val
    }),
  ) as Record<string, unknown>
}

function defaultIntegration(): WhatsAppIntegration {
  const now = nowIso()
  return {
    status: 'not_started',
    oauthStatus: 'not_started',
    connectionStatus: 'not_started',
    updatedAt: now,
  }
}

function defaultState(): WhatsAppState {
  const now = nowIso()
  return {
    version: 2,
    integration: defaultIntegration(),
    businesses: [],
    wabas: [],
    phoneNumbers: [],
    removedPhoneNumberIds: [],
    templates: [],
    conversations: [],
    contacts: [],
    contactLists: [],
    campaigns: [],
    automations: [],
    automationJobs: [],
    automationLogs: [],
    ecommerceEvents: [],
    logs: [
      {
        id: id('log'),
        timestamp: nowIso(),
        type: 'connection_saved',
        status: 'info',
        description: 'Mensageria initialized with empty local state. No mock connection or token was created.',
        recommendedAction: 'Connect Meta to load real Business, WABA, phone number and template data.',
      },
    ],
    ai: {
      provider: 'openai',
      model: 'gpt-5-mini',
      contentAnalysisEnabled: false,
      updatedAt: now,
    },
  }
}

function normalizeState(raw: unknown): WhatsAppState {
  if (!raw || typeof raw !== 'object') return defaultState()
  const maybe = raw as Partial<WhatsAppState> & { seeded?: boolean }

  if (maybe.version !== 2) {
    const next = defaultState()
    next.logs.unshift({
      id: id('log'),
      timestamp: nowIso(),
      type: 'connection_saved',
      status: 'needs_attention',
      description: 'Legacy mensageria data was isolated because it used the previous mock automation model.',
      recommendedAction: 'Reconnect Meta and sync WhatsApp assets for the new App Review flow.',
    })
    return next
  }

  const legacyWabaId = maybe.integration?.wabaId
  const wabas = (Array.isArray(maybe.wabas) ? maybe.wabas : []).map((waba) => ({
    ...waba,
    webhookSubscribedAt: waba.webhookSubscribedAt
      ?? (waba.id === legacyWabaId ? maybe.integration?.webhookSubscribedAt : undefined),
  }))
  const phoneNumbers = (Array.isArray(maybe.phoneNumbers) ? maybe.phoneNumbers : []).map((phone) => ({
    ...phone,
    wabaId: phone.wabaId ?? legacyWabaId,
    businessId: phone.businessId ?? maybe.integration?.businessId,
  }))
  const wabaByPhoneId = new Map(phoneNumbers.map((phone) => [phone.id, phone.wabaId]))
  const templates = (Array.isArray(maybe.templates) ? maybe.templates : []).map((template) => ({
    ...template,
    wabaId: template.wabaId ?? legacyWabaId,
  }))
  const conversations = (Array.isArray(maybe.conversations) ? maybe.conversations : []).map((conversation) => {
    const inferredPhoneNumberId = conversation.phoneNumberId
      ?? conversation.messages.find((message) => message.direction === 'inbound')?.to
      ?? conversation.messages.find((message) => message.direction === 'outbound')?.from
    return {
      ...conversation,
      phoneNumberId: inferredPhoneNumberId,
      wabaId: conversation.wabaId ?? (inferredPhoneNumberId ? wabaByPhoneId.get(inferredPhoneNumberId) : undefined),
    }
  })
  const messageByMetaId = new Map(
    conversations.flatMap((conversation) => conversation.messages)
      .filter((message) => Boolean(message.metaMessageId))
      .map((message) => [message.metaMessageId as string, message]),
  )
  const automationLogs = (Array.isArray(maybe.automationLogs) ? maybe.automationLogs : []).map((log) => {
    const message = log.messageId ? messageByMetaId.get(log.messageId) : undefined
    if (!message || !['sent', 'delivered', 'read', 'failed'].includes(message.status)) return log

    const status = message.status as AutomationRunStatus
    return {
      ...log,
      status,
      description: status === 'failed'
        ? 'A Meta aceitou inicialmente o disparo, mas informou falha na entrega pelo webhook.'
        : status === 'delivered'
          ? 'Mensagem entregue ao WhatsApp do destinatário.'
          : status === 'read'
            ? 'Mensagem lida pelo destinatário.'
            : log.description,
      error: message.error ?? log.error,
      recommendedAction: status === 'failed'
        ? message.error?.action ?? 'Verifique o erro definitivo retornado pela Meta e corrija a configuração antes de reenviar.'
        : log.recommendedAction,
    }
  })
  const automations = (Array.isArray(maybe.automations) ? maybe.automations : []).map((automation) => {
    const runs = automationLogs.filter((log) => log.automationId === automation.id)
    const phoneNumberId = automation.phoneNumberId
      ?? automation.fallbackPhoneNumberId
      ?? maybe.integration?.phoneNumberId
    const normalized = {
      ...automation,
      phoneNumberId,
      wabaId: automation.wabaId ?? (phoneNumberId ? wabaByPhoneId.get(phoneNumberId) : undefined),
    }
    if (runs.length === 0) return normalized
    return {
      ...normalized,
      totalRuns: runs.length,
      successfulRuns: runs.filter((log) => ['sent', 'delivered', 'read', 'responded'].includes(log.status)).length,
      failedRuns: runs.filter((log) => ['failed', 'blocked'].includes(log.status)).length,
    }
  })

  return {
    version: 2,
    integration: { ...defaultIntegration(), ...(maybe.integration ?? {}) },
    businesses: Array.isArray(maybe.businesses) ? maybe.businesses : [],
    wabas,
    phoneNumbers,
    removedPhoneNumberIds: Array.isArray(maybe.removedPhoneNumberIds) ? maybe.removedPhoneNumberIds : [],
    templates,
    conversations,
    contacts: Array.isArray(maybe.contacts) ? maybe.contacts : [],
    contactLists: Array.isArray(maybe.contactLists) ? maybe.contactLists : [],
    campaigns: Array.isArray(maybe.campaigns) ? maybe.campaigns : [],
    automations,
    automationJobs: Array.isArray(maybe.automationJobs) ? maybe.automationJobs : [],
    automationLogs,
    ecommerceEvents: Array.isArray(maybe.ecommerceEvents) ? maybe.ecommerceEvents : [],
    logs: Array.isArray(maybe.logs) ? maybe.logs : [],
    ai: {
      provider: 'openai',
      model: maybe.ai?.model || 'gpt-5-mini',
      contentAnalysisEnabled: maybe.ai?.contentAnalysisEnabled === true,
      updatedAt: maybe.ai?.updatedAt || nowIso(),
      lastAnalysis: maybe.ai?.lastAnalysis,
    },
  }
}

export async function getState(): Promise<WhatsAppState> {
  const snapshot = await loadPersistedState()
  return normalizeState(snapshot.data)
}

export async function replaceState(next: WhatsAppState): Promise<WhatsAppState> {
  const snapshot = await loadPersistedState()
  await savePersistedState(next, snapshot.revision)
  return next
}

export async function updateState(mutator: (state: WhatsAppState) => void): Promise<WhatsAppState> {
  const maxAttempts = persistenceBackend() === 'postgres' ? 12 : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const snapshot = await loadPersistedState()
    const state = normalizeState(snapshot.data)
    mutator(state)

    try {
      await savePersistedState(state, snapshot.revision)
      return state
    } catch (error) {
      if (!isPersistedStateConflict(error) || attempt === maxAttempts) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt * 10 + Math.random() * 20))
    }
  }

  throw new Error('WhatsApp state could not be persisted after concurrent updates.')
}

export async function addLog(input: {
  type: WhatsAppLogType
  status: LogStatus
  description: string
  safePayload?: Record<string, unknown>
  error?: unknown
  recommendedAction?: string
}): Promise<WhatsAppLog> {
  const log: WhatsAppLog = {
    id: id('log'),
    timestamp: nowIso(),
    type: input.type,
    status: input.status,
    description: input.description,
    safePayload: safeObject(input.safePayload),
    error: input.error ? sanitizeError(input.error, input.recommendedAction) : undefined,
    recommendedAction: input.recommendedAction,
  }

  await updateState((state) => {
    state.logs = [log, ...state.logs].slice(0, 1000)
  })

  return log
}

export async function upsertBusinesses(businesses: MetaBusiness[]): Promise<WhatsAppState> {
  return updateState((state) => {
    state.businesses = businesses
    state.integration.lastSyncAt = nowIso()
    state.integration.updatedAt = nowIso()
  })
}

export async function upsertWabas(wabas: WhatsAppBusinessAccount[]): Promise<WhatsAppState> {
  return updateState((state) => {
    state.wabas = wabas
    state.integration.lastSyncAt = nowIso()
    state.integration.updatedAt = nowIso()
  })
}

export async function upsertPhoneNumbers(phoneNumbers: WhatsAppPhoneNumber[]): Promise<WhatsAppState> {
  return updateState((state) => {
    state.phoneNumbers = phoneNumbers
    state.integration.lastSyncAt = nowIso()
    state.integration.updatedAt = nowIso()
  })
}

export async function upsertTemplates(templates: WhatsAppTemplate[]): Promise<WhatsAppState> {
  return updateState((state) => {
    const localDrafts = state.templates.filter((template) => template.source === 'local_draft')
    state.templates = [...templates, ...localDrafts]
    state.integration.lastSyncAt = nowIso()
    state.integration.updatedAt = nowIso()
  })
}

export async function saveTemplate(template: WhatsAppTemplate): Promise<WhatsAppState> {
  return updateState((state) => {
    const idx = state.templates.findIndex((item) => item.id === template.id)
    if (idx >= 0) state.templates[idx] = template
    else state.templates.unshift(template)
    state.integration.updatedAt = nowIso()
  })
}

export async function saveContact(contact: Contact): Promise<WhatsAppState> {
  return updateState((state) => {
    const idx = state.contacts.findIndex((item) => item.id === contact.id)
    if (idx >= 0) state.contacts[idx] = contact
    else state.contacts.unshift(contact)
  })
}

export async function saveContactList(list: ContactList): Promise<WhatsAppState> {
  return updateState((state) => {
    const idx = state.contactLists.findIndex((item) => item.id === list.id)
    if (idx >= 0) state.contactLists[idx] = list
    else state.contactLists.unshift(list)
  })
}

export async function deleteContactList(listId: string): Promise<WhatsAppState> {
  return updateState((state) => {
    state.contactLists = state.contactLists.filter((list) => list.id !== listId)
    state.campaigns = state.campaigns.map((campaign) =>
      campaign.listId === listId ? { ...campaign, listId: undefined, updatedAt: nowIso() } : campaign,
    )
  })
}

export async function saveCampaign(campaign: Campaign): Promise<WhatsAppState> {
  return updateState((state) => {
    const idx = state.campaigns.findIndex((item) => item.id === campaign.id)
    if (idx >= 0) state.campaigns[idx] = campaign
    else state.campaigns.unshift(campaign)
  })
}

export async function saveAutomation(automation: AutomationRule): Promise<WhatsAppState> {
  return updateState((state) => {
    const idx = state.automations.findIndex((item) => item.id === automation.id)
    if (idx >= 0) state.automations[idx] = automation
    else state.automations.unshift(automation)
  })
}

export async function saveAutomationJob(job: AutomationJob): Promise<WhatsAppState> {
  return updateState((state) => {
    const idx = state.automationJobs.findIndex((item) => item.id === job.id)
    if (idx >= 0) state.automationJobs[idx] = job
    else state.automationJobs.unshift(job)
    state.automationJobs = state.automationJobs.slice(0, 2000)
  })
}

export async function saveEcommerceEvent(event: ECommerceWebhookEvent): Promise<WhatsAppState> {
  return updateState((state) => {
    if (!state.ecommerceEvents.some((item) => item.eventId === event.eventId)) {
      state.ecommerceEvents.unshift(event)
      state.ecommerceEvents = state.ecommerceEvents.slice(0, 2000)
    }
  })
}

export async function addAutomationRunLog(input: Omit<AutomationRunLog, 'id' | 'timestamp'> & { timestamp?: string }): Promise<AutomationRunLog> {
  const log: AutomationRunLog = {
    ...input,
    id: id('automation-log'),
    timestamp: input.timestamp ?? nowIso(),
    safePayload: safeObject(input.safePayload),
    error: input.error ? sanitizeError(input.error, input.recommendedAction) : undefined,
  }

  await updateState((state) => {
    state.automationLogs = [log, ...state.automationLogs].slice(0, 1000)
  })

  return log
}

export async function addInboxMessage(message: InboxMessage): Promise<WhatsAppState> {
  return updateState((state) => {
    const phone = message.direction === 'inbound' ? message.from : message.to
    const phoneNumberId = message.direction === 'inbound' ? message.to : message.from
    const connectedPhone = state.phoneNumbers.find((item) => item.id === phoneNumberId)
    const conversationId = message.conversationId || `conv-${phoneNumberId}-${phone}`
    const existing = state.conversations.find((conversation) => conversation.id === conversationId)
    const duplicateByMetaId = message.metaMessageId
      ? state.conversations.some((conversation) =>
          conversation.messages.some((item) => item.metaMessageId === message.metaMessageId),
        )
      : false

    if (duplicateByMetaId) return
    const windowExpiresAt =
      message.direction === 'inbound'
        ? new Date(new Date(message.timestamp).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : existing?.windowExpiresAt

    if (existing) {
      existing.phoneNumberId = existing.phoneNumberId ?? phoneNumberId
      existing.wabaId = existing.wabaId ?? connectedPhone?.wabaId
      existing.messages = [...existing.messages.filter((item) => item.id !== message.id), { ...message, conversationId }]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      existing.lastMessageAt = message.timestamp
      existing.windowExpiresAt = windowExpiresAt
    } else {
      state.conversations.unshift({
        id: conversationId,
        phoneNumberId,
        wabaId: connectedPhone?.wabaId,
        phone,
        maskedPhone: maskPhone(phone),
        lastMessageAt: message.timestamp,
        windowExpiresAt,
        messages: [{ ...message, conversationId }],
      })
    }
  })
}

export async function updateInboxMessageStatus(metaMessageId: string, status: InboxMessage['status'], error?: unknown): Promise<WhatsAppState> {
  return updateState((state) => {
    for (const conversation of state.conversations) {
      const message = conversation.messages.find((item) => item.metaMessageId === metaMessageId)
      if (message) {
        message.status = status
        if (error) message.error = sanitizeError(error)
        conversation.lastMessageAt = new Date().toISOString()
      }
    }
  })
}

export async function updateAutomationRunStatus(
  metaMessageId: string,
  status: Extract<AutomationRunStatus, 'sent' | 'delivered' | 'read' | 'failed'>,
  error?: unknown,
): Promise<WhatsAppState> {
  return updateState((state) => {
    const log = state.automationLogs.find((item) => item.messageId === metaMessageId)
    if (!log) return

    log.status = status
    if (status === 'failed') {
      log.description = 'A Meta aceitou inicialmente o disparo, mas informou falha na entrega pelo webhook.'
      log.error = sanitizeError(error, 'Verifique a configuração indicada pela Meta antes de reenviar a automação.')
      log.recommendedAction = log.error.action
    } else if (status === 'delivered') {
      log.description = 'Mensagem entregue ao WhatsApp do destinatário.'
    } else if (status === 'read') {
      log.description = 'Mensagem lida pelo destinatário.'
    }
  })
}

export async function updateIntegration(patch: Partial<WhatsAppIntegration>): Promise<WhatsAppState> {
  return updateState((state) => {
    const next = { ...state.integration, ...patch, updatedAt: nowIso() }
    const missing = next.metaUser?.missingPermissions ?? META_REQUIRED_PERMISSIONS.filter((permission) => !next.metaUser?.grantedPermissions?.includes(permission))
    const hasBusiness = Boolean(next.businessId)
    const hasWaba = Boolean(next.wabaId)
    const hasPhone = Boolean(next.phoneNumberId)
    const selectedTemplate = state.templates.find((template) => template.id === next.selectedTemplateId)
    const hasApprovedTemplate = selectedTemplate?.status === 'APPROVED'

    if (next.oauthStatus === 'failed' || next.lastError) {
      next.connectionStatus = 'failed'
      next.status = 'failed'
    } else if (missing.length > 0) {
      next.connectionStatus = 'needs_attention'
      next.status = next.oauthStatus === 'completed' ? 'needs_attention' : 'started'
      next.alert = `Missing Meta permissions: ${missing.join(', ')}`
    } else if (hasBusiness && hasWaba && hasPhone && hasApprovedTemplate) {
      next.connectionStatus = 'ready'
      next.status = 'ready'
      next.alert = undefined
    } else if (next.oauthStatus === 'completed') {
      next.connectionStatus = 'needs_attention'
      next.status = 'needs_attention'
      next.alert = 'Business, WABA, phone number and approved template must be configured.'
    }

    state.integration = next
  })
}

export function selectedBusiness(state: WhatsAppState) {
  return state.businesses.find((business) => business.id === state.integration.businessId)
}

export function selectedWaba(state: WhatsAppState) {
  return state.wabas.find((waba) => waba.id === state.integration.wabaId)
}

export function selectedPhoneNumber(state: WhatsAppState) {
  return state.phoneNumbers.find((phone) => phone.id === state.integration.phoneNumberId)
}

export function selectedTemplate(state: WhatsAppState) {
  return state.templates.find((template) => template.id === state.integration.selectedTemplateId)
}

export function buildReviewChecklist(state: WhatsAppState): ReviewChecklistItem[] {
  const missingPermissions = state.integration.metaUser?.missingPermissions ?? META_REQUIRED_PERMISSIONS
  const approvedSelected = selectedTemplate(state)?.status === 'APPROVED'
  const hasInbound = state.conversations.some((conversation) => conversation.messages.some((message) => message.direction === 'inbound'))
  const webhookWorking = Boolean(state.integration.webhookVerifiedAt || state.logs.some((log) => log.type === 'webhook_received' && log.status === 'success'))

  return [
    {
      id: 'meta-login',
      label: 'Meta Login concluido',
      status: state.integration.oauthStatus === 'completed' ? 'Done' : state.integration.oauthStatus === 'failed' ? 'Failed' : 'Missing',
      detail: state.integration.oauthStatus === 'completed' ? 'OAuth completed and a Meta user is connected.' : 'Connect with Meta to complete OAuth.',
    },
    {
      id: 'permissions',
      label: 'Permissoes concedidas',
      status: missingPermissions.length === 0 ? 'Done' : 'Needs attention',
      detail: missingPermissions.length === 0 ? 'All required permissions are present.' : `Missing: ${missingPermissions.join(', ')}`,
    },
    { id: 'business', label: 'Business selecionado', status: state.integration.businessId ? 'Done' : 'Missing', detail: maskId(state.integration.businessId) },
    { id: 'waba', label: 'WABA selecionada', status: state.integration.wabaId ? 'Done' : 'Missing', detail: maskId(state.integration.wabaId) },
    { id: 'phone', label: 'Numero selecionado', status: state.integration.phoneNumberId ? 'Done' : 'Missing', detail: maskId(state.integration.phoneNumberId) },
    { id: 'templates-loaded', label: 'Templates carregados', status: state.templates.length > 0 ? 'Done' : 'Missing', detail: `${state.templates.length} template(s) available.` },
    { id: 'approved-template', label: 'Template aprovado selecionado', status: approvedSelected ? 'Done' : 'Needs attention', detail: approvedSelected ? selectedTemplate(state)?.name ?? '' : 'Select an APPROVED template.' },
    { id: 'test-message', label: 'Mensagem de teste enviada', status: state.integration.lastTestMessageId ? 'Done' : 'Missing', detail: state.integration.lastTestMessageId ? maskId(state.integration.lastTestMessageId) : 'Send a real test message.' },
    { id: 'inbox-reply', label: 'Resposta recebida no Inbox', status: hasInbound ? 'Done' : 'Missing', detail: hasInbound ? 'Inbound webhook message exists.' : 'Reply from WhatsApp has not arrived yet.' },
    { id: 'webhook', label: 'Webhook funcionando', status: webhookWorking ? 'Done' : 'Needs attention', detail: webhookWorking ? 'Webhook event received or verification completed.' : 'Configure Meta webhook callback and verify token.' },
    { id: 'logs', label: 'Logs disponiveis', status: state.logs.length > 0 ? 'Done' : 'Missing', detail: `${state.logs.length} log(s) recorded.` },
    { id: 'privacy', label: 'Politica de privacidade publica', status: 'Done', detail: '/privacy is public and does not require login.' },
  ]
}

export { id as createId, nowIso }
