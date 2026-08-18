import { NextRequest, NextResponse } from 'next/server'
import { checkUserPermission } from '@/lib/actions/permissions'
import { analyzeWhatsAppService, testOpenAiCredential } from '@/lib/whatsapp/ai'
import { decryptCredential, encryptCredential } from '@/lib/whatsapp/credentials'
import { deletePersistedSecret, loadPersistedSecret, savePersistedSecret } from '@/lib/whatsapp/persist'
import { addLog, getState, updateState } from '@/lib/whatsapp/store'

const OPENAI_SECRET_NAME = 'openai_api_key'
const DEFAULT_MODEL = 'gpt-5-mini'

function safeModel(value: unknown): string {
  const model = String(value ?? DEFAULT_MODEL).trim()
  if (!/^[a-zA-Z0-9._:-]{2,80}$/.test(model)) throw new Error('Modelo da OpenAI inválido.')
  return model
}

async function canView() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  return permission?.has_permission === true
}

async function canManage() {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  return permission?.has_permission === true
}

export async function GET() {
  if (!await canView()) return NextResponse.json({ error: 'Você não tem permissão para visualizar a análise.' }, { status: 403 })
  const [state, credential] = await Promise.all([getState(), loadPersistedSecret(OPENAI_SECRET_NAME)])
  return NextResponse.json({
    hasApiKey: Boolean(credential),
    provider: state.ai.provider,
    model: state.ai.model,
    contentAnalysisEnabled: state.ai.contentAnalysisEnabled,
    updatedAt: state.ai.updatedAt,
    lastAnalysis: state.ai.lastAnalysis,
  })
}

export async function PUT(req: NextRequest) {
  if (!await canManage()) return NextResponse.json({ error: 'Você não tem permissão para configurar a IA.' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as {
    apiKey?: string
    model?: string
    contentAnalysisEnabled?: boolean
  }
  const model = safeModel(body.model)
  const apiKey = body.apiKey?.trim()

  try {
    if (apiKey) {
      if (!apiKey.startsWith('sk-')) return NextResponse.json({ error: 'A chave informada não possui o formato esperado da OpenAI.' }, { status: 400 })
      await testOpenAiCredential(apiKey, model)
      await savePersistedSecret(OPENAI_SECRET_NAME, encryptCredential(apiKey))
    } else if (!await loadPersistedSecret(OPENAI_SECRET_NAME)) {
      return NextResponse.json({ error: 'Informe uma chave da OpenAI para ativar a análise.' }, { status: 400 })
    }

    const state = await updateState((current) => {
      current.ai = {
        ...current.ai,
        provider: 'openai',
        model,
        contentAnalysisEnabled: body.contentAnalysisEnabled === true,
        updatedAt: new Date().toISOString(),
      }
    })
    await addLog({
      type: 'connection_saved',
      status: 'success',
      description: 'Configuração de análise por IA atualizada com credencial protegida.',
      safePayload: { provider: 'openai', model, contentAnalysisEnabled: state.ai.contentAnalysisEnabled },
    })
    return NextResponse.json({
      ok: true,
      hasApiKey: true,
      provider: state.ai.provider,
      model: state.ai.model,
      contentAnalysisEnabled: state.ai.contentAnalysisEnabled,
      updatedAt: state.ai.updatedAt,
      lastAnalysis: state.ai.lastAnalysis,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível validar a configuração de IA.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  if (!await canManage()) return NextResponse.json({ error: 'Você não tem permissão para executar a análise.' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { phoneNumberId?: string; dateFrom?: string; dateTo?: string }
  const state = await getState()
  if (!state.ai.contentAnalysisEnabled) {
    return NextResponse.json({ error: 'Ative a análise de conteúdo anonimizado nas configurações de IA.' }, { status: 400 })
  }

  const encrypted = await loadPersistedSecret(OPENAI_SECRET_NAME)
  if (!encrypted) return NextResponse.json({ error: 'Cadastre a chave da OpenAI antes de executar a análise.' }, { status: 400 })

  try {
    const analysis = await analyzeWhatsAppService(state, decryptCredential(encrypted), safeModel(state.ai.model), {
      phoneNumberId: body.phoneNumberId && body.phoneNumberId !== 'all' ? body.phoneNumberId : undefined,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    })
    await updateState((current) => {
      current.ai.lastAnalysis = analysis
      current.ai.updatedAt = new Date().toISOString()
    })
    await addLog({
      type: 'inbox_updated',
      status: 'success',
      description: 'Análise de gargalos do atendimento concluída com conteúdo anonimizado.',
      safePayload: { model: analysis.model, conversations: analysis.conversationCount, messages: analysis.messageCount },
    })
    return NextResponse.json({ ok: true, analysis })
  } catch (error) {
    await addLog({
      type: 'inbox_updated',
      status: 'failed',
      description: 'Falha ao executar a análise de gargalos do atendimento.',
      error,
      recommendedAction: 'Revise a chave, o modelo, o saldo da conta OpenAI e tente novamente.',
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível executar a análise.' }, { status: 502 })
  }
}

export async function DELETE() {
  if (!await canManage()) return NextResponse.json({ error: 'Você não tem permissão para remover a configuração de IA.' }, { status: 403 })
  await deletePersistedSecret(OPENAI_SECRET_NAME)
  const state = await updateState((current) => {
    current.ai.contentAnalysisEnabled = false
    current.ai.updatedAt = new Date().toISOString()
  })
  return NextResponse.json({ ok: true, hasApiKey: false, model: state.ai.model, contentAnalysisEnabled: false })
}
