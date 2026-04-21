'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getAdminStoreIdFromToken } from '@/lib/auth'
import type { ApiResponse } from '@/lib/types'

interface B2bCustomer {
  id: number
  contact_name: string
  email: string
  phone: string
  company_name: string
  trade_name: string
  cnpj: string
  state_registration: string
  segment: string
  address_zip: string
  address_street: string
  address_number: string
  address_complement: string
  address_neighborhood: string
  address_city: string
  address_state: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  blocked: boolean
  newsletter_notification: boolean
  whatsapp_notification: boolean
  created_at: string
  updated_at: string
}

interface B2bUpdatePayload {
  contact_name?: string
  email?: string
  phone?: string
  company_name?: string
  trade_name?: string
  segment?: string
  address_zip?: string
  address_street?: string
  address_number?: string
  address_complement?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  blocked?: boolean
  newsletter_notification?: boolean
  whatsapp_notification?: boolean
}

function extractStoreId(customer: Record<string, unknown>): number | null {
  const parsed = Number(customer.store_id ?? customer.storeId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function resolveB2BBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function readBackendErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: string }
    if (payload?.message && typeof payload.message === 'string') return payload.message
    if (payload?.error && typeof payload.error === 'string') return payload.error
  } catch {
    const text = await response.text().catch(() => '')
    if (text) return text
  }
  return fallback
}

export async function listB2BCustomersAction(): Promise<ApiResponse<B2bCustomer[]>> {
  const baseUrl = resolveB2BBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value
    const scopedStoreId = await getAdminStoreIdFromToken()
    const params = new URLSearchParams()
    if (scopedStoreId) {
      params.set('store_id', String(scopedStoreId))
    }

    const response = await fetch(`${baseUrl}/b2b${params.toString() ? `?${params.toString()}` : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(
        response,
        `HTTP ${response.status}: Erro ao buscar clientes B2B`
      )
      return { success: false, error }
    }

    const customersRaw = (await response.json()) as Record<string, unknown>[]
    const customers = scopedStoreId
      ? customersRaw.filter((customer) => extractStoreId(customer) === scopedStoreId)
      : customersRaw

    return { success: true, data: customers as B2bCustomer[] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao listar clientes B2B',
    }
  }
}

export async function getB2BCustomerAction(id: number): Promise<ApiResponse<B2bCustomer>> {
  const baseUrl = resolveB2BBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/b2b/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, `HTTP ${response.status}: Cliente não encontrado`)
      return { success: false, error }
    }

    const customer = (await response.json()) as B2bCustomer
    return { success: true, data: customer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao buscar cliente B2B',
    }
  }
}

export async function updateB2BCustomerAction(
  id: number,
  payload: B2bUpdatePayload
): Promise<ApiResponse<B2bCustomer>> {
  const baseUrl = resolveB2BBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/b2b/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(
        response,
        `HTTP ${response.status}: Erro ao atualizar cliente B2B`
      )
      return { success: false, error }
    }

    const customer = (await response.json()) as B2bCustomer
    revalidatePath('/b2b-customers')
    return { success: true, data: customer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar cliente B2B',
    }
  }
}

export async function approveB2BCustomerAction(id: number): Promise<ApiResponse<B2bCustomer>> {
  return updateB2BCustomerAction(id, { blocked: false })
}

export async function rejectB2BCustomerAction(id: number): Promise<ApiResponse<B2bCustomer>> {
  return updateB2BCustomerAction(id, { blocked: true })
}

export async function blockB2BCustomerAction(id: number): Promise<ApiResponse<B2bCustomer>> {
  return updateB2BCustomerAction(id, { blocked: true })
}

export async function unblockB2BCustomerAction(id: number): Promise<ApiResponse<B2bCustomer>> {
  return updateB2BCustomerAction(id, { blocked: false })
}
