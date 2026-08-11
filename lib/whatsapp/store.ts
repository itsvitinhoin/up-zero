import { loadFromDisk, saveToDisk } from './persist'
import {
  META_REQUIRED_PERMISSIONS,
  type AutomationRule,
  type AutomationRunLog,
  type Campaign,
  type Contact,
  type ContactList,
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
  return {
    version: 2,
    integration: defaultIntegration(),
    businesses: [],
    wabas: [],
    phoneNumbers: [],
    templates: [],
    conversations: [],
    contacts: [],
    contactLists: [],
    campaigns: [],
    automations: [],
    automationLogs: [],
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

  return {
    version: 2,
    integration: { ...defaultIntegration(), ...(maybe.integration ?? {}) },
    businesses: Array.isArray(maybe.businesses) ? maybe.businesses : [],
    wabas: Array.isArray(maybe.wabas) ? maybe.wabas : [],
    phoneNumbers: Array.isArray(maybe.phoneNumbers) ? maybe.phoneNumbers : [],
    templates: Array.isArray(maybe.templates) ? maybe.templates : [],
    conversations: Array.isArray(maybe.conversations) ? maybe.conversations : [],
    contacts: Array.isArray(maybe.contacts) ? maybe.contacts : [],
    contactLists: Array.isArray(maybe.contactLists) ? maybe.contactLists : [],
    campaigns: Array.isArray(maybe.campaigns) ? maybe.campaigns : [],
    automations: Array.isArray(maybe.automations) ? maybe.automations : [],
    automationLogs: Array.isArray(maybe.automationLogs) ? maybe.automationLogs : [],
    logs: Array.isArray(maybe.logs) ? maybe.logs : [],
  }
}

export function getState(): WhatsAppState {
  const state = normalizeState(loadFromDisk())
  if (state.version !== 2) saveToDisk(state)
  return state
}

export function replaceState(next: WhatsAppState): WhatsAppState {
  saveToDisk(next)
  return next
}

export function updateState(mutator: (state: WhatsAppState) => void): WhatsAppState {
  const state = getState()
  mutator(state)
  saveToDisk(state)
  return state
}

export function addLog(input: {
  type: WhatsAppLogType
  status: LogStatus
  description: string
  safePayload?: Record<string, unknown>
  error?: unknown
  recommendedAction?: string
}): WhatsAppLog {
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

  updateState((state) => {
    state.logs = [log, ...state.logs].slice(0, 1000)
  })

  return log
}

export function upsertBusinesses(businesses: MetaBusiness[]): WhatsAppState {
  return updateState((state) => {
    state.businesses = businesses
    state.integration.lastSyncAt = nowIso()
    state.integration.updatedAt = nowIso()
  })
}

export function upsertWabas(wabas: WhatsAppBusinessAccount[]): WhatsAppState {
  return updateState((state) => {
    state.wabas = wabas
    state.integration.lastSyncAt = nowIso()
    state.integration.updatedAt = nowIso()
  })
}

export function upsertPhoneNumbers(phoneNumbers: WhatsAppPhoneNumber[]): WhatsAppState {
  return updateState((state) => {
    state.phoneNumbers = phoneNumbers
    state.integration.lastSyncAt = nowIso()
    state.integration.updatedAt = nowIso()
  })
}

export function upsertTemplates(templates: WhatsAppTemplate[]): WhatsAppState {
  return updateState((state) => {
    const localDrafts = state.templates.filter((template) => template.source === 'local_draft')
    state.templates = [...templates, ...localDrafts]
    state.integration.lastSyncAt = nowIso()
    state.integration.updatedAt = nowIso()
  })
}

export function saveTemplate(template: WhatsAppTemplate): WhatsAppState {
  return updateState((state) => {
    const idx = state.templates.findIndex((item) => item.id === template.id)
    if (idx >= 0) state.templates[idx] = template
    else state.templates.unshift(template)
    state.integration.updatedAt = nowIso()
  })
}

export function saveContact(contact: Contact): WhatsAppState {
  return updateState((state) => {
    const idx = state.contacts.findIndex((item) => item.id === contact.id)
    if (idx >= 0) state.contacts[idx] = contact
    else state.contacts.unshift(contact)
  })
}

export function saveContactList(list: ContactList): WhatsAppState {
  return updateState((state) => {
    const idx = state.contactLists.findIndex((item) => item.id === list.id)
    if (idx >= 0) state.contactLists[idx] = list
    else state.contactLists.unshift(list)
  })
}

export function deleteContactList(listId: string): WhatsAppState {
  return updateState((state) => {
    state.contactLists = state.contactLists.filter((list) => list.id !== listId)
    state.campaigns = state.campaigns.map((campaign) =>
      campaign.listId === listId ? { ...campaign, listId: undefined, updatedAt: nowIso() } : campaign,
    )
  })
}

export function saveCampaign(campaign: Campaign): WhatsAppState {
  return updateState((state) => {
    const idx = state.campaigns.findIndex((item) => item.id === campaign.id)
    if (idx >= 0) state.campaigns[idx] = campaign
    else state.campaigns.unshift(campaign)
  })
}

export function saveAutomation(automation: AutomationRule): WhatsAppState {
  return updateState((state) => {
    const idx = state.automations.findIndex((item) => item.id === automation.id)
    if (idx >= 0) state.automations[idx] = automation
    else state.automations.unshift(automation)
  })
}

export function addAutomationRunLog(input: Omit<AutomationRunLog, 'id' | 'timestamp'> & { timestamp?: string }): AutomationRunLog {
  const log: AutomationRunLog = {
    ...input,
    id: id('automation-log'),
    timestamp: input.timestamp ?? nowIso(),
    safePayload: safeObject(input.safePayload),
    error: input.error ? sanitizeError(input.error, input.recommendedAction) : undefined,
  }

  updateState((state) => {
    state.automationLogs = [log, ...state.automationLogs].slice(0, 1000)
  })

  return log
}

export function addInboxMessage(message: InboxMessage): WhatsAppState {
  return updateState((state) => {
    const phone = message.direction === 'inbound' ? message.from : message.to
    const conversationId = message.conversationId || `conv-${phone}`
    const existing = state.conversations.find((conversation) => conversation.id === conversationId)
    const windowExpiresAt =
      message.direction === 'inbound'
        ? new Date(new Date(message.timestamp).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : existing?.windowExpiresAt

    if (existing) {
      existing.messages = [...existing.messages.filter((item) => item.id !== message.id), { ...message, conversationId }]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      existing.lastMessageAt = message.timestamp
      existing.windowExpiresAt = windowExpiresAt
    } else {
      state.conversations.unshift({
        id: conversationId,
        phone,
        maskedPhone: maskPhone(phone),
        lastMessageAt: message.timestamp,
        windowExpiresAt,
        messages: [{ ...message, conversationId }],
      })
    }
  })
}

export function updateInboxMessageStatus(metaMessageId: string, status: InboxMessage['status'], error?: unknown): WhatsAppState {
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

export function updateIntegration(patch: Partial<WhatsAppIntegration>): WhatsAppState {
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

export function selectedBusiness(state = getState()) {
  return state.businesses.find((business) => business.id === state.integration.businessId)
}

export function selectedWaba(state = getState()) {
  return state.wabas.find((waba) => waba.id === state.integration.wabaId)
}

export function selectedPhoneNumber(state = getState()) {
  return state.phoneNumbers.find((phone) => phone.id === state.integration.phoneNumberId)
}

export function selectedTemplate(state = getState()) {
  return state.templates.find((template) => template.id === state.integration.selectedTemplateId)
}

export function buildReviewChecklist(state = getState()): ReviewChecklistItem[] {
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
