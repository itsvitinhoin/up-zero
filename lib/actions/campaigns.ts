'use server'

import { revalidatePath } from 'next/cache'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import {
  addCampaignTimelineEvent,
  deleteCampaign,
  getActivePricingSnapshot,
  getCampaign,
  getCampaigns,
  getPricingSnapshots,
  upsertCampaign,
} from '@/lib/campaigns/store'
import type {
  AudienceSourceType,
  AttributionWindow,
  Campaign,
  CampaignPricingSnapshot,
  CampaignStatus,
  MessageCategory,
} from '@/lib/campaigns/types'

export async function getCampaignsAction(): Promise<{ success: boolean; data?: Campaign[]; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const campaigns = getCampaigns(id)
    return { success: true, data: campaigns }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function getCampaignAction(campaignId: string): Promise<{ success: boolean; data?: Campaign; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const campaign = getCampaign(campaignId, id)
    if (!campaign) return { success: false, error: 'Not found' }
    return { success: true, data: campaign }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function createCampaignAction(payload: {
  name: string
  description: string
  audienceSourceType: AudienceSourceType
  smartListId: string | null
  connectionId: string
  wabaId: string
  phoneNumberId: string
  whatsappTemplateId: string
  templateName: string
  templateCategory: MessageCategory
  templateLanguage: string
  templateVariables: Record<string, string>
  scheduledAt: Date | null
  estimatedAudienceCount: number
  eligibleAudienceCount: number
  excludedCount: number
  invalidCount: number
  attributionWindowDays?: AttributionWindow
}): Promise<{ success: boolean; data?: Campaign; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1

    const snapshot = getActivePricingSnapshot('BR', payload.templateCategory)
    const unitCost = snapshot?.unitPrice ?? 0
    const totalCost = unitCost * payload.eligibleAudienceCount

    const now = new Date()
    const campaign: Campaign = {
      id: `camp-${Date.now()}`,
      storeId: id,
      name: payload.name,
      description: payload.description,
      status: 'DRAFT',
      audienceSourceType: payload.audienceSourceType,
      smartListId: payload.smartListId,
      wabaId: payload.wabaId,
      phoneNumberId: payload.phoneNumberId,
      connectionId: payload.connectionId,
      whatsappTemplateId: payload.whatsappTemplateId,
      templateName: payload.templateName,
      templateCategory: payload.templateCategory,
      templateLanguage: payload.templateLanguage,
      templateVariables: payload.templateVariables,
      scheduledAt: payload.scheduledAt,
      startedAt: null,
      finishedAt: null,
      createdBy: 'admin',
      pricingSnapshotId: snapshot?.id ?? '',
      estimatedAudienceCount: payload.estimatedAudienceCount,
      eligibleAudienceCount: payload.eligibleAudienceCount,
      excludedCount: payload.excludedCount,
      invalidCount: payload.invalidCount,
      estimatedUnitCost: unitCost,
      estimatedTotalCost: totalCost,
      actualDeliveredCount: 0,
      actualTotalCost: 0,
      attributedOrderCount: 0,
      attributedRevenue: 0,
      attributionWindowDays: payload.attributionWindowDays ?? 7,
      roi: 0,
      createdAt: now,
      updatedAt: now,
      performance: null,
      timeline: [
        {
          id: `tl-${Date.now()}`,
          campaignId: `camp-${Date.now()}`,
          event: 'CREATED',
          description: 'Campanha criada',
          occurredAt: now,
        },
      ],
      recipients: [],
    }

    upsertCampaign(campaign)
    revalidatePath('/campaigns')
    return { success: true, data: campaign }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function updateCampaignAction(
  campaignId: string,
  payload: Partial<Campaign>,
): Promise<{ success: boolean; data?: Campaign; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const existing = getCampaign(campaignId, id)
    if (!existing) return { success: false, error: 'Not found' }
    const updated: Campaign = {
      ...existing,
      ...payload,
      id: campaignId,
      storeId: id,
      updatedAt: new Date(),
    }
    upsertCampaign(updated)
    revalidatePath('/campaigns')
    revalidatePath(`/campaigns/${campaignId}`)
    return { success: true, data: updated }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function deleteCampaignAction(campaignId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const existing = getCampaign(campaignId, id)
    if (!existing) return { success: false, error: 'Not found' }
    if (existing.status === 'RUNNING') return { success: false, error: 'Não é possível excluir uma campanha em andamento' }
    deleteCampaign(campaignId, id)
    revalidatePath('/campaigns')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function sendCampaignNowAction(campaignId: string): Promise<{ success: boolean; data?: Campaign; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const existing = getCampaign(campaignId, id)
    if (!existing) return { success: false, error: 'Not found' }
    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(existing.status)) {
      return { success: false, error: 'Status inválido para envio' }
    }
    const now = new Date()
    const updated: Campaign = { ...existing, status: 'RUNNING', startedAt: now, updatedAt: now }
    upsertCampaign(updated)
    addCampaignTimelineEvent(campaignId, id, 'STARTED', 'Envio iniciado')
    revalidatePath('/campaigns')
    revalidatePath(`/campaigns/${campaignId}`)
    return { success: true, data: updated }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function scheduleCampaignAction(
  campaignId: string,
  scheduledAt: Date,
): Promise<{ success: boolean; data?: Campaign; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const existing = getCampaign(campaignId, id)
    if (!existing) return { success: false, error: 'Not found' }
    const now = new Date()
    const updated: Campaign = {
      ...existing,
      status: 'SCHEDULED',
      scheduledAt,
      updatedAt: now,
    }
    upsertCampaign(updated)
    addCampaignTimelineEvent(campaignId, id, 'SCHEDULED', 'Campanha agendada')
    revalidatePath('/campaigns')
    revalidatePath(`/campaigns/${campaignId}`)
    return { success: true, data: updated }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function pauseCampaignAction(campaignId: string): Promise<{ success: boolean; data?: Campaign; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const existing = getCampaign(campaignId, id)
    if (!existing) return { success: false, error: 'Not found' }
    const now = new Date()
    const updated: Campaign = { ...existing, status: 'PAUSED', updatedAt: now }
    upsertCampaign(updated)
    addCampaignTimelineEvent(campaignId, id, 'PAUSED', 'Campanha pausada')
    revalidatePath('/campaigns')
    revalidatePath(`/campaigns/${campaignId}`)
    return { success: true, data: updated }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function cancelCampaignAction(campaignId: string): Promise<{ success: boolean; data?: Campaign; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const existing = getCampaign(campaignId, id)
    if (!existing) return { success: false, error: 'Not found' }
    const now = new Date()
    const updated: Campaign = {
      ...existing,
      status: 'CANCELED',
      finishedAt: now,
      updatedAt: now,
    }
    upsertCampaign(updated)
    addCampaignTimelineEvent(campaignId, id, 'CANCELED', 'Campanha cancelada')
    revalidatePath('/campaigns')
    revalidatePath(`/campaigns/${campaignId}`)
    return { success: true, data: updated }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function getPricingSnapshotsAction(): Promise<{ success: boolean; data?: CampaignPricingSnapshot[]; error?: string }> {
  try {
    const snapshots = getPricingSnapshots()
    return { success: true, data: snapshots }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function estimateCampaignCostAction(
  category: MessageCategory,
  eligibleCount: number,
  market = 'BR',
): Promise<{ success: boolean; data?: { unitCost: number; totalCost: number; snapshotId: string; currency: string }; error?: string }> {
  try {
    const snapshot = getActivePricingSnapshot(market, category)
    if (!snapshot) return { success: false, error: 'Pricing not available for this market/category' }
    return {
      success: true,
      data: {
        unitCost: snapshot.unitPrice,
        totalCost: snapshot.unitPrice * eligibleCount,
        snapshotId: snapshot.id,
        currency: snapshot.currency,
      },
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
