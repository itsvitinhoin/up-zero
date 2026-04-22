'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type {
  ApiResponse,
  FlowAction,
  FlowCondition,
  MessageFlow,
  MessageTemplate,
  WhatsAppConfig,
} from '@/lib/types'

type MessagingOverview = {
  whatsappConfig: WhatsAppConfig
  templates: MessageTemplate[]
  flows: MessageFlow[]
}

type MessageTemplateInput = Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>
type MessageFlowInput = Omit<MessageFlow, 'id' | 'createdAt' | 'updatedAt'>

function resolveBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

async function buildAdminCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const adminAuthToken = cookieStore.get('adminAuthToken')?.value
  if (!adminAuthToken) return undefined
  return `adminAuthToken=${adminAuthToken}`
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

function mapWhatsAppConfig(raw: Record<string, unknown>): WhatsAppConfig {
  return {
    isEnabled: Boolean(raw.isEnabled),
    provider: 'META_CLOUD',
    phoneNumberId: String(raw.phoneNumberId || ''),
    accessToken: String(raw.accessToken || ''),
    businessAccountId: String(raw.businessAccountId || ''),
    webhookVerifyToken: String(raw.webhookVerifyToken || ''),
    isConnected: Boolean(raw.isConnected),
    connectedAt: raw.connectedAt ? new Date(String(raw.connectedAt)) : null,
  }
}

function mapCondition(raw: Record<string, unknown>): FlowCondition {
  const valueRaw = raw.value
  let value: string | number | boolean | null = null
  if (typeof valueRaw === 'string' || typeof valueRaw === 'number' || typeof valueRaw === 'boolean') {
    value = valueRaw
  }

  return {
    id: String(raw.id || `cond_${Date.now()}_${Math.random()}`),
    type: String(raw.type || 'CUSTOMER_STATUS') as FlowCondition['type'],
    operator: String(raw.operator || 'EQUALS') as FlowCondition['operator'],
    value,
  }
}

function mapAction(raw: Record<string, unknown>): FlowAction {
  return {
    id: String(raw.id || `act_${Date.now()}_${Math.random()}`),
    type: String(raw.type || 'SEND_WHATSAPP') as FlowAction['type'],
    config: (raw.config && typeof raw.config === 'object')
      ? (raw.config as FlowAction['config'])
      : {},
  }
}

function mapTemplate(raw: Record<string, unknown>): MessageTemplate {
  return {
    id: String(raw.id || ''),
    name: String(raw.name || ''),
    trigger: String(raw.trigger || 'CUSTOMER_REGISTERED') as MessageTemplate['trigger'],
    isActive: Boolean(raw.isActive),
    channel: String(raw.channel || 'WHATSAPP') as MessageTemplate['channel'],
    content: String(raw.content || ''),
    variables: Array.isArray(raw.variables) ? raw.variables.map((item) => String(item)) : [],
    delayMinutes: Number(raw.delayMinutes || 0),
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    updatedAt: raw.updatedAt ? new Date(String(raw.updatedAt)) : new Date(),
  }
}

function mapFlow(raw: Record<string, unknown>): MessageFlow {
  const stepsRaw = Array.isArray(raw.steps) ? raw.steps : []

  return {
    id: String(raw.id || ''),
    name: String(raw.name || ''),
    description: raw.description ? String(raw.description) : null,
    trigger: String(raw.trigger || 'CUSTOMER_REGISTERED') as MessageFlow['trigger'],
    isActive: Boolean(raw.isActive),
    steps: stepsRaw.map((step) => {
      const stepObj = (step && typeof step === 'object') ? (step as Record<string, unknown>) : {}
      const conditionsRaw = Array.isArray(stepObj.conditions) ? stepObj.conditions : []
      const actionsRaw = Array.isArray(stepObj.actions) ? stepObj.actions : []

      return {
        id: String(stepObj.id || `step_${Date.now()}_${Math.random()}`),
        name: String(stepObj.name || 'Passo'),
        conditions: conditionsRaw.map((condition) => mapCondition((condition as Record<string, unknown>) || {})),
        conditionLogic: String(stepObj.conditionLogic || 'AND') as 'AND' | 'OR',
        actions: actionsRaw.map((action) => mapAction((action as Record<string, unknown>) || {})),
        nextStepId: stepObj.nextStepId ? String(stepObj.nextStepId) : null,
      }
    }),
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    updatedAt: raw.updatedAt ? new Date(String(raw.updatedAt)) : new Date(),
  }
}

function normalizeTemplatePayload(template: MessageTemplateInput) {
  return {
    name: template.name,
    trigger: template.trigger,
    isActive: template.isActive,
    channel: template.channel,
    content: template.content,
    variables: template.variables,
    delayMinutes: template.delayMinutes,
  }
}

function normalizeFlowPayload(flow: MessageFlowInput) {
  return {
    name: flow.name,
    description: flow.description,
    trigger: flow.trigger,
    isActive: flow.isActive,
    steps: flow.steps.map((step) => ({
      id: step.id,
      name: step.name,
      conditionLogic: step.conditionLogic,
      nextStepId: step.nextStepId,
      conditions: step.conditions.map((condition) => ({
        id: condition.id,
        type: condition.type,
        operator: condition.operator,
        value: condition.value,
      })),
      actions: step.actions.map((action) => ({
        id: action.id,
        type: action.type,
        config: action.config,
      })),
    })),
  }
}

export async function getMensageriaOverviewAction(): Promise<ApiResponse<MessagingOverview>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieHeader = await buildAdminCookieHeader()

    const [configResponse, templatesResponse, flowsResponse] = await Promise.all([
      fetch(`${baseUrl}/messaging/config`, {
        headers: {
          'Content-Type': 'application/json',
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      }),
      fetch(`${baseUrl}/messaging/templates`, {
        headers: {
          'Content-Type': 'application/json',
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      }),
      fetch(`${baseUrl}/messaging/flows`, {
        headers: {
          'Content-Type': 'application/json',
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
      }),
    ])

    if (!configResponse.ok || !templatesResponse.ok || !flowsResponse.ok) {
      const error = await readBackendErrorMessage(configResponse, 'Erro ao carregar mensageria')
      return { success: false, error }
    }

    const configRaw = (await configResponse.json()) as Record<string, unknown>
    const templatesRaw = (await templatesResponse.json()) as Record<string, unknown>[]
    const flowsRaw = (await flowsResponse.json()) as Record<string, unknown>[]

    return {
      success: true,
      data: {
        whatsappConfig: mapWhatsAppConfig(configRaw),
        templates: templatesRaw.map(mapTemplate),
        flows: flowsRaw.map(mapFlow),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao carregar mensageria',
    }
  }
}

export async function upsertWhatsAppConfigAction(config: WhatsAppConfig): Promise<ApiResponse<WhatsAppConfig>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  try {
    const cookieHeader = await buildAdminCookieHeader()

    const response = await fetch(`${baseUrl}/messaging/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        isEnabled: config.isEnabled,
        provider: config.provider,
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        businessAccountId: config.businessAccountId,
        webhookVerifyToken: config.webhookVerifyToken,
        isConnected: config.isConnected,
      }),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao salvar configuração do WhatsApp')
      return { success: false, error }
    }

    const payload = (await response.json()) as Record<string, unknown>
    revalidatePath('/mensageria')
    return { success: true, data: mapWhatsAppConfig(payload) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao salvar configuração do WhatsApp',
    }
  }
}

export async function createMessageTemplateAction(template: MessageTemplateInput): Promise<ApiResponse<MessageTemplate>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(normalizeTemplatePayload(template)),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao criar mensagem automática')
      return { success: false, error }
    }

    const payload = (await response.json()) as Record<string, unknown>
    revalidatePath('/mensageria')
    return { success: true, data: mapTemplate(payload) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao criar mensagem' }
  }
}

export async function updateMessageTemplateAction(id: string, template: MessageTemplateInput): Promise<ApiResponse<MessageTemplate>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/templates/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(normalizeTemplatePayload(template)),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao atualizar mensagem automática')
      return { success: false, error }
    }

    const payload = (await response.json()) as Record<string, unknown>
    revalidatePath('/mensageria')
    return { success: true, data: mapTemplate(payload) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar mensagem' }
  }
}

export async function deleteMessageTemplateAction(id: string): Promise<ApiResponse<null>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/templates/${id}`, {
      method: 'DELETE',
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao remover mensagem automática')
      return { success: false, error }
    }

    revalidatePath('/mensageria')
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao remover mensagem' }
  }
}

export async function toggleMessageTemplateAction(id: string, isActive: boolean): Promise<ApiResponse<null>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/templates/${id}/toggle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ isActive }),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao alterar status da mensagem automática')
      return { success: false, error }
    }

    revalidatePath('/mensageria')
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao alterar status da mensagem' }
  }
}

export async function createMessageFlowAction(flow: MessageFlowInput): Promise<ApiResponse<MessageFlow>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/flows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(normalizeFlowPayload(flow)),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao criar fluxo de automação')
      return { success: false, error }
    }

    const payload = (await response.json()) as Record<string, unknown>
    revalidatePath('/mensageria')
    return { success: true, data: mapFlow(payload) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao criar fluxo' }
  }
}

export async function updateMessageFlowAction(id: string, flow: MessageFlowInput): Promise<ApiResponse<MessageFlow>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/flows/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(normalizeFlowPayload(flow)),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao atualizar fluxo de automação')
      return { success: false, error }
    }

    const payload = (await response.json()) as Record<string, unknown>
    revalidatePath('/mensageria')
    return { success: true, data: mapFlow(payload) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar fluxo' }
  }
}

export async function deleteMessageFlowAction(id: string): Promise<ApiResponse<null>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/flows/${id}`, {
      method: 'DELETE',
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao remover fluxo de automação')
      return { success: false, error }
    }

    revalidatePath('/mensageria')
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao remover fluxo' }
  }
}

export async function toggleMessageFlowAction(id: string, isActive: boolean): Promise<ApiResponse<null>> {
  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/flows/${id}/toggle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ isActive }),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao alterar status do fluxo')
      return { success: false, error }
    }

    revalidatePath('/mensageria')
    return { success: true, data: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao alterar status do fluxo' }
  }
}
