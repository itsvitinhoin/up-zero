'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export type ReceitaWSLookupResult = {
  companyName?: string
  tradeName?: string
  stateRegistration?: string
  segment?: string
  zipCode?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  phone?: string
  email?: string
}

function getStringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function getPrincipalActivity(raw: Record<string, unknown>): string | undefined {
  const activities = raw.atividade_principal
  if (!Array.isArray(activities)) return undefined

  for (const item of activities) {
    if (item && typeof item === 'object') {
      const text = getStringField(item as Record<string, unknown>, ['text'])
      if (text) return text
    }
  }

  return undefined
}

export async function lookupReceitaWSCnpjAction(
  cnpj: string,
): Promise<{ success: boolean; data?: ReceitaWSLookupResult; error?: string }> {
  const baseUrl = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim().replace(/\/$/, '')
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  const normalizedCnpj = cnpj.replace(/\D/g, '')
  if (normalizedCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido' }
  }

  try {
    const response = await fetch(`${baseUrl}/b2b/receitaws/${normalizedCnpj}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { success: false, error: text || `Erro ao consultar ReceitaWS: ${response.status}` }
    }

    const payload = (await response.json()) as { success?: boolean; data?: Record<string, unknown> }
    const raw = payload?.data
    if (!raw || typeof raw !== 'object') {
      return { success: false, error: 'Resposta inválida da ReceitaWS' }
    }

    return {
      success: true,
      data: {
        companyName: getStringField(raw, ['nome']),
        tradeName: getStringField(raw, ['fantasia', 'nome']),
        stateRegistration: getStringField(raw, ['ie', 'inscricao_estadual']),
        segment: getPrincipalActivity(raw),
        zipCode: getStringField(raw, ['cep'])?.replace(/\D/g, ''),
        street: getStringField(raw, ['logradouro']),
        number: getStringField(raw, ['numero']),
        complement: getStringField(raw, ['complemento']),
        neighborhood: getStringField(raw, ['bairro']),
        city: getStringField(raw, ['municipio']),
        state: getStringField(raw, ['uf'])?.toUpperCase(),
        phone: getStringField(raw, ['telefone'])?.replace(/\D/g, ''),
        email: getStringField(raw, ['email']),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao consultar ReceitaWS',
    }
  }
}

/**
 * Trigger ReceitaWS sync fully on Rust backend
 */
export async function updateCustomerWithReceitaWSAction(
  customerId: string,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim().replace(/\/$/, '')
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('adminAuthToken')?.value

    const response = await fetch(`${baseUrl}/b2b/${customerId}/receitaws`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { success: false, error: text || `Erro ao sincronizar ReceitaWS: ${response.status}` }
    }

    revalidatePath('/customers')
    revalidatePath(`/customers/${customerId}`)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar cliente',
    }
  }
}
