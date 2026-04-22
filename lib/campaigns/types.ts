// ─── Smart List Types ──────────────────────────────────────────────────────────

export type SmartListType = 'DYNAMIC' | 'STATIC'
export type SmartListStatus = 'ACTIVE' | 'ARCHIVED'
export type SmartListVisibility = 'PRIVATE' | 'TEAM' | 'GLOBAL'

export type FilterField =
  // Customer profile
  | 'customer.name'
  | 'customer.email'
  | 'customer.phone'
  | 'customer.document'
  | 'customer.status'
  | 'customer.createdAt'
  | 'customer.seller'
  | 'customer.source'
  // Location
  | 'customer.city'
  | 'customer.state'
  | 'customer.zipCode'
  // Purchase behavior
  | 'orders.hasPurchased'
  | 'orders.neverPurchased'
  | 'orders.lastPurchaseDaysAgo'
  | 'orders.firstPurchaseDaysAgo'
  | 'orders.count'
  | 'orders.totalSpend'
  | 'orders.avgTicket'
  | 'orders.frequency'
  // Order data
  | 'orders.hasStatus'
  | 'orders.value'
  | 'orders.paymentMethod'
  | 'orders.installmentCount'
  | 'orders.couponUsed'
  | 'orders.hasDiscount'
  // Product / category behavior
  | 'orders.boughtProduct'
  | 'orders.boughtCategory'
  | 'orders.boughtCollection'
  | 'orders.boughtVariant'
  | 'orders.boughtColor'
  | 'orders.boughtSize'
  | 'orders.notBoughtCategory'
  // CRM / inactivity
  | 'crm.inactiveDays'
  | 'crm.purchasedOnce'
  | 'crm.approvedNoPurchase'
  | 'crm.frequencyDropped'
  | 'crm.totalSpendAbove'
  | 'crm.isVip'
  // List-in-list
  | 'list.belongsTo'
  | 'list.notBelongsTo'

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in_last_x_days'
  | 'more_than_x_days_ago'
  | 'exists'
  | 'not_exists'
  | 'in_list'
  | 'not_in_list'
  | 'is_true'
  | 'is_false'

export interface FilterRule {
  id: string
  field: FilterField
  operator: FilterOperator
  value: string | number | boolean | string[] | [number, number] | null
  label?: string
}

export interface FilterGroup {
  id: string
  logic: 'ALL' | 'ANY'
  rules: FilterRule[]
  groups: FilterGroup[]
}

export interface SmartList {
  id: string
  storeId: number
  name: string
  description: string
  type: SmartListType
  status: SmartListStatus
  visibilityScope: SmartListVisibility
  isFavorite: boolean
  rules: FilterGroup
  exclusions: FilterRule[]
  resultCount: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
  lastCalculatedAt: Date | null
}

export interface SmartListTemplate {
  id: string
  tenantId: number | null
  name: string
  description: string
  category: string
  rules: FilterGroup
  exclusions: FilterRule[]
  isSystemTemplate: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SmartListResultCacheEntry {
  id: string
  listId: string
  customerId: string
  snapshotDate: string
  createdAt: Date
}

// ─── Campaign Types ────────────────────────────────────────────────────────────

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELED'

export type AudienceSourceType = 'SMART_LIST' | 'STATIC_UPLOAD' | 'CUSTOM_FILTER'

export type RecipientEligibilityStatus =
  | 'ELIGIBLE'
  | 'INVALID_PHONE'
  | 'NO_OPT_IN'
  | 'DUPLICATE'
  | 'BLOCKED'
  | 'EXCLUDED'
  | 'OTHER'

export type RecipientSendStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'REPLIED'
  | 'FAILED'
  | 'SKIPPED'

export type MessageCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE'

export type AttributionWindow = 1 | 3 | 7

export interface CampaignPricingSnapshot {
  id: string
  source: string
  market: string
  currency: string
  category: MessageCategory
  unitPrice: number
  effectiveFrom: Date
  effectiveTo: Date | null
  rawSourcePayload: Record<string, unknown>
  createdAt: Date
}

export interface CampaignRecipient {
  id: string
  campaignId: string
  customerId: string
  customerName: string
  phone: string
  countryCode: string
  eligibilityStatus: RecipientEligibilityStatus
  exclusionReason: string | null
  providerMessageId: string | null
  sendStatus: RecipientSendStatus
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  repliedAt: Date | null
  failedAt: Date | null
  attributedOrderId: string | null
  attributedRevenue: number | null
  actualUnitCost: number | null
  actualCost: number | null
  createdAt: Date
  updatedAt: Date
}

export interface CampaignPerformance {
  id: string
  campaignId: string
  totalTargeted: number
  totalEligible: number
  totalSent: number
  totalAccepted: number
  totalDelivered: number
  totalRead: number
  totalFailed: number
  totalReplied: number
  totalOrders: number
  totalRevenue: number
  totalCost: number
  roi: number
  updatedAt: Date
}

export interface CampaignTimelineEvent {
  id: string
  campaignId: string
  event: string
  description: string
  occurredAt: Date
}

export interface Campaign {
  id: string
  storeId: number
  name: string
  description: string
  status: CampaignStatus
  audienceSourceType: AudienceSourceType
  smartListId: string | null
  wabaId: string
  phoneNumberId: string
  connectionId: string
  whatsappTemplateId: string
  templateName: string
  templateCategory: MessageCategory
  templateLanguage: string
  templateVariables: Record<string, string>
  scheduledAt: Date | null
  startedAt: Date | null
  finishedAt: Date | null
  createdBy: string
  pricingSnapshotId: string
  estimatedAudienceCount: number
  eligibleAudienceCount: number
  excludedCount: number
  invalidCount: number
  estimatedUnitCost: number
  estimatedTotalCost: number
  actualDeliveredCount: number
  actualTotalCost: number
  attributedOrderCount: number
  attributedRevenue: number
  attributionWindowDays: AttributionWindow
  roi: number
  createdAt: Date
  updatedAt: Date
  // Embedded performance (kept in sync)
  performance: CampaignPerformance | null
  timeline: CampaignTimelineEvent[]
  recipients: CampaignRecipient[]
}

// ─── Persisted data shape ──────────────────────────────────────────────────────

export interface CampaignsPersistedData {
  smartLists: SmartList[]
  campaigns: Campaign[]
  pricingSnapshots: CampaignPricingSnapshot[]
  seeded?: boolean
}
