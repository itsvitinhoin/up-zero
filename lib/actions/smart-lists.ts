'use server'

import { revalidatePath } from 'next/cache'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { getSmartList, getSmartLists, upsertSmartList } from '@/lib/campaigns/store'
import type { FilterGroup, FilterRule, SmartList, SmartListType, SmartListVisibility } from '@/lib/campaigns/types'

export async function getSmartListsAction(): Promise<{ success: boolean; data?: SmartList[]; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const lists = getSmartLists(id)
    return { success: true, data: lists }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function getSmartListAction(listId: string): Promise<{ success: boolean; data?: SmartList; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const list = getSmartList(listId, id)
    if (!list) return { success: false, error: 'Not found' }
    return { success: true, data: list }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function createSmartListAction(payload: {
  name: string
  description: string
  type: SmartListType
  visibilityScope: SmartListVisibility
  rules: FilterGroup
  exclusions: FilterRule[]
}): Promise<{ success: boolean; data?: SmartList; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const now = new Date()
    const list: SmartList = {
      id: `sl-${Date.now()}`,
      storeId: storeId ?? 1,
      name: payload.name,
      description: payload.description,
      type: payload.type,
      status: 'ACTIVE',
      visibilityScope: payload.visibilityScope,
      isFavorite: false,
      rules: payload.rules,
      exclusions: payload.exclusions,
      resultCount: 0,
      createdBy: 'admin',
      createdAt: now,
      updatedAt: now,
      lastCalculatedAt: null,
    }
    upsertSmartList(list)
    revalidatePath('/smart-lists')
    return { success: true, data: list }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function updateSmartListAction(
  listId: string,
  payload: Partial<SmartList>,
): Promise<{ success: boolean; data?: SmartList; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const existing = getSmartList(listId, id)
    if (!existing) return { success: false, error: 'Not found' }
    const updated: SmartList = { ...existing, ...payload, id: listId, storeId: id, updatedAt: new Date() }
    upsertSmartList(updated)
    revalidatePath('/smart-lists')
    revalidatePath(`/smart-lists/${listId}`)
    return { success: true, data: updated }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function deleteSmartListAction(listId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const { deleteSmartList } = await import('@/lib/campaigns/store')
    deleteSmartList(listId, id)
    revalidatePath('/smart-lists')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function toggleSmartListFavoriteAction(listId: string): Promise<{ success: boolean; data?: SmartList; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const { toggleSmartListFavorite } = await import('@/lib/campaigns/store')
    const updated = toggleSmartListFavorite(listId, id)
    if (!updated) return { success: false, error: 'Not found' }
    revalidatePath('/smart-lists')
    return { success: true, data: updated }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function archiveSmartListAction(listId: string): Promise<{ success: boolean; data?: SmartList; error?: string }> {
  try {
    const storeId = await getAdminStoreIdFromToken()
    const id = storeId ?? 1
    const { archiveSmartList } = await import('@/lib/campaigns/store')
    const updated = archiveSmartList(listId, id)
    if (!updated) return { success: false, error: 'Not found' }
    revalidatePath('/smart-lists')
    return { success: true, data: updated }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function previewSmartListAction(
  listId: string,
  rules?: FilterGroup,
  exclusions?: FilterRule[],
): Promise<{ success: boolean; data?: { count: number; sample: unknown[]; metrics: { totalRevenue: number; avgTicket: number; avgOrderCount: number } }; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/smart-lists/${listId}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules, exclusions }),
    })
    if (!res.ok) return { success: false, error: 'Preview failed' }
    const data = await res.json()
    return { success: true, data }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
