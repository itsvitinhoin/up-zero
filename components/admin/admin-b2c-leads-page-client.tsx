'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Clock3,
  ContactRound,
  Filter,
  MapPin,
  MessageCircle,
  PackageOpen,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'

import type { B2CAdminView } from '@/components/admin/admin-b2c-page'
import {
  AdminPanel,
  AdminToolbar,
  DesktopOnly,
  MobileCardList,
} from '@/components/admin/admin-mobile-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  assignB2CLeadAction,
  unassignB2CLeadAction,
  updateB2CLeadStatusAction,
} from '@/lib/actions/b2c-leads'
import type {
  B2CDistributionSettings,
  B2CLead,
  B2CLeadStatus,
  EligibleB2CReseller,
} from '@/lib/b2c-leads/types'
import { cn } from '@/lib/utils'

interface AdminB2CLeadsPageClientProps {
  view: B2CAdminView
  initialLeads: B2CLead[]
  initialError: string | null
  resellers: EligibleB2CReseller[]
  settings: B2CDistributionSettings
}

const STATUS_META: Record<B2CLeadStatus, { label: string; className: string }> = {
  NEW: { label: 'Novo', className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300' },
  ASSIGNED: { label: 'Distribuído', className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300' },
  CONTACTED: { label: 'Contatado', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  QUALIFIED: { label: 'Qualificado', className: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300' },
  CONVERTED: { label: 'Convertido', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  LOST: { label: 'Perdido', className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300' },
  INVALID: { label: 'Inválido', className: 'border-border bg-muted text-muted-foreground' },
}

const MODE_LABELS = {
  MANUAL: 'Distribuição manual',
  AUTOMATIC: 'Roleta automática',
  TIERED: 'Automática por níveis',
} as const

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatPhone(value: string | null): string {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  return value || '—'
}

function leadAge(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function StatusBadge({ status }: { status: B2CLeadStatus }) {
  const meta = STATUS_META[status]
  return <Badge variant="outline" className={cn('rounded-full font-medium', meta.className)}>{meta.label}</Badge>
}

function resellerMatchesSettings(reseller: EligibleB2CReseller, settings: B2CDistributionSettings): boolean {
  return settings.resellerLists.some((list) => list.enabled && resellerMatchesList(reseller, list))
}

function resellerMatchesList(reseller: EligibleB2CReseller, list: B2CDistributionSettings['resellerLists'][number]) {
  if (list.excludedResellerIds.includes(reseller.id)) return false
  if (list.includedResellerIds.includes(reseller.id)) return true
  const filters = list.filters
  if (filters.requireApproved && !reseller.eligible) return false
  if (filters.requirePreviousOrder && reseller.ordersCount < 1) return false
  if (reseller.ordersCount < filters.minOrders || reseller.totalSpent < filters.minTotalSpent) return false
  if (filters.states.length > 0 && (!reseller.state || !filters.states.includes(reseller.state.toUpperCase()))) return false
  if (filters.maxDaysSinceLastOrder !== null) {
    if (!reseller.lastOrderAt) return false
    const age = Date.now() - new Date(reseller.lastOrderAt).getTime()
    if (!Number.isFinite(age) || age > filters.maxDaysSinceLastOrder * 86_400_000) return false
  }
  return true
}

function resellerPriority(reseller: EligibleB2CReseller, settings: B2CDistributionSettings) {
  const weights = { PREFERRED: 4, GOLD: 3, SILVER: 2, BRONZE: 1 }
  return settings.resellerLists
    .filter((list) => list.enabled && resellerMatchesList(reseller, list))
    .sort((left, right) => weights[right.priority] - weights[left.priority])[0]?.priority || 'BRONZE'
}

export function AdminB2CLeadsPageClient({
  view,
  initialLeads,
  initialError,
  resellers,
  settings,
}: AdminB2CLeadsPageClientProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isPending, startTransition] = useTransition()

  const customers = useMemo(() => leads.filter((lead) => (lead.items || []).length === 0), [leads])
  const orders = useMemo(() => leads.filter((lead) => (lead.items || []).length > 0), [leads])
  const scopedLeads = view === 'customers' ? customers : orders
  const selectedLead = orders.find((lead) => lead.id === selectedLeadId) ?? null
  const eligibleResellers = useMemo(
    () => resellers.filter((reseller) => resellerMatchesSettings(reseller, settings)),
    [resellers, settings],
  )
  const filteredLeads = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR')
    return scopedLeads.filter((lead) => {
      const matchesStatus = view !== 'orders' || statusFilter === 'all' || lead.status === statusFilter
      const matchesSearch = !needle || [
        lead.name,
        lead.email,
        lead.phone,
        lead.city,
        lead.state,
        lead.assignedReseller?.name,
        ...(lead.items || []).map((item) => `${item.productName} ${item.sku || ''}`),
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase('pt-BR').includes(needle))
      return matchesStatus && matchesSearch
    })
  }, [scopedLeads, search, statusFilter, view])

  const assignedCount = orders.filter((lead) => lead.assignedReseller).length
  const contactedCount = orders.filter((lead) => ['CONTACTED', 'QUALIFIED', 'CONVERTED'].includes(lead.status)).length
  const convertedCount = orders.filter((lead) => lead.status === 'CONVERTED').length
  const conversionRate = orders.length ? Math.round((convertedCount / orders.length) * 100) : 0
  const distributionRate = orders.length ? Math.round((assignedCount / orders.length) * 100) : 0
  const requestedUnits = orders.reduce((total, lead) => total + lead.items.reduce((sum, item) => sum + item.quantity, 0), 0)

  const replaceLead = (nextLead: B2CLead) => {
    setLeads((current) => current.map((lead) => lead.id === nextLead.id ? nextLead : lead))
  }

  const assignLead = (lead: B2CLead, reseller: EligibleB2CReseller, mode: 'AUTO' | 'MANUAL') => {
    startTransition(async () => {
      const result = await assignB2CLeadAction({
        leadId: lead.id,
        mode,
        reseller: {
          id: reseller.id,
          name: reseller.name,
          email: reseller.email,
          phone: reseller.phone,
          city: reseller.city,
          state: reseller.state,
        },
      })
      if (!result.success || !result.data) {
        toast.error(result.error || 'Não foi possível distribuir o pedido.')
        return
      }
      replaceLead(result.data)
      toast.success(`Pedido distribuído para ${reseller.name}.`)
    })
  }

  const autoAssign = (lead: B2CLead) => {
    const assignedByReseller = orders.reduce<Record<string, number>>((accumulator, entry) => {
      const id = entry.assignedReseller?.id
      if (id) accumulator[id] = (accumulator[id] || 0) + 1
      return accumulator
    }, {})
    const levelWeight = { PREFERRED: 4, GOLD: 3, SILVER: 2, BRONZE: 1 }
    const ranked = [...eligibleResellers].sort((left, right) => {
      const levelDifference = levelWeight[resellerPriority(right, settings)] - levelWeight[resellerPriority(left, settings)]
      if (levelDifference) return levelDifference
      if (settings.filters.prioritizeSameState) {
        const stateDifference = Number(Boolean(lead.state && right.state === lead.state)) - Number(Boolean(lead.state && left.state === lead.state))
        if (stateDifference) return stateDifference
      }
      const loadDifference = (assignedByReseller[left.id] || 0) - (assignedByReseller[right.id] || 0)
      if (loadDifference) return loadDifference
      return right.ordersCount - left.ordersCount
    })
    if (!ranked[0]) {
      toast.error('Nenhum revendedor atende às regras B2C configuradas.')
      return
    }
    assignLead(lead, ranked[0], 'AUTO')
  }

  const updateStatus = (lead: B2CLead, status: B2CLeadStatus) => {
    startTransition(async () => {
      const result = await updateB2CLeadStatusAction({ leadId: lead.id, status })
      if (!result.success || !result.data) {
        toast.error(result.error || 'Não foi possível atualizar o pedido.')
        return
      }
      replaceLead(result.data)
      toast.success(`Pedido marcado como ${STATUS_META[status].label.toLowerCase()}.`)
    })
  }

  const removeAssignment = (lead: B2CLead) => {
    startTransition(async () => {
      const result = await unassignB2CLeadAction(lead.id)
      if (!result.success || !result.data) {
        toast.error(result.error || 'Não foi possível remover a atribuição.')
        return
      }
      replaceLead(result.data)
      toast.success('Pedido voltou para a fila de distribuição.')
    })
  }

  if (view === 'dashboard') {
    const funnel = [
      { label: 'Pedidos recebidos', value: orders.length, rate: 100 },
      { label: 'Distribuídos', value: assignedCount, rate: distributionRate },
      { label: 'Contatados', value: contactedCount, rate: orders.length ? Math.round((contactedCount / orders.length) * 100) : 0 },
      { label: 'Convertidos', value: convertedCount, rate: conversionRate },
    ]
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <B2CPageHeader icon={BarChart3} eyebrow="Canal B2C" title="Dashboard B2C" description="Visão geral dos consumidores, pedidos e desempenho da distribuição para revendedores." />
        {initialError ? <ErrorBanner message={initialError} /> : null}
        <B2CMetricGrid>
          <B2CMetricCard icon={UsersRound} label="Clientes" value={customers.length} hint="Consumidores cadastrados" tone="info" />
          <B2CMetricCard icon={PackageOpen} label="Pedidos" value={orders.length} hint={`${requestedUnits} unidade(s) solicitada(s)`} tone="default" />
          <B2CMetricCard icon={UserCheck} label="Distribuídos" value={assignedCount} hint={`${distributionRate}% dos pedidos`} tone="warning" />
          <B2CMetricCard icon={CircleDollarSign} label="Conversão" value={`${conversionRate}%`} hint={`${convertedCount} venda(s) confirmada(s)`} tone="success" />
        </B2CMetricGrid>

        <div className="grid gap-4 xl:grid-cols-2">
          <AdminPanel title="Funil B2C" description="Avanço dos pedidos recebidos até a conversão.">
            <div className="space-y-5">
              {funnel.map((stage) => (
                <div key={stage.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm"><span>{stage.label}</span><span className="font-semibold">{stage.value} · {stage.rate}%</span></div>
                  <Progress value={stage.rate} className="h-2" />
                </div>
              ))}
            </div>
          </AdminPanel>
          <AdminPanel title="Saúde da distribuição" description="Regras ativas e capacidade atual da rede.">
            <div className="grid grid-cols-2 gap-3">
              <MetricTile label="Modo atual" value={MODE_LABELS[settings.mode]} />
              <MetricTile label="Revendedores aptos" value={String(eligibleResellers.length)} />
              <MetricTile label="Preferenciais" value={String(settings.preferredResellerIds.length)} />
              <MetricTile label="Aguardando distribuição" value={String(orders.length - assignedCount)} />
            </div>
            <Button asChild variant="outline" className="mt-4 w-full"><Link href="/settings/b2c"><Settings2 className="mr-2 h-4 w-4" />Configurar distribuição B2C</Link></Button>
          </AdminPanel>
        </div>

        <AdminPanel title="Desempenho dos revendedores" description="Volume distribuído e vendas confirmadas por parceiro.">
          <MobileCardList>
            {resellers.map((reseller) => {
              const assigned = orders.filter((lead) => lead.assignedReseller?.id === reseller.id)
              return <ResellerPerformanceCard key={reseller.id} reseller={reseller} assigned={assigned} preferred={settings.preferredResellerIds.includes(reseller.id)} />
            })}
          </MobileCardList>
          <DesktopOnly>
            <div className="divide-y rounded-xl border">
              {resellers.map((reseller) => {
                const assigned = orders.filter((lead) => lead.assignedReseller?.id === reseller.id)
                const converted = assigned.filter((lead) => lead.status === 'CONVERTED').length
                return (
                  <div key={reseller.id} className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(100px,0.7fr))] items-center gap-4 p-4 text-sm">
                    <div><p className="font-semibold">{reseller.name}</p><p className="mt-1 text-xs text-muted-foreground">{[reseller.city, reseller.state].filter(Boolean).join(' / ') || 'Sem localização'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Nível</p><p className="mt-1 font-medium">{settings.preferredResellerIds.includes(reseller.id) ? 'Preferencial' : settings.resellerLevels[reseller.id] || 'Bronze'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Recebidos</p><p className="mt-1 font-semibold">{assigned.length}</p></div>
                    <div><p className="text-xs text-muted-foreground">Convertidos</p><p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">{converted}</p></div>
                  </div>
                )
              })}
            </div>
          </DesktopOnly>
        </AdminPanel>
      </div>
    )
  }

  if (view === 'customers') {
    const located = customers.filter((lead) => lead.city && lead.state).length
    const consented = customers.filter((lead) => lead.consent.accepted).length
    const customersWithOrders = new Set(orders.map((lead) => lead.email.toLocaleLowerCase('pt-BR'))).size
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <B2CPageHeader icon={UsersRound} eyebrow="Base B2C" title="Clientes B2C" description="Acompanhe os consumidores finais cadastrados na vitrine e o vínculo com suas solicitações." />
        {initialError ? <ErrorBanner message={initialError} /> : null}
        <B2CMetricGrid>
          <B2CMetricCard icon={UsersRound} label="Clientes" value={customers.length} hint="Cadastros recebidos" tone="info" />
          <B2CMetricCard icon={MapPin} label="Com localização" value={located} hint="Cidade e UF informadas" tone="default" />
          <B2CMetricCard icon={ShieldCheck} label="Consentimento" value={consented} hint="Compartilhamento autorizado" tone="success" />
          <B2CMetricCard icon={PackageOpen} label="Com pedidos" value={customersWithOrders} hint="Consumidores que solicitaram itens" tone="warning" />
        </B2CMetricGrid>
        <AdminToolbar><SearchField value={search} onChange={setSearch} placeholder="Buscar por nome, e-mail, telefone ou cidade" /></AdminToolbar>
        <AdminPanel title="Clientes cadastrados" description={`${filteredLeads.length} cliente(s) encontrado(s).`}>
          {filteredLeads.length === 0 ? <EmptyState icon={UsersRound} title="Nenhum consumidor cadastrado" description="Use “Sou consumidor” no cadastro da vitrine sandbox para testar." /> : (
            <>
              <MobileCardList>
                {filteredLeads.map((lead) => (
                  <Card key={lead.id} className="py-0"><CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{lead.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{lead.email}</p></div><Badge variant="outline" className="rounded-full">{lead.documentType || 'B2C'}</Badge></div>
                    <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Telefone</p><p className="mt-1 font-medium">{formatPhone(lead.phone)}</p></div><div><p className="text-xs text-muted-foreground">Localização</p><p className="mt-1 font-medium">{[lead.city, lead.state].filter(Boolean).join(' / ') || 'Não informada'}</p></div></div>
                    <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span>{formatDate(lead.createdAt)}</span><span className="text-emerald-700 dark:text-emerald-300">Consentimento registrado</span></div>
                  </CardContent></Card>
                ))}
              </MobileCardList>
              <DesktopOnly>
                <div className="divide-y rounded-xl border">
                  {filteredLeads.map((lead) => (
                    <div key={lead.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-4 p-4">
                      <div className="min-w-0"><p className="truncate font-semibold">{lead.name}</p><p className="mt-1 truncate text-sm text-muted-foreground">{lead.email} · {formatPhone(lead.phone)}</p></div>
                      <div className="text-sm"><p className="font-medium">{[lead.city, lead.state].filter(Boolean).join(' / ') || 'Local não informado'}</p><p className="mt-1 text-xs text-muted-foreground">{lead.documentType || 'Documento'}: {lead.document || 'não informado'}</p></div>
                      <div className="text-right text-xs text-muted-foreground"><p>{formatDate(lead.createdAt)}</p><p className="mt-1 text-emerald-700 dark:text-emerald-300">Consentimento registrado</p></div>
                    </div>
                  ))}
                </div>
              </DesktopOnly>
            </>
          )}
        </AdminPanel>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <B2CPageHeader icon={PackageOpen} eyebrow="Canal B2C" title="Pedidos B2C" description="Confira os produtos solicitados, distribua para revendedores e acompanhe cada oportunidade até a venda." />
      {initialError ? <ErrorBanner message={initialError} /> : null}
      <B2CMetricGrid>
        <B2CMetricCard icon={PackageOpen} label="Pedidos" value={orders.length} hint={`${requestedUnits} unidade(s) solicitada(s)`} tone="info" />
        <B2CMetricCard icon={UserCheck} label="Distribuídos" value={assignedCount} hint={`${distributionRate}% da fila`} tone="default" />
        <B2CMetricCard icon={MessageCircle} label="Contatados" value={contactedCount} hint="Inclui qualificados" tone="warning" />
        <B2CMetricCard icon={CircleDollarSign} label="Convertidos" value={convertedCount} hint={`${conversionRate}% de conversão`} tone="success" />
      </B2CMetricGrid>
      <AdminToolbar>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchField value={search} onChange={setSearch} placeholder="Buscar por cliente, produto, cidade ou revendedor" />
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-48"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(STATUS_META).map(([status, meta]) => <SelectItem key={status} value={status}>{meta.label}</SelectItem>)}</SelectContent></Select>
        </div>
      </AdminToolbar>
      <AdminPanel title="Fila de pedidos" description={`${filteredLeads.length} pedido(s) encontrado(s). Abra um pedido para conferir os itens e distribuir.`}>
        {filteredLeads.length === 0 ? <EmptyState icon={PackageOpen} title="Nenhum pedido nesta visualização" description="Os carrinhos enviados por consumidores aparecerão aqui." /> : (
          <>
            <MobileCardList>
              {filteredLeads.map((lead) => (
                <button key={lead.id} type="button" onClick={() => setSelectedLeadId(lead.id)} className="w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{lead.requestCode || lead.name}</p><p className="mt-1 truncate text-sm text-muted-foreground">{lead.name}</p></div><StatusBadge status={lead.status} /></div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Produtos</p><p className="mt-1 font-semibold">{lead.items.reduce((total, item) => total + item.quantity, 0)} unidade(s)</p></div><div><p className="text-xs text-muted-foreground">Localização</p><p className="mt-1 font-medium">{[lead.city, lead.state].filter(Boolean).join(' / ') || 'Não informada'}</p></div></div>
                  <div className="mt-3 border-t pt-3"><p className="text-xs text-muted-foreground">Revendedor</p><p className="mt-1 text-sm font-medium">{lead.assignedReseller?.name || 'Aguardando distribuição'}</p></div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{leadAge(lead.createdAt)}</span><span className="flex items-center gap-1 font-medium text-primary">Abrir pedido <ArrowRight className="h-3.5 w-3.5" /></span></div>
                </button>
              ))}
            </MobileCardList>
            <DesktopOnly>
              <div className="divide-y rounded-xl border">
                {filteredLeads.map((lead) => (
                  <button key={lead.id} type="button" onClick={() => setSelectedLeadId(lead.id)} className="group grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{lead.requestCode || lead.name}</p><StatusBadge status={lead.status} /></div><p className="mt-1 truncate text-sm text-muted-foreground">{lead.name} · {formatPhone(lead.phone)}</p><p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-amber-700 dark:text-amber-300"><PackageOpen className="h-3.5 w-3.5" />{lead.items.reduce((total, item) => total + item.quantity, 0)} unidade(s) · {lead.items.map((item) => item.productName).join(', ')}</p></div>
                    <div className="text-sm"><p className="flex items-center gap-1.5 font-medium"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{[lead.city, lead.state].filter(Boolean).join(' / ') || 'Local não informado'}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(lead.createdAt)}</p></div>
                    <div className="text-sm"><p className="font-medium">{lead.assignedReseller?.name || 'Aguardando distribuição'}</p><p className="mt-1 text-xs text-muted-foreground">{lead.assignmentMode ? (lead.assignmentMode === 'AUTO' ? 'Roleta automática' : 'Escolha manual') : MODE_LABELS[settings.mode]}</p></div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </DesktopOnly>
          </>
        )}
      </AdminPanel>

      <Sheet open={Boolean(selectedLead)} onOpenChange={(open) => { if (!open) setSelectedLeadId(null) }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedLead ? <OrderSheet lead={selectedLead} resellers={eligibleResellers} settings={settings} isPending={isPending} onAssign={assignLead} onAutoAssign={autoAssign} onStatus={updateStatus} onUnassign={removeAssignment} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function B2CPageHeader({ icon: Icon, eyebrow, title, description }: { icon: LucideIcon; eyebrow: string; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Badge variant="outline" className="mb-3 h-6 rounded-full px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</Badge>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="h-8 w-fit rounded-full border-amber-300 bg-amber-50 px-3 font-normal text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Sandbox local</Badge>
      </div>
    </div>
  )
}

function B2CMetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}

function B2CMetricCard({ icon: Icon, label, value, hint, tone }: { icon: LucideIcon; label: string; value: string | number; hint: string; tone: 'default' | 'success' | 'warning' | 'info' }) {
  const tones = {
    default: { icon: 'bg-primary/10 text-primary', bar: 'from-primary/80 to-primary/20' },
    success: { icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', bar: 'from-emerald-500/80 to-emerald-500/20' },
    warning: { icon: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', bar: 'from-amber-500/80 to-amber-500/20' },
    info: { icon: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300', bar: 'from-sky-500/80 to-sky-500/20' },
  }
  return (
    <Card className="relative overflow-hidden rounded-2xl border-border/40 py-0 shadow-sm">
      <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-linear-to-r', tones[tone].bar)} />
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tones[tone].icon)}><Icon className="h-4 w-4" /></div>
      </CardContent>
    </Card>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{message} Reinicie a API sandbox se as rotas locais ainda não estiverem disponíveis.</div>
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative block min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="rounded-full pl-9" /></label>
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center"><Icon className="mb-3 h-10 w-10 text-muted-foreground/40" /><p className="font-medium">{title}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p></div>
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold sm:text-base">{value}</p></div>
}

function ResellerPerformanceCard({ reseller, assigned, preferred }: { reseller: EligibleB2CReseller; assigned: B2CLead[]; preferred: boolean }) {
  const converted = assigned.filter((lead) => lead.status === 'CONVERTED').length
  return <Card className="py-0"><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{reseller.name}</p><p className="mt-1 text-xs text-muted-foreground">{[reseller.city, reseller.state].filter(Boolean).join(' / ') || 'Sem localização'}</p></div>{preferred ? <Badge className="rounded-full">Preferencial</Badge> : null}</div><div className="grid grid-cols-2 gap-3"><MetricTile label="Recebidos" value={String(assigned.length)} /><MetricTile label="Convertidos" value={String(converted)} /></div></CardContent></Card>
}

function OrderSheet({
  lead,
  resellers,
  settings,
  isPending,
  onAssign,
  onAutoAssign,
  onStatus,
  onUnassign,
}: {
  lead: B2CLead
  resellers: EligibleB2CReseller[]
  settings: B2CDistributionSettings
  isPending: boolean
  onAssign: (lead: B2CLead, reseller: EligibleB2CReseller, mode: 'AUTO' | 'MANUAL') => void
  onAutoAssign: (lead: B2CLead) => void
  onStatus: (lead: B2CLead, status: B2CLeadStatus) => void
  onUnassign: (lead: B2CLead) => void
}) {
  return <>
    <SheetHeader><div className="flex flex-wrap items-center gap-2"><SheetTitle>{lead.requestCode || lead.name}</SheetTitle><StatusBadge status={lead.status} /></div><SheetDescription>{lead.name} · recebido {formatDate(lead.createdAt)}</SheetDescription></SheetHeader>
    <div className="space-y-6 px-4 pb-6">
      <section className="rounded-xl border bg-muted/20 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produtos solicitados</p><p className="mt-1 text-sm text-muted-foreground">{lead.items.reduce((total, item) => total + item.quantity, 0)} unidade(s)</p></div>{lead.requestValue !== null ? <p className="font-semibold">{formatMoney(lead.requestValue)}</p> : null}</div><div className="space-y-3">{lead.items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-background p-3">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-14 w-12 rounded-md object-cover" /> : <div className="flex h-14 w-12 items-center justify-center rounded-md bg-muted"><PackageOpen className="h-5 w-5 text-muted-foreground" /></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.productName}</p><p className="mt-1 text-xs text-muted-foreground">{[item.color, item.size, item.sku].filter(Boolean).join(' · ') || 'Variação não informada'}</p></div><Badge variant="secondary">{item.quantity}x</Badge></div>)}</div></section>
      <section className="grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm"><div><p className="text-xs text-muted-foreground">WhatsApp</p><p className="mt-1 font-medium">{formatPhone(lead.phone)}</p></div><div><p className="text-xs text-muted-foreground">E-mail</p><p className="mt-1 break-all font-medium">{lead.email}</p></div><div><p className="text-xs text-muted-foreground">Localização</p><p className="mt-1 font-medium">{[lead.city, lead.state].filter(Boolean).join(' / ') || 'Não informada'}</p></div><div><p className="text-xs text-muted-foreground">Documento</p><p className="mt-1 font-medium">{lead.document || 'Não informado'}</p></div></section>
      {lead.assignedReseller ? <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/20"><p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">Revendedor responsável</p><p className="mt-2 font-semibold">{lead.assignedReseller.name}</p><p className="mt-1 text-sm text-muted-foreground">{lead.assignmentMode === 'AUTO' ? 'Distribuição automática' : 'Escolha manual'} · {formatDate(lead.assignedAt)}</p>{lead.resellerResponse ? <Badge variant="outline" className="mt-3 rounded-full">{lead.resellerResponse === 'PENDING' ? 'Aguardando aceite' : lead.resellerResponse === 'ACCEPTED' ? 'Aceita pelo revendedor' : 'Recusada'}</Badge> : null}<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => onStatus(lead, 'CONTACTED')} disabled={isPending}><MessageCircle className="mr-2 h-4 w-4" />Marcar contato</Button><Button size="sm" variant="outline" onClick={() => onStatus(lead, 'QUALIFIED')} disabled={isPending}>Qualificar</Button><Button size="sm" variant="outline" onClick={() => onStatus(lead, 'CONVERTED')} disabled={isPending}><CircleDollarSign className="mr-2 h-4 w-4" />Converter</Button><Button size="sm" variant="ghost" onClick={() => onUnassign(lead)} disabled={isPending}><RefreshCw className="mr-2 h-4 w-4" />Reatribuir</Button></div></section> : <section className="space-y-3"><div><h3 className="font-semibold">Distribuir pedido</h3><p className="text-sm text-muted-foreground">Modo configurado: {MODE_LABELS[settings.mode]}. Preferenciais aparecem primeiro e não são excluídos pelos filtros.</p></div>{settings.mode !== 'MANUAL' ? <Button className="w-full" onClick={() => onAutoAssign(lead)} disabled={isPending || resellers.length === 0}><Sparkles className="mr-2 h-4 w-4" />Executar roleta agora</Button> : null}<div className="space-y-2">{resellers.map((reseller) => <button key={reseller.id} type="button" disabled={isPending} onClick={() => onAssign(lead, reseller, 'MANUAL')} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:opacity-50"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{reseller.name}</p>{settings.preferredResellerIds.includes(reseller.id) ? <Badge className="rounded-full text-[10px]">Preferencial</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">{[reseller.city, reseller.state].filter(Boolean).join(' / ') || 'Sem localização'} · {reseller.ordersCount} pedido(s)</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}{resellers.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum revendedor atende às regras atuais.</p> : null}</div></section>}
      <section><div className="mb-3 flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground" /><h3 className="font-semibold">Histórico</h3></div><div className="space-y-3 border-l pl-4">{[...lead.events].reverse().map((event) => <div key={event.id} className="relative text-sm before:absolute before:-left-[21px] before:top-1.5 before:h-2.5 before:w-2.5 before:rounded-full before:border-2 before:border-background before:bg-primary"><p className="font-medium">{event.description}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(event.createdAt)}</p></div>)}</div></section>
    </div>
  </>
}
