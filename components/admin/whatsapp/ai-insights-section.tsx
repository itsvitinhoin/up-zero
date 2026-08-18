'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Bot, BrainCircuit, CheckCircle2, Eye, EyeOff, KeyRound,
  Lightbulb, Loader2, RefreshCw, ShieldCheck, Sparkles, Target, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminPanel, AdminStatCard } from '@/components/admin/admin-mobile-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AiInsightSeverity, WhatsAppAiAnalysis } from '@/lib/whatsapp/types'

interface PublicAiSettings {
  hasApiKey: boolean
  provider: 'openai'
  model: string
  contentAnalysisEnabled: boolean
  updatedAt: string
  lastAnalysis?: WhatsAppAiAnalysis
}

async function jsonRequest<T>(options?: RequestInit): Promise<T> {
  const response = await fetch('/api/mensageria/ai', options)
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação de IA.')
  return payload
}

function severityLabel(severity: AiInsightSeverity) {
  return severity === 'critical' ? 'Crítico' : severity === 'high' ? 'Alto' : severity === 'medium' ? 'Médio' : 'Baixo'
}

function severityClass(severity: AiInsightSeverity) {
  if (severity === 'critical') return 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-200'
  if (severity === 'high') return 'border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950/20 dark:text-orange-200'
  if (severity === 'medium') return 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-200'
  return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200'
}

export function WhatsAppAiInsights({ phoneNumberId, dateFrom, dateTo }: { phoneNumberId: string; dateFrom: string; dateTo: string }) {
  const [settings, setSettings] = useState<PublicAiSettings>()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-5-mini')
  const [enabled, setEnabled] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await jsonRequest<PublicAiSettings>()
      setSettings(data)
      setModel(data.model)
      setEnabled(data.contentAnalysisEnabled)
      setConfigOpen(!data.hasApiKey)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar a IA.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const data = await jsonRequest<PublicAiSettings>({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined, model, contentAnalysisEnabled: enabled }),
      })
      setSettings(data)
      setApiKey('')
      setConfigOpen(false)
      toast.success('Chave validada e configuração de IA salva com segurança.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível validar a chave.')
    } finally {
      setSaving(false)
    }
  }

  async function analyze() {
    setAnalyzing(true)
    try {
      const data = await jsonRequest<{ analysis: WhatsAppAiAnalysis }>({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId, dateFrom, dateTo }),
      })
      setSettings((current) => current ? { ...current, lastAnalysis: data.analysis } : current)
      toast.success('Análise de atendimento concluída.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível executar a análise.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function removeCredential() {
    setSaving(true)
    try {
      await jsonRequest({ method: 'DELETE' })
      setSettings((current) => current ? { ...current, hasApiKey: false, contentAnalysisEnabled: false } : current)
      setEnabled(false)
      setConfigOpen(true)
      setRemoveOpen(false)
      toast.success('Credencial da OpenAI removida.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover a credencial.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminPanel title="Análise inteligente do atendimento"><div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando configuração de IA...</div></AdminPanel>
  const analysis = settings?.lastAnalysis

  return <div className="space-y-4">
    <AdminPanel title="Análise inteligente do atendimento" description="A IA procura gargalos, sinais de demanda e oportunidades nas conversas reais do período.">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"><BrainCircuit className="h-6 w-6" /></div><div><p className="font-semibold">OpenAI · {settings?.model ?? model}</p><p className="text-sm text-muted-foreground">{settings?.hasApiKey ? 'Credencial protegida e pronta para uso.' : 'Cadastre a chave da conta OpenAI deste cliente.'}</p><p className="mt-1 text-xs text-muted-foreground">O conteúdo é anonimizado antes da análise e não é salvo pela UP Zero como chave legível.</p></div></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setConfigOpen((open) => !open)}><KeyRound className="mr-2 h-4 w-4" />Configurar IA</Button><Button onClick={() => void analyze()} disabled={analyzing || !settings?.hasApiKey || !settings.contentAnalysisEnabled}><Sparkles className="mr-2 h-4 w-4" />{analyzing ? 'Analisando...' : 'Analisar período'}</Button></div>
      </div>

      {configOpen ? <div className="mt-5 rounded-xl border bg-muted/20 p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="openai-api-key">API key da OpenAI</Label><div className="relative"><Input id="openai-api-key" type={showKey ? 'text' : 'password'} autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings?.hasApiKey ? 'Chave já configurada · preencha apenas para substituir' : 'sk-proj-...'} className="pr-10" /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowKey((show) => !show)} aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
          <div className="space-y-2"><Label htmlFor="openai-model">Modelo</Label><Input id="openai-model" value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-5-mini" /></div>
        </div>
        <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border bg-background p-3"><div><p className="font-medium">Analisar conteúdo anonimizado</p><p className="text-sm text-muted-foreground">Telefones, e-mails, CPF, CNPJ e CEP são removidos antes do envio à OpenAI.</p></div><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
        <div className="mt-4 flex flex-wrap justify-between gap-2"><div>{settings?.hasApiKey ? <Button variant="destructive" onClick={() => setRemoveOpen(true)} disabled={saving}><Trash2 className="mr-2 h-4 w-4" />Remover chave</Button> : null}</div><Button onClick={() => void save()} disabled={saving || (!settings?.hasApiKey && !apiKey.trim()) || !model.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Validar e salvar</Button></div>
      </div> : null}

      {!settings?.hasApiKey ? <Alert className="mt-5"><KeyRound className="h-4 w-4" /><AlertTitle>Chave necessária</AlertTitle><AlertDescription>Cadastre a chave da OpenAI do cliente para habilitar as análises. A chave será validada e armazenada criptografada.</AlertDescription></Alert> : !settings.contentAnalysisEnabled ? <Alert className="mt-5"><AlertTriangle className="h-4 w-4" /><AlertTitle>Análise desativada</AlertTitle><AlertDescription>Abra Configurar IA, habilite a análise de conteúdo anonimizado e salve.</AlertDescription></Alert> : null}
    </AdminPanel>

    {analysis ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard icon={Target} label="Score de atendimento" value={`${Math.round(analysis.serviceScore)}/100`} hint="avaliação da IA" tone={analysis.serviceScore >= 75 ? 'success' : analysis.serviceScore >= 50 ? 'warning' : 'danger'} />
        <AdminStatCard icon={AlertTriangle} label="Nível de risco" value={severityLabel(analysis.riskLevel)} hint="gargalos do período" tone={analysis.riskLevel === 'low' ? 'success' : analysis.riskLevel === 'medium' ? 'warning' : 'danger'} />
        <AdminStatCard icon={Bot} label="Conversas analisadas" value={analysis.conversationCount} hint={`${analysis.messageCount} mensagens`} tone="info" />
        <AdminStatCard icon={RefreshCw} label="Última análise" value={new Date(analysis.analyzedAt).toLocaleDateString('pt-BR')} hint={new Date(analysis.analyzedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} />
      </div>
      <Alert className="border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20"><Sparkles className="h-4 w-4" /><AlertTitle>Resumo executivo</AlertTitle><AlertDescription>{analysis.executiveSummary}</AlertDescription></Alert>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel title="Gargalos identificados" description="Priorizados por gravidade e sustentados por evidências do período."><div className="space-y-3">{analysis.bottlenecks.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{index + 1}. {item.title}</span><Badge variant="outline" className={severityClass(item.severity)}>{severityLabel(item.severity)}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{item.evidence}</p></div><div className="rounded-lg bg-muted px-3 py-2 text-right"><p className="text-xs text-muted-foreground">{item.metricName}</p><p className="font-semibold">{item.metricValue}</p></div></div><p className="mt-3 text-sm"><strong>Impacto:</strong> {item.impact}</p><p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300"><strong>Ação:</strong> {item.recommendedAction}</p></div>)}{analysis.bottlenecks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum gargalo relevante identificado.</p> : null}</div></AdminPanel>
        <AdminPanel title="Prioridades recomendadas" description="Plano curto para atacar os principais problemas."><div className="space-y-3">{analysis.priorities.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-xl border p-4"><div className="flex items-start gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{index + 1}</div><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">Responsável: {item.owner} · Prazo: {item.deadline}</p><p className="mt-2 text-sm">{item.expectedImpact}</p></div></div></div>)}</div></AdminPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <AdminPanel title="Sinais dos clientes" description="Demandas e oportunidades observadas no conteúdo anonimizado."><div className="space-y-3">{analysis.customerSignals.map((signal, index) => <div key={`${signal.title}-${index}`} className="rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4 text-amber-500" />{signal.title}</p><p className="mt-2 text-sm text-muted-foreground">{signal.evidence}</p><p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{signal.opportunity}</p></div>)}</div></AdminPanel>
        <AdminPanel title="Tom das conversas" description="Distribuição estimada do comportamento dos clientes."><div className="space-y-4">{analysis.tone.map((tone) => <div key={tone.label}><div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium">{tone.label}</span><strong>{Math.round(tone.share)}%</strong></div><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, Math.max(0, tone.share))}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{tone.explanation}</p></div>)}</div></AdminPanel>
      </div>
      <p className="text-xs text-muted-foreground">Fonte: conversas reais recebidas pelo webhook · período {new Date(`${analysis.periodStart}T12:00:00`).toLocaleDateString('pt-BR')} a {new Date(`${analysis.periodEnd}T12:00:00`).toLocaleDateString('pt-BR')} · modelo {analysis.model}.</p>
    </> : settings?.hasApiKey && settings.contentAnalysisEnabled ? <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>Pronto para analisar</AlertTitle><AlertDescription>Use “Analisar período” para gerar o primeiro diagnóstico com os filtros atuais do Dashboard.</AlertDescription></Alert> : null}

    <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover a chave da OpenAI?</AlertDialogTitle><AlertDialogDescription>A análise por IA será desativada. O último diagnóstico permanece visível, mas nenhuma nova análise poderá ser executada até cadastrar outra chave.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void removeCredential()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover chave</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}
