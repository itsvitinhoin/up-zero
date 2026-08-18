'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/lib/types'
import type {
  B2CDistributionSettings,
  B2CLead,
  B2CLeadReseller,
  B2CLeadStatus,
  B2CResellerDataSource,
} from '@/lib/b2c-leads/types'
import { hasAdminPermission } from '@/lib/server-admin-permissions'

function sandboxBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

async function sandboxCookieHeader(): Promise<string> {
  const cookieStore = await cookies()
  const token = cookieStore.get('adminAuthToken')?.value
  return token ? `adminAuthToken=${token}` : ''
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null
  return payload?.message || payload?.error || fallback
}

export async function getB2CLeadsAction(): Promise<ApiResponse<B2CLead[]>> {
  if (!await hasAdminPermission('customers.view')) return { success: false, error: 'Acesso não autorizado aos dados B2C.' }
  const base = sandboxBaseUrl()
  if (!base) return { success: false, error: 'O protótipo B2C está disponível somente no sandbox local.' }

  const cookie = await sandboxCookieHeader()
  try {
    const response = await fetch(`${base}/b2c/leads?store_id=1043`, {
      headers: cookie ? { cookie } : {},
      cache: 'no-store',
    })
    if (!response.ok) return { success: false, error: await readError(response, 'Erro ao carregar leads B2C') }
    return { success: true, data: await response.json() as B2CLead[] }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar leads B2C' }
  }
}

export async function getB2CSettingsAction(): Promise<ApiResponse<B2CDistributionSettings>> {
  if (!await hasAdminPermission('settings.view')) return { success: false, error: 'Acesso não autorizado às configurações B2C.' }
  const base = sandboxBaseUrl()
  if (!base) return { success: false, error: 'As configurações B2C estão disponíveis somente no sandbox local.' }

  const cookie = await sandboxCookieHeader()
  try {
    const response = await fetch(`${base}/b2c/settings?store_id=1043`, {
      headers: cookie ? { cookie } : {},
      cache: 'no-store',
    })
    if (!response.ok) return { success: false, error: await readError(response, 'Erro ao carregar configurações B2C') }
    return { success: true, data: await response.json() as B2CDistributionSettings }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar configurações B2C' }
  }
}

export async function getB2CResellerSourceAction(): Promise<ApiResponse<B2CResellerDataSource>> {
  if (!await hasAdminPermission('customers.view')) return { success: false, error: 'Acesso não autorizado aos revendedores B2C.' }
  const base = sandboxBaseUrl()
  if (!base) return { success: false, error: 'A fonte segura de revendedores está disponível somente no sandbox local.' }

  const cookie = await sandboxCookieHeader()
  try {
    const response = await fetch(`${base}/b2c/resellers?store_id=1043`, {
      headers: cookie ? { cookie } : {},
      cache: 'no-store',
    })
    if (!response.ok) return { success: false, error: await readError(response, 'Erro ao carregar revendedores B2C') }
    return { success: true, data: await response.json() as B2CResellerDataSource }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar revendedores B2C' }
  }
}

export async function syncB2CResellerSourceAction(): Promise<ApiResponse<Omit<B2CResellerDataSource, 'resellers' | 'error'>>> {
  if (!await hasAdminPermission('settings.edit')) return { success: false, error: 'Você não possui permissão para sincronizar revendedores.' }
  const base = sandboxBaseUrl()
  if (!base) return { success: false, error: 'A sincronização segura está disponível somente no sandbox local.' }

  const cookie = await sandboxCookieHeader()
  try {
    const response = await fetch(`${base}/b2c/resellers/sync`, {
      method: 'POST',
      headers: cookie ? { cookie } : {},
      cache: 'no-store',
    })
    if (!response.ok) return { success: false, error: await readError(response, 'Erro ao sincronizar revendedores') }
    revalidatePath('/settings/b2c')
    revalidatePath('/b2c')
    revalidatePath('/b2c-orders')
    return { success: true, data: await response.json() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao sincronizar revendedores' }
  }
}

export async function updateB2CSettingsAction(
  settings: B2CDistributionSettings,
): Promise<ApiResponse<B2CDistributionSettings>> {
  if (!await hasAdminPermission('settings.edit')) return { success: false, error: 'Você não possui permissão para alterar as configurações B2C.' }
  const base = sandboxBaseUrl()
  if (!base) return { success: false, error: 'As configurações B2C estão disponíveis somente no sandbox local.' }

  const cookie = await sandboxCookieHeader()
  try {
    const response = await fetch(`${base}/b2c/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(settings),
      cache: 'no-store',
    })
    if (!response.ok) return { success: false, error: await readError(response, 'Erro ao salvar configurações B2C') }
    const data = await response.json() as B2CDistributionSettings
    revalidatePath('/b2c')
    revalidatePath('/b2c-orders')
    revalidatePath('/settings/b2c')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao salvar configurações B2C' }
  }
}

export async function assignB2CLeadAction(input: {
  leadId: string
  reseller: B2CLeadReseller
  mode: 'AUTO' | 'MANUAL'
}): Promise<ApiResponse<B2CLead>> {
  if (!await hasAdminPermission('orders.edit')) return { success: false, error: 'Você não possui permissão para distribuir pedidos B2C.' }
  const base = sandboxBaseUrl()
  if (!base) return { success: false, error: 'O protótipo B2C está disponível somente no sandbox local.' }

  const cookie = await sandboxCookieHeader()
  try {
    const response = await fetch(`${base}/b2c/leads/${encodeURIComponent(input.leadId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ action: 'ASSIGN', reseller: input.reseller, mode: input.mode }),
      cache: 'no-store',
    })
    if (!response.ok) return { success: false, error: await readError(response, 'Erro ao distribuir lead') }
    const data = await response.json() as B2CLead
    revalidatePath('/b2c')
    revalidatePath('/b2c-leads')
    revalidatePath('/b2c-orders')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao distribuir lead' }
  }
}

export async function updateB2CLeadStatusAction(input: {
  leadId: string
  status: B2CLeadStatus
  reason?: string
}): Promise<ApiResponse<B2CLead>> {
  if (!await hasAdminPermission('orders.edit')) return { success: false, error: 'Você não possui permissão para atualizar pedidos B2C.' }
  const base = sandboxBaseUrl()
  if (!base) return { success: false, error: 'O protótipo B2C está disponível somente no sandbox local.' }

  const cookie = await sandboxCookieHeader()
  try {
    const response = await fetch(`${base}/b2c/leads/${encodeURIComponent(input.leadId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ action: 'STATUS', status: input.status, reason: input.reason }),
      cache: 'no-store',
    })
    if (!response.ok) return { success: false, error: await readError(response, 'Erro ao atualizar lead') }
    const data = await response.json() as B2CLead
    revalidatePath('/b2c')
    revalidatePath('/b2c-leads')
    revalidatePath('/b2c-orders')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar lead' }
  }
}

export async function unassignB2CLeadAction(leadId: string): Promise<ApiResponse<B2CLead>> {
  if (!await hasAdminPermission('orders.edit')) return { success: false, error: 'Você não possui permissão para reatribuir pedidos B2C.' }
  const base = sandboxBaseUrl()
  if (!base) return { success: false, error: 'O protótipo B2C está disponível somente no sandbox local.' }

  const cookie = await sandboxCookieHeader()
  try {
    const response = await fetch(`${base}/b2c/leads/${encodeURIComponent(leadId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ action: 'UNASSIGN' }),
      cache: 'no-store',
    })
    if (!response.ok) return { success: false, error: await readError(response, 'Erro ao remover atribuição') }
    const data = await response.json() as B2CLead
    revalidatePath('/b2c')
    revalidatePath('/b2c-leads')
    revalidatePath('/b2c-orders')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao remover atribuição' }
  }
}
