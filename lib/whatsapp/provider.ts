import type { WaConnection } from './types'

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface WaProvider {
  send(connection: WaConnection, phone: string, text: string): Promise<SendResult>
  testConnection(connection: WaConnection): Promise<{ ok: boolean; error?: string }>
}

// ─── Mock provider ────────────────────────────────────────────────────────────

export class MockWaProvider implements WaProvider {
  async send(_connection: WaConnection, _phone: string, _text: string): Promise<SendResult> {
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 120))
    if (Math.random() < 0.04) {
      return { success: false, error: 'Número inválido ou não registrado no WhatsApp (simulado)' }
    }
    return { success: true, messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
  }

  async testConnection(_connection: WaConnection): Promise<{ ok: boolean; error?: string }> {
    await new Promise((r) => setTimeout(r, 150))
    return { ok: true, error: 'Conexão Mock ativa. Mensagens serão simuladas (não enviadas de verdade).' }
  }
}

// ─── Meta Cloud API error hints ───────────────────────────────────────────────

interface MetaError {
  message: string
  type: string
  code: number
  error_subcode?: number
  fbtrace_id?: string
}

function metaHint(code: number, subcode?: number): string {
  // Auth errors
  if (code === 190) return 'Token inválido ou expirado. Gere um novo token permanente em Meta for Developers → Configurações → Sistema de Usuários.'
  if (code === 200 || code === 10) return 'Permissões insuficientes. O System User Token precisa ter as permissões: whatsapp_business_messaging e whatsapp_business_management.'
  // Phone Number ID errors
  if (code === 100) {
    if (subcode === 2388008) return 'Phone Number ID incorreto. Acesse Meta for Developers → WhatsApp → API Setup e copie o ID correto.'
    return 'Parâmetro inválido. Verifique o Phone Number ID em WhatsApp → API Setup.'
  }
  // Business / account issues
  if (code === 272) return 'Esta conta do WhatsApp Business não tem permissão para esta operação. Verifique o status da conta no Business Manager.'
  if (code === 4) return 'Limite de envios atingido (API rate limit). Aguarde alguns minutos antes de tentar novamente.'
  // Message errors
  if (code === 130429) return 'Taxa de envio excedida para este número. Aguarde e tente novamente.'
  if (code === 131000) return 'Erro interno da API do Meta. Tente novamente em alguns minutos.'
  if (code === 131005) return 'Permissão negada. Verifique as permissões do token e a configuração da conta.'
  if (code === 131008) return 'Parâmetro obrigatório ausente. Verifique o payload enviado.'
  if (code === 131009) return 'Valor de parâmetro inválido. Verifique o número de telefone (formato: DDDnúmero, sem +55).'
  if (code === 131021) return 'Número do remetente inválido. O Phone Number ID pode estar incorreto ou o número não está verificado.'
  if (code === 131026) return 'Número do destinatário não está na lista permitida (modo sandbox/teste). Para produção, solicite acesso completo no Meta Business Manager.'
  if (code === 131047) return 'Mensagem de texto livre só pode ser enviada dentro da janela de 24h após o cliente ter iniciado conversa. Para mensagens proativas, use Templates aprovados pelo Meta.'
  if (code === 131051) return 'Tipo de mensagem não suportado. Use type: "text" para mensagens simples.'
  if (code === 132000) return 'Template não encontrado ou não aprovado. Para mensagens proativas (fora da janela de 24h), você precisa criar e ter um template aprovado pelo Meta.'
  if (code === 132001) return 'Template inativo ou rejeitado pelo Meta. Acesse o Meta Business Manager → WhatsApp → Message Templates para verificar o status.'
  if (code === 133004) return 'Conta do servidor suspensa. Entre em contato com o suporte do Meta.'
  if (code === 133005) return 'Conta bloqueada por qualidade baixa de mensagens. Verifique o Dashboard de Qualidade no Meta Business Manager.'
  if (code === 133006) return 'Número do remetente bloqueado por violação de política. Contacte o suporte do Meta.'
  if (code === 133010) return 'O número do destinatário não está registrado no WhatsApp. Verifique se o número está correto (formato: DDDnúmero sem +55, ex: 11999990001) e se o destinatário realmente usa WhatsApp.'
  return ''
}

// ─── Meta Cloud API provider ──────────────────────────────────────────────────

export class MetaCloudWaProvider implements WaProvider {
  async send(connection: WaConnection, phone: string, text: string): Promise<SendResult> {
    if (!connection.phoneNumberId) {
      return { success: false, error: 'Phone Number ID não configurado. Edite a conexão e preencha o campo.' }
    }

    // Prefer the server-side system user token (long-lived, correct for Cloud API calls).
    // Fall back to connection.accessToken for manual token entries.
    const bearerToken = process.env.FACEBOOK_SYSTEM_USER_TOKEN ?? connection.accessToken
    if (!bearerToken) {
      return {
        success: false,
        error:
          'Token não configurado. Defina FACEBOOK_SYSTEM_USER_TOKEN no .env.local ' +
          '(Meta for Developers → Configurações → Usuários do Sistema → Gerar token).',
      }
    }

    if (!phone) {
      return { success: false, error: 'Número de telefone inválido ou ausente.' }
    }

    // Phone must be digits only for Meta API (no + prefix)
    const cleanPhone = phone.replace(/\D/g, '')

    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${connection.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { preview_url: false, body: text },
          }),
        },
      )

      let data: { messages?: { id: string }[]; error?: MetaError } = {}
      try {
        data = await res.json()
      } catch {
        return { success: false, error: `Resposta inválida da API do Meta (HTTP ${res.status}).` }
      }

      if (!res.ok || data.error) {
        const err = data.error
        const base = err?.message ?? `Erro HTTP ${res.status}`
        const hint = err ? metaHint(err.code, err.error_subcode) : ''
        const trace = err?.fbtrace_id ? ` [trace: ${err.fbtrace_id}]` : ''
        return { success: false, error: hint ? `${hint}${trace}` : `${base}${trace}` }
      }

      return { success: true, messageId: data.messages?.[0]?.id }
    } catch (e) {
      return {
        success: false,
        error: `Erro de rede ao contactar o servidor do Meta. Verifique a conectividade do servidor. (${String(e)})`,
      }
    }
  }

  async testConnection(connection: WaConnection): Promise<{ ok: boolean; error?: string }> {
    if (!connection.phoneNumberId) {
      return {
        ok: false,
        error: 'Phone Number ID não preenchido. Acesse Meta for Developers → WhatsApp → API Setup, copie o "Phone Number ID" e cole aqui.',
      }
    }

    // Use system user token from env (preferred) or stored connection token as fallback
    const bearerToken = process.env.FACEBOOK_SYSTEM_USER_TOKEN ?? connection.accessToken
    if (!bearerToken) {
      return {
        ok: false,
        error:
          'Token não configurado. Defina FACEBOOK_SYSTEM_USER_TOKEN no .env.local ' +
          '(Meta for Developers → Configurações → Usuários do Sistema → Gerar token). ' +
          'Marque as permissões whatsapp_business_messaging e whatsapp_business_management.',
      }
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${connection.phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,status`,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      )
      let data: {
        id?: string
        display_phone_number?: string
        verified_name?: string
        quality_rating?: string
        status?: string
        error?: MetaError
      } = {}
      try {
        data = await res.json()
      } catch {
        return { ok: false, error: `Resposta inválida da API do Meta (HTTP ${res.status}).` }
      }

      if (!res.ok || data.error) {
        const err = data.error
        const base = err?.message ?? `HTTP ${res.status}`
        const hint = err ? metaHint(err.code, err.error_subcode) : ''
        return { ok: false, error: hint || base }
      }

      const qualityWarning =
        data.quality_rating === 'RED'
          ? ' ⚠️ Qualidade BAIXA — risco de bloqueio pelo Meta. Reduza envios para recuperar a pontuação.'
          : data.quality_rating === 'YELLOW'
          ? ' ⚠️ Qualidade MÉDIA — monitore o Dashboard de Qualidade no Meta Business Manager.'
          : ''

      const statusNote =
        data.status && data.status !== 'CONNECTED'
          ? ` Status da conta: ${data.status}.`
          : ''

      return {
        ok: true,
        error: `Conectado: ${data.verified_name ?? ''}${data.display_phone_number ? ` (${data.display_phone_number})` : ''}${statusNote}${qualityWarning}`,
      }
    } catch (e) {
      return {
        ok: false,
        error: `Erro de rede: não foi possível alcançar a API do Meta. Verifique se o servidor tem acesso à internet. (${String(e)})`,
      }
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function getProvider(provider: WaConnection['provider']): WaProvider {
  if (provider === 'META_CLOUD') return new MetaCloudWaProvider()
  return new MockWaProvider()
}
