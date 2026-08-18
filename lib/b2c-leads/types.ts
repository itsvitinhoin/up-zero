export type B2CLeadStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'CONVERTED'
  | 'LOST'
  | 'INVALID'

export interface B2CLeadReseller {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
}

export interface B2CLeadEvent {
  id: string
  type: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface B2CLeadItem {
  id: string
  productId: string
  productName: string
  productSlug: string | null
  sku: string | null
  imageUrl: string | null
  variantId: string | null
  color: string | null
  size: string | null
  quantity: number
  unitPrice: number | null
}

export interface B2CLead {
  id: string
  storeId: number
  branchId: string | null
  source: string
  name: string
  email: string
  phone: string
  document: string | null
  documentType: 'CPF' | 'CNPJ' | null
  zipCode: string | null
  city: string | null
  state: string | null
  interest: string | null
  requestCode: string | null
  items: B2CLeadItem[]
  requestValue: number | null
  preferredChannel: string
  consent: {
    accepted: boolean
    version: string
    acceptedAt: string
  }
  status: B2CLeadStatus
  assignedReseller: B2CLeadReseller | null
  assignmentMode: 'AUTO' | 'MANUAL' | null
  assignedAt: string | null
  contactedAt: string | null
  convertedAt: string | null
  lostReason: string | null
  resellerResponse: 'PENDING' | 'ACCEPTED' | 'REJECTED' | null
  resellerRespondedAt: string | null
  createdAt: string
  updatedAt: string
  events: B2CLeadEvent[]
}

export interface EligibleB2CReseller extends B2CLeadReseller {
  document: string
  ordersCount: number
  totalSpent: number
  lastOrderAt: string | null
  eligible: boolean
  eligibilityReason: string
}

export type B2CDistributionMode = 'MANUAL' | 'AUTOMATIC' | 'TIERED'

export type B2CResellerLevel = 'GOLD' | 'SILVER' | 'BRONZE'

export type B2CResellerListPriority = 'PREFERRED' | B2CResellerLevel

export interface B2CResellerListFilters {
  requireApproved: boolean
  requirePreviousOrder: boolean
  maxDaysSinceLastOrder: number | null
  minOrders: number
  minTotalSpent: number
  states: string[]
}

export interface B2CResellerList {
  id: string
  name: string
  description: string
  enabled: boolean
  priority: B2CResellerListPriority
  filters: B2CResellerListFilters
  includedResellerIds: string[]
  excludedResellerIds: string[]
  createdAt: string
  updatedAt: string
}

export interface B2CDistributionResellerSnapshot extends EligibleB2CReseller {
  level: B2CResellerLevel
}

export interface B2CDistributionSettings {
  mode: B2CDistributionMode
  resellerLists: B2CResellerList[]
  enabledResellerIds: string[]
  preferredResellerIds: string[]
  resellerLevels: Record<string, B2CResellerLevel>
  filters: {
    requireApproved: boolean
    requirePreviousOrder: boolean
    maxDaysSinceLastOrder: number | null
    minOrders: number
    minTotalSpent: number
    prioritizeSameState: boolean
  }
  resellerDirectory: B2CDistributionResellerSnapshot[]
  resellerSourceSyncedAt?: string | null
  updatedAt: string | null
}

export interface B2CResellerDataSource {
  mode: 'SAFE_READ_ONLY'
  source: 'API_READ_ONLY' | 'SANDBOX'
  configured: boolean
  readOnly: true
  rawPayloadPersisted: false
  count: number
  lastSyncAt: string | null
  error: string | null
  resellers: EligibleB2CReseller[]
}

export const DEFAULT_B2C_DISTRIBUTION_SETTINGS: B2CDistributionSettings = {
  mode: 'MANUAL',
  resellerLists: [
    {
      id: 'list-active-resellers',
      name: 'Revendedores ativos',
      description: 'Parceiros aprovados que compraram nos últimos 90 dias.',
      enabled: true,
      priority: 'BRONZE',
      filters: {
        requireApproved: true,
        requirePreviousOrder: true,
        maxDaysSinceLastOrder: 90,
        minOrders: 1,
        minTotalSpent: 0,
        states: [],
      },
      includedResellerIds: [],
      excludedResellerIds: [],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    },
  ],
  enabledResellerIds: [],
  preferredResellerIds: [],
  resellerLevels: {},
  filters: {
    requireApproved: true,
    requirePreviousOrder: true,
    maxDaysSinceLastOrder: 90,
    minOrders: 1,
    minTotalSpent: 0,
    prioritizeSameState: true,
  },
  resellerDirectory: [],
  updatedAt: null,
}
