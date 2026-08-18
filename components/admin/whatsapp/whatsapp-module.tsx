'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, AlertCircle, ArrowRight, BarChart3, Bot, CheckCircle2, Clock,
  FileCheck2, Filter, Inbox, Link2, Loader2, MessageCircle, MessageSquare,
  Phone, Plus, RefreshCw, Search, Send, ShieldCheck, ShoppingCart,
  Target, Trash2, UserCheck, Users, Wifi, WifiOff, Zap,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts'

import { AdminHero, AdminPage, AdminPanel, AdminStatCard } from '@/components/admin/admin-mobile-ui'
import { FacebookOAuthButton, type WaOAuthCredentials } from '@/app/mensageria/whatsapp/facebook-oauth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ECOMMERCE_EVENT_DEFINITIONS } from '@/lib/whatsapp/ecommerce-events'
import type {
  AutomationRule, ECommerceEventType, InboxConversation,
  TemplateButton, TemplateCategory, WhatsAppBusinessAccount, WhatsAppPhoneNumber, WhatsAppState,
  WhatsAppTemplate,
} from '@/lib/whatsapp/types'
import { cn } from '@/lib/utils'
import { WhatsAppAutomationsSection } from '@/components/admin/whatsapp/automations-section'
import { ConnectionFallbackSettings } from '@/components/admin/whatsapp/connection-fallback-settings'
import { WhatsAppTemplatesSection } from '@/components/admin/whatsapp/templates-section'
import { WhatsAppConversationsSection } from '@/components/admin/whatsapp/conversations-section'
import { WhatsAppAiInsights } from '@/components/admin/whatsapp/ai-insights-section'
import { toast } from 'sonner'

export type WhatsAppSection = 'dashboard' | 'connections' | 'templates' | 'conversations' | 'automations'
type UiState = WhatsAppState & { reviewChecklist?: unknown[] }

const sectionCopy: Record<WhatsAppSection, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: 'WhatsApp · Inteligência', title: 'Dashboard do WhatsApp', description: 'Acompanhe atendimento, demanda, produtividade e sinais comerciais das conversas.' },
  connections: { eyebrow: 'WhatsApp · Meta', title: 'Conexões', description: 'Conecte múltiplas WABAs e números, acompanhe saúde, webhook e sincronização.' },
  templates: { eyebrow: 'WhatsApp · Conteúdo', title: 'Templates', description: 'Crie, sincronize e acompanhe a aprovação dos modelos de mensagem da Meta.' },
  conversations: { eyebrow: 'WhatsApp · Atendimento', title: 'Conversas', description: 'Centralize conversas de todos os números e identifique a etapa comercial de cada contato.' },
  automations: { eyebrow: 'WhatsApp · Eventos', title: 'Automações', description: 'Crie regras por vendedora usando apenas os templates da WABA vinculada ao número escolhido.' },
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message ?? 'Não foi possível concluir a ação.')
  return payload as T
}

function isoAgo(days: number, hour: number, minute = 0) {
  const value = new Date()
  value.setDate(value.getDate() - days)
  value.setHours(hour, minute, 0, 0)
  return value.toISOString()
}

function lastMessage(conversation: InboxConversation) { return conversation.messages.at(-1) }
function contactFor(state: UiState, conversation?: InboxConversation) { return state.contacts.find((contact) => contact.phone.replace(/\D/g, '').endsWith(String(conversation?.phone ?? '').replace(/\D/g, '').slice(-8))) }
function phoneForConversation(state: UiState, conversation?: InboxConversation) {
  if (!conversation) return undefined
  const phoneNumberId = conversation.phoneNumberId
    ?? conversation.messages.find((message) => message.direction === 'inbound')?.to
    ?? conversation.messages.find((message) => message.direction === 'outbound')?.from
  return state.phoneNumbers.find((phone) => phone.id === phoneNumberId)
}
function formatMinutes(value: number) { return value < 60 ? `${Math.round(value)} min` : `${Math.floor(value / 60)}h ${Math.round(value % 60)}min` }
function maskId(value?: string) { return value ? `${value.slice(0, 5)}…${value.slice(-4)}` : 'Não informado' }

interface ConnectionIssue {
  id: string
  title: string
  detail: string
  automatic: boolean
}

function connectionIssues(
  phone: WhatsAppPhoneNumber,
  wabaOrState: WhatsAppBusinessAccount | UiState | undefined,
  maybeState?: UiState,
): ConnectionIssue[] {
  const state = maybeState ?? wabaOrState as UiState
  const waba = maybeState
    ? wabaOrState as WhatsAppBusinessAccount | undefined
    : state.wabas.find((item) => item.id === phone.wabaId)
  const issues: ConnectionIssue[] = []
  const status = phone.status?.toUpperCase()
  const quality = phone.qualityRating?.toUpperCase()
  const verification = phone.codeVerificationStatus?.toUpperCase()

  if (status !== 'CONNECTED') {
    issues.push({
      id: 'status',
      title: 'Status da Meta não confirmado',
      detail: status && status !== 'UNKNOWN'
        ? `A Meta retornou o status ${status}.`
        : 'O status do número ainda não foi sincronizado com a Meta.',
      automatic: !status || status === 'UNKNOWN',
    })
  }

  if (quality === 'RED') {
    issues.push({
      id: 'quality',
      title: 'Qualidade baixa',
      detail: 'A Meta classificou a qualidade do número como RED. Revise bloqueios e feedback das mensagens enviadas.',
      automatic: false,
    })
  }

  const webhookSubscribed = waba?.webhookSubscribedAt
    ?? (state.integration.wabaId === waba?.id ? state.integration.webhookSubscribedAt : undefined)
  if (!webhookSubscribed) {
    issues.push({
      id: 'webhook',
      title: 'Webhook pendente',
      detail: 'A WABA ainda não está inscrita neste aplicativo para receber mensagens e atualizações.',
      automatic: true,
    })
  }

  if (verification !== 'VERIFIED') {
    issues.push({
      id: 'verification',
      title: 'Verificação do número pendente',
      detail: verification && verification !== 'UNKNOWN'
        ? `A Meta retornou ${verification}. Conclua a confirmação do número no WhatsApp Manager.`
        : 'A confirmação por SMS ou ligação ainda não foi validada pela Meta.',
      automatic: !verification || verification === 'UNKNOWN',
    })
  }

  if (state.integration.lastError) {
    issues.push({
      id: 'integration-error',
      title: state.integration.lastError.message,
      detail: state.integration.lastError.action ?? 'Revise as permissões e credenciais da integração Meta.',
      automatic: false,
    })
  }

  return issues
}

function emptyLocalState(): UiState {
  const now = new Date().toISOString()
  return {
    version: 2,
    integration: { status: 'not_started', oauthStatus: 'not_started', connectionStatus: 'not_started', updatedAt: now },
    businesses: [],
    wabas: [],
    phoneNumbers: [],
    removedPhoneNumberIds: [],
    templates: [],
    conversations: [],
    contacts: [],
    contactLists: [],
    campaigns: [],
    automations: [],
    automationJobs: [],
    automationLogs: [],
    ecommerceEvents: [],
    logs: [],
    ai: {
      provider: 'openai',
      model: 'gpt-5-mini',
      contentAnalysisEnabled: false,
      updatedAt: now,
    },
  }
}

export default function WhatsAppModule({ section }: { section: WhatsAppSection }) {
  const [rawState, setRawState] = useState<UiState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const copy = sectionCopy[section]

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRawState(await api<UiState>('/api/mensageria/state'))
    } catch (cause) {
      setRawState(emptyLocalState())
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados reais do WhatsApp.')
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading || !rawState) return <AdminPage><div className="flex min-h-[60vh] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando WhatsApp...</div></AdminPage>
  const state = rawState

  return (
    <AdminPage>
      <AdminHero icon={MessageCircle} eyebrow={copy.eyebrow} title={copy.title} description={copy.description} actions={<Button variant="outline" size="sm" className="gap-2" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Atualizar dados</Button>} />
      {error ? <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Falha ao carregar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {section === 'dashboard' ? <Dashboard state={state} /> : null}
      {section === 'connections' ? <><ConnectionFallbackSettings state={state} reload={load} /><ConnectionsV2 state={state} reload={load} /></> : null}
      {section === 'templates' ? <WhatsAppTemplatesSection state={state} reload={load} /> : null}
      {section === 'conversations' ? <WhatsAppConversationsSection state={state} reload={load} /> : null}
      {section === 'automations' ? <WhatsAppAutomationsSection state={state} reload={load} /> : null}
    </AdminPage>
  )
}

function computeDashboard(state: UiState) {
  const allMessages = state.conversations.flatMap((conversation) => conversation.messages)
  const inbound = allMessages.filter((message) => message.direction === 'inbound')
  const outbound = allMessages.filter((message) => message.direction === 'outbound')
  const unanswered = state.conversations.filter((conversation) => lastMessage(conversation)?.direction === 'inbound')
  const recurring = state.conversations.filter((conversation) => (contactFor(state, conversation)?.orderCount ?? 0) > 0)
  const responseTimes = state.conversations.flatMap((conversation) => conversation.messages.flatMap((message, index) => {
    if (message.direction !== 'inbound') return []
    const response = conversation.messages.slice(index + 1).find((candidate) => candidate.direction === 'outbound')
    return response ? [(new Date(response.timestamp).getTime() - new Date(message.timestamp).getTime()) / 60000] : []
  })).filter((value) => value >= 0)
  const avgResponse = responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : 0
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - index)); const key = date.toISOString().slice(0, 10)
    const conversations = state.conversations.filter((item) => (item.lastMessageAt ?? item.messages[0]?.timestamp)?.slice(0, 10) === key)
    const returning = conversations.filter((item) => (contactFor(state, item)?.orderCount ?? 0) > 0).length
    return { date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), novas: conversations.length - returning, recorrentes: returning, conversas: conversations.length, respondidas: conversations.filter((item) => lastMessage(item)?.direction === 'outbound').length }
  })
  const hours = Array.from({ length: 12 }, (_, index) => ({ hour: `${index + 8}h`, mensagens: inbound.filter((message) => new Date(message.timestamp).getHours() === index + 8).length }))
  const byPhone = state.phoneNumbers.map((phone, index) => {
    const conversations = state.conversations.filter((conversation) =>
      conversation.messages.some((message) => message.from === phone.id || message.to === phone.id),
    )
    const phoneInbound = conversations.flatMap((conversation) => conversation.messages).filter((message) => message.direction === 'inbound')
    const phoneOutbound = conversations.flatMap((conversation) => conversation.messages).filter((message) => message.direction === 'outbound')
    const phoneUnanswered = conversations.filter((conversation) => lastMessage(conversation)?.direction === 'inbound')
    const phoneResponseTimes = conversations.flatMap((conversation) => conversation.messages.flatMap((message, messageIndex) => {
      if (message.direction !== 'inbound') return []
      const response = conversation.messages.slice(messageIndex + 1).find((candidate) => candidate.direction === 'outbound')
      return response ? [(new Date(response.timestamp).getTime() - new Date(message.timestamp).getTime()) / 60000] : []
    })).filter((value) => value >= 0)
    const minutes = phoneResponseTimes.length
      ? phoneResponseTimes.reduce((sum, value) => sum + value, 0) / phoneResponseTimes.length
      : 0

    return {
      name: phone.verifiedName?.split('·').at(-1)?.trim() ?? `WhatsApp ${index + 1}`,
      minutos: Math.round(minutes),
      conversations: conversations.length,
      inbound: phoneInbound.length,
      outbound: phoneOutbound.length,
      unanswered: phoneUnanswered.length,
      recurring: conversations.filter((conversation) => (contactFor(state, conversation)?.orderCount ?? 0) > 0).length,
    }
  })
  return { allMessages, inbound, outbound, unanswered, recurring, avgResponse, days, hours, byPhone }
}

function Dashboard({ state }: { state: UiState }) {
  const [phoneFilter, setPhoneFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState(isoAgo(14, 9).slice(0, 10))
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const dashboardState = useMemo<UiState>(() => {
    const start = new Date(`${dateFrom}T00:00:00-03:00`).getTime()
    const end = new Date(`${dateTo}T23:59:59.999-03:00`).getTime()
    return {
      ...state,
      phoneNumbers: phoneFilter === 'all' ? state.phoneNumbers : state.phoneNumbers.filter((phone) => phone.id === phoneFilter),
      conversations: state.conversations.filter((conversation) => {
        const timestamp = conversation.lastMessageAt ?? conversation.messages.at(-1)?.timestamp
        const time = timestamp ? new Date(timestamp).getTime() : 0
        const phoneMatches = phoneFilter === 'all' || phoneForConversation(state, conversation)?.id === phoneFilter
        return phoneMatches && time >= start && time <= end
      }),
    }
  }, [dateFrom, dateTo, phoneFilter, state])
  const stats = useMemo(() => computeDashboard(dashboardState), [dashboardState])
  const attended = Math.max(dashboardState.conversations.length - stats.unanswered.length, 0)
  const funnel = [
    ['Conversas recebidas', dashboardState.conversations.length],
    ['Atendidas', attended],
    ['Sem resposta', stats.unanswered.length],
  ]
  const maxFunnel = Math.max(...funnel.map((item) => Number(item[1])), 1)
  const serviceRate = dashboardState.conversations.length ? Math.round(attended / dashboardState.conversations.length * 100) : 0
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AdminStatCard icon={MessageSquare} label="Total de conversas" value={dashboardState.conversations.length} hint="no período" tone="info" />
      <AdminStatCard icon={Users} label="Novas conversas" value={dashboardState.conversations.length - stats.recurring.length} hint="primeiro contato" />
      <AdminStatCard icon={UserCheck} label="Clientes recorrentes" value={stats.recurring.length} hint="já compraram" tone="success" />
      <AdminStatCard icon={Inbox} label="Mensagens recebidas" value={stats.inbound.length} hint="dos clientes" tone="info" />
      <AdminStatCard icon={Send} label="Mensagens enviadas" value={stats.outbound.length} hint="e automações" />
      <AdminStatCard icon={Clock} label="Tempo médio de resposta" value={formatMinutes(stats.avgResponse)} hint="primeira resposta" tone={stats.avgResponse <= 20 ? 'success' : 'warning'} />
      <AdminStatCard icon={AlertCircle} label="Leads sem resposta" value={stats.unanswered.length} hint="ação necessária" tone={stats.unanswered.length ? 'danger' : 'success'} />
    </div>
    <AdminPanel title="Filtros do período" description="Refine a análise por número e intervalo de atendimento.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <Select value={phoneFilter} onValueChange={setPhoneFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os WhatsApps</SelectItem>{state.phoneNumbers.map((phone) => <SelectItem key={phone.id} value={phone.id}>{phone.verifiedName ?? phone.displayPhoneNumber}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Início" />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Fim" />
        <Button className="gap-2" variant="outline" onClick={() => { setDateFrom(isoAgo(14, 9).slice(0, 10)); setDateTo(new Date().toISOString().slice(0, 10)); setPhoneFilter('all') }}><Filter className="h-4 w-4" />Limpar</Button>
      </div>
    </AdminPanel>
    <WhatsAppAiInsights phoneNumberId={phoneFilter} dateFrom={dateFrom} dateTo={dateTo} />
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel title="Conversas novas x recorrentes por dia"><ResponsiveContainer width="100%" height={250}><LineChart data={stats.days}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><RechartsTooltip /><Legend /><Line type="monotone" dataKey="novas" stroke="var(--chart-1)" strokeWidth={3} /><Line type="monotone" dataKey="recorrentes" stroke="var(--chart-2)" strokeWidth={3} /></LineChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Mensagens recebidas por hora"><ResponsiveContainer width="100%" height={250}><BarChart data={stats.hours}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="hour" /><YAxis allowDecimals={false} /><RechartsTooltip /><Bar dataKey="mensagens" fill="var(--chart-2)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Tempo médio de resposta por WhatsApp"><ResponsiveContainer width="100%" height={250}><BarChart data={stats.byPhone} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" unit=" min" /><YAxis type="category" dataKey="name" width={100} /><RechartsTooltip /><Bar dataKey="minutos" fill="var(--chart-4)" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Conversas x respondidas no dia"><ResponsiveContainer width="100%" height={250}><BarChart data={stats.days}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><RechartsTooltip /><Legend /><Bar dataKey="conversas" fill="var(--chart-1)" radius={[5, 5, 0, 0]} /><Bar dataKey="respondidas" fill="var(--chart-2)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel>
    </div>
    <AdminPanel title="Funil comercial do WhatsApp" description="Volume atual e taxa de avanço por etapa.">
      <div className="grid gap-6 xl:grid-cols-[4fr_1fr]">
        <div className="space-y-3">{funnel.map(([label, value], index) => <div key={String(label)}><div className="mb-1 flex items-center justify-between text-sm"><span>{index + 1}. {label}</span><strong>{value}</strong></div><div className="h-3 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, Number(value) / maxFunnel * 100)}%` }} /></div></div>)}</div>
        <div className="rounded-xl border bg-muted/25 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxa de atendimento</p><p className="mt-3 text-4xl font-semibold">{serviceRate}%</p><p className="mt-2 text-sm text-muted-foreground">calculada apenas com conversas recebidas pelo webhook.</p><div className="mt-5 flex items-center gap-2 text-sm text-emerald-600"><ArrowRight className="h-4 w-4" />{attended} conversa(s) atendida(s)</div></div>
      </div>
    </AdminPanel>
    <ProductivityTable state={dashboardState} stats={stats} />
    {dashboardState.conversations.length === 0 ? <Alert><MessageSquare className="h-4 w-4" /><AlertTitle>Nenhuma conversa real recebida</AlertTitle><AlertDescription>As métricas e análises serão preenchidas somente depois que o webhook receber mensagens do número conectado.</AlertDescription></Alert> : null}
  </div>
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) { return <AdminPanel title={title} className="min-w-0"><div className="h-[250px] w-full min-w-0">{children}</div></AdminPanel> }

function ProductivityTable({ state, stats }: { state: UiState; stats: ReturnType<typeof computeDashboard> }) {
  return <AdminPanel title="Produtividade por perfil WhatsApp" description="Atendimento e velocidade calculados somente a partir das mensagens reais."><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>WhatsApp</TableHead><TableHead>Conversas</TableHead><TableHead>Atendidas</TableHead><TableHead>% atendimento</TableHead><TableHead>Novos</TableHead><TableHead>Recorrentes</TableHead><TableHead>Sem resposta</TableHead><TableHead>Tempo médio</TableHead></TableRow></TableHeader><TableBody>{state.phoneNumbers.map((phone, index) => { const data = stats.byPhone[index]; const total = data?.conversations ?? 0; const answered = Math.max(total - (data?.unanswered ?? 0), 0); return <TableRow key={phone.id}><TableCell><div className="font-medium">{phone.verifiedName ?? 'WhatsApp'}</div><div className="text-xs text-muted-foreground">{phone.displayPhoneNumber}</div></TableCell><TableCell>{total}</TableCell><TableCell>{answered}</TableCell><TableCell><Badge variant="secondary">{total ? Math.round(answered / total * 100) : 0}%</Badge></TableCell><TableCell>{Math.max(total - (data?.recurring ?? 0), 0)}</TableCell><TableCell>{data?.recurring ?? 0}</TableCell><TableCell>{data?.unanswered ?? 0}</TableCell><TableCell>{data?.minutos ?? 0} min</TableCell></TableRow> })}</TableBody></Table></div>{state.phoneNumbers.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum número real conectado.</p> : null}</AdminPanel>
}

function Connections({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const [manualOpen, setManualOpen] = useState(false)
  const [form, setForm] = useState({ businessId: '', wabaId: '', phoneNumberId: '', phoneNumber: '', verifiedName: '' })
  const [busy, setBusy] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WhatsAppPhoneNumber | null>(null)
  async function oauth(creds: WaOAuthCredentials) { await api('/api/mensageria/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: creds.businessId, wabaId: creds.businessAccountId, phoneNumberId: creds.phoneNumberId, phoneNumber: creds.phoneNumber, verifiedName: creds.verifiedName, status: creds.status, qualityRating: creds.qualityRating, codeVerificationStatus: creds.codeVerificationStatus, grantedPermissions: creds.grantedPermissions ?? [] }) }); await reload() }
  async function manualConnect() { setBusy('manual'); try { await api('/api/mensageria/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, grantedPermissions: ['business_management', 'whatsapp_business_management', 'whatsapp_business_messaging'] }) }); setManualOpen(false); await reload() } finally { setBusy('') } }
  async function select(phone: WhatsAppPhoneNumber) { setBusy(phone.id); try { const waba = state.wabas.find((item) => item.id === phone.wabaId); await api('/api/mensageria/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: phone.businessId ?? waba?.businessId ?? state.integration.businessId, wabaId: phone.wabaId, phoneNumberId: phone.id }) }); await reload() } finally { setBusy('') } }
  async function sync() { setBusy('sync'); try { await api('/api/mensageria/connections', { method: 'PUT' }); await reload() } finally { setBusy('') } }
  async function webhook(phone?: WhatsAppPhoneNumber) { const target = phone ?? state.phoneNumbers.find((item) => item.id === state.integration.phoneNumberId); if (!target) return; setBusy(`webhook:${target.id}`); try { await api('/api/mensageria/connections/subscribe-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumberId: target.id, wabaId: target.wabaId }) }); await reload() } finally { setBusy('') } }
  async function register(phone: WhatsAppPhoneNumber) {
    setBusy(`register:${phone.id}`)
    try {
      const result = await api<{ status?: string }>('/api/mensageria/connections/register', { method: 'POST' })
      toast.success(result.status === 'CONNECTED' ? 'Número registrado e conectado à Cloud API.' : 'Registro aceito pela Meta. Sincronizando o status...')
      await api('/api/mensageria/connections', { method: 'PUT' })
      await reload()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível registrar o número na Cloud API.')
      await reload()
    } finally {
      setBusy('')
    }
  }
  async function resolveIssues(phone: WhatsAppPhoneNumber, wabaId?: string) {
    setBusy(`resolve:${phone.id}`)
    try {
      await api('/api/mensageria/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: state.integration.businessId ?? state.businesses[0]?.id,
          wabaId: wabaId ?? state.integration.wabaId,
          phoneNumberId: phone.id,
        }),
      })
      await api('/api/mensageria/connections', { method: 'PUT' })

      const waba = state.wabas.find((item) => item.id === (wabaId ?? phone.wabaId))
      const webhookSubscribed = waba?.webhookSubscribedAt
        ?? (state.integration.wabaId === waba?.id ? state.integration.webhookSubscribedAt : undefined)
      if (!webhookSubscribed) {
        const result = await api<{ ok?: boolean; error?: string | { message?: string } }>('/api/mensageria/connections/subscribe-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumberId: phone.id, wabaId: wabaId ?? phone.wabaId }) })
        if (result.ok === false) {
          throw new Error(typeof result.error === 'string' ? result.error : result.error?.message ?? 'Não foi possível ativar o webhook.')
        }
      }

      toast.success('Diagnóstico atualizado e correções automáticas aplicadas.')
      await reload()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível resolver as pendências automaticamente.')
      await reload()
    } finally {
      setBusy('')
    }
  }
  async function removeConnection() {
    if (!deleteTarget) return

    const target = deleteTarget
    setBusy(`delete:${target.id}`)
    try {
      await api('/api/mensageria/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId: target.id }),
      })
      setDeleteTarget(null)
      toast.success(`Conexão ${target.displayPhoneNumber} removida do painel.`)
      await reload()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível remover a conexão.')
    } finally {
      setBusy('')
    }
  }

  return <div className="space-y-5"><div className="flex flex-wrap gap-2"><FacebookOAuthButton onSuccess={(creds) => void oauth(creds)} /><Button variant="outline" className="gap-2" onClick={() => setManualOpen((value) => !value)}><Plus className="h-4 w-4" />Integrar manualmente</Button><Button variant="outline" className="gap-2" onClick={() => void sync()} disabled={busy === 'sync'}><RefreshCw className={cn('h-4 w-4', busy === 'sync' && 'animate-spin')} />Sincronizar Meta</Button></div>{manualOpen ? <AdminPanel title="Integração manual" description="Use os IDs do Business Manager, WABA e número fornecidos pela Meta."><div className="grid gap-3 md:grid-cols-2"><Field label="Business ID"><Input value={form.businessId} onChange={(event) => setForm((value) => ({ ...value, businessId: event.target.value }))} /></Field><Field label="WABA ID"><Input value={form.wabaId} onChange={(event) => setForm((value) => ({ ...value, wabaId: event.target.value }))} /></Field><Field label="Phone Number ID"><Input value={form.phoneNumberId} onChange={(event) => setForm((value) => ({ ...value, phoneNumberId: event.target.value }))} /></Field><Field label="Número"><Input value={form.phoneNumber} onChange={(event) => setForm((value) => ({ ...value, phoneNumber: event.target.value }))} /></Field></div><Button className="mt-4" onClick={() => void manualConnect()} disabled={!form.wabaId || !form.phoneNumberId || busy === 'manual'}>Salvar conexão</Button></AdminPanel> : null}{state.phoneNumbers.length === 0 ? <Alert><Phone className="h-4 w-4" /><AlertTitle>Nenhum número conectado</AlertTitle><AlertDescription>Conclua o Embedded Signup para carregar a WABA e o número real selecionado na Meta.</AlertDescription></Alert> : null}<div className="grid gap-4 xl:grid-cols-2">{state.phoneNumbers.map((phone, index) => { const issues = connectionIssues(phone, state); const healthy = issues.length === 0; const waba = state.wabas[index] ?? state.wabas[0]; const canRegister = phone.status?.toUpperCase() !== 'CONNECTED' && phone.codeVerificationStatus?.toUpperCase() === 'VERIFIED'; return <div key={phone.id} className={cn('rounded-xl border-2 bg-card p-5 shadow-sm', healthy ? 'border-emerald-400/70' : 'border-rose-400/70')}><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', healthy ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{healthy ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}</div><div><h3 className="font-semibold">{phone.verifiedName ?? 'WhatsApp conectado'}</h3><p className="text-sm text-muted-foreground">{phone.displayPhoneNumber}</p></div></div><Tooltip><TooltipTrigger asChild><button type="button" className="cursor-help rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={healthy ? 'Conexão pronta' : `Requer atenção: ${issues.map((issue) => issue.title).join(', ')}`}><Badge variant={healthy ? 'default' : 'destructive'}>{healthy ? 'Pronto' : 'Requer atenção'}</Badge></button></TooltipTrigger><TooltipContent side="left" className="w-80 max-w-[calc(100vw-2rem)] p-3 text-left"><p className="font-semibold">{healthy ? 'Conexão pronta' : `${issues.length} ${issues.length === 1 ? 'pendência encontrada' : 'pendências encontradas'}`}</p>{healthy ? <p className="mt-1 opacity-80">Status, qualidade, webhook e verificação estão regulares.</p> : <ul className="mt-2 space-y-2">{issues.map((issue) => <li key={issue.id}><span className="font-medium">{issue.title}</span><span className="mt-0.5 block opacity-80">{issue.detail}</span></li>)}</ul>} {!healthy ? <p className="mt-2 border-t border-background/20 pt-2 opacity-80">“Corrigir automaticamente” sincroniza o número e ativa o webhook. Confirmações por SMS ou ligação precisam ser concluídas na Meta.</p> : null}</TooltipContent></Tooltip></div><div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><ConnectionDetail label="Phone ID" value={maskId(phone.id)} /><ConnectionDetail label="WABA ID" value={maskId(waba?.id)} /><ConnectionDetail label="Qualidade" value={phone.qualityRating ?? 'Não informada'} /><ConnectionDetail label="Webhook" value={state.integration.webhookSubscribedAt ? 'Ativo' : 'Pendente'} /><ConnectionDetail label="Nome da conta" value={waba?.name ?? 'Não informado'} /><ConnectionDetail label="Última sincronização" value={state.integration.lastSyncAt ? new Date(state.integration.lastSyncAt).toLocaleString('pt-BR') : 'Nunca'} /><ConnectionDetail label="Pagamento" value="Regular" /><ConnectionDetail label="Verificação" value={phone.codeVerificationStatus ?? 'Pendente'} /></div><div className="mt-5 flex flex-wrap gap-2"><Button asChild size="sm"><Link href="/whatsapp/conversations">Ver conversas</Link></Button><Button size="sm" variant="outline" onClick={() => void select(phone)} disabled={busy === phone.id}>Usar como padrão</Button>{canRegister ? <Button size="sm" variant="outline" onClick={() => void register(phone)} disabled={busy === `register:${phone.id}`}><ShieldCheck className="mr-2 h-4 w-4" />{busy === `register:${phone.id}` ? 'Registrando...' : 'Registrar na Cloud API'}</Button> : null}{healthy ? null : <Button size="sm" variant="outline" onClick={() => void resolveIssues(phone, waba?.id)} disabled={busy === `resolve:${phone.id}`}><RefreshCw className={cn('mr-2 h-4 w-4', busy === `resolve:${phone.id}` && 'animate-spin')} />Corrigir automaticamente</Button>}<Button size="sm" variant="outline" onClick={() => void webhook()} disabled={busy === 'webhook' || Boolean(state.integration.webhookSubscribedAt)}><ShieldCheck className="mr-2 h-4 w-4" />{state.integration.webhookSubscribedAt ? 'Webhook ativo' : 'Ativar webhook'}</Button><Button size="icon" variant="ghost" className="text-destructive" aria-label={`Excluir conexão ${phone.displayPhoneNumber}`} onClick={() => setDeleteTarget(phone)} disabled={busy === `delete:${phone.id}`}><Trash2 className="h-4 w-4" /></Button></div></div> })}</div><AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !busy.startsWith('delete:')) setDeleteTarget(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover conexão do WhatsApp?</AlertDialogTitle><AlertDialogDescription>O número <strong className="text-foreground">{deleteTarget?.displayPhoneNumber}</strong> será removido deste painel, do fallback e das automações que o utilizam. O número não será excluído da sua conta na Meta.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy.startsWith('delete:')}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void removeConnection() }} disabled={busy.startsWith('delete:')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{busy.startsWith('delete:') ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Removendo...</> : 'Remover conexão'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
}

function ConnectionsV2({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const [manualOpen, setManualOpen] = useState(false)
  const [form, setForm] = useState({ businessId: '', wabaId: '', phoneNumberId: '', phoneNumber: '', verifiedName: '' })
  const [busy, setBusy] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WhatsAppPhoneNumber | null>(null)

  async function oauth(creds: WaOAuthCredentials) {
    await api('/api/mensageria/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: creds.businessId,
        wabaId: creds.businessAccountId,
        phoneNumberId: creds.phoneNumberId,
        phoneNumber: creds.phoneNumber,
        verifiedName: creds.verifiedName,
        status: creds.status,
        qualityRating: creds.qualityRating,
        codeVerificationStatus: creds.codeVerificationStatus,
        grantedPermissions: creds.grantedPermissions ?? [],
      }),
    })
    await reload()
  }

  async function manualConnect() {
    setBusy('manual')
    try {
      await api('/api/mensageria/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          grantedPermissions: ['business_management', 'whatsapp_business_management', 'whatsapp_business_messaging'],
        }),
      })
      setManualOpen(false)
      await reload()
    } finally {
      setBusy('')
    }
  }

  async function sync() {
    setBusy('sync')
    try {
      await api('/api/mensageria/connections', { method: 'PUT' })
      await reload()
    } finally {
      setBusy('')
    }
  }

  async function select(phone: WhatsAppPhoneNumber) {
    const waba = state.wabas.find((item) => item.id === phone.wabaId)
    setBusy(`select:${phone.id}`)
    try {
      await api('/api/mensageria/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: phone.businessId ?? waba?.businessId,
          wabaId: phone.wabaId,
          phoneNumberId: phone.id,
        }),
      })
      await reload()
    } finally {
      setBusy('')
    }
  }

  async function subscribeWebhook(phone: WhatsAppPhoneNumber) {
    setBusy(`webhook:${phone.id}`)
    try {
      const result = await api<{ ok?: boolean; error?: string | { message?: string } }>('/api/mensageria/connections/subscribe-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId: phone.id, wabaId: phone.wabaId }),
      })
      if (result.ok === false) throw new Error(typeof result.error === 'string' ? result.error : result.error?.message ?? 'Não foi possível ativar o webhook.')
      toast.success(`Webhook ativado para ${phone.verifiedName ?? phone.displayPhoneNumber}.`)
      await reload()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível ativar o webhook.')
    } finally {
      setBusy('')
    }
  }

  async function register(phone: WhatsAppPhoneNumber) {
    setBusy(`register:${phone.id}`)
    try {
      await api('/api/mensageria/connections/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId: phone.id }),
      })
      await sync()
      toast.success('Número registrado na Cloud API.')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível registrar o número.')
    } finally {
      setBusy('')
    }
  }

  async function removeConnection() {
    if (!deleteTarget) return
    const target = deleteTarget
    setBusy(`delete:${target.id}`)
    try {
      await api('/api/mensageria/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId: target.id }),
      })
      setDeleteTarget(null)
      toast.success(`Conexão ${target.displayPhoneNumber} removida do painel.`)
      await reload()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível remover a conexão.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <FacebookOAuthButton onSuccess={(creds) => void oauth(creds)} />
        <Button variant="outline" className="gap-2" onClick={() => setManualOpen((value) => !value)}><Plus className="h-4 w-4" />Integrar manualmente</Button>
        <Button variant="outline" className="gap-2" onClick={() => void sync()} disabled={busy === 'sync'}><RefreshCw className={cn('h-4 w-4', busy === 'sync' && 'animate-spin')} />Sincronizar todas</Button>
      </div>

      {manualOpen ? (
        <AdminPanel title="Integração manual" description="Cadastre o vínculo exato entre Business, WABA e Phone Number ID.">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Business ID"><Input value={form.businessId} onChange={(event) => setForm((value) => ({ ...value, businessId: event.target.value }))} /></Field>
            <Field label="WABA ID"><Input value={form.wabaId} onChange={(event) => setForm((value) => ({ ...value, wabaId: event.target.value }))} /></Field>
            <Field label="Phone Number ID"><Input value={form.phoneNumberId} onChange={(event) => setForm((value) => ({ ...value, phoneNumberId: event.target.value }))} /></Field>
            <Field label="Número"><Input value={form.phoneNumber} onChange={(event) => setForm((value) => ({ ...value, phoneNumber: event.target.value }))} /></Field>
          </div>
          <Button className="mt-4" onClick={() => void manualConnect()} disabled={!form.wabaId || !form.phoneNumberId || busy === 'manual'}>Salvar conexão</Button>
        </AdminPanel>
      ) : null}

      {state.phoneNumbers.length === 0 ? <Alert><Phone className="h-4 w-4" /><AlertTitle>Nenhum número conectado</AlertTitle><AlertDescription>Conclua o Embedded Signup para carregar uma WABA e seu número.</AlertDescription></Alert> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {state.phoneNumbers.map((phone) => {
          const waba = state.wabas.find((item) => item.id === phone.wabaId)
          const issues = connectionIssues(phone, waba, state)
          const healthy = issues.length === 0
          const webhookSubscribed = waba?.webhookSubscribedAt
            ?? (state.integration.wabaId === waba?.id ? state.integration.webhookSubscribedAt : undefined)
          const isDefault = state.integration.phoneNumberId === phone.id
          const canRegister = phone.status?.toUpperCase() !== 'CONNECTED' && phone.codeVerificationStatus?.toUpperCase() === 'VERIFIED'

          return (
            <div key={phone.id} className={cn('rounded-xl border-2 bg-card p-5 shadow-sm', healthy ? 'border-emerald-400/70' : 'border-rose-400/70')}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', healthy ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{healthy ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}</div>
                  <div><h3 className="font-semibold">{phone.verifiedName ?? 'WhatsApp conectado'}</h3><p className="text-sm text-muted-foreground">{phone.displayPhoneNumber}</p></div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild><button type="button" className="cursor-help rounded-full"><Badge variant={healthy ? 'default' : 'destructive'}>{healthy ? 'Pronto' : 'Requer atenção'}</Badge></button></TooltipTrigger>
                  <TooltipContent side="left" className="w-80 p-3 text-left"><p className="font-semibold">{healthy ? 'Conexão pronta' : 'Pendências da conexão'}</p>{issues.map((issue) => <p key={issue.id} className="mt-2"><strong>{issue.title}:</strong> {issue.detail}</p>)}</TooltipContent>
                </Tooltip>
              </div>

              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <ConnectionDetail label="Phone ID" value={maskId(phone.id)} />
                <ConnectionDetail label="WABA ID" value={maskId(phone.wabaId)} />
                <ConnectionDetail label="Qualidade" value={phone.qualityRating ?? 'Não informada'} />
                <ConnectionDetail label="Webhook desta WABA" value={webhookSubscribed ? 'Ativo' : 'Pendente'} />
                <ConnectionDetail label="Nome da conta" value={waba?.name ?? 'Não informado'} />
                <ConnectionDetail label="Verificação" value={phone.codeVerificationStatus ?? 'Pendente'} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm"><Link href="/whatsapp/conversations">Ver conversas</Link></Button>
                <Button size="sm" variant="outline" onClick={() => void select(phone)} disabled={isDefault || busy === `select:${phone.id}`}>{isDefault ? 'Número padrão' : 'Usar como padrão'}</Button>
                {canRegister ? <Button size="sm" variant="outline" onClick={() => void register(phone)} disabled={busy === `register:${phone.id}`}><ShieldCheck className="mr-2 h-4 w-4" />Registrar</Button> : null}
                <Button size="sm" variant="outline" onClick={() => void subscribeWebhook(phone)} disabled={Boolean(webhookSubscribed) || busy === `webhook:${phone.id}`}><ShieldCheck className="mr-2 h-4 w-4" />{webhookSubscribed ? 'Webhook ativo' : 'Ativar webhook'}</Button>
                <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Excluir conexão ${phone.displayPhoneNumber}`} onClick={() => setDeleteTarget(phone)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          )
        })}
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !busy.startsWith('delete:')) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remover conexão do WhatsApp?</AlertDialogTitle><AlertDialogDescription>O número <strong className="text-foreground">{deleteTarget?.displayPhoneNumber}</strong> será removido do painel. As automações vinculadas deixarão de enviar até que outro número seja escolhido.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void removeConnection() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover conexão</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ConnectionDetail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div> }

function Templates({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const [selectedPhone, setSelectedPhone] = useState(state.phoneNumbers[0]?.id ?? '')
  const [form, setForm] = useState({ name: '', body: '', footer: '', language: 'pt_BR', category: 'MARKETING' as TemplateCategory, buttonText: '', buttonUrl: '' })
  const [busy, setBusy] = useState(false)
  const variables = ['nome_cliente', 'primeiro_nome', 'telefone', 'email', 'numero_pedido', 'valor_pedido', 'status_pedido', 'codigo_rastreio', 'link_rastreio', 'link_pagamento', 'nome_loja', 'seller_phone']
  async function create(submitToMeta: boolean) { setBusy(true); try { const buttons: TemplateButton[] = form.buttonText ? [{ type: 'URL', text: form.buttonText, url: form.buttonUrl }] : []; await api('/api/mensageria/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, buttons, submitToMeta }) }); setForm((value) => ({ ...value, name: '', body: '', footer: '', buttonText: '', buttonUrl: '' })); await reload() } finally { setBusy(false) } }
  async function sync() { setBusy(true); try { await api(`/api/mensageria/templates?sync=1&wabaId=${encodeURIComponent(state.integration.wabaId ?? '')}`); await reload() } finally { setBusy(false) } }
  const approved = state.templates.filter((item) => item.status === 'APPROVED').length, pending = state.templates.filter((item) => item.status === 'PENDING').length, rejected = state.templates.filter((item) => item.status === 'REJECTED').length
  return <div className="space-y-5"><div className="flex justify-end"><Button variant="outline" className="gap-2" onClick={() => void sync()} disabled={busy}><RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />Sincronizar com a Meta</Button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{state.phoneNumbers.map((phone) => <button key={phone.id} type="button" onClick={() => setSelectedPhone(phone.id)} className={cn('rounded-xl border bg-card p-4 text-left shadow-sm transition-colors', selectedPhone === phone.id && 'border-primary ring-2 ring-primary/15')}><div className="flex items-center gap-3"><Phone className="h-5 w-5 text-primary" /><div><strong>{phone.verifiedName}</strong><p className="text-sm text-muted-foreground">{phone.displayPhoneNumber}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div><strong className="block text-emerald-600">{approved}</strong>Aprovados</div><div><strong className="block text-amber-600">{pending}</strong>Pendentes</div><div><strong className="block text-rose-600">{rejected}</strong>Recusados</div></div></button>)}</div><div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]"><AdminPanel title="Criar template" description="O modelo será vinculado ao número selecionado e poderá ser enviado para aprovação."><div className="space-y-3"><Field label="Nome do template"><Input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="pedido_confirmado" /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Categoria"><Select value={form.category} onValueChange={(category) => setForm((value) => ({ ...value, category: category as TemplateCategory }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MARKETING">Marketing</SelectItem><SelectItem value="UTILITY">Utilidade</SelectItem><SelectItem value="AUTHENTICATION">Autenticação</SelectItem></SelectContent></Select></Field><Field label="Idioma"><Select value={form.language} onValueChange={(language) => setForm((value) => ({ ...value, language }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pt_BR">Português (Brasil)</SelectItem><SelectItem value="en_US">Inglês (EUA)</SelectItem><SelectItem value="es">Espanhol</SelectItem></SelectContent></Select></Field></div><Field label="Texto do corpo"><Textarea rows={7} value={form.body} onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))} /></Field><div><Label>Inserir variável</Label><div className="mt-2 flex flex-wrap gap-2">{variables.map((variable) => <Button key={variable} type="button" size="sm" variant="outline" onClick={() => setForm((value) => ({ ...value, body: `${value.body}${value.body ? ' ' : ''}{{${variable}}}` }))}>{`{{${variable}}}`}</Button>)}</div></div><Field label="Rodapé"><Input value={form.footer} onChange={(event) => setForm((value) => ({ ...value, footer: event.target.value }))} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Texto do botão"><Input value={form.buttonText} onChange={(event) => setForm((value) => ({ ...value, buttonText: event.target.value }))} /></Field><Field label="URL do botão"><Input value={form.buttonUrl} onChange={(event) => setForm((value) => ({ ...value, buttonUrl: event.target.value }))} /></Field></div><div className="flex gap-2"><Button variant="outline" onClick={() => void create(false)} disabled={busy || !form.name || !form.body}>Salvar rascunho</Button><Button onClick={() => void create(true)} disabled={busy || !form.name || !form.body}>Enviar para aprovação</Button></div></div></AdminPanel><AdminPanel title="Prévia no WhatsApp" description="Visualização aproximada do template."><div className="rounded-xl bg-[#e7f3ed] p-4 dark:bg-emerald-950/20"><div className="ml-auto max-w-[90%] rounded-lg bg-white p-3 text-sm text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"><p className="whitespace-pre-wrap">{form.body || 'Digite o texto do template para visualizar.'}</p>{form.footer ? <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">{form.footer}</p> : null}{form.buttonText ? <div className="mt-3 border-t pt-2 text-center font-medium text-sky-600">{form.buttonText}</div> : null}</div></div></AdminPanel></div><AdminPanel title="Modelos cadastrados" description="Status e sincronização de todos os templates."><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Idioma</TableHead><TableHead>Status</TableHead><TableHead>Variáveis</TableHead><TableHead>Última sincronização</TableHead></TableRow></TableHeader><TableBody>{state.templates.map((template) => <TableRow key={template.id}><TableCell className="font-medium">{template.name}</TableCell><TableCell>{template.category}</TableCell><TableCell>{template.language}</TableCell><TableCell><TemplateStatus status={template.status} /></TableCell><TableCell>{template.variables.join(', ') || '—'}</TableCell><TableCell>{new Date(template.updatedAt).toLocaleString('pt-BR')}</TableCell></TableRow>)}</TableBody></Table></div></AdminPanel></div>
}

function TemplateStatus({ status }: { status: WhatsAppTemplate['status'] }) { return <Badge variant={status === 'APPROVED' ? 'default' : status === 'REJECTED' ? 'destructive' : 'secondary'}>{status === 'APPROVED' ? 'Aprovado' : status === 'REJECTED' ? 'Recusado' : status === 'PENDING' ? 'Pendente' : status}</Badge> }

function Conversations({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const [query, setQuery] = useState(''), [phoneId, setPhoneId] = useState('all'), [selectedId, setSelectedId] = useState(state.conversations[0]?.id ?? ''), [reply, setReply] = useState(''), [busy, setBusy] = useState(false)
  const conversations = state.conversations.filter((conversation) => (
    (phoneId === 'all' || phoneForConversation(state, conversation)?.id === phoneId)
    && `${contactFor(state, conversation)?.name ?? ''} ${conversation.maskedPhone} ${lastMessage(conversation)?.text ?? ''}`.toLowerCase().includes(query.toLowerCase())
  ))
  const selected = conversations.find((item) => item.id === selectedId) ?? conversations[0]
  async function sendReply() { if (!selected || !reply.trim()) return; setBusy(true); try { await api('/api/mensageria/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: selected.id, text: reply }) }); setReply(''); await reload() } finally { setBusy(false) } }
  const selectedConnection = phoneForConversation(state, selected)
  return <div className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="grid min-h-[680px] lg:grid-cols-[360px_1fr]"><aside className="border-b lg:border-b-0 lg:border-r"><div className="space-y-3 border-b p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversa" /></div><Select value={phoneId} onValueChange={setPhoneId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os números</SelectItem>{state.phoneNumbers.map((phone) => <SelectItem key={phone.id} value={phone.id}>{phone.verifiedName}</SelectItem>)}</SelectContent></Select></div><ScrollArea className="h-[300px] lg:h-[600px]">{conversations.map((conversation) => { const contact = contactFor(state, conversation), message = lastMessage(conversation), recurring = (contact?.orderCount ?? 0) > 0; return <button type="button" key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={cn('w-full border-b p-4 text-left hover:bg-muted/40', selected?.id === conversation.id && 'bg-muted/60')}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{contact?.name ?? conversation.contactName}</p><p className="truncate text-sm text-muted-foreground">{message?.text}</p></div><span className="text-[11px] text-muted-foreground">{message ? new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span></div><div className="mt-2 flex flex-wrap gap-1"><Badge variant={recurring ? 'default' : 'secondary'}>{recurring ? 'Lead recorrente' : 'Lead novo'}</Badge>{(contact?.orderCount ?? 0) > 0 ? <Badge variant="outline">Já fez pedido</Badge> : null}{message?.direction === 'inbound' ? <Badge variant="destructive">Sem resposta</Badge> : null}</div></button> })}{conversations.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa real recebida.</p> : null}</ScrollArea></aside><section className="flex min-h-[680px] flex-col">{selected ? <><header className="flex items-center justify-between border-b p-4"><div><h3 className="font-semibold">{contactFor(state, selected)?.name ?? selected.contactName}</h3><p className="text-sm text-muted-foreground">{selected.maskedPhone}</p><p className="text-xs text-muted-foreground">Atendido por {selectedConnection?.verifiedName ?? selectedConnection?.displayPhoneNumber ?? 'conexão não identificada'}</p></div><Badge><Target className="mr-1 h-3 w-3" />Em atendimento</Badge></header><ScrollArea className="flex-1 bg-[#efeae2] p-4 dark:bg-slate-950"><div className="mx-auto max-w-3xl space-y-3">{selected.messages.map((message) => <div key={message.id} className={cn('max-w-[85%] rounded-xl p-3 text-sm shadow-sm', message.direction === 'outbound' ? 'ml-auto bg-[#d9fdd3] text-slate-900' : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white')}><p>{message.text}</p><div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-60">{message.templateId ? <span className="inline-flex items-center gap-1"><Bot className="h-3 w-3" />Automação</span> : message.direction === 'outbound' ? <span>Painel / celular</span> : <span>Recebida</span>}<span>{new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div></div>)}</div></ScrollArea><footer className="flex gap-2 border-t p-4"><Input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Digite uma mensagem" onKeyDown={(event) => { if (event.key === 'Enter') void sendReply() }} /><Button size="icon" onClick={() => void sendReply()} disabled={busy || !reply.trim()}><Send className="h-4 w-4" /></Button></footer></> : <div className="flex flex-1 items-center justify-center text-muted-foreground">Selecione uma conversa</div>}</section></div></div>
}

function Automations({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const approved = state.templates.filter((template) => template.status === 'APPROVED')
  const [form, setForm] = useState({ name: '', eventType: 'customer.created' as ECommerceEventType, templateId: approved[0]?.id ?? '', delayMinutes: '0', fallbackPhoneNumberId: state.integration.phoneNumberId ?? state.phoneNumbers[0]?.id ?? '', senderStrategy: 'seller_then_fallback' as 'seller_then_fallback' | 'fallback_only', status: 'Active' as AutomationRule['status'] })
  const [busy, setBusy] = useState(false)
  async function create() { setBusy(true); try { await api('/api/mensageria/automations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, delayMinutes: Number(form.delayMinutes), conditions: {}, variableMapping: { nome_cliente: 'customer.name', numero_pedido: 'order.id', valor_pedido: 'order.total' } }) }); setForm((value) => ({ ...value, name: '' })); await reload() } finally { setBusy(false) } }
  async function toggle(rule: AutomationRule, enabled: boolean) { await api('/api/mensageria/automations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rule.id, status: enabled ? 'Active' : 'Paused' }) }); await reload() }
  return <div className="space-y-5"><Alert className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"><ShieldCheck className="h-4 w-4" /><AlertTitle>Roteamento por vendedora</AlertTitle><AlertDescription>Quando o payload contém <code>seller_phone</code>, o disparo usa o WhatsApp conectado da vendedora. Se ele não existir, a automação usa o número padrão de fallback.</AlertDescription></Alert><div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"><AdminPanel title="Criar automação" description="Evento + template aprovado + delay + origem do disparo."><div className="space-y-3"><Field label="Nome"><Input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Ex: Boas-vindas do cadastro" /></Field><Field label="Evento da UP Zero"><Select value={form.eventType} onValueChange={(eventType) => setForm((value) => ({ ...value, eventType: eventType as ECommerceEventType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ECOMMERCE_EVENT_DEFINITIONS.map((event) => <SelectItem key={event.type} value={event.type}>{event.type} · {event.label}</SelectItem>)}</SelectContent></Select></Field><Field label="Template aprovado"><Select value={form.templateId} onValueChange={(templateId) => setForm((value) => ({ ...value, templateId }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{approved.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Delay (minutos)"><Input type="number" min="0" value={form.delayMinutes} onChange={(event) => setForm((value) => ({ ...value, delayMinutes: event.target.value }))} /></Field><Field label="Número de fallback"><Select value={form.fallbackPhoneNumberId} onValueChange={(fallbackPhoneNumberId) => setForm((value) => ({ ...value, fallbackPhoneNumberId }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{state.phoneNumbers.map((phone) => <SelectItem key={phone.id} value={phone.id}>{phone.verifiedName}</SelectItem>)}</SelectContent></Select></Field></div><Field label="Origem do envio"><Select value={form.senderStrategy} onValueChange={(senderStrategy) => setForm((value) => ({ ...value, senderStrategy: senderStrategy as typeof form.senderStrategy }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="seller_then_fallback">Vendedora e depois fallback</SelectItem><SelectItem value="fallback_only">Sempre número padrão</SelectItem></SelectContent></Select></Field><Button className="w-full gap-2" onClick={() => void create()} disabled={busy || !form.name || !form.templateId}><Zap className="h-4 w-4" />Criar automação ativa</Button></div></AdminPanel><AdminPanel title="Automações configuradas" description="Ative, pause e acompanhe resultados."><div className="space-y-3">{state.automations.map((rule) => <div key={rule.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><strong>{rule.name}</strong><Badge variant="outline">{rule.eventType}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Template: {state.templates.find((item) => item.id === rule.templateId)?.name ?? 'Não selecionado'} · Delay: {rule.delayMinutes} min</p><p className="mt-1 text-xs text-muted-foreground">Fallback: {state.phoneNumbers.find((item) => item.id === rule.fallbackPhoneNumberId)?.verifiedName ?? 'Padrão da integração'}</p></div><Switch checked={rule.status === 'Active'} onCheckedChange={(checked) => void toggle(rule, checked)} /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg bg-muted/40 p-2"><strong className="block">{rule.totalRuns}</strong>execuções</div><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/20"><strong className="block">{rule.successfulRuns}</strong>sucessos</div><div className="rounded-lg bg-rose-50 p-2 text-rose-700 dark:bg-rose-950/20"><strong className="block">{rule.failedRuns}</strong>erros</div></div></div>)}{state.automations.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma automação configurada.</p> : null}</div></AdminPanel></div><AdminPanel title="Logs de envio" description="Envios concluídos, bloqueios e erros recentes."><div className="space-y-2">{state.automationLogs.slice(0, 10).map((log) => <div key={log.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center"><Badge variant={log.status === 'failed' || log.status === 'blocked' ? 'destructive' : log.status === 'sent' || log.status === 'delivered' ? 'default' : 'secondary'}>{log.status}</Badge><span className="font-medium">{log.eventType}</span><span className="flex-1 text-muted-foreground">{log.description}</span><span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString('pt-BR')}</span></div>)}{state.automationLogs.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Os logs aparecerão quando os eventos forem processados.</p> : null}</div></AdminPanel></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
