'use server'

import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import { checkUserPermission } from '@/lib/actions/permissions'

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------

export type FiscalNatureScope = 'INTRAESTADUAL' | 'INTERESTADUAL' | 'AMBOS'

export interface FiscalOperationNature {
  id: number
  store_id: number
  name: string
  active: boolean
  platforms: string[]
  person_types: string[]
  consumer_presence: number
  operation_type: string
  purpose: string
  /** Escopo geográfico: INTRAESTADUAL | INTERESTADUAL | AMBOS */
  scope: FiscalNatureScope
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FiscalOperationTaxRule {
  id: number
  operation_nature_id: number
  csosn: string | null
  cst_icms: string | null
  cfop: string | null
  icms_rate_bps: number
  icms_interstate_split_bps: number
  icms_base_mode: number
  icms_base_reduction_bps: number
  icms_st_rate_bps: number
  icms_st_base_mode: number
  icms_st_mva_bps: number
  cst_ipi: string | null
  ipi_rate_bps: number
  ipi_framework_code: string | null
  cst_pis: string | null
  pis_rate_bps: number
  pis_base_reduction_bps: number
  cst_cofins: string | null
  cofins_rate_bps: number
  cofins_base_reduction_bps: number
  cst_ibs: string | null
  ibs_rate_bps: number
  cst_cbs: string | null
  cbs_rate_bps: number
  created_at: string
  updated_at: string
}

export interface FiscalOperationStateException {
  id: number
  operation_nature_id: number
  states: string[]
  tax_type: string
  csosn: string | null
  cst: string | null
  cfop: string | null
  rate_bps: number | null
  internal_rate_bps: number | null
  interstate_split_bps: number | null
  st_mva_bps: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FiscalOperationNatureFull extends FiscalOperationNature {
  tax_rule: FiscalOperationTaxRule | null
  state_exceptions: FiscalOperationStateException[]
}

async function canEditSettings(): Promise<boolean> {
  try {
    const result = await checkUserPermission('settings.edit')
    return result?.has_permission === true
  } catch {
    return false
  }
}

async function ensureCanEditSettings(): Promise<{ success: false; error: string } | null> {
  if (await canEditSettings()) return null
  return { success: false, error: 'Você não tem permissão para editar configurações' }
}

export interface FiscalEmitter {
  id: number
  store_id: number
  name: string
  cnpj: string
  email: string | null
  phone: string | null
  address_zip: string | null
  address_street: string | null
  address_number: string | null
  address_complement: string | null
  address_neighborhood: string | null
  address_city: string | null
  address_state: string | null
  active: boolean
  meta: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface FiscalNatureEmitterLink {
  id: number
  operation_nature_id: number
  emitter_id: number
  active: boolean
  selection_mode: 'fixed' | 'round_robin' | 'weighted_random'
  priority: number
  weight: number
  created_at: string
  updated_at: string
}

export interface FiscalNatureEmitterLinkWithEmitter extends FiscalNatureEmitterLink {
  emitter: FiscalEmitter
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies()
  const token = cookieStore.get('adminAuthToken')?.value
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers['cookie'] = `adminAuthToken=${token}`
  return headers
}

function base(): string {
  return (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
}

// ---------------------------------------------------------------------------
// Naturezas
// ---------------------------------------------------------------------------

export async function getFiscalNaturesAction(): Promise<FiscalOperationNature[]> {
  const storeId = await getAdminStoreIdFromToken()
  const headers = await buildHeaders()
  const url = new URL('/fiscal/operation-natures', base())
  if (storeId) url.searchParams.set('store_id', String(storeId))

  const res = await fetch(url, { headers, next: { revalidate: 15 } })
  if (!res.ok) return []
  return res.json()
}

export async function getFiscalNatureFullAction(id: number): Promise<FiscalOperationNatureFull | null> {
  const headers = await buildHeaders()
  const res = await fetch(`${base()}/fiscal/operation-natures/${id}`, { headers, cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

export async function createFiscalNatureAction(data: {
  name: string
  active: boolean
  platforms: string[]
  person_types: string[]
  consumer_presence: number
  operation_type: string
  purpose: string
  scope: FiscalNatureScope
  notes: string
}): Promise<{ success: boolean; data?: FiscalOperationNature; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const storeId = await getAdminStoreIdFromToken()
  const headers = await buildHeaders()

  const res = await fetch(`${base()}/fiscal/operation-natures`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...data, store_id: storeId }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao criar natureza' }
  }
  const created = await res.json()
  return { success: true, data: created }
}

export async function updateFiscalNatureAction(id: number, data: {
  name?: string
  active?: boolean
  platforms?: string[]
  person_types?: string[]
  consumer_presence?: number
  operation_type?: string
  purpose?: string
  scope?: FiscalNatureScope
  notes?: string
}): Promise<{ success: boolean; data?: FiscalOperationNature; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const headers = await buildHeaders()

  const res = await fetch(`${base()}/fiscal/operation-natures/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao atualizar natureza' }
  }
  return { success: true, data: await res.json() }
}

export async function deleteFiscalNatureAction(id: number): Promise<{ success: boolean; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const headers = await buildHeaders()
  const res = await fetch(`${base()}/fiscal/operation-natures/${id}`, { method: 'DELETE', headers })
  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao excluir natureza' }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Regra tributária
// ---------------------------------------------------------------------------

export async function upsertTaxRuleAction(natureId: number, data: Partial<FiscalOperationTaxRule>): Promise<{ success: boolean; data?: FiscalOperationTaxRule; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const headers = await buildHeaders()

  const res = await fetch(`${base()}/fiscal/operation-natures/${natureId}/tax-rule`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao salvar regra tributária' }
  }
  return { success: true, data: await res.json() }
}

// ---------------------------------------------------------------------------
// Exceções por estado
// ---------------------------------------------------------------------------

export async function createStateExceptionAction(natureId: number, data: {
  states: string[]
  tax_type: string
  csosn?: string
  cst?: string
  cfop?: string
  rate_bps?: number
  internal_rate_bps?: number
  interstate_split_bps?: number
  st_mva_bps?: number
  notes?: string
}): Promise<{ success: boolean; data?: FiscalOperationStateException; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const headers = await buildHeaders()

  const res = await fetch(`${base()}/fiscal/operation-natures/${natureId}/state-exceptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao criar exceção' }
  }
  return { success: true, data: await res.json() }
}

export async function deleteStateExceptionAction(natureId: number, excId: number): Promise<{ success: boolean; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const headers = await buildHeaders()
  const res = await fetch(`${base()}/fiscal/operation-natures/${natureId}/state-exceptions/${excId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao excluir exceção' }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Emitentes fiscais
// ---------------------------------------------------------------------------

export async function getFiscalEmittersAction(): Promise<FiscalEmitter[]> {
  const storeId = await getAdminStoreIdFromToken()
  const headers = await buildHeaders()
  const url = new URL('/fiscal/emitters', base())
  if (storeId) url.searchParams.set('store_id', String(storeId))

  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export async function createFiscalEmitterAction(data: {
  name: string
  cnpj: string
  email?: string
  phone?: string
  address_zip?: string
  address_street?: string
  address_number?: string
  address_complement?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  active?: boolean
}): Promise<{ success: boolean; data?: FiscalEmitter; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const storeId = await getAdminStoreIdFromToken()
  const headers = await buildHeaders()

  const res = await fetch(`${base()}/fiscal/emitters`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...data,
      store_id: storeId,
      meta: {},
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao criar emitente' }
  }

  return { success: true, data: await res.json() }
}

export async function updateFiscalEmitterAction(id: number, data: {
  name?: string
  cnpj?: string
  email?: string
  phone?: string
  address_zip?: string
  address_street?: string
  address_number?: string
  address_complement?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  active?: boolean
}): Promise<{ success: boolean; data?: FiscalEmitter; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const headers = await buildHeaders()

  const res = await fetch(`${base()}/fiscal/emitters/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao atualizar emitente' }
  }

  return { success: true, data: await res.json() }
}

export async function deleteFiscalEmitterAction(id: number): Promise<{ success: boolean; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const headers = await buildHeaders()
  const res = await fetch(`${base()}/fiscal/emitters/${id}`, {
    method: 'DELETE',
    headers,
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao excluir emitente' }
  }

  return { success: true }
}

export async function getNatureEmittersAction(natureId: number): Promise<FiscalNatureEmitterLinkWithEmitter[]> {
  const headers = await buildHeaders()
  const res = await fetch(`${base()}/fiscal/operation-natures/${natureId}/emitters`, {
    headers,
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export async function upsertNatureEmittersAction(
  natureId: number,
  links: Array<{
    emitter_id: number
    active?: boolean
    selection_mode?: 'fixed' | 'round_robin' | 'weighted_random'
    priority?: number
    weight?: number
  }>
): Promise<{ success: boolean; data?: FiscalNatureEmitterLink[]; error?: string }> {
  const permissionError = await ensureCanEditSettings()
  if (permissionError) return permissionError

  const headers = await buildHeaders()
  const res = await fetch(`${base()}/fiscal/operation-natures/${natureId}/emitters`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(links),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: text || 'Erro ao salvar vínculos de emitentes' }
  }

  return { success: true, data: await res.json() }
}
