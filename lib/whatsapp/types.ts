export type WaConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING'
export type WaProvider = 'MOCK' | 'META_CLOUD'

/**
 * Onboarding scenario detected during Embedded Signup:
 *   new_number          — phone not yet on any Cloud API provider (fresh setup)
 *   existing_app_number — phone is on WhatsApp Business App (on-premise), needs migration to Cloud API
 *   migration_required  — phone is already managed by another Cloud API provider/BSP
 *   connected           — phone is already on our Cloud API (reconnect / token refresh)
 */
export type WaOnboardingType =
  | 'new_number'
  | 'existing_app_number'
  | 'migration_required'
  | 'connected'

export interface WaConnection {
  id: string
  name: string
  provider: WaProvider
  phoneNumber: string
  phoneNumberId: string
  accessToken: string
  businessAccountId: string  // WABA ID (waba_id from Embedded Signup)
  businessId?: string        // Meta Business Manager ID (business_id from Embedded Signup)
  webhookVerifyToken: string
  storeId?: number           // Tenant scope — set from admin session on save
  /** Onboarding scenario detected at signup time */
  onboardingType?: WaOnboardingType
  /** Raw platform_type from Meta /{phone_number_id}: CLOUD_API | ON_PREMISE */
  platformType?: string
  status: WaConnectionStatus
  connectedAt: Date | null
  lastMessageAt: Date | null
  messagesSentToday: number
  messagesTotal: number
}

export type WaEventType =
  | 'CUSTOMER_REGISTERED'
  | 'CUSTOMER_APPROVED'
  | 'CUSTOMER_REJECTED'
  | 'ORDER_RECEIVED'
  | 'ORDER_PAID'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'CART_ABANDONED'
  | 'PAYMENT_FAILED'

export interface WaEventPayload {
  customerId?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  orderId?: string
  orderTotal?: number
  orderStatus?: string
  cartValue?: number
}

export interface WaEvent {
  id: string
  type: WaEventType
  payload: WaEventPayload
  triggeredAt: Date
  source: 'MANUAL' | 'SYSTEM'
}

export type WaConditionField =
  | 'orderTotal'
  | 'customerStatus'
  | 'cartValue'
  | 'hourOfDay'
  | 'dayOfWeek'

export type WaConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in'

export interface WaCondition {
  field: WaConditionField
  op: WaConditionOp
  value: string | number | string[]
}

export interface WaAutomationRule {
  id: string
  name: string
  trigger: WaEventType
  conditions: WaCondition[]
  templateId: string
  connectionId: string
  isActive: boolean
  cooldownMinutes: number
  dailyLimit: number
  allowedHoursStart: number
  allowedHoursEnd: number
  createdAt: Date
  updatedAt: Date
}

export interface WaTemplate {
  id: string
  name: string
  body: string
  variables: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type WaMessageStatus = 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED'
export type WaSkipReason =
  | 'COOLDOWN'
  | 'DAILY_LIMIT'
  | 'OUTSIDE_HOURS'
  | 'NO_PHONE'
  | 'RULE_INACTIVE'
  | 'CONDITION_FAILED'

export interface WaMessageLog {
  id: string
  ruleId: string
  ruleName: string
  connectionId: string
  templateId: string
  eventType: WaEventType
  recipientPhone: string
  recipientName: string
  message: string
  status: WaMessageStatus
  skipReason?: WaSkipReason
  sentAt: Date
  deliveredAt?: Date
  errorMessage?: string
}

export interface WaSettings {
  defaultConnectionId: string | null
  globalDailyLimit: number
  defaultAllowedHoursStart: number
  defaultAllowedHoursEnd: number
  timezone: string
}
