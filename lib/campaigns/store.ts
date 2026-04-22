import { getOrCreateData, loadFromDisk, saveToDisk } from './persist'
import type {
  Campaign,
  CampaignPricingSnapshot,
  CampaignRecipient,
  CampaignTimelineEvent,
  MessageCategory,
  SmartList,
} from './types'

// Resolve storeId for seeding — falls back to env var
function resolveStoreId(storeId?: number): number {
  if (storeId && storeId > 0) return storeId
  const env = Number(process.env.STORE_ID)
  return Number.isInteger(env) && env > 0 ? env : 1
}

function read(storeId?: number) {
  const saved = loadFromDisk()
  if (saved && saved.seeded) return saved
  return getOrCreateData(resolveStoreId(storeId))
}

// ─── Smart List CRUD ──────────────────────────────────────────────────────────

export function getSmartLists(storeId: number): SmartList[] {
  return read(storeId).smartLists.filter((sl) => sl.storeId === storeId)
}

export function getSmartList(id: string, storeId: number): SmartList | undefined {
  return read(storeId).smartLists.find((sl) => sl.id === id && sl.storeId === storeId)
}

export function upsertSmartList(list: SmartList): void {
  const state = read(list.storeId)
  const idx = state.smartLists.findIndex((sl) => sl.id === list.id)
  if (idx >= 0) state.smartLists[idx] = list
  else state.smartLists.push(list)
  saveToDisk(state)
}

export function deleteSmartList(id: string, storeId: number): void {
  const state = read(storeId)
  state.smartLists = state.smartLists.filter((sl) => !(sl.id === id && sl.storeId === storeId))
  saveToDisk(state)
}

export function toggleSmartListFavorite(id: string, storeId: number): SmartList | null {
  const state = read(storeId)
  const idx = state.smartLists.findIndex((sl) => sl.id === id && sl.storeId === storeId)
  if (idx < 0) return null
  state.smartLists[idx] = {
    ...state.smartLists[idx],
    isFavorite: !state.smartLists[idx].isFavorite,
    updatedAt: new Date(),
  }
  saveToDisk(state)
  return state.smartLists[idx]
}

export function archiveSmartList(id: string, storeId: number): SmartList | null {
  const state = read(storeId)
  const idx = state.smartLists.findIndex((sl) => sl.id === id && sl.storeId === storeId)
  if (idx < 0) return null
  state.smartLists[idx] = {
    ...state.smartLists[idx],
    status: state.smartLists[idx].status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED',
    updatedAt: new Date(),
  }
  saveToDisk(state)
  return state.smartLists[idx]
}

export function updateSmartListResultCount(id: string, storeId: number, count: number): void {
  const state = read(storeId)
  const idx = state.smartLists.findIndex((sl) => sl.id === id && sl.storeId === storeId)
  if (idx < 0) return
  state.smartLists[idx] = {
    ...state.smartLists[idx],
    resultCount: count,
    lastCalculatedAt: new Date(),
    updatedAt: new Date(),
  }
  saveToDisk(state)
}

// ─── Campaign CRUD ────────────────────────────────────────────────────────────

export function getCampaigns(storeId: number): Campaign[] {
  return read(storeId).campaigns.filter((c) => c.storeId === storeId)
}

export function getCampaign(id: string, storeId: number): Campaign | undefined {
  return read(storeId).campaigns.find((c) => c.id === id && c.storeId === storeId)
}

export function upsertCampaign(campaign: Campaign): void {
  const state = read(campaign.storeId)
  const idx = state.campaigns.findIndex((c) => c.id === campaign.id)
  if (idx >= 0) state.campaigns[idx] = campaign
  else state.campaigns.push(campaign)
  saveToDisk(state)
}

export function deleteCampaign(id: string, storeId: number): void {
  const state = read(storeId)
  state.campaigns = state.campaigns.filter((c) => !(c.id === id && c.storeId === storeId))
  saveToDisk(state)
}

export function addCampaignTimelineEvent(
  campaignId: string,
  storeId: number,
  event: string,
  description: string,
): void {
  const state = read(storeId)
  const idx = state.campaigns.findIndex((c) => c.id === campaignId && c.storeId === storeId)
  if (idx < 0) return
  const tEvent: CampaignTimelineEvent = {
    id: `tl-${Date.now()}`,
    campaignId,
    event,
    description,
    occurredAt: new Date(),
  }
  state.campaigns[idx] = {
    ...state.campaigns[idx],
    timeline: [...(state.campaigns[idx].timeline ?? []), tEvent],
    updatedAt: new Date(),
  }
  saveToDisk(state)
}

export function updateCampaignRecipients(
  campaignId: string,
  storeId: number,
  recipients: CampaignRecipient[],
): void {
  const state = read(storeId)
  const idx = state.campaigns.findIndex((c) => c.id === campaignId && c.storeId === storeId)
  if (idx < 0) return
  state.campaigns[idx] = { ...state.campaigns[idx], recipients, updatedAt: new Date() }
  saveToDisk(state)
}

// ─── Pricing Snapshots ────────────────────────────────────────────────────────

export function getPricingSnapshots(market?: string): CampaignPricingSnapshot[] {
  const state = loadFromDisk() ?? getOrCreateData(1)
  const all = state.pricingSnapshots ?? []
  if (!market) return all
  return all.filter((ps) => ps.market === market)
}

export function getActivePricingSnapshot(
  market: string,
  category: MessageCategory,
): CampaignPricingSnapshot | undefined {
  const state = loadFromDisk() ?? getOrCreateData(1)
  const now = new Date()
  return (state.pricingSnapshots ?? [])
    .filter(
      (ps) =>
        ps.market === market &&
        ps.category === category &&
        new Date(ps.effectiveFrom) <= now &&
        (!ps.effectiveTo || new Date(ps.effectiveTo) >= now),
    )
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0]
}

export function upsertPricingSnapshot(snapshot: CampaignPricingSnapshot): void {
  const state = loadFromDisk() ?? getOrCreateData(1)
  const idx = (state.pricingSnapshots ?? []).findIndex((ps) => ps.id === snapshot.id)
  if (!state.pricingSnapshots) state.pricingSnapshots = []
  if (idx >= 0) state.pricingSnapshots[idx] = snapshot
  else state.pricingSnapshots.push(snapshot)
  saveToDisk(state)
}
