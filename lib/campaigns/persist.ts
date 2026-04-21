import fs from 'fs'
import path from 'path'
import type {
  Campaign,
  CampaignPerformance,
  CampaignPricingSnapshot,
  CampaignsPersistedData,
  MessageCategory,
  SmartList,
} from './types'

const _defaultDataDir =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
    ? '/tmp/.data'
    : path.join(process.cwd(), '.data')

const DATA_DIR = process.env.CAMPAIGNS_DATA_DIR ?? _defaultDataDir
const DATA_FILE = path.join(DATA_DIR, 'campaigns.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function rehydrateDates(parsed: CampaignsPersistedData): CampaignsPersistedData {
  parsed.smartLists = (parsed.smartLists ?? []).map((sl) => ({
    ...sl,
    createdAt: new Date(sl.createdAt),
    updatedAt: new Date(sl.updatedAt),
    lastCalculatedAt: sl.lastCalculatedAt ? new Date(sl.lastCalculatedAt) : null,
  }))

  parsed.campaigns = (parsed.campaigns ?? []).map((c) => ({
    ...c,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
    scheduledAt: c.scheduledAt ? new Date(c.scheduledAt) : null,
    startedAt: c.startedAt ? new Date(c.startedAt) : null,
    finishedAt: c.finishedAt ? new Date(c.finishedAt) : null,
    recipients: (c.recipients ?? []).map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      sentAt: r.sentAt ? new Date(r.sentAt) : null,
      deliveredAt: r.deliveredAt ? new Date(r.deliveredAt) : null,
      readAt: r.readAt ? new Date(r.readAt) : null,
      repliedAt: r.repliedAt ? new Date(r.repliedAt) : null,
      failedAt: r.failedAt ? new Date(r.failedAt) : null,
    })),
    performance: c.performance
      ? { ...c.performance, updatedAt: new Date(c.performance.updatedAt) }
      : null,
    timeline: (c.timeline ?? []).map((t) => ({
      ...t,
      occurredAt: new Date(t.occurredAt),
    })),
  }))

  parsed.pricingSnapshots = (parsed.pricingSnapshots ?? []).map((ps) => ({
    ...ps,
    createdAt: new Date(ps.createdAt),
    effectiveFrom: new Date(ps.effectiveFrom),
    effectiveTo: ps.effectiveTo ? new Date(ps.effectiveTo) : null,
  }))

  return parsed
}

function buildDefaultPricingSnapshots(): CampaignPricingSnapshot[] {
  const now = new Date()
  const categories: MessageCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE']
  // Default Brazil (BR) pricing in BRL — these are illustrative starting values.
  // Update via the Pricing admin page without touching code.
  const prices: Record<MessageCategory, number> = {
    MARKETING: 0.32,
    UTILITY: 0.08,
    AUTHENTICATION: 0.08,
    SERVICE: 0.04,
  }
  return categories.map((cat, i) => ({
    id: `pricing-br-${cat.toLowerCase()}-v1`,
    source: 'META_PUBLISHED',
    market: 'BR',
    currency: 'BRL',
    category: cat,
    unitPrice: prices[cat],
    effectiveFrom: now,
    effectiveTo: null,
    rawSourcePayload: { note: 'Default seed value — update via admin Pricing page.' },
    createdAt: new Date(now.getTime() - i * 1000),
  }))
}

function buildDefaultSmartLists(storeId: number): SmartList[] {
  const now = new Date()
  const d = (days: number) => new Date(now.getTime() - days * 86_400_000)
  const emptyGroup = () => ({ id: `g-${Date.now()}-${Math.random().toString(36).slice(2)}`, logic: 'ALL' as const, rules: [], groups: [] })

  return [
    {
      id: 'sl-template-vip',
      storeId,
      name: 'Clientes VIP',
      description: 'Clientes com mais de R$ 5.000 em pedidos',
      type: 'DYNAMIC',
      status: 'ACTIVE',
      visibilityScope: 'TEAM',
      isFavorite: true,
      rules: {
        id: 'g1',
        logic: 'ALL',
        rules: [
          { id: 'r1', field: 'orders.totalSpend', operator: 'greater_than', value: 5000, label: 'Total gasto > R$5.000' },
          { id: 'r2', field: 'orders.hasPurchased', operator: 'is_true', value: true, label: 'Realizou compra' },
        ],
        groups: [],
      },
      exclusions: [],
      resultCount: 48,
      createdBy: 'sistema',
      createdAt: d(30),
      updatedAt: d(1),
      lastCalculatedAt: d(1),
    },
    {
      id: 'sl-template-inactive-30',
      storeId,
      name: 'Inativos 30 dias',
      description: 'Clientes que não compram há mais de 30 dias',
      type: 'DYNAMIC',
      status: 'ACTIVE',
      visibilityScope: 'TEAM',
      isFavorite: false,
      rules: {
        id: 'g2',
        logic: 'ALL',
        rules: [
          { id: 'r3', field: 'orders.lastPurchaseDaysAgo', operator: 'more_than_x_days_ago', value: 30, label: 'Última compra > 30 dias' },
          { id: 'r4', field: 'orders.hasPurchased', operator: 'is_true', value: true, label: 'Já comprou' },
        ],
        groups: [],
      },
      exclusions: [],
      resultCount: 134,
      createdBy: 'sistema',
      createdAt: d(20),
      updatedAt: d(2),
      lastCalculatedAt: d(2),
    },
    {
      id: 'sl-template-approved-no-purchase',
      storeId,
      name: 'Aprovados sem Compra',
      description: 'Clientes aprovados que nunca compraram',
      type: 'DYNAMIC',
      status: 'ACTIVE',
      visibilityScope: 'TEAM',
      isFavorite: true,
      rules: {
        id: 'g3',
        logic: 'ALL',
        rules: [
          { id: 'r5', field: 'customer.status', operator: 'equals', value: 'APPROVED', label: 'Status = Aprovado' },
          { id: 'r6', field: 'orders.neverPurchased', operator: 'is_true', value: true, label: 'Nunca comprou' },
        ],
        groups: [],
      },
      exclusions: [],
      resultCount: 67,
      createdBy: 'sistema',
      createdAt: d(15),
      updatedAt: d(3),
      lastCalculatedAt: d(3),
    },
    {
      id: 'sl-template-sp-customers',
      storeId,
      name: 'Clientes São Paulo',
      description: 'Clientes do estado de SP',
      type: 'DYNAMIC',
      status: 'ACTIVE',
      visibilityScope: 'TEAM',
      isFavorite: false,
      rules: {
        id: 'g4',
        logic: 'ALL',
        rules: [
          { id: 'r7', field: 'customer.state', operator: 'equals', value: 'SP', label: 'Estado = SP' },
        ],
        groups: [],
      },
      exclusions: [],
      resultCount: 89,
      createdBy: 'sistema',
      createdAt: d(10),
      updatedAt: d(5),
      lastCalculatedAt: d(5),
    },
  ]
}

function buildDefaultCampaigns(storeId: number): Campaign[] {
  const now = new Date()
  const d = (days: number) => new Date(now.getTime() - days * 86_400_000)

  const perf = (
    campaignId: string,
    targeted: number,
    eligible: number,
    sent: number,
    delivered: number,
    read: number,
    failed: number,
    orders: number,
    revenue: number,
    cost: number,
  ): CampaignPerformance => ({
    id: `perf-${campaignId}`,
    campaignId,
    totalTargeted: targeted,
    totalEligible: eligible,
    totalSent: sent,
    totalAccepted: sent,
    totalDelivered: delivered,
    totalRead: read,
    totalFailed: failed,
    totalReplied: Math.floor(read * 0.08),
    totalOrders: orders,
    totalRevenue: revenue,
    totalCost: cost,
    roi: cost > 0 ? Math.round(((revenue - cost) / cost) * 100) / 100 : 0,
    updatedAt: d(0),
  })

  return [
    {
      id: 'camp-1',
      storeId,
      name: 'Black Friday 2025 – VIP',
      description: 'Campanha exclusiva para clientes VIP com oferta especial Black Friday',
      status: 'COMPLETED',
      audienceSourceType: 'SMART_LIST',
      smartListId: 'sl-template-vip',
      wabaId: '9988776655',
      phoneNumberId: '109876543210',
      connectionId: 'conn-1',
      whatsappTemplateId: 'tpl-1',
      templateName: 'black_friday_vip',
      templateCategory: 'MARKETING',
      templateLanguage: 'pt_BR',
      templateVariables: { customerName: '{{customerName}}', discount: '20%' },
      scheduledAt: d(14),
      startedAt: d(14),
      finishedAt: d(13),
      createdBy: 'Admin',
      pricingSnapshotId: 'pricing-br-marketing-v1',
      estimatedAudienceCount: 48,
      eligibleAudienceCount: 45,
      excludedCount: 3,
      invalidCount: 0,
      estimatedUnitCost: 0.32,
      estimatedTotalCost: 14.40,
      actualDeliveredCount: 43,
      actualTotalCost: 13.76,
      attributedOrderCount: 11,
      attributedRevenue: 8420.0,
      attributionWindowDays: 7,
      roi: 611.05,
      createdAt: d(15),
      updatedAt: d(13),
      performance: perf('camp-1', 48, 45, 45, 43, 29, 2, 11, 8420, 13.76),
      timeline: [
        { id: 't1-1', campaignId: 'camp-1', event: 'CREATED', description: 'Campanha criada', occurredAt: d(15) },
        { id: 't1-2', campaignId: 'camp-1', event: 'SCHEDULED', description: 'Agendada para envio', occurredAt: d(15) },
        { id: 't1-3', campaignId: 'camp-1', event: 'STARTED', description: 'Envio iniciado', occurredAt: d(14) },
        { id: 't1-4', campaignId: 'camp-1', event: 'COMPLETED', description: 'Envio concluído', occurredAt: d(13) },
      ],
      recipients: [],
    },
    {
      id: 'camp-2',
      storeId,
      name: 'Reativação – Inativos 30 dias',
      description: 'Reconquiste clientes que não compram há mais de 30 dias',
      status: 'COMPLETED',
      audienceSourceType: 'SMART_LIST',
      smartListId: 'sl-template-inactive-30',
      wabaId: '9988776655',
      phoneNumberId: '109876543210',
      connectionId: 'conn-1',
      whatsappTemplateId: 'tpl-5',
      templateName: 'reactivation_30days',
      templateCategory: 'MARKETING',
      templateLanguage: 'pt_BR',
      templateVariables: { customerName: '{{customerName}}', cartValue: 'R$ 0,00' },
      scheduledAt: d(7),
      startedAt: d(7),
      finishedAt: d(6),
      createdBy: 'Admin',
      pricingSnapshotId: 'pricing-br-marketing-v1',
      estimatedAudienceCount: 134,
      eligibleAudienceCount: 128,
      excludedCount: 6,
      invalidCount: 4,
      estimatedUnitCost: 0.32,
      estimatedTotalCost: 40.96,
      actualDeliveredCount: 121,
      actualTotalCost: 38.72,
      attributedOrderCount: 18,
      attributedRevenue: 14260.0,
      attributionWindowDays: 7,
      roi: 368.21,
      createdAt: d(8),
      updatedAt: d(6),
      performance: perf('camp-2', 134, 128, 128, 121, 74, 7, 18, 14260, 38.72),
      timeline: [
        { id: 't2-1', campaignId: 'camp-2', event: 'CREATED', description: 'Campanha criada', occurredAt: d(8) },
        { id: 't2-2', campaignId: 'camp-2', event: 'STARTED', description: 'Envio iniciado', occurredAt: d(7) },
        { id: 't2-3', campaignId: 'camp-2', event: 'COMPLETED', description: 'Envio concluído', occurredAt: d(6) },
      ],
      recipients: [],
    },
    {
      id: 'camp-3',
      storeId,
      name: 'Boas-vindas – Aprovados sem Compra',
      description: 'Incentivo para primeira compra de clientes aprovados',
      status: 'DRAFT',
      audienceSourceType: 'SMART_LIST',
      smartListId: 'sl-template-approved-no-purchase',
      wabaId: '9988776655',
      phoneNumberId: '109876543210',
      connectionId: 'conn-1',
      whatsappTemplateId: 'tpl-1',
      templateName: 'welcome_first_purchase',
      templateCategory: 'MARKETING',
      templateLanguage: 'pt_BR',
      templateVariables: { customerName: '{{customerName}}' },
      scheduledAt: null,
      startedAt: null,
      finishedAt: null,
      createdBy: 'Admin',
      pricingSnapshotId: 'pricing-br-marketing-v1',
      estimatedAudienceCount: 67,
      eligibleAudienceCount: 64,
      excludedCount: 3,
      invalidCount: 2,
      estimatedUnitCost: 0.32,
      estimatedTotalCost: 20.48,
      actualDeliveredCount: 0,
      actualTotalCost: 0,
      attributedOrderCount: 0,
      attributedRevenue: 0,
      attributionWindowDays: 7,
      roi: 0,
      createdAt: d(2),
      updatedAt: d(1),
      performance: null,
      timeline: [
        { id: 't3-1', campaignId: 'camp-3', event: 'CREATED', description: 'Campanha criada', occurredAt: d(2) },
      ],
      recipients: [],
    },
  ]
}

export function loadFromDisk(): CampaignsPersistedData | null {
  try {
    ensureDir()
    if (!fs.existsSync(DATA_FILE)) return null
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return rehydrateDates(JSON.parse(raw) as CampaignsPersistedData)
  } catch (e) {
    console.error('[Campaigns] Failed to load persisted data:', e)
    return null
  }
}

export function saveToDisk(data: CampaignsPersistedData): void {
  ensureDir()
  const tmp = `${DATA_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, DATA_FILE)
}

export function getOrCreateData(storeId: number): CampaignsPersistedData {
  const saved = loadFromDisk()
  if (saved && saved.seeded) return saved

  const initial: CampaignsPersistedData = {
    smartLists: buildDefaultSmartLists(storeId),
    campaigns: buildDefaultCampaigns(storeId),
    pricingSnapshots: buildDefaultPricingSnapshots(),
    seeded: true,
  }
  saveToDisk(initial)
  return initial
}
