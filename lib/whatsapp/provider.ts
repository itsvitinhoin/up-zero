import type {
  MetaBusiness,
  SafeError,
  TemplateButton,
  TemplateComponent,
  WhatsAppBusinessAccount,
  WhatsAppPhoneNumber,
  WhatsAppTemplate,
} from './types'
import { sanitizeError } from './store'

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

interface GraphError {
  message: string
  type?: string
  code?: number
  error_subcode?: number
  fbtrace_id?: string
}

interface GraphResponse<T> {
  data?: T
  error?: GraphError
}

export interface MetaCallResult<T> {
  ok: boolean
  data?: T
  error?: SafeError
}

function systemToken() {
  return process.env.FACEBOOK_SYSTEM_USER_TOKEN?.trim() || ''
}

function noTokenError(): SafeError {
  return {
    message: 'FACEBOOK_SYSTEM_USER_TOKEN is not configured on the server.',
    action: 'Create a Meta System User token with business_management, whatsapp_business_management and whatsapp_business_messaging.',
  }
}

async function graphGet<T>(path: string): Promise<MetaCallResult<T>> {
  const token = systemToken()
  if (!token) return { ok: false, error: noTokenError() }

  try {
    const res = await fetch(`${GRAPH}${path}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = (await res.json().catch(() => ({}))) as GraphResponse<T>

    if (!res.ok || body.error) {
      return { ok: false, error: sanitizeError(body.error ?? `Meta HTTP ${res.status}`) }
    }

    return { ok: true, data: body.data as T }
  } catch (error) {
    return { ok: false, error: sanitizeError(error, 'Check server network access to graph.facebook.com.') }
  }
}

async function graphPost<T>(path: string, payload: Record<string, unknown>): Promise<MetaCallResult<T>> {
  const token = systemToken()
  if (!token) return { ok: false, error: noTokenError() }

  try {
    const res = await fetch(`${GRAPH}${path}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const body = (await res.json().catch(() => ({}))) as GraphResponse<T> & T

    if (!res.ok || body.error) {
      return { ok: false, error: sanitizeError(body.error ?? `Meta HTTP ${res.status}`) }
    }

    return { ok: true, data: body as T }
  } catch (error) {
    return { ok: false, error: sanitizeError(error, 'Check server network access to graph.facebook.com.') }
  }
}

export async function listBusinesses(): Promise<MetaCallResult<MetaBusiness[]>> {
  const result = await graphGet<Array<{ id: string; name?: string; verification_status?: string }>>('/me/businesses?fields=id,name,verification_status&limit=100')
  if (!result.ok) return { ok: false, error: result.error }

  return {
    ok: true,
    data: (result.data ?? []).map((business) => ({
      id: business.id,
      name: business.name || business.id,
      verificationStatus: business.verification_status,
    })),
  }
}

export async function listWabas(businessId: string): Promise<MetaCallResult<WhatsAppBusinessAccount[]>> {
  const fields = 'id,name,currency,timezone_id'
  const path = `/${businessId}/client_whatsapp_business_accounts?fields=${fields}&limit=100`
  const result = await graphGet<Array<{ id: string; name?: string; currency?: string; timezone_id?: string }>>(path)
  if (!result.ok) return { ok: false, error: result.error }

  return {
    ok: true,
    data: (result.data ?? []).map((waba) => ({
      id: waba.id,
      name: waba.name || waba.id,
      businessId,
      currency: waba.currency,
      timezoneId: waba.timezone_id,
    })),
  }
}

export async function listPhoneNumbers(wabaId: string): Promise<MetaCallResult<WhatsAppPhoneNumber[]>> {
  const fields = 'id,display_phone_number,verified_name,quality_rating,status,code_verification_status'
  const result = await graphGet<Array<{
    id: string
    display_phone_number?: string
    verified_name?: string
    quality_rating?: string
    status?: string
    code_verification_status?: string
  }>>(`/${wabaId}/phone_numbers?fields=${fields}&limit=100`)

  if (!result.ok) return { ok: false, error: result.error }

  return {
    ok: true,
    data: (result.data ?? []).map((phone) => ({
      id: phone.id,
      displayPhoneNumber: phone.display_phone_number || phone.id,
      verifiedName: phone.verified_name,
      qualityRating: phone.quality_rating,
      status: phone.status,
      codeVerificationStatus: phone.code_verification_status,
    })),
  }
}

function extractBody(components: TemplateComponent[]): string {
  return components.find((component) => component.type === 'BODY')?.text ?? ''
}

function extractVariables(body: string): string[] {
  return [...new Set((body.match(/{{\s*[\w.]+\s*}}/g) ?? []).map((value) => value.replace(/[{}]/g, '').trim()))]
}

function normalizeButtons(raw: unknown): TemplateButton[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const button = item as { type?: string; text?: string; url?: string; phone_number?: string }
    return {
      type: button.type === 'URL' || button.type === 'PHONE_NUMBER' ? button.type : 'QUICK_REPLY',
      text: button.text || 'Button',
      url: button.url,
      phoneNumber: button.phone_number,
    }
  })
}

export async function listTemplates(wabaId: string): Promise<MetaCallResult<WhatsAppTemplate[]>> {
  const fields = 'id,name,category,language,status,components,rejected_reason'
  const result = await graphGet<Array<{
    id: string
    name: string
    category?: string
    language?: string
    status?: string
    components?: Array<{ type: TemplateComponent['type']; text?: string; format?: string; buttons?: unknown }>
    rejected_reason?: string
  }>>(`/${wabaId}/message_templates?fields=${fields}&limit=100`)

  if (!result.ok) return { ok: false, error: result.error }

  return {
    ok: true,
    data: (result.data ?? []).map((template) => {
      const components: TemplateComponent[] = (template.components ?? []).map((component) => ({
        type: component.type,
        text: component.text,
        format: component.format,
        buttons: normalizeButtons(component.buttons),
      }))
      const body = extractBody(components)
      const now = new Date().toISOString()
      return {
        id: `meta-${template.id}`,
        metaTemplateId: template.id,
        name: template.name,
        category: template.category === 'UTILITY' || template.category === 'AUTHENTICATION' ? template.category : 'MARKETING',
        language: template.language || 'en_US',
        status: template.status === 'APPROVED' || template.status === 'PENDING' || template.status === 'REJECTED' || template.status === 'PAUSED' ? template.status : 'UNKNOWN',
        components,
        body,
        variables: extractVariables(body),
        footer: components.find((component) => component.type === 'FOOTER')?.text,
        buttons: components.find((component) => component.type === 'BUTTONS')?.buttons ?? [],
        exampleValues: {},
        rejectionReason: template.rejected_reason,
        source: 'meta',
        createdAt: now,
        updatedAt: now,
      }
    }),
  }
}

export async function createMetaTemplate(wabaId: string, template: WhatsAppTemplate): Promise<MetaCallResult<{ id?: string }>> {
  const components: Record<string, unknown>[] = [
    {
      type: 'BODY',
      text: template.body,
      example: template.variables.length > 0
        ? { body_text: [template.variables.map((variable) => template.exampleValues[variable] || `Example ${variable}`)] }
        : undefined,
    },
  ]

  if (template.footer) components.push({ type: 'FOOTER', text: template.footer })
  if (template.buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: template.buttons.map((button) => ({
        type: button.type,
        text: button.text,
        url: button.url,
        phone_number: button.phoneNumber,
      })),
    })
  }

  return graphPost<{ id?: string }>(`/${wabaId}/message_templates`, {
    name: template.name,
    category: template.category,
    language: template.language,
    components,
  })
}

export async function sendTemplateMessage(input: {
  phoneNumberId: string
  to: string
  template: WhatsAppTemplate
  values: Record<string, string>
}): Promise<MetaCallResult<{ messages?: { id: string }[] }>> {
  const components = input.template.variables.length > 0
    ? [
        {
          type: 'body',
          parameters: input.template.variables.map((variable) => ({
            type: 'text',
            text: input.values[variable] || '',
          })),
        },
      ]
    : undefined

  return graphPost<{ messages?: { id: string }[] }>(`/${input.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: input.to.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: input.template.name,
      language: { code: input.template.language },
      components,
    },
  })
}

export async function sendTextMessage(input: {
  phoneNumberId: string
  to: string
  text: string
}): Promise<MetaCallResult<{ messages?: { id: string }[] }>> {
  return graphPost<{ messages?: { id: string }[] }>(`/${input.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: input.to.replace(/\D/g, ''),
    type: 'text',
    text: {
      preview_url: false,
      body: input.text,
    },
  })
}

export async function subscribeWabaToApp(wabaId: string): Promise<MetaCallResult<{ success?: boolean }>> {
  return graphPost<{ success?: boolean }>(`/${wabaId}/subscribed_apps`, {})
}
