'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { checkUserPermission } from '@/lib/actions/permissions'
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

type DispatchOrderMessageInput = {
  orderId: string
  trigger: MessageTemplate['trigger']
  channel: MessageTemplate['channel']
}

type DispatchCartMessageInput = {
  cartId: string
  trigger: MessageTemplate['trigger']
  channel: MessageTemplate['channel']
}

type DispatchPaymentLinkMessageInput = {
  paymentLinkId: number | string
  trigger: Extract<MessageTemplate['trigger'], 'PAYMENT_LINK_CREATED' | 'PAYMENT_LINK_REMINDER'>
  channel: Extract<MessageTemplate['channel'], 'WHATSAPP' | 'EMAIL'>
  storefrontBaseUrl?: string
}

type DispatchOrderMessageResult = {
  success: boolean
  message: string
  channel: string
  recipient: string
  renderedMessage: string
  whatsappUrl?: string | null
}

type DispatchCartMessageResult = {
  success: boolean
  message: string
  channel: string
  recipient: string
  renderedMessage: string
  whatsappUrl?: string | null
}

type DispatchPaymentLinkMessageResult = {
  success: boolean
  message: string
  channel: string
  recipient: string
  renderedMessage: string
  whatsappUrl?: string | null
}

async function hasMessagingPermission(permissionCode: string): Promise<boolean> {
  try {
    const result = await checkUserPermission(permissionCode)
    return result?.has_permission === true
  } catch {
    return false
  }
}

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
  const text = await response.text().catch(() => '')
  if (!text) return fallback

  try {
    const payload = JSON.parse(text) as { message?: string; error?: string }
    if (payload?.message && typeof payload.message === 'string') return payload.message
    if (payload?.error && typeof payload.error === 'string') return payload.error
  } catch {
    // Body is not JSON; return raw text below.
  }

  if (text.trim()) return text
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
    copyEmails: raw.copyEmails ? String(raw.copyEmails) : undefined,
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
    copyEmails: template.copyEmails || null,
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
  if (!(await hasMessagingPermission('messaging.view'))) {
    return { success: false, error: 'Você não tem permissão para visualizar mensageria' }
  }

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
  if (!(await hasMessagingPermission('messaging.manage_settings'))) {
    return { success: false, error: 'Você não tem permissão para gerenciar configurações de mensageria' }
  }

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
  if (!(await hasMessagingPermission('messaging.manage_templates'))) {
    return { success: false, error: 'Você não tem permissão para gerenciar templates de mensageria' }
  }

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
  if (!(await hasMessagingPermission('messaging.manage_templates'))) {
    return { success: false, error: 'Você não tem permissão para gerenciar templates de mensageria' }
  }

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
  if (!(await hasMessagingPermission('messaging.manage_templates'))) {
    return { success: false, error: 'Você não tem permissão para gerenciar templates de mensageria' }
  }

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
  if (!(await hasMessagingPermission('messaging.manage_templates'))) {
    return { success: false, error: 'Você não tem permissão para gerenciar templates de mensageria' }
  }

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
  if (!(await hasMessagingPermission('messaging.manage_templates'))) {
    return { success: false, error: 'Você não tem permissão para gerenciar templates de mensageria' }
  }

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
  if (!(await hasMessagingPermission('messaging.manage_templates'))) {
    return { success: false, error: 'Você não tem permissão para gerenciar templates de mensageria' }
  }

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
  if (!(await hasMessagingPermission('messaging.manage_templates'))) {
    return { success: false, error: 'Você não tem permissão para gerenciar templates de mensageria' }
  }

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
  if (!(await hasMessagingPermission('messaging.manage_templates'))) {
    return { success: false, error: 'Você não tem permissão para gerenciar templates de mensageria' }
  }

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

export async function dispatchOrderMessageAction(
  input: DispatchOrderMessageInput,
): Promise<ApiResponse<DispatchOrderMessageResult>> {
  if (!(await hasMessagingPermission('messaging.send'))) {
    return { success: false, error: 'Você não tem permissão para enviar mensagens' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/orders/${encodeURIComponent(String(input.orderId))}/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        trigger: input.trigger,
        channel: input.channel,
      }),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao disparar mensagem do pedido')
      return { success: false, error }
    }

    const payload = (await response.json()) as Record<string, unknown>
    return {
      success: true,
      data: {
        success: Boolean(payload.success),
        message: String(payload.message || ''),
        channel: String(payload.channel || ''),
        recipient: String(payload.recipient || ''),
        renderedMessage: String(payload.renderedMessage || ''),
        whatsappUrl: payload.whatsappUrl ? String(payload.whatsappUrl) : null,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao disparar mensagem do pedido',
    }
  }
}

export async function dispatchCartMessageAction(
  input: DispatchCartMessageInput,
): Promise<ApiResponse<DispatchCartMessageResult>> {
  if (!(await hasMessagingPermission('messaging.send'))) {
    return { success: false, error: 'Você não tem permissão para enviar mensagens' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(`${baseUrl}/messaging/carts/${encodeURIComponent(String(input.cartId))}/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        trigger: input.trigger,
        channel: input.channel,
      }),
    })

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao disparar mensagem do carrinho')
      return { success: false, error }
    }

    const payload = (await response.json()) as Record<string, unknown>
    return {
      success: true,
      data: {
        success: Boolean(payload.success),
        message: String(payload.message || ''),
        channel: String(payload.channel || ''),
        recipient: String(payload.recipient || ''),
        renderedMessage: String(payload.renderedMessage || ''),
        whatsappUrl: payload.whatsappUrl ? String(payload.whatsappUrl) : null,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao disparar mensagem do carrinho',
    }
  }
}

export async function dispatchPaymentLinkMessageAction(
  input: DispatchPaymentLinkMessageInput,
): Promise<ApiResponse<DispatchPaymentLinkMessageResult>> {
  if (!(await hasMessagingPermission('messaging.send'))) {
    return { success: false, error: 'Você não tem permissão para enviar mensagens' }
  }

  const baseUrl = resolveBackendBaseUrl()
  if (!baseUrl) return { success: false, error: 'Backend URL não configurado' }

  const numericId = Number(input.paymentLinkId)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { success: false, error: 'Link de pagamento inválido' }
  }

  try {
    const cookieHeader = await buildAdminCookieHeader()
    const response = await fetch(
      `${baseUrl}/messaging/payment-links/${encodeURIComponent(String(Math.trunc(numericId)))}/dispatch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        body: JSON.stringify({
          trigger: input.trigger,
          channel: input.channel,
          storefrontBaseUrl: input.storefrontBaseUrl || undefined,
        }),
      },
    )

    if (!response.ok) {
      const error = await readBackendErrorMessage(response, 'Erro ao disparar mensagem do link de pagamento')
      return { success: false, error }
    }

    const payload = (await response.json()) as Record<string, unknown>
    return {
      success: true,
      data: {
        success: Boolean(payload.success),
        message: String(payload.message || ''),
        channel: String(payload.channel || ''),
        recipient: String(payload.recipient || ''),
        renderedMessage: String(payload.renderedMessage || ''),
        whatsappUrl: payload.whatsappUrl ? String(payload.whatsappUrl) : null,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao disparar mensagem do link de pagamento',
    }
  }
}
