export const META_REQUIRED_PERMISSIONS = [
  'public_profile',
  'email',
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
] as const

export const META_PERMISSIONS_NOT_REQUESTED_NOW = [
  'manage_app_solution',
  'whatsapp_business_manage_events',
] as const

export type MetaRequiredPermission = (typeof META_REQUIRED_PERMISSIONS)[number]

export type IntegrationStatus = 'not_started' | 'started' | 'connected' | 'needs_attention' | 'ready' | 'failed'
export type ReviewItemStatus = 'Done' | 'Missing' | 'Failed' | 'Needs attention'
export type LogStatus = 'success' | 'failed' | 'needs_attention' | 'info'
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'UNKNOWN'
export type CampaignStatus = 'Draft' | 'Scheduled' | 'Sending' | 'Sent' | 'Failed' | 'Paused' | 'Cancelled'
export type AutomationStatus = 'Draft' | 'Active' | 'Paused' | 'Failed'
export type AutomationRunStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'responded' | 'failed' | 'blocked' | 'ignored'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'received'
export type WaOnboardingType = 'new_number' | 'existing_app_number' | 'migration_required' | 'connected'
export type ECommerceEventType =
  | 'customer.created'
  | 'customer.updated'
  | 'customer.registration_incomplete'
  | 'customer.whatsapp_opt_in_missing'
  | 'customer.whatsapp_opt_in_confirmed'
  | 'order.created'
  | 'order.updated'
  | 'order.reserved'
  | 'order.confirmed'
  | 'order.payment_confirmed'
  | 'order.processing'
  | 'order.invoiced'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'

export interface SafeError {
  message: string
  code?: string | number
  traceId?: string
  action?: string
}

export interface MetaUser {
  id: string
  name?: string
  email?: string
  grantedPermissions: string[]
  missingPermissions: string[]
}

export interface MetaBusiness {
  id: string
  name: string
  verificationStatus?: string
}

export interface WhatsAppBusinessAccount {
  id: string
  name: string
  businessId?: string
  currency?: string
  timezoneId?: string
}

export interface WhatsAppPhoneNumber {
  id: string
  displayPhoneNumber: string
  verifiedName?: string
  qualityRating?: string
  status?: string
  codeVerificationStatus?: string
}

export interface WhatsAppIntegration {
  status: IntegrationStatus
  oauthStatus: 'not_started' | 'started' | 'completed' | 'failed'
  connectionStatus: IntegrationStatus
  metaUser?: MetaUser
  businessId?: string
  wabaId?: string
  phoneNumberId?: string
  selectedTemplateId?: string
  lastSyncAt?: string
  webhookVerifiedAt?: string
  webhookSubscribedAt?: string
  lastTestMessageId?: string
  lastError?: SafeError
  alert?: string
  updatedAt: string
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  text?: string
  format?: string
  buttons?: TemplateButton[]
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  text: string
  url?: string
  phoneNumber?: string
}

export interface WhatsAppTemplate {
  id: string
  metaTemplateId?: string
  name: string
  category: TemplateCategory
  language: string
  status: TemplateStatus
  components: TemplateComponent[]
  body: string
  variables: string[]
  footer?: string
  buttons: TemplateButton[]
  exampleValues: Record<string, string>
  rejectionReason?: string
  source: 'meta' | 'local_draft'
  createdAt: string
  updatedAt: string
}

export interface InboxMessage {
  id: string
  metaMessageId?: string
  conversationId: string
  direction: MessageDirection
  from: string
  to: string
  text: string
  status: MessageStatus
  timestamp: string
  templateId?: string
  error?: SafeError
}

export interface InboxConversation {
  id: string
  contactName?: string
  maskedPhone: string
  phone: string
  lastMessageAt?: string
  windowExpiresAt?: string
  messages: InboxMessage[]
}

export interface Contact {
  id: string
  externalId?: string
  name: string
  phone: string
  countryCode: string
  email?: string
  document?: string
  customerType?: 'RETAIL' | 'WHOLESALE'
  tags: string[]
  source?: string
  status: 'active' | 'inactive' | 'blocked' | 'incomplete'
  optInWhatsapp: boolean
  city?: string
  state?: string
  firstPurchaseAt?: string
  lastPurchaseAt?: string
  totalSpent?: number
  orderCount?: number
  createdAt: string
  updatedAt: string
}

export interface ContactFilters {
  firstPurchase?: boolean
  neverPurchased?: boolean
  moreThanOnePurchase?: boolean
  minOrderValue?: number
  lastPurchaseFrom?: string
  purchaseFrom?: string
  purchaseTo?: string
  tags?: string[]
  status?: string
  optInWhatsapp?: boolean
  countryCode?: string
  source?: string
  state?: string
  city?: string
  customerType?: string
  orderStatus?: string
  paymentStatus?: string
}

export interface ContactList {
  id: string
  name: string
  description?: string
  filters: ContactFilters
  contactIds: string[]
  createdAt: string
  updatedAt: string
}

export interface CampaignMetrics {
  totalContacts: number
  scheduled: number
  sent: number
  delivered: number
  failed: number
  replies: number
  estimatedCost: number
  costPerMessage: number
  responseRate: number
}

export interface Campaign {
  id: string
  name: string
  listId?: string
  templateId?: string
  variableMapping: Record<string, string>
  scheduledAt?: string
  status: CampaignStatus
  estimatedCost: number
  metrics: CampaignMetrics
  createdAt: string
  updatedAt: string
}

export interface ECommerceEventDefinition {
  type: ECommerceEventType
  label: string
  group: 'Cadastro' | 'Pedido' | 'Entrega'
  description: string
  statusHint: 'success' | 'failed' | 'needs_attention' | 'info'
  payloadFields: string[]
}

export interface AutomationRule {
  id: string
  name: string
  eventType: ECommerceEventType
  conditions: ContactFilters & {
    onlyWithOptIn?: boolean
    minOrderTotal?: number
  }
  templateId?: string
  variableMapping: Record<string, string>
  delayMinutes: number
  allowedWindow?: {
    start: string
    end: string
  }
  status: AutomationStatus
  lastTriggeredAt?: string
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  createdAt: string
  updatedAt: string
}

export interface AutomationRunLog {
  id: string
  automationId?: string
  eventType: ECommerceEventType
  status: AutomationRunStatus
  timestamp: string
  customerId?: string
  customerName?: string
  maskedPhone?: string
  orderId?: string
  templateId?: string
  messageId?: string
  description: string
  safePayload?: Record<string, unknown>
  error?: SafeError
  recommendedAction?: string
}

export type WhatsAppLogType =
  | 'oauth_started'
  | 'oauth_completed'
  | 'permission_missing'
  | 'business_loaded'
  | 'waba_loaded'
  | 'phone_selected'
  | 'templates_synced'
  | 'template_created'
  | 'template_approved'
  | 'template_rejected'
  | 'message_sent'
  | 'webhook_received'
  | 'inbox_updated'
  | 'automation_created'
  | 'automation_updated'
  | 'automation_paused'
  | 'automation_triggered'
  | 'automation_error'
  | 'ecommerce_event_received'
  | 'campaign_created'
  | 'campaign_sent'
  | 'campaign_paused'
  | 'campaign_error'
  | 'connection_saved'
  | 'contact_list_created'
  | 'contact_created'

export interface WhatsAppLog {
  id: string
  timestamp: string
  type: WhatsAppLogType
  status: LogStatus
  description: string
  safePayload?: Record<string, unknown>
  error?: SafeError
  recommendedAction?: string
}

export interface WhatsAppState {
  version: 2
  integration: WhatsAppIntegration
  businesses: MetaBusiness[]
  wabas: WhatsAppBusinessAccount[]
  phoneNumbers: WhatsAppPhoneNumber[]
  templates: WhatsAppTemplate[]
  conversations: InboxConversation[]
  contacts: Contact[]
  contactLists: ContactList[]
  campaigns: Campaign[]
  automations: AutomationRule[]
  automationLogs: AutomationRunLog[]
  logs: WhatsAppLog[]
}

export interface ReviewChecklistItem {
  id: string
  label: string
  status: ReviewItemStatus
  detail: string
}
