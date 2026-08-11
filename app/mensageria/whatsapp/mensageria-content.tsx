'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileText,
  Filter,
  Inbox,
  Info,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { AdminHero, AdminPage, AdminPanel, AdminToolbar } from '@/components/admin/admin-mobile-ui'
import { FacebookOAuthButton, type WaOAuthCredentials } from './facebook-oauth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ECOMMERCE_EVENT_DEFINITIONS } from '@/lib/whatsapp/ecommerce-events'
import { renderTemplate } from '@/lib/whatsapp/engine'
import { META_PERMISSIONS_NOT_REQUESTED_NOW, META_REQUIRED_PERMISSIONS } from '@/lib/whatsapp/types'
import type {
  Campaign,
  AutomationRule,
  Contact,
  ContactList,
  ECommerceEventDefinition,
  InboxConversation,
  ReviewChecklistItem,
  TemplateCategory,
  WhatsAppLog,
  WhatsAppState,
  WhatsAppTemplate,
} from '@/lib/whatsapp/types'

type UiState = WhatsAppState & { reviewChecklist: ReviewChecklistItem[] }
type TabKey = 'overview' | 'contacts' | 'campaigns' | 'automations' | 'inbox' | 'templates' | 'connection' | 'diagnostics'

const TABS: Array<{ value: TabKey; label: string; icon: typeof MessageSquare }> = [
  { value: 'overview', label: 'Visao Geral', icon: MessageSquare },
  { value: 'inbox', label: 'Inbox', icon: Inbox },
  { value: 'contacts', label: 'Clientes e Segmentos', icon: Users },
  { value: 'campaigns', label: 'Campanhas', icon: MessageSquare },
  { value: 'automations', label: 'Automacoes', icon: Zap },
  { value: 'templates', label: 'Templates', icon: FileText },
  { value: 'connection', label: 'Conexao Meta', icon: ShieldCheck },
  { value: 'diagnostics', label: 'Diagnostico', icon: Settings },
]

const statusClass: Record<string, string> = {
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  connected: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  failed: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300',
  needs_attention: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300',
  started: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-300',
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-300',
  not_started: 'border-border bg-muted text-muted-foreground',
  Active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  Draft: 'border-border bg-muted text-muted-foreground',
  Paused: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300',
  queued: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-300',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  read: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  responded: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  blocked: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300',
  ignored: 'border-border bg-muted text-muted-foreground',
  Missing: 'border-border bg-muted text-muted-foreground',
  Done: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  Failed: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300',
  'Needs attention': 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300',
  PAUSED: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300',
  UNKNOWN: 'border-border bg-muted text-muted-foreground',
  Scheduled: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-300',
  Sending: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-300',
  Sent: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  Cancelled: 'border-border bg-muted text-muted-foreground',
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : data?.error?.message ?? response.statusText)
  }
  return data as T
}

function mask(value?: string | null) {
  const raw = String(value ?? '').trim()
  if (!raw) return 'not selected'
  if (raw.length <= 6) return `${raw.slice(0, 2)}***`
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`
}

function maskPhone(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return 'not selected'
  if (digits.length < 6) return '****'
  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} *****-${digits.slice(-4)}`
}

function StatusPill({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    success: 'OK',
    ready: 'Pronto',
    connected: 'Conectado',
    completed: 'Concluido',
    failed: 'Erro',
    needs_attention: 'Atencao',
    info: 'Info',
    started: 'Em andamento',
    not_started: 'Pendente',
    Active: 'Ativa',
    Draft: 'Rascunho',
    Paused: 'Pausada',
    Missing: 'Pendente',
    Done: 'OK',
    Failed: 'Erro',
    'Needs attention': 'Atencao',
    APPROVED: 'Aprovado',
    PENDING: 'Pendente',
    REJECTED: 'Rejeitado',
    PAUSED: 'Pausado',
    UNKNOWN: 'Desconhecido',
    Scheduled: 'Agendada',
    Sending: 'Enviando',
    Sent: 'Enviada',
    Cancelled: 'Cancelada',
  }

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', statusClass[status] ?? statusClass.info)}>
      {labelMap[status] ?? status}
    </span>
  )
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p> : null}
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, hint, status = 'info' }: { icon: typeof MessageSquare; label: string; value: React.ReactNode; hint?: React.ReactNode; status?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', statusClass[status] ?? statusClass.info)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function WhatsAppPreview({ text, footer }: { text: string; footer?: string }) {
  return (
    <div className="rounded-lg border border-emerald-200/70 bg-[#e7f7ee] p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <div className="ml-auto max-w-[86%] rounded-lg bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100">
        <p className="whitespace-pre-wrap">{text || 'Digite uma mensagem para ver a previa.'}</p>
        {footer ? <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{footer}</p> : null}
        <p className="mt-1 text-right text-[10px] text-muted-foreground">agora</p>
      </div>
    </div>
  )
}

function formatCurrency(value?: number) {
  if (!value || value <= 0) return 'Estimativa pendente'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ContextLogs({ logs, types }: { logs: WhatsAppLog[]; types: string[] }) {
  const filtered = logs.filter((log) => types.includes(log.type)).slice(0, 4)
  if (filtered.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Logs contextuais</p>
      {filtered.map((log) => (
        <div key={log.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <StatusPill status={log.status} />
            <span className="font-medium">{log.description}</span>
          </div>
          {log.recommendedAction ? <p className="mt-1 text-muted-foreground">{log.recommendedAction}</p> : null}
        </div>
      ))}
    </div>
  )
}

function EmptyNotice({ title, description }: { title: string; description: string }) {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}

function selectedTemplate(state: UiState | null) {
  return state?.templates.find((template) => template.id === state.integration.selectedTemplateId)
}

function lastMessage(conversation: InboxConversation) {
  return conversation.messages.at(-1)
}

function isB2BContact(contact?: Contact) {
  if (!contact) return false
  const documentDigits = contact.document?.replace(/\D/g, '') ?? ''
  return contact.customerType === 'WHOLESALE' || documentDigits.length > 11 || contact.tags.some((tag) => /b2b|cnpj|empresa|atacado/i.test(tag))
}

function findContactByPhone(state: UiState, phone?: string) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return state.contacts.find((contact) => contact.phone.replace(/\D/g, '').endsWith(digits.slice(-8)))
}

function buildDashboardStats(state: UiState) {
  const leads = state.contacts.length
  const conversations = state.conversations.length
  const awaitingStore = state.conversations.filter((conversation) => lastMessage(conversation)?.direction === 'inbound').length
  const awaitingCustomer = state.conversations.filter((conversation) => lastMessage(conversation)?.direction === 'outbound').length
  const b2bContacts = state.contacts.filter(isB2BContact).length
  const b2bRate = leads > 0 ? Math.round((b2bContacts / leads) * 100) : 0
  const outboundConversations = state.conversations.filter((conversation) => conversation.messages.some((message) => message.direction === 'outbound')).length
  const repliedConversations = state.conversations.filter((conversation) => {
    const firstOutboundIndex = conversation.messages.findIndex((message) => message.direction === 'outbound')
    return firstOutboundIndex >= 0 && conversation.messages.slice(firstOutboundIndex + 1).some((message) => message.direction === 'inbound')
  }).length
  const replyRate = outboundConversations > 0 ? Math.round((repliedConversations / outboundConversations) * 100) : 0

  const responseTimes = state.conversations.flatMap((conversation) => {
    return conversation.messages.flatMap((message, index) => {
      if (message.direction !== 'inbound') return []
      const response = conversation.messages.slice(index + 1).find((candidate) => candidate.direction === 'outbound')
      if (!response) return []
      return [(new Date(response.timestamp).getTime() - new Date(message.timestamp).getTime()) / 60000]
    })
  }).filter((minutes) => minutes >= 0)
  const averageResponseMinutes = responseTimes.length > 0 ? Math.round(responseTimes.reduce((sum, item) => sum + item, 0) / responseTimes.length) : null

  const now = new Date()
  const daily = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (6 - index))
    const key = day.toISOString().slice(0, 10)
    const count = state.conversations.filter((conversation) => {
      const date = conversation.lastMessageAt ?? conversation.messages[0]?.timestamp
      return date?.slice(0, 10) === key
    }).length
    return { key, label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), count }
  })

  return { leads, conversations, awaitingStore, awaitingCustomer, b2bRate, replyRate, averageResponseMinutes, daily }
}

export default function MensageriaPage() {
  const [state, setState] = useState<UiState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setState(await api<UiState>('/api/mensageria/state'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as TabKey | null
    if (tab && TABS.some((item) => item.value === tab)) setActiveTab(tab)
    void load()
  }, [load])

  async function refreshMeta() {
    setRefreshing(true)
    try {
      await api('/api/mensageria/connections', { method: 'PUT' })
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  if (loading || !state) {
    return (
      <AdminPage>
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando mensageria...
        </div>
      </AdminPage>
    )
  }

  const business = state.businesses.find((item) => item.id === state.integration.businessId)
  const waba = state.wabas.find((item) => item.id === state.integration.wabaId)
  const phone = state.phoneNumbers.find((item) => item.id === state.integration.phoneNumberId)
  const failureLogs = state.logs.filter((log) => log.status === 'failed')
  const readyItems = [
    Boolean(business),
    Boolean(waba),
    Boolean(phone),
    Boolean(selectedTemplate(state)?.status === 'APPROVED'),
  ].filter(Boolean).length

  return (
    <AdminPage>
      <AdminHero
        icon={MessageSquare}
        eyebrow="CRM, campanhas e automacoes WhatsApp"
        title="Mensageria UpZero"
        description="Crie segmentos de clientes, campanhas e automacoes WhatsApp baseadas em cadastro, pedido, pagamento e entrega."
        actions={
          <>
            <Link href="/privacy">
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                Privacy
              </Button>
            </Link>
            <Button size="sm" className="gap-2" onClick={refreshMeta} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar Meta
            </Button>
          </>
        }
      />

      <IntegrationSummary state={state} businessName={business?.name} wabaName={waba?.name} phoneLabel={phone ? `${phone.verifiedName ?? 'Numero'} ${phone.displayPhoneNumber}` : undefined} readyItems={readyItems} />

      {state.integration.lastError ? (
        <Alert className="border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Falha de integracao</AlertTitle>
          <AlertDescription>{state.integration.lastError.message}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)} className="space-y-4">
        <AdminToolbar>
          <div className="overflow-x-auto">
            <TabsList className="h-auto min-w-max flex-wrap justify-start gap-1 bg-muted/50 p-1">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2 rounded-md px-3 py-2 text-xs">
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </AdminToolbar>

        <TabsContent value="overview"><OverviewTab state={state} failureCount={failureLogs.length} /></TabsContent>
        <TabsContent value="contacts"><ContactsTab state={state} reload={load} /></TabsContent>
        <TabsContent value="campaigns"><CampaignsTab state={state} reload={load} /></TabsContent>
        <TabsContent value="automations"><AutomationsTab state={state} reload={load} /></TabsContent>
        <TabsContent value="inbox"><InboxTab state={state} reload={load} /></TabsContent>
        <TabsContent value="templates"><TemplatesTab state={state} reload={load} /></TabsContent>
        <TabsContent value="connection"><ConnectionTab state={state} reload={load} /></TabsContent>
        <TabsContent value="diagnostics"><DiagnosticsTab state={state} reload={load} /></TabsContent>
      </Tabs>
    </AdminPage>
  )
}

function IntegrationSummary({ state, businessName, wabaName, phoneLabel, readyItems }: { state: UiState; businessName?: string; wabaName?: string; phoneLabel?: string; readyItems: number }) {
  const template = selectedTemplate(state)
  const statusTone = state.integration.status === 'ready' ? 'success' : state.integration.status === 'failed' ? 'failed' : 'needs_attention'

  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={statusTone} />
          <span className="font-semibold">{readyItems}/4 itens prontos</span>
          <span className="text-sm text-muted-foreground">{state.integration.alert ?? 'Meta configurada fica como infraestrutura; o uso diario acontece em clientes, campanhas e automacoes.'}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Ultimo sync: {state.integration.lastSyncAt ? new Date(state.integration.lastSyncAt).toLocaleString('pt-BR') : 'nunca'}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
        <ReadOnlyInfo label="Business" value={businessName ?? mask(state.integration.businessId)} status={businessName ? 'success' : 'needs_attention'} />
        <ReadOnlyInfo label="WABA" value={wabaName ?? mask(state.integration.wabaId)} status={wabaName ? 'success' : 'needs_attention'} />
        <ReadOnlyInfo label="Numero" value={phoneLabel ?? mask(state.integration.phoneNumberId)} status={phoneLabel ? 'success' : 'needs_attention'} />
        <ReadOnlyInfo label="Template padrao" value={template?.name ?? 'nao selecionado'} status={template?.status === 'APPROVED' ? 'success' : 'needs_attention'} />
      </div>
    </div>
  )
}

function ReadOnlyInfo({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-muted-foreground">{label}</span>
        <StatusPill status={status} />
      </div>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  )
}

function OverviewTab({ state, failureCount }: { state: UiState; failureCount: number }) {
  const stats = buildDashboardStats(state)
  const activeAutomations = state.automations.filter((automation) => automation.status === 'Active').length
  const maxDaily = Math.max(...stats.daily.map((day) => day.count), 1)
  const stalledAlerts = state.conversations
    .map((conversation) => ({ conversation, message: lastMessage(conversation), contact: findContactByPhone(state, conversation.phone) }))
    .filter(({ message }) => Boolean(message))
    .slice(0, 6)
  const recentLogs = state.logs.slice(0, 8)
  const responseTone = stats.averageResponseMinutes === null ? 'info' : stats.averageResponseMinutes <= 20 ? 'success' : stats.averageResponseMinutes <= 60 ? 'needs_attention' : 'failed'

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Painel operacional"
        title="Acompanhamento de WhatsApp e E-Commerce"
        description="Indicadores calculados a partir das conversas, clientes, campanhas, automacoes e logs que ja existem no app."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Leads - Conversas" value={`${stats.leads} / ${stats.conversations}`} hint="Leads cadastrados e conversas no Inbox." status={stats.conversations > 0 ? 'success' : 'info'} />
        <MetricCard icon={Clock} label="Tempo medio de resposta" value={stats.averageResponseMinutes === null ? 'Sem dados' : `${stats.averageResponseMinutes} min`} hint="Tempo entre mensagem do cliente e resposta da loja." status={responseTone} />
        <MetricCard icon={Activity} label="Taxa de resposta dos leads" value={`${stats.replyRate}%`} hint="Conversas abordadas que tiveram retorno do cliente." status={stats.replyRate >= 40 ? 'success' : 'needs_attention'} />
        <MetricCard icon={Building2} label="% de leads B2B" value={`${stats.b2bRate}% B2B`} hint="Inferido por tipo wholesale, CNPJ ou tags empresariais." status={stats.b2bRate > 0 ? 'success' : 'info'} />
        <MetricCard icon={Send} label="Sem resposta do cliente" value={stats.awaitingCustomer} hint="Ultima mensagem foi enviada pela loja." status={stats.awaitingCustomer > 0 ? 'needs_attention' : 'success'} />
        <MetricCard icon={Inbox} label="Sem resposta da loja" value={stats.awaitingStore} hint="Cliente enviou mensagem e aguarda atendimento." status={stats.awaitingStore > 0 ? 'failed' : 'success'} />
        <MetricCard icon={Zap} label="Automacoes ativas" value={activeAutomations} hint={`${state.automations.length} regras criadas no total.`} status={activeAutomations > 0 ? 'success' : 'needs_attention'} />
        <MetricCard icon={ListChecks} label="Avisos e falhas" value={failureCount} hint="Falhas recentes nos logs globais." status={failureCount > 0 ? 'failed' : 'success'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <AdminPanel title="Conversas por dia" description="Volume diario de conversas nos ultimos 7 dias.">
          <div className="flex h-64 items-end gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
            {stats.daily.map((day) => (
              <div key={day.key} className="flex h-full flex-1 flex-col justify-end gap-2">
                <div className="flex flex-1 items-end">
                  <div className="w-full rounded-t-md bg-primary/80" style={{ height: `${Math.max((day.count / maxDaily) * 100, day.count > 0 ? 10 : 2)}%` }} title={`${day.count} conversas`} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold">{day.count}</p>
                  <p className="text-[11px] text-muted-foreground">{day.label}</p>
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Avisos inteligentes" description="Clientes e leads que merecem atencao operacional.">
          <div className="space-y-2">
            {stalledAlerts.length === 0 ? <EmptyNotice title="Sem conversas para analisar" description="Quando mensagens reais chegarem, os alertas aparecem aqui." /> : null}
            {stalledAlerts.map(({ conversation, message, contact }) => {
              const pendingStore = message?.direction === 'inbound'
              const hours = message ? Math.round((Date.now() - new Date(message.timestamp).getTime()) / 3600000) : 0
              return (
                <div key={conversation.id} className="rounded-lg border border-border/60 bg-card/80 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{contact?.name ?? conversation.maskedPhone}</p>
                      <p className="text-xs text-muted-foreground">{pendingStore ? 'Cliente aguardando resposta da loja' : 'Cliente ainda nao respondeu a loja'} ha {hours}h</p>
                    </div>
                    <StatusPill status={pendingStore ? 'failed' : 'needs_attention'} />
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{message?.text}</p>
                </div>
              )
            })}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel title="Logs e avisos recentes" description="Eventos recentes de mensagens, automacoes, campanhas, templates, API, Meta e E-Commerce.">
        <LogFilterList logs={recentLogs} compact />
      </AdminPanel>
    </div>
  )
}

function ConnectionTab({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const [businessId, setBusinessId] = useState(state.integration.businessId ?? '')
  const [wabaId, setWabaId] = useState(state.integration.wabaId ?? '')
  const [phoneNumberId, setPhoneNumberId] = useState(state.integration.phoneNumberId ?? '')
  const [saving, setSaving] = useState(false)

  async function saveSelection() {
    setSaving(true)
    try {
      await api('/api/mensageria/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, wabaId, phoneNumberId }),
      })
      await reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleOAuthSuccess(creds: WaOAuthCredentials) {
    await api('/api/mensageria/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: creds.businessId,
        wabaId: creds.businessAccountId,
        phoneNumberId: creds.phoneNumberId,
        phoneNumber: creds.phoneNumber,
        grantedPermissions: creds.grantedPermissions ?? [],
      }),
    })
    await reload()
  }

  const missing = state.integration.metaUser?.missingPermissions ?? META_REQUIRED_PERMISSIONS

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Login Embed e ativos Meta"
        title="Conexão Meta"
        description="Fluxo real de OAuth, Business Manager, WABA, numero conectado, permissoes e sincronizacao. Os detalhes tecnicos ficam visiveis sem expor tokens."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ShieldCheck} label="Status Meta" value={state.integration.connectionStatus} hint="Estado geral da integracao." status={state.integration.connectionStatus === 'ready' ? 'success' : state.integration.connectionStatus === 'failed' ? 'failed' : 'needs_attention'} />
        <MetricCard icon={Building2} label="Business" value={state.businesses.find((item) => item.id === state.integration.businessId)?.name ?? 'Nao selecionado'} hint={mask(state.integration.businessId)} status={state.integration.businessId ? 'success' : 'needs_attention'} />
        <MetricCard icon={MessageSquare} label="WABA" value={state.wabas.find((item) => item.id === state.integration.wabaId)?.name ?? 'Nao selecionada'} hint={mask(state.integration.wabaId)} status={state.integration.wabaId ? 'success' : 'needs_attention'} />
        <MetricCard icon={Phone} label="Numero" value={state.phoneNumbers.find((item) => item.id === state.integration.phoneNumberId)?.displayPhoneNumber ?? 'Nao conectado'} hint={mask(state.integration.phoneNumberId)} status={state.integration.phoneNumberId ? 'success' : 'needs_attention'} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel title="Processo de conexão" description="Fluxo real de OAuth e selecao de ativos WhatsApp. IDs aparecem mascarados na UI.">
          <div className="space-y-4">
          <FacebookOAuthButton onSuccess={(creds) => void handleOAuthSuccess(creds)} />

          <div className="grid gap-3 sm:grid-cols-2">
            <StatusLine label="OAuth" status={state.integration.oauthStatus} success="Connected: Meta OAuth completed and required permissions were granted." failure="Failed: complete Meta OAuth and grant permissions." />
            <StatusLine label="Permissoes ausentes" status={missing.length === 0 ? 'success' : 'needs_attention'} success="Ready: all required permissions are present." failure={missing.length > 0 ? `Failed: ${missing.join(', ')} permission was not granted.` : 'No permission data returned yet.'} />
            <StatusLine label="Business" status={state.integration.businessId ? 'success' : 'needs_attention'} success="Business Manager selected." failure="Needs attention: No Business Manager selected." />
            <StatusLine label="WABA" status={state.integration.wabaId ? 'success' : 'needs_attention'} success="WhatsApp Business Account selected." failure="Needs attention: No WhatsApp Business Account selected." />
            <StatusLine label="Numero" status={state.integration.phoneNumberId ? 'success' : 'needs_attention'} success="WhatsApp phone number selected." failure="Needs attention: No WhatsApp phone number selected." />
            <StatusLine label="Ready" status={state.integration.status === 'ready' ? 'success' : 'needs_attention'} success="Ready: Business, WABA, phone number and approved template are configured." failure="Configure Business, WABA, phone number and an approved template." />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/25 p-3 text-xs">
            <p className="font-semibold">Usuario Meta conectado</p>
            <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
              <span>Nome: <strong className="text-foreground">{state.integration.metaUser?.name ?? 'not available'}</strong></span>
              <span>Email: <strong className="text-foreground">{state.integration.metaUser?.email ?? 'not available'}</strong></span>
              <span>Granted: <strong className="text-foreground">{state.integration.metaUser?.grantedPermissions?.join(', ') || 'not returned yet'}</strong></span>
              <span>Missing: <strong className="text-foreground">{missing.join(', ') || 'none'}</strong></span>
            </div>
          </div>

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Permissoes solicitadas agora</AlertTitle>
            <AlertDescription>
              {META_REQUIRED_PERMISSIONS.join(', ')}. Nao solicitamos nesta etapa: {META_PERMISSIONS_NOT_REQUESTED_NOW.join(', ')}.
            </AlertDescription>
          </Alert>
          </div>
        </AdminPanel>

        <AdminPanel title="Selecionar ativos" description="Liste, selecione e salve Business, WABA e numero WhatsApp usados pelo produto.">
          <div className="space-y-4">
          <SelectBlock label="Business Managers" value={businessId} onChange={setBusinessId} placeholder="Selecionar Business" items={state.businesses.map((item) => ({ value: item.id, label: item.name, hint: mask(item.id) }))} />
          <SelectBlock label="WhatsApp Business Accounts" value={wabaId} onChange={setWabaId} placeholder="Selecionar WABA" items={state.wabas.map((item) => ({ value: item.id, label: item.name, hint: mask(item.id) }))} />
          <SelectBlock label="Numeros WhatsApp" value={phoneNumberId} onChange={setPhoneNumberId} placeholder="Selecionar numero" items={state.phoneNumbers.map((item) => ({ value: item.id, label: item.displayPhoneNumber, hint: `${item.verifiedName ?? 'Sem nome'} | ${mask(item.id)}` }))} />
          <Button onClick={saveSelection} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar conexao
          </Button>
          <ContextLogs logs={state.logs} types={['oauth_started', 'oauth_completed', 'permission_missing', 'business_loaded', 'waba_loaded', 'phone_selected', 'connection_saved']} />
          </div>
        </AdminPanel>
      </div>
    </div>
  )
}

function StatusLine({ label, status, success, failure }: { label: string; status: string; success: string; failure: string }) {
  const ok = status === 'success' || status === 'ready' || status === 'completed' || status === 'connected'
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{label}</p>
        <StatusPill status={status} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{ok ? success : failure}</p>
    </div>
  )
}

function SelectBlock({ label, value, onChange, placeholder, items }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; items: Array<{ value: string; label: string; hint?: string }> }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}{item.hint ? ` - ${item.hint}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum item real carregado ainda. Clique em Atualizar Meta depois de conectar.</p> : null}
    </div>
  )
}

function TemplatesTab({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ name: '', category: 'MARKETING' as TemplateCategory, language: 'pt_BR', body: '', footer: '', examples: '' })
  const [submitting, setSubmitting] = useState(false)
  const availableVariables = ['nome_cliente', 'primeiro_nome', 'telefone', 'email', 'numero_pedido', 'valor_pedido', 'status_pedido', 'codigo_rastreio', 'link_rastreio', 'link_pagamento', 'nome_loja', 'cnpj', 'estado', 'cidade']
  const exampleValues = Object.fromEntries(
    form.examples.split('\n').map((line) => line.split('=').map((part) => part.trim())).filter(([key, value]) => key && value),
  )
  const previewText = renderTemplate(form.body, exampleValues)

  async function sync() {
    await api('/api/mensageria/templates?sync=1')
    await reload()
  }

  async function createTemplate(submitToMeta: boolean) {
    setSubmitting(true)
    try {
      const exampleValues = Object.fromEntries(
        form.examples.split('\n').map((line) => line.split('=').map((part) => part.trim())).filter(([key, value]) => key && value),
      )
      await api('/api/mensageria/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, exampleValues, submitToMeta }),
      })
      setForm({ name: '', category: 'MARKETING', language: 'pt_BR', body: '', footer: '', examples: '' })
      await reload()
    } finally {
      setSubmitting(false)
    }
  }

  async function selectTemplate(templateId: string) {
    await api('/api/mensageria/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: templateId, select: true }),
    })
    await reload()
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Mensagens aprovadas"
        title="Templates WhatsApp"
        description="Crie, acompanhe status da Meta e selecione templates aprovados para campanhas, automacoes e envio de teste."
        action={<Button variant="outline" size="sm" onClick={sync} className="gap-2"><RefreshCw className="h-4 w-4" />Atualizar templates da Meta</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel title="Templates existentes" description="Somente templates APPROVED podem ser usados em envios que iniciam conversa.">
          <div className="space-y-3">
            {state.templates.length === 0 ? <EmptyNotice title="Nenhum template carregado" description="Conecte a WABA e sincronize templates reais da Meta. Drafts locais ficam marcados como local_draft." /> : null}
            {state.templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-border/60 bg-card/80 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{template.name}</p>
                      <StatusPill status={template.status} />
                      <Badge variant="outline">{template.category}</Badge>
                      <Badge variant="secondary">{template.language}</Badge>
                      <Badge variant="outline">{template.source}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{template.body || 'Sem body retornado pela API.'}</p>
                  </div>
                  <Button size="sm" disabled={template.status !== 'APPROVED'} onClick={() => selectTemplate(template.id)}>Selecionar aprovado</Button>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                  <span>Componentes: {template.components.map((component) => component.type).join(', ') || 'none'}</span>
                  <span>Variaveis: {template.variables.join(', ') || 'none'}</span>
                  <span>ID: {mask(template.metaTemplateId ?? template.id)}</span>
                </div>
                <div className="mt-3"><WhatsAppPreview text={renderTemplate(template.body, template.exampleValues)} footer={template.footer} /></div>
                {template.status === 'REJECTED' ? <p className="mt-2 text-xs text-rose-600">Motivo: {template.rejectionReason ?? 'Meta did not return a rejection reason.'}</p> : null}
                {template.status === 'PENDING' ? <p className="mt-2 text-xs text-amber-700">Template pendente ainda nao pode ser usado para envio.</p> : null}
              </div>
            ))}
            <ContextLogs logs={state.logs} types={['templates_synced', 'template_created', 'template_approved', 'template_rejected']} />
          </div>
        </AdminPanel>

        <div className="space-y-4">
          <AdminPanel title="Criar template ou draft" description="Submeta para Meta apenas quando WABA e token de servidor estiverem configurados. Caso contrario, salva draft local seguro.">
            <div className="space-y-3">
              <Field label="Nome do template"><Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="ex: pedido_confirmado" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Categoria">
                  <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as TemplateCategory }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKETING">MARKETING</SelectItem>
                      <SelectItem value="UTILITY">UTILITY</SelectItem>
                      <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Idioma"><Input value={form.language} onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))} /></Field>
              </div>
              <Field label="Corpo da mensagem"><Textarea rows={7} value={form.body} onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))} placeholder="Ola {{nome_cliente}}, seu pedido {{numero_pedido}} foi confirmado." /></Field>
              <Field label="Rodape"><Input value={form.footer} onChange={(e) => setForm((prev) => ({ ...prev, footer: e.target.value }))} /></Field>
              <Field label="Exemplos de valores (um por linha: nome_cliente=Joao)"><Textarea rows={3} value={form.examples} onChange={(e) => setForm((prev) => ({ ...prev, examples: e.target.value }))} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={submitting} onClick={() => createTemplate(false)}>Salvar draft</Button>
                <Button disabled={submitting} onClick={() => createTemplate(true)}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Submit for approval</Button>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel title="Variaveis disponiveis" description="Copie ou use no corpo do template com chaves duplas.">
            <div className="flex flex-wrap gap-2">
              {availableVariables.map((variable) => (
                <button key={variable} type="button" onClick={() => setForm((prev) => ({ ...prev, body: `${prev.body}${prev.body ? ' ' : ''}{{${variable}}}` }))} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted">
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Previa" description="Visualizacao aproximada de como a mensagem aparece no WhatsApp.">
            <WhatsAppPreview text={previewText} footer={form.footer} />
          </AdminPanel>
        </div>
      </div>
    </div>
  )
}

function TestSendTab({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const approvedTemplates = state.templates.filter((template) => template.status === 'APPROVED')
  const defaultTemplateId = state.integration.selectedTemplateId && approvedTemplates.some((template) => template.id === state.integration.selectedTemplateId)
    ? state.integration.selectedTemplateId
    : approvedTemplates[0]?.id ?? ''
  const [templateId, setTemplateId] = useState(defaultTemplateId)
  const [recipientPhone, setRecipientPhone] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [optInConfirmed, setOptInConfirmed] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; messageId?: string; error?: { message?: string; action?: string } | string; preview?: string } | null>(null)
  const [sending, setSending] = useState(false)
  const template = state.templates.find((item) => item.id === templateId)
  const preview = template ? renderTemplate(template.body, values) : ''

  async function send() {
    setSending(true)
    setResult(null)
    try {
      const response = await api<typeof result>('/api/mensageria/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientPhone, templateId, values, optInConfirmed }),
      })
      setResult(response)
      await reload()
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <AdminPanel title="Envio de teste" description="Usa template APPROVED para iniciar conversa. Tokens nunca sao exibidos.">
        <div className="space-y-4">
          {!state.integration.phoneNumberId ? <EmptyNotice title="Numero nao conectado" description="Nao e permitido enviar sem numero WhatsApp conectado." /> : null}
          {approvedTemplates.length === 0 ? <EmptyNotice title="Template aprovado ausente" description="Nao e permitido enviar sem template APPROVED." /> : null}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Destinatario real para teste</AlertTitle>
            <AlertDescription>
              Digite aqui um numero WhatsApp real com opt-in. Se o remetente selecionado for o numero de teste da Meta,
              a Meta tambem exige que esse destinatario esteja adicionado e verificado em WhatsApp &gt; API Setup &gt;
              Manage phone number list. Com um numero real conectado na WABA, essa lista de teste deixa de ser o bloqueio.
            </AlertDescription>
          </Alert>
          <Field label="Numero WhatsApp do destinatario"><Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="+55 11 99999-0000" /></Field>
          <Field label="Template aprovado">
            <Select value={templateId} onValueChange={(value) => { setTemplateId(value); setValues({}) }}>
              <SelectTrigger><SelectValue placeholder="Selecione um template aprovado" /></SelectTrigger>
              <SelectContent>{approvedTemplates.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {template?.variables.map((variable) => (
            <Field key={variable} label={`Variavel {{${variable}}}`}>
              <Input value={values[variable] ?? ''} onChange={(e) => setValues((prev) => ({ ...prev, [variable]: e.target.value }))} />
            </Field>
          ))}
          <label className="flex items-start gap-2 rounded-lg border border-border/60 p-3 text-sm">
            <Checkbox checked={optInConfirmed} onCheckedChange={(checked) => setOptInConfirmed(Boolean(checked))} />
            <span>Confirmo que o destinatario deu opt-in para receber mensagens WhatsApp desta empresa.</span>
          </label>
          <Button onClick={send} disabled={sending || !state.integration.phoneNumberId || !templateId || !recipientPhone || !optInConfirmed} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send WhatsApp Message
          </Button>
        </div>
      </AdminPanel>

      <AdminPanel title="Preview, status e evento" description="Erros sao sanitizados e message ID aparece mascarado no log global.">
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Preview</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{preview || 'Selecione um template aprovado para visualizar a mensagem final.'}</p>
          </div>
          {result ? (
            <Alert className={result.ok ? statusClass.success : statusClass.failed}>
              {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle>{result.ok ? 'Mensagem enviada' : 'Envio falhou'}</AlertTitle>
              <AlertDescription>
                {result.ok ? `Message ID: ${mask(result.messageId)}` : typeof result.error === 'string' ? result.error : result.error?.message}
                {!result.ok && typeof result.error === 'object' && result.error?.action ? <span className="mt-2 block">{result.error.action}</span> : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <ContextLogs logs={state.logs} types={['message_sent']} />
        </div>
      </AdminPanel>
    </div>
  )
}

function InboxTab({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'store' | 'customer' | 'b2b'>('all')
  const [selectedId, setSelectedId] = useState(state.conversations[0]?.id ?? '')
  const [reply, setReply] = useState('')
  const [replyResult, setReplyResult] = useState<{ ok: boolean; message?: string; action?: string; messageId?: string } | null>(null)
  const [sendingReply, setSendingReply] = useState(false)
  const conversations = state.conversations.filter((conversation) => {
    const contact = findContactByPhone(state, conversation.phone)
    const message = lastMessage(conversation)
    const matchesQuery = conversation.maskedPhone.includes(query) || contact?.name.toLowerCase().includes(query.toLowerCase()) || conversation.messages.some((item) => item.text.toLowerCase().includes(query.toLowerCase()))
    const matchesFilter =
      filter === 'all' ||
      (filter === 'store' && message?.direction === 'inbound') ||
      (filter === 'customer' && message?.direction === 'outbound') ||
      (filter === 'b2b' && isB2BContact(contact))
    return matchesQuery && matchesFilter
  })
  const selected = state.conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0]
  const selectedContact = findContactByPhone(state, selected?.phone)

  async function queueReply() {
    if (!selected || !reply.trim()) return
    setSendingReply(true)
    setReplyResult(null)
    try {
      const response = await api<{ ok?: boolean; messageId?: string; error?: string | { message?: string; action?: string } }>('/api/mensageria/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.id, text: reply }),
      })
      if (response.ok) {
        setReplyResult({ ok: true, message: 'Resposta enviada pela Cloud API.', messageId: response.messageId })
        setReply('')
      } else {
        setReplyResult({
          ok: false,
          message: typeof response.error === 'string' ? response.error : response.error?.message ?? 'Nao foi possivel enviar a resposta.',
          action: typeof response.error === 'object' ? response.error?.action : undefined,
        })
      }
      await reload()
    } catch (error) {
      setReplyResult({ ok: false, message: error instanceof Error ? error.message : 'Nao foi possivel enviar a resposta.' })
    } finally {
      setSendingReply(false)
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Atendimento"
        title="Inbox WhatsApp"
        description="Conversas recebidas por webhook, envios do app e respostas livres dentro da janela de atendimento de 24h."
        action={<Button variant="outline" size="sm" onClick={reload} className="gap-2"><RefreshCw className="h-4 w-4" />Refresh manual</Button>}
      />
      <div className="grid min-h-[680px] overflow-hidden rounded-lg border border-border/60 bg-card/95 shadow-sm xl:grid-cols-[340px_minmax(0,1fr)_300px]">
        <aside className="border-b border-border/60 bg-muted/20 xl:border-b-0 xl:border-r">
          <div className="space-y-3 border-b border-border/60 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar conversa" className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['all', 'Todas'],
                ['store', 'Aguardando loja'],
                ['customer', 'Aguardando cliente'],
                ['b2b', 'Leads B2B'],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value as typeof filter)} className={cn('rounded-full border px-2.5 py-1 text-xs', filter === value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {conversations.length === 0 ? <div className="p-3"><EmptyNotice title="Inbox vazio" description="Quando o webhook receber mensagens WhatsApp reais, elas aparecem aqui." /></div> : null}
            {conversations.map((conversation) => {
              const contact = findContactByPhone(state, conversation.phone)
              const message = lastMessage(conversation)
              const pendingStore = message?.direction === 'inbound'
              return (
                <button key={conversation.id} type="button" onClick={() => setSelectedId(conversation.id)} className={cn('flex w-full gap-3 border-b border-border/60 p-3 text-left transition-colors hover:bg-muted/50', selected?.id === conversation.id && 'bg-primary/5')}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{(contact?.name ?? conversation.maskedPhone).slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{contact?.name ?? conversation.contactName ?? conversation.maskedPhone}</p>
                      <span className="text-[10px] text-muted-foreground">{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{conversation.maskedPhone}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{message?.text}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {pendingStore ? <Badge variant="destructive" className="text-[10px]">aguardando loja</Badge> : <Badge variant="outline" className="text-[10px]">aguardando cliente</Badge>}
                      {isB2BContact(contact) ? <Badge variant="outline" className="text-[10px]">B2B</Badge> : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="flex min-h-[620px] flex-col">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">{(selectedContact?.name ?? selected.maskedPhone).slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{selectedContact?.name ?? selected.maskedPhone}</p>
                    <p className="text-xs text-muted-foreground">Janela 24h: {selected.windowExpiresAt ? new Date(selected.windowExpiresAt).toLocaleString('pt-BR') : 'nao detectada'}</p>
                  </div>
                </div>
                <StatusPill status={selected.windowExpiresAt && new Date(selected.windowExpiresAt) > new Date() ? 'success' : 'needs_attention'} />
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#e7f7ee] p-4 dark:bg-emerald-950/10">
                {selected.messages.map((message) => (
                  <div key={message.id} className={cn('flex', message.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm', message.direction === 'outbound' ? 'bg-primary text-primary-foreground' : 'border border-border/60 bg-card')}>
                      {message.templateId ? <Badge variant="outline" className="mb-2 text-[10px]">template</Badge> : null}
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      <p className={cn('mt-1 text-right text-[10px]', message.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{new Date(message.timestamp).toLocaleString('pt-BR')} | {message.status}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 border-t border-border/60 p-3">
                {replyResult ? (
                  <Alert className={replyResult.ok ? statusClass.success : statusClass.failed}>
                    {replyResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <AlertTitle>{replyResult.ok ? 'Resposta enviada' : 'Resposta nao enviada'}</AlertTitle>
                    <AlertDescription>
                      {replyResult.ok && replyResult.messageId ? `Message ID: ${mask(replyResult.messageId)}` : replyResult.message}
                      {!replyResult.ok && replyResult.action ? <span className="mt-2 block">{replyResult.action}</span> : null}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex gap-2">
                  <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder quando permitido pela janela de 24h" />
                  <Button onClick={queueReply} disabled={sendingReply || !reply.trim()} className="gap-2">
                    {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Responder
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6"><EmptyNotice title="Nenhuma conversa selecionada" description="Receba um webhook real ou envie uma mensagem de teste para iniciar uma conversa." /></div>
          )}
        </main>

        <aside className="border-t border-border/60 bg-muted/20 p-4 xl:border-l xl:border-t-0">
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">{(selectedContact?.name ?? selected?.maskedPhone ?? '?').slice(0, 1).toUpperCase()}</div>
              <p className="mt-2 font-semibold">{selectedContact?.name ?? selected?.maskedPhone ?? 'Contato'}</p>
              <p className="text-xs text-muted-foreground">{selected?.maskedPhone}</p>
            </div>
            <div className="space-y-2 text-sm">
              <ProfileLine icon={Building2} label="Tipo" value={isB2BContact(selectedContact) ? 'B2B' : 'Nao identificado'} />
              <ProfileLine icon={Mail} label="E-mail" value={selectedContact?.email ?? 'Nao informado'} />
              <ProfileLine icon={MapPin} label="Local" value={`${selectedContact?.city ?? '-'} / ${selectedContact?.state ?? '-'}`} />
              <ProfileLine icon={CircleDollarSign} label="Total comprado" value={formatCurrency(selectedContact?.totalSpent)} />
              <ProfileLine icon={ListChecks} label="Pedidos" value={String(selectedContact?.orderCount ?? 0)} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tags</p>
              <div className="mt-2 flex flex-wrap gap-1">{selectedContact?.tags.length ? selectedContact.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>) : <span className="text-xs text-muted-foreground">Sem tags</span>}</div>
            </div>
            <ContextLogs logs={state.logs} types={['webhook_received', 'inbox_updated']} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function ProfileLine({ icon: Icon, label, value }: { icon: typeof MessageSquare; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 p-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function CampaignsTab({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const approvedTemplates = state.templates.filter((template) => template.status === 'APPROVED')
  const [form, setForm] = useState({ name: '', listId: '', templateId: '', scheduledAt: '', estimatedCost: '0', tags: '', minOrderValue: '', countryCode: '55' })
  const avgCostPerMessage = state.campaigns.find((campaign) => campaign.metrics.costPerMessage > 0)?.metrics.costPerMessage ?? 0
  const suggestedAudiences = [
    { name: 'Todos os contatos', description: 'Base completa de clientes e leads cadastrados.', count: state.contacts.length, tag: 'Base completa' },
    { name: 'Clientes B2B', description: 'Leads identificados como empresa, atacado ou CNPJ.', count: state.contacts.filter(isB2BContact).length, tag: 'B2B' },
    { name: 'Clientes com CNPJ', description: 'Contatos com documento empresarial cadastrado.', count: state.contacts.filter((contact) => (contact.document?.replace(/\D/g, '').length ?? 0) > 11).length, tag: 'CNPJ' },
    { name: 'Clientes que ja compraram', description: 'Clientes com pelo menos um pedido registrado.', count: state.contacts.filter((contact) => (contact.orderCount ?? 0) > 0).length, tag: 'Compradores' },
    { name: 'Clientes sem pedido', description: 'Leads que ainda nao converteram em pedido.', count: state.contacts.filter((contact) => (contact.orderCount ?? 0) === 0).length, tag: 'Leads' },
    { name: 'Clientes inativos', description: 'Clientes sem compra recente, conforme dados disponiveis.', count: state.contacts.filter((contact) => contact.status === 'inactive').length, tag: 'Reativacao' },
  ]

  async function createCampaign() {
    await api('/api/mensageria/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        listId: form.listId || undefined,
        templateId: form.templateId || undefined,
        scheduledAt: form.scheduledAt || undefined,
        estimatedCost: Number(form.estimatedCost),
        variableMapping: {},
      }),
    })
    setForm((prev) => ({ ...prev, name: '' }))
    await reload()
  }

  async function campaignAction(path: string, campaignId: string) {
    await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId }) })
    await reload()
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Envio em massa oficial"
        title="Campanhas WhatsApp"
        description="Escolha um publico, conecte um template aprovado e acompanhe custo, volume, envio, entrega, falhas e respostas."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {suggestedAudiences.map((audience) => (
          <CampaignAudienceCard
            key={audience.name}
            title={audience.name}
            description={audience.description}
            count={audience.count}
            tag={audience.tag}
            estimatedCost={avgCostPerMessage ? audience.count * avgCostPerMessage : 0}
            onSelect={() => setForm((prev) => ({ ...prev, name: audience.name, estimatedCost: avgCostPerMessage ? String(audience.count * avgCostPerMessage) : prev.estimatedCost }))}
          />
        ))}
        {state.contactLists.map((listItem) => (
          <CampaignAudienceCard
            key={listItem.id}
            title={listItem.name}
            description={listItem.description ?? 'Lista personalizada criada em Clientes e Segmentos.'}
            count={listItem.contactIds.length}
            tag="Lista salva"
            estimatedCost={avgCostPerMessage ? listItem.contactIds.length * avgCostPerMessage : 0}
            onSelect={() => setForm((prev) => ({ ...prev, name: listItem.name, listId: listItem.id, estimatedCost: avgCostPerMessage ? String(listItem.contactIds.length * avgCostPerMessage) : prev.estimatedCost }))}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel title="Configurar campanha" description="Fluxo preservado: lista com opt-in, template APPROVED, agendamento, custo estimado e criacao via endpoint existente.">
          <div className="space-y-3">
            <Field label="Nome da campanha"><Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></Field>
            <SelectBlock label="Lista personalizada" value={form.listId} onChange={(value) => setForm((prev) => ({ ...prev, listId: value }))} placeholder="Selecionar lista" items={state.contactLists.map((listItem) => ({ value: listItem.id, label: listItem.name, hint: `${listItem.contactIds.length} contatos` }))} />
            <SelectBlock label="Template" value={form.templateId} onChange={(value) => setForm((prev) => ({ ...prev, templateId: value }))} placeholder="Selecionar template" items={approvedTemplates.map((template) => ({ value: template.id, label: template.name, hint: template.category }))} />
            <Field label="Agendamento"><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))} /></Field>
            <Field label="Investimento aproximado"><Input type="number" min="0" step="0.0001" value={form.estimatedCost} onChange={(e) => setForm((prev) => ({ ...prev, estimatedCost: e.target.value }))} /></Field>
            <Alert>
              <CircleDollarSign className="h-4 w-4" />
              <AlertTitle>Estimativa visual</AlertTitle>
              <AlertDescription>O custo usa valores ja configurados ou calculados nas campanhas existentes. A cobranca final e determinada pela Meta.</AlertDescription>
            </Alert>
            <Button onClick={createCampaign} disabled={!form.name}>Criar campanha</Button>
          </div>
        </AdminPanel>

        <AdminPanel title="Campanhas e metricas" description="Cada acao gera logs com timestamp, campanha, template, destinatarios, status e recomendacao.">
          <div className="space-y-3">
            {state.campaigns.length === 0 ? <EmptyNotice title="Nenhuma campanha" description="Crie uma campanha para associar lista, template, variaveis e custo estimado." /> : null}
            {state.campaigns.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={campaign} list={state.contactLists.find((listItem) => listItem.id === campaign.listId)} template={state.templates.find((template) => template.id === campaign.templateId)} onSend={() => campaignAction('/api/mensageria/campaigns/send', campaign.id)} onPause={() => campaignAction('/api/mensageria/campaigns/pause', campaign.id)} />
            ))}
            <ContextLogs logs={state.logs} types={['campaign_created', 'campaign_sent', 'campaign_paused', 'campaign_error']} />
          </div>
        </AdminPanel>
      </div>
    </div>
  )
}

function CampaignAudienceCard({ title, description, count, tag, estimatedCost, onSelect }: { title: string; description: string; count: number; tag: string; estimatedCost: number; onSelect: () => void }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Badge variant="outline">{tag}</Badge>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Send className="h-5 w-5" /></div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div><p className="font-semibold">{count}</p><p className="text-muted-foreground">contatos</p></div>
        <div><p className="font-semibold">{formatCurrency(estimatedCost)}</p><p className="text-muted-foreground">aprox.</p></div>
        <div><p className="font-semibold">{count > 0 ? `${Math.max(Math.ceil(count / 500), 1)} min` : '0 min'}</p><p className="text-muted-foreground">envio</p></div>
      </div>
      <Button className="mt-4 w-full" variant="outline" onClick={onSelect}>Configurar campanha</Button>
    </div>
  )
}

function CampaignRow({ campaign, list, template, onSend, onPause }: { campaign: Campaign; list?: ContactList; template?: WhatsAppTemplate; onSend: () => void; onPause: () => void }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{campaign.name}</p>
            <StatusPill status={campaign.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Lista: {list?.name ?? 'not selected'} | Template: {template?.name ?? 'not selected'}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onPause}>Pausar</Button>
          <Button size="sm" onClick={onSend}>Disparar</Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <span>Total: {campaign.metrics.totalContacts}</span>
        <span>Enviadas: {campaign.metrics.sent}</span>
        <span>Entregues: {campaign.metrics.delivered}</span>
        <span>Falhas: {campaign.metrics.failed}</span>
        <span>Respostas: {campaign.metrics.replies}</span>
        <span>Custo estimado: {campaign.metrics.estimatedCost.toFixed(4)}</span>
        <span>Custo/msg: {campaign.metrics.costPerMessage.toFixed(4)}</span>
        <span>Taxa resposta: {(campaign.metrics.responseRate * 100).toFixed(1)}%</span>
      </div>
    </div>
  )
}

function AutomationsTab({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const approvedTemplates = state.templates.filter((template) => template.status === 'APPROVED')
  const [form, setForm] = useState({
    name: '',
    eventType: 'order.payment_confirmed',
    templateId: '',
    status: 'Draft',
    onlyWithOptIn: true,
    state: '',
    orderStatus: '',
    paymentStatus: '',
    minOrderTotal: '',
    delayMinutes: '0',
    variableMapping: 'nome=customer.name\npedido=order.id\ntotal=order.total\nrastreio=label.tracking_code',
  })

  async function createAutomation() {
    const variableMapping = Object.fromEntries(
      form.variableMapping
        .split('\n')
        .map((line) => line.split('=').map((part) => part.trim()))
        .filter(([key, value]) => key && value),
    )

    await api('/api/mensageria/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        eventType: form.eventType,
        templateId: form.templateId || undefined,
        status: form.status,
        delayMinutes: Number(form.delayMinutes),
        variableMapping,
        conditions: {
          onlyWithOptIn: form.onlyWithOptIn,
          state: form.state || undefined,
          orderStatus: form.orderStatus || undefined,
          paymentStatus: form.paymentStatus || undefined,
          minOrderTotal: form.minOrderTotal ? Number(form.minOrderTotal) : undefined,
        },
      }),
    })
    setForm((prev) => ({ ...prev, name: '' }))
    await reload()
  }

  async function updateAutomation(id: string, status: AutomationRule['status']) {
    await api('/api/mensageria/automations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    await reload()
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Mensagens automaticas"
        title="Automações por evento do E-Commerce"
        description="Status de cadastro, pedido, pagamento e entrega podem disparar templates aprovados via WhatsApp, respeitando opt-in e configuracao atual."
      />

      <AdminPanel title="Eventos disponiveis" description="Cada evento mostra se existe automacao ativa, ultima execucao e quantidade de disparos registrados.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ECOMMERCE_EVENT_DEFINITIONS.map((event) => {
            const rule = state.automations.find((automation) => automation.eventType === event.type)
            const lastRun = state.automationLogs.find((log) => log.eventType === event.type)
            return <EcommerceEventCard key={event.type} event={event} automation={rule} lastRunAt={lastRun?.timestamp} onConfigure={() => setForm((prev) => ({ ...prev, eventType: event.type, name: rule?.name ?? event.label, templateId: rule?.templateId ?? prev.templateId, status: rule?.status ?? prev.status }))} />
          })}
        </div>
      </AdminPanel>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel title="Criar automacao" description="Escolha o evento, as condicoes e o template aprovado. O envio real so acontece se numero, template e opt-in estiverem prontos.">
          <div className="space-y-3">
            <Field label="Nome da automacao"><Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Pos-pagamento aprovado" /></Field>
            <SelectBlock label="Evento do e-commerce" value={form.eventType} onChange={(value) => setForm((prev) => ({ ...prev, eventType: value }))} placeholder="Selecionar evento" items={ECOMMERCE_EVENT_DEFINITIONS.map((event) => ({ value: event.type, label: event.label, hint: event.type }))} />
            <SelectBlock label="Template WhatsApp" value={form.templateId} onChange={(value) => setForm((prev) => ({ ...prev, templateId: value }))} placeholder="Selecionar template aprovado" items={approvedTemplates.map((template) => ({ value: template.id, label: template.name, hint: template.category }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Delay em minutos"><Input type="number" min="0" value={form.delayMinutes} onChange={(e) => setForm((prev) => ({ ...prev, delayMinutes: e.target.value }))} /></Field>
              <Field label="Estado do cliente"><Input value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))} placeholder="SP, MG..." /></Field>
              <Field label="Valor minimo do pedido"><Input type="number" min="0" value={form.minOrderTotal} onChange={(e) => setForm((prev) => ({ ...prev, minOrderTotal: e.target.value }))} /></Field>
              <Field label="Status do pedido"><Input value={form.orderStatus} onChange={(e) => setForm((prev) => ({ ...prev, orderStatus: e.target.value.toUpperCase() }))} placeholder="CONFIRMED, SHIPPED..." /></Field>
              <Field label="Status pagamento"><Input value={form.paymentStatus} onChange={(e) => setForm((prev) => ({ ...prev, paymentStatus: e.target.value.toLowerCase() }))} placeholder="paid, unpaid..." /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.onlyWithOptIn} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, onlyWithOptIn: Boolean(checked) }))} />Somente clientes com opt-in WhatsApp</label>
            <Field label="Mapeamento de variaveis (variavel=caminho no evento)"><Textarea rows={5} value={form.variableMapping} onChange={(e) => setForm((prev) => ({ ...prev, variableMapping: e.target.value }))} /></Field>
            <Button onClick={createAutomation} disabled={!form.name || !form.eventType} className="gap-2"><Zap className="h-4 w-4" />Criar automacao</Button>
          </div>
        </AdminPanel>

        <AdminPanel title="Regras e logs de automacao" description="Entregue/lido/respondido aparecem em verde; bloqueado/pendente em laranja; falha em vermelho.">
          <div className="space-y-3">
            {state.automations.length === 0 ? <EmptyNotice title="Nenhuma automacao criada" description="Crie uma automacao para eventos de cadastro, pedido, pagamento ou entrega." /> : null}
            {state.automations.map((automation) => <AutomationRow key={automation.id} automation={automation} template={state.templates.find((template) => template.id === automation.templateId)} onActivate={() => updateAutomation(automation.id, 'Active')} onPause={() => updateAutomation(automation.id, 'Paused')} />)}
            <div className="space-y-2">
              {state.automationLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="rounded-lg border border-border/60 bg-card/80 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={log.status} />
                    <span className="font-semibold">{log.eventType}</span>
                    <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{log.description}</p>
                  {log.recommendedAction ? <p className="mt-1 text-muted-foreground">Acao: {log.recommendedAction}</p> : null}
                </div>
              ))}
            </div>
            <ContextLogs logs={state.logs} types={['automation_created', 'automation_updated', 'automation_paused', 'automation_triggered', 'automation_error', 'ecommerce_event_received']} />
          </div>
        </AdminPanel>
      </div>
    </div>
  )
}

function EcommerceEventCard({ event, automation, lastRunAt, onConfigure }: { event: ECommerceEventDefinition; automation?: AutomationRule; lastRunAt?: string; onConfigure?: () => void }) {
  const active = automation?.status === 'Active'
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{event.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{event.type}</p>
        </div>
        <StatusPill status={active ? 'Active' : automation ? automation.status : 'not_started'} />
      </div>
      <p className="mt-2 text-muted-foreground">{event.description}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <span><strong>{automation?.totalRuns ?? 0}</strong><br />execucoes</span>
        <span><strong>{automation?.successfulRuns ?? 0}</strong><br />sucessos</span>
        <span><strong>{automation?.failedRuns ?? 0}</strong><br />falhas</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Ultima execucao: {lastRunAt ? new Date(lastRunAt).toLocaleString('pt-BR') : 'sem registro'}</p>
      <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">Variaveis: {event.payloadFields.join(', ')}</p>
      <Button size="sm" variant="outline" className="mt-3 w-full" onClick={onConfigure}>Configurar</Button>
    </div>
  )
}

function AutomationRow({ automation, template, onActivate, onPause }: { automation: AutomationRule; template?: WhatsAppTemplate; onActivate: () => void; onPause: () => void }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{automation.name}</p>
            <StatusPill status={automation.status} />
            <Badge variant="outline">{automation.eventType}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Template: {template?.name ?? 'nao selecionado'} | Delay: {automation.delayMinutes} min</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onPause}>Pausar</Button>
          <Button size="sm" onClick={onActivate}>Ativar</Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <span>Total: {automation.totalRuns}</span>
        <span>Sucesso: {automation.successfulRuns}</span>
        <span>Falhas/bloqueios: {automation.failedRuns}</span>
      </div>
    </div>
  )
}

function ContactsTab({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const [contact, setContact] = useState({ name: '', phone: '', countryCode: '55', email: '', state: '', city: '', totalSpent: '', orderCount: '', tags: '', source: 'manual', optInWhatsapp: false })
  const [list, setList] = useState({ name: '', description: '', contactIds: [] as string[], optInOnly: true, tags: '', source: '', countryCode: '55', state: '', minOrderValue: '' })
  const [query, setQuery] = useState('')

  async function addContact() {
    await api('/api/mensageria/contact-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'contact', ...contact, tags: contact.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }),
    })
    setContact({ name: '', phone: '', countryCode: '55', email: '', state: '', city: '', totalSpent: '', orderCount: '', tags: '', source: 'manual', optInWhatsapp: false })
    await reload()
  }

  async function addList() {
    await api('/api/mensageria/contact-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'list',
        name: list.name,
        description: list.description,
        contactIds: list.contactIds,
        filters: { optInWhatsapp: list.optInOnly, tags: list.tags.split(',').map((tag) => tag.trim()).filter(Boolean), source: list.source, countryCode: list.countryCode, state: list.state, minOrderValue: list.minOrderValue ? Number(list.minOrderValue) : undefined },
      }),
    })
    setList({ name: '', description: '', contactIds: [], optInOnly: true, tags: '', source: '', countryCode: '55', state: '', minOrderValue: '' })
    await reload()
  }

  async function deleteList(id: string) {
    await api('/api/mensageria/contact-lists', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await reload()
  }

  const filteredContacts = state.contacts.filter((item) => {
    const haystack = `${item.name} ${item.email ?? ''} ${item.phone} ${item.city ?? ''} ${item.state ?? ''} ${item.tags.join(' ')}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="CRM de clientes"
        title="Clientes e Segmentos"
        description="Lista operacional de leads e clientes do E-Commerce, com filtros para montar listas de campanha sem enviar para contatos sem opt-in."
        action={<Button variant="outline" size="sm" onClick={reload} className="gap-2"><RefreshCw className="h-4 w-4" />Atualizar</Button>}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={Users} label="Clientes" value={state.contacts.length} hint="Total cadastrado no app." status="info" />
        <MetricCard icon={Phone} label="Com WhatsApp opt-in" value={state.contacts.filter((item) => item.optInWhatsapp).length} hint="Permitidos para campanhas." status="success" />
        <MetricCard icon={Building2} label="B2B identificados" value={state.contacts.filter(isB2BContact).length} hint="Wholesale, CNPJ ou tag empresarial." status="info" />
        <MetricCard icon={ListChecks} label="Listas salvas" value={state.contactLists.length} hint="Segmentacoes prontas." status={state.contactLists.length > 0 ? 'success' : 'needs_attention'} />
      </div>

      <AdminPanel title="Filtros para lista personalizada" description="Use estes filtros para salvar uma segmentacao. Os filtros de compra ficam guardados para uso com dados reais do E-Commerce.">
        <div className="grid gap-3 lg:grid-cols-3">
          <Field label="Nome da lista"><Input value={list.name} onChange={(e) => setList((prev) => ({ ...prev, name: e.target.value }))} placeholder="Clientes B2B de Sao Paulo" /></Field>
          <Field label="Descricao"><Input value={list.description} onChange={(e) => setList((prev) => ({ ...prev, description: e.target.value }))} /></Field>
          <Field label="Periodo"><Input placeholder="Ex: ultimos 90 dias" disabled title="Placeholder visual: depende da sincronizacao completa de pedidos." /></Field>
          <Field label="Quantidade de pedidos"><Input placeholder="Ex: mais de 2" disabled title="Placeholder visual: depende da sincronizacao completa de pedidos." /></Field>
          <Field label="Valor total comprado acima de"><Input type="number" min="0" value={list.minOrderValue} onChange={(e) => setList((prev) => ({ ...prev, minOrderValue: e.target.value }))} /></Field>
          <Field label="Estado"><Input value={list.state} onChange={(e) => setList((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))} placeholder="SP" /></Field>
          <Field label="Cidade"><Input placeholder="Cidade" disabled title="Placeholder visual: filtro sera aplicado quando a API de clientes trouxer cidade na lista." /></Field>
          <Field label="Tags"><Input value={list.tags} onChange={(e) => setList((prev) => ({ ...prev, tags: e.target.value }))} placeholder="vip, atacado" /></Field>
          <Field label="Origem"><Input value={list.source} onChange={(e) => setList((prev) => ({ ...prev, source: e.target.value }))} placeholder="site, checkout, manual" /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Cliente com CNPJ', 'Sem CNPJ', 'B2B', 'B2C', 'Com pedido', 'Sem pedido', 'Compraram recentemente', 'Inativos', 'Com WhatsApp', 'Sem WhatsApp'].map((filter) => (
            <Badge key={filter} variant="outline" className="rounded-full px-3 py-1 text-xs">{filter}</Badge>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><Checkbox checked={list.optInOnly} onCheckedChange={(checked) => setList((prev) => ({ ...prev, optInOnly: Boolean(checked) }))} />Somente contatos com opt-in WhatsApp</label>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.contacts.map((item) => (
            <button key={item.id} type="button" onClick={() => setList((prev) => ({ ...prev, contactIds: prev.contactIds.includes(item.id) ? prev.contactIds.filter((id) => id !== item.id) : [...prev.contactIds, item.id] }))} className={cn('rounded-full border px-2.5 py-1 text-xs', list.contactIds.includes(item.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted')}>
              {item.name} {item.optInWhatsapp ? '' : '(sem opt-in)'}
            </button>
          ))}
        </div>
        <Button className="mt-4 gap-2" onClick={addList} disabled={!list.name}><Filter className="h-4 w-4" />Criar lista personalizada</Button>
      </AdminPanel>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <AdminPanel title="Lista de leads e clientes" description="Clientes reais ou sincronizados do E-Commerce aparecem aqui.">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, telefone, cidade, estado, e-mail ou tag" className="pl-9" />
            </div>
            {filteredContacts.length === 0 ? <EmptyNotice title="Nenhum cliente encontrado" description="Adicione um contato manual para teste ou conecte a sincronizacao do E-Commerce." /> : null}
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="min-w-[920px] w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">WhatsApp</th>
                    <th className="px-3 py-3">Local</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Pedidos</th>
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((item) => (
                    <tr key={item.id} className="border-t border-border/60">
                      <td className="px-3 py-3">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.email ?? 'E-mail nao informado'}</p>
                      </td>
                      <td className="px-3 py-3">{maskPhone(item.phone)}</td>
                      <td className="px-3 py-3">{item.city ?? '-'} / {item.state ?? '-'}</td>
                      <td className="px-3 py-3"><Badge variant="outline">{isB2BContact(item) ? 'B2B' : 'Nao identificado'}</Badge></td>
                      <td className="px-3 py-3">{item.orderCount ?? 0}</td>
                      <td className="px-3 py-3">{formatCurrency(item.totalSpent)}</td>
                      <td className="px-3 py-3"><StatusPill status={item.optInWhatsapp ? 'success' : 'needs_attention'} /></td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{item.tags.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AdminPanel>

        <div className="space-y-4">
          <AdminPanel title="Adicionar cliente" description="Cadastro manual para teste operacional; dados reais podem vir da API do E-Commerce.">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome"><Input value={contact.name} onChange={(e) => setContact((prev) => ({ ...prev, name: e.target.value }))} /></Field>
                <Field label="Telefone"><Input value={contact.phone} onChange={(e) => setContact((prev) => ({ ...prev, phone: e.target.value }))} /></Field>
                <Field label="E-mail"><Input value={contact.email} onChange={(e) => setContact((prev) => ({ ...prev, email: e.target.value }))} /></Field>
                <Field label="Pais/DDI"><Input value={contact.countryCode} onChange={(e) => setContact((prev) => ({ ...prev, countryCode: e.target.value }))} /></Field>
                <Field label="Estado"><Input value={contact.state} onChange={(e) => setContact((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))} placeholder="SP" /></Field>
                <Field label="Cidade"><Input value={contact.city} onChange={(e) => setContact((prev) => ({ ...prev, city: e.target.value }))} /></Field>
                <Field label="Total gasto"><Input type="number" min="0" value={contact.totalSpent} onChange={(e) => setContact((prev) => ({ ...prev, totalSpent: e.target.value }))} /></Field>
                <Field label="Numero de pedidos"><Input type="number" min="0" value={contact.orderCount} onChange={(e) => setContact((prev) => ({ ...prev, orderCount: e.target.value }))} /></Field>
              </div>
              <Field label="Tags"><Input value={contact.tags} onChange={(e) => setContact((prev) => ({ ...prev, tags: e.target.value }))} placeholder="vip, primeira-compra, b2b" /></Field>
              <Field label="Origem"><Input value={contact.source} onChange={(e) => setContact((prev) => ({ ...prev, source: e.target.value }))} /></Field>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={contact.optInWhatsapp} onCheckedChange={(checked) => setContact((prev) => ({ ...prev, optInWhatsapp: Boolean(checked) }))} />Opt-in WhatsApp confirmado</label>
              <Button onClick={addContact} disabled={!contact.name || !contact.phone}>Adicionar contato</Button>
            </div>
          </AdminPanel>

          <AdminPanel title="Listas salvas" description="Use listas em campanhas ou edite filtros conforme a operacao.">
            <div className="space-y-3">
              {state.contactLists.length === 0 ? <EmptyNotice title="Nenhuma lista salva" description="Crie listas como Clientes B2B de Sao Paulo ou Leads sem pedido." /> : null}
              {state.contactLists.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-card/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.description ?? 'Sem descricao'}</p>
                    </div>
                    <Badge variant="outline">{item.contactIds.length} contatos</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">Filtros: {JSON.stringify(item.filters)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Atualizada em {new Date(item.updatedAt).toLocaleDateString('pt-BR')}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled title="Visual previsto para quando a lista detalhada estiver conectada.">Ver lista</Button>
                    <Button size="sm" variant="outline" disabled title="Edicao detalhada de filtros fica como evolucao futura.">Editar filtros</Button>
                    <Button size="sm" variant="outline" disabled title="Selecione esta lista pela tela de Campanhas.">Usar em campanha</Button>
                    <Button size="sm" variant="outline" onClick={() => deleteList(item.id)}>Excluir</Button>
                  </div>
                </div>
              ))}
            </div>
          </AdminPanel>
        </div>
      </div>
      <ContextLogs logs={state.logs} types={['contact_created', 'contact_list_created']} />
    </div>
  )
}

function DiagnosticsTab({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Saude da integracao"
        title="Diagnóstico"
        description="Checklist visual para identificar rapidamente problemas de Meta, WABA, numero, webhook, templates, API, E-Commerce e logs."
      />
      <HealthChecklistPanel state={state} />
      <WebhookSetupPanel state={state} reload={reload} />
      <TestSendTab state={state} reload={reload} />
      <LogsTab state={state} reload={reload} />
      <ReviewTab state={state} />
    </div>
  )
}

function HealthChecklistPanel({ state }: { state: UiState }) {
  const healthItems = [
    { label: 'Meta conectada', status: state.integration.oauthStatus === 'completed' ? 'success' : 'needs_attention', detail: 'Login Meta e consentimento de permissoes.' },
    { label: 'Business ID identificado', status: state.integration.businessId ? 'success' : 'needs_attention', detail: mask(state.integration.businessId) },
    { label: 'WABA vinculado', status: state.integration.wabaId ? 'success' : 'needs_attention', detail: mask(state.integration.wabaId) },
    { label: 'Numero conectado', status: state.integration.phoneNumberId ? 'success' : 'needs_attention', detail: mask(state.integration.phoneNumberId) },
    { label: 'Permissoes concedidas', status: (state.integration.metaUser?.missingPermissions.length ?? META_REQUIRED_PERMISSIONS.length) === 0 ? 'success' : 'needs_attention', detail: state.integration.metaUser?.missingPermissions.join(', ') || 'Todas as permissoes obrigatorias retornaram como concedidas.' },
    { label: 'Webhook ativo', status: state.integration.webhookVerifiedAt ? 'success' : 'needs_attention', detail: state.integration.webhookVerifiedAt ? new Date(state.integration.webhookVerifiedAt).toLocaleString('pt-BR') : 'Callback ainda nao verificado.' },
    { label: 'WABA inscrita em eventos', status: state.integration.webhookSubscribedAt ? 'success' : 'needs_attention', detail: state.integration.webhookSubscribedAt ? new Date(state.integration.webhookSubscribedAt).toLocaleString('pt-BR') : 'Use o botao de inscricao do webhook.' },
    { label: 'Templates sincronizados', status: state.templates.length > 0 ? 'success' : 'needs_attention', detail: `${state.templates.length} templates carregados.` },
    { label: 'Template aprovado selecionado', status: selectedTemplate(state)?.status === 'APPROVED' ? 'success' : 'needs_attention', detail: selectedTemplate(state)?.name ?? 'Nenhum template aprovado selecionado.' },
    { label: 'API respondendo', status: 'success', detail: 'A tela carregou o estado atual da API interna.' },
    { label: 'Eventos do E-Commerce recebidos', status: state.logs.some((log) => log.type === 'ecommerce_event_received') ? 'success' : 'needs_attention', detail: 'Eventos aparecem aqui quando o webhook do E-Commerce envia payload real.' },
  ]

  return (
    <AdminPanel title="Checklist de conexão" description="Status OK, Atencao, Erro ou Pendente para cada parte critica da operação.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {healthItems.map((item) => (
          <div key={item.label} className="rounded-lg border border-border/60 bg-card/80 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <StatusPill status={item.status} />
            </div>
          </div>
        ))}
      </div>
    </AdminPanel>
  )
}

function WebhookSetupPanel({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  const [origin, setOrigin] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeResult, setSubscribeResult] = useState<{ ok: boolean; message: string; action?: string } | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  async function subscribeWaba() {
    setSubscribing(true)
    setSubscribeResult(null)
    try {
      const response = await api<{ ok?: boolean; error?: string | { message?: string; action?: string } }>('/api/mensageria/connections/subscribe-webhook', { method: 'POST' })
      if (response.ok) {
        setSubscribeResult({ ok: true, message: 'WABA inscrita no app para eventos de webhook.' })
      } else {
        setSubscribeResult({
          ok: false,
          message: typeof response.error === 'string' ? response.error : response.error?.message ?? 'Nao foi possivel inscrever a WABA.',
          action: typeof response.error === 'object' ? response.error?.action : undefined,
        })
      }
      await reload()
    } catch (error) {
      setSubscribeResult({ ok: false, message: error instanceof Error ? error.message : 'Nao foi possivel inscrever a WABA.' })
    } finally {
      setSubscribing(false)
    }
  }

  const callbackUrl = origin ? `${origin}/api/mensageria/webhook` : '/api/mensageria/webhook'
  const inboundCount = state.conversations.reduce((total, conversation) => total + conversation.messages.filter((message) => message.direction === 'inbound').length, 0)
  const latestWebhookLog = state.logs.find((log) => log.type === 'webhook_received' || log.type === 'inbox_updated')

  return (
    <AdminPanel title="Recebimento via Webhook Meta" description="Configure este callback no app da Meta para receber mensagens, entregas, leituras e falhas dentro da Inbox.">
      <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-3">
          <ReadOnlyInfo label="Callback URL" value={callbackUrl} status={state.integration.webhookVerifiedAt ? 'success' : 'needs_attention'} />
          <ReadOnlyInfo label="Verify token" value="WHATSAPP_WEBHOOK_VERIFY_TOKEN (valor fica somente no servidor)" status={state.integration.webhookVerifiedAt ? 'success' : 'needs_attention'} />
          <ReadOnlyInfo label="Campo inscrito na Meta" value="messages" status={inboundCount > 0 ? 'success' : 'needs_attention'} />
          <ReadOnlyInfo label="WABA inscrita no app" value={state.integration.webhookSubscribedAt ? new Date(state.integration.webhookSubscribedAt).toLocaleString('pt-BR') : 'Ainda nao inscrita por este painel'} status={state.integration.webhookSubscribedAt ? 'success' : 'needs_attention'} />
          <Button type="button" variant="outline" onClick={subscribeWaba} disabled={subscribing || !state.integration.wabaId} className="gap-2">
            {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Inscrever WABA no app
          </Button>
          {subscribeResult ? (
            <Alert className={subscribeResult.ok ? statusClass.success : statusClass.failed}>
              {subscribeResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle>{subscribeResult.ok ? 'WABA inscrita' : 'Inscricao falhou'}</AlertTitle>
              <AlertDescription>
                {subscribeResult.message}
                {!subscribeResult.ok && subscribeResult.action ? <span className="mt-2 block">{subscribeResult.action}</span> : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/25 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={state.integration.webhookVerifiedAt ? 'success' : 'needs_attention'} />
            <span className="font-semibold">Status do webhook</span>
          </div>
          <p className="mt-2 text-muted-foreground">
            {state.integration.webhookVerifiedAt
              ? `Verificado em ${new Date(state.integration.webhookVerifiedAt).toLocaleString('pt-BR')}.`
              : 'Ainda nao verificado pela Meta. Configure a URL, o verify token e assine o campo messages.'}
          </p>
          <p className="mt-2 text-muted-foreground">Mensagens recebidas: {inboundCount}</p>
          {latestWebhookLog ? <p className="mt-2 text-xs text-muted-foreground">Ultimo evento: {latestWebhookLog.description}</p> : null}
        </div>
      </div>
    </AdminPanel>
  )
}

function LogsTab({ state, reload }: { state: UiState; reload: () => Promise<void> }) {
  async function clear() {
    await api('/api/mensageria/logs', { method: 'DELETE' })
    await reload()
  }

  return (
    <AdminPanel title="Logs globais" description="Eventos criticos com payload seguro, erro sanitizado e acao recomendada." action={<Button variant="outline" size="sm" onClick={clear}>Limpar logs</Button>}>
      <LogFilterList logs={state.logs} />
    </AdminPanel>
  )
}

function LogFilterList({ logs, compact = false }: { logs: WhatsAppLog[]; compact?: boolean }) {
  const [filter, setFilter] = useState('all')
  const types = ['all', ...Array.from(new Set(logs.map((log) => log.type))).slice(0, 8)]
  const visibleLogs = logs.filter((log) => filter === 'all' || log.type === filter)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {types.map((type) => (
          <button key={type} type="button" onClick={() => setFilter(type)} className={cn('rounded-full border px-2.5 py-1 text-xs', filter === type ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground')}>
            {type === 'all' ? 'Todos' : type}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {visibleLogs.length === 0 ? <EmptyNotice title="Nenhum log" description="Os eventos aparecem aqui conforme a integracao e os fluxos sao usados." /> : null}
        {visibleLogs.map((log) => (
          <div key={log.id} className="rounded-lg border border-border/60 bg-card/80 p-3 text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={log.status} />
                  <span className="font-semibold">{log.type}</span>
                  <span className="text-xs text-muted-foreground">{logOrigin(log.type)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{log.description}</p>
                {log.error ? <p className="mt-1 text-xs text-rose-600">{log.error.message}</p> : null}
                {log.recommendedAction ? <p className="mt-1 text-xs text-muted-foreground">Acao recomendada: {log.recommendedAction}</p> : null}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
            </div>
            {!compact && log.safePayload ? <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-[11px]">{JSON.stringify(log.safePayload, null, 2)}</pre> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function logOrigin(type: string) {
  if (type.includes('webhook') || type.includes('message') || type.includes('inbox')) return 'WhatsApp'
  if (type.includes('campaign')) return 'Campanha'
  if (type.includes('automation')) return 'Automacao'
  if (type.includes('template')) return 'Template'
  if (type.includes('ecommerce')) return 'E-Commerce'
  if (type.includes('oauth') || type.includes('business') || type.includes('waba') || type.includes('connection')) return 'Meta'
  return 'Sistema'
}

function ReviewTab({ state }: { state: UiState }) {
  const script = [
    'Abrir /mensageria.',
    'Conectar com Meta.',
    'Conceder permissoes.',
    'Selecionar Business.',
    'Selecionar WABA.',
    'Selecionar numero WhatsApp.',
    'Abrir Templates.',
    'Selecionar ou criar template.',
    'Mostrar status do template.',
    'Ir para Envio de Teste.',
    'Enviar mensagem para numero real.',
    'Abrir WhatsApp e mostrar mensagem recebida.',
    'Responder pelo WhatsApp.',
    'Voltar para Inbox.',
    'Mostrar resposta recebida.',
    'Abrir Logs.',
    'Mostrar eventos de envio e webhook.',
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <AdminPanel title="Checklist real da integracao" description="Esta aba nao simula sucesso: ela le o estado salvo da integracao e marca cada item conforme configuracao real.">
        <div className="space-y-2">
          {state.reviewChecklist.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/60 bg-card/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{item.label}</p>
                <StatusPill status={item.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </AdminPanel>
      <AdminPanel title="Roteiro para gravacao" description="Use este fluxo para o screencast de Meta App Review com dados reais da empresa.">
        <ol className="space-y-2 text-sm">
          {script.map((step, index) => (
            <li key={step} className="flex gap-3 rounded-lg border border-border/60 p-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </AdminPanel>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
