'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  Pause,
  X,
  Play,
  TrendingUp,
  Users,
  DollarSign,
  CheckCircle,
  Loader2,
  MessageSquare,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  cancelCampaignAction,
  deleteCampaignAction,
  pauseCampaignAction,
  sendCampaignNowAction,
} from '@/lib/actions/campaigns'
import type { Campaign, CampaignPricingSnapshot, CampaignStatus, MessageCategory } from '@/lib/campaigns/types'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  SCHEDULED: { label: 'Agendada', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  RUNNING: { label: 'Enviando', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  PAUSED: { label: 'Pausada', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  COMPLETED: { label: 'Concluída', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  PARTIALLY_COMPLETED: { label: 'Parcial', className: 'bg-yellow-100 text-yellow-700' },
  FAILED: { label: 'Falha', className: 'bg-red-100 text-red-700' },
  CANCELED: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
}

const CATEGORY_LABELS: Record<MessageCategory, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
  SERVICE: 'Serviço',
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = STATUS_CONFIG[status]
  return <Badge className={cn('text-xs', cfg.className)}>{cfg.label}</Badge>
}

function DeliveryRate({ sent, delivered }: { sent: number; delivered: number }) {
  if (sent === 0) return <span className="text-muted-foreground">—</span>
  const rate = Math.round((delivered / sent) * 100)
  return (
    <span className={cn('text-sm font-medium', rate >= 90 ? 'text-emerald-600' : rate >= 70 ? 'text-amber-600' : 'text-red-600')}>
      {rate}%
    </span>
  )
}

function CampaignRow({
  campaign,
  onView,
  onSend,
  onPause,
  onCancel,
  onDelete,
}: {
  campaign: Campaign
  onView: () => void
  onSend: () => void
  onPause: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const perf = campaign.performance
  const fmtN = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmt = (n: number) => fmtN.format(n)
  const canSend = ['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)
  const canPause = campaign.status === 'RUNNING'
  const canCancel = ['RUNNING', 'SCHEDULED', 'PAUSED'].includes(campaign.status)
  const canDelete = !['RUNNING'].includes(campaign.status)

  return (
    <div
      className="flex items-center gap-4 rounded-2xl border border-border/60 p-4 transition-all hover:shadow-sm hover:border-primary/20 cursor-pointer"
      onClick={onView}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{campaign.name}</span>
          <StatusBadge status={campaign.status} />
          <Badge variant="outline" className="text-xs shrink-0">
            {CATEGORY_LABELS[campaign.templateCategory]}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {campaign.estimatedAudienceCount.toLocaleString('pt-BR')} destinatários
          </span>
          {campaign.templateName && <span>Modelo: {campaign.templateName}</span>}
          <span>
            {campaign.startedAt
              ? `Iniciada ${formatDistanceToNow(new Date(campaign.startedAt), { locale: ptBR, addSuffix: true })}`
              : campaign.scheduledAt
              ? `Agendada para ${format(new Date(campaign.scheduledAt), "dd/MM HH:mm")}`
              : `Criada ${formatDistanceToNow(new Date(campaign.createdAt), { locale: ptBR, addSuffix: true })}`}
          </span>
        </div>
      </div>

      {perf && (
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="font-medium">{perf.totalSent.toLocaleString('pt-BR')}</div>
            <div className="text-xs text-muted-foreground">Enviados</div>
          </div>
          <div className="text-center">
            <DeliveryRate sent={perf.totalSent} delivered={perf.totalDelivered} />
            <div className="text-xs text-muted-foreground">Entrega</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{perf.totalOrders}</div>
            <div className="text-xs text-muted-foreground">Pedidos</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{fmt(perf.totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">Receita</div>
          </div>
          <div className="text-center">
            <div className={cn('font-medium', perf.roi > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
              {perf.roi > 0 ? `${(perf.roi * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="text-xs text-muted-foreground">ROI</div>
          </div>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView() }}>
            <Eye className="h-4 w-4" /> Ver detalhes
          </DropdownMenuItem>
          {canSend && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSend() }}>
              <Play className="h-4 w-4" /> Enviar agora
            </DropdownMenuItem>
          )}
          {canPause && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPause() }}>
              <Pause className="h-4 w-4" /> Pausar
            </DropdownMenuItem>
          )}
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCancel() }} className="text-orange-600">
                <X className="h-4 w-4" /> Cancelar
              </DropdownMenuItem>
            </>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete() }} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── Pricing card ──────────────────────────────────────────────────────────────

function PricingCard({ pricing }: { pricing: CampaignPricingSnapshot[] }) {
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }).format(n)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Preços Ativos (BR)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {pricing.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{CATEGORY_LABELS[p.category]}</span>
            <span className="font-medium font-mono">{fmt(p.unitPrice)}</span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-1">
          Preço por mensagem entregue. Atualizado via painel de Preços.
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'draft' | 'active' | 'completed' | 'failed'

interface Props {
  initialCampaigns: Campaign[]
  initialPricing: CampaignPricingSnapshot[]
}

export function AdminCampaignsPageClient({ initialCampaigns, initialPricing }: Props) {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    let result = campaigns
    if (activeTab === 'draft') result = result.filter((c) => c.status === 'DRAFT')
    else if (activeTab === 'active') result = result.filter((c) => ['SCHEDULED', 'RUNNING', 'PAUSED'].includes(c.status))
    else if (activeTab === 'completed') result = result.filter((c) => ['COMPLETED', 'PARTIALLY_COMPLETED'].includes(c.status))
    else if (activeTab === 'failed') result = result.filter((c) => ['FAILED', 'CANCELED'].includes(c.status))

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    }
    return result
  }, [campaigns, activeTab, search])

  const stats = useMemo(() => {
    const completed = campaigns.filter((c) => c.status === 'COMPLETED')
    return {
      total: campaigns.length,
      active: campaigns.filter((c) => ['RUNNING', 'SCHEDULED'].includes(c.status)).length,
      totalSent: campaigns.reduce((sum, c) => sum + (c.performance?.totalSent ?? 0), 0),
      totalRevenue: completed.reduce((sum, c) => sum + (c.performance?.totalRevenue ?? 0), 0),
    }
  }, [campaigns])

  const handleSend = (id: string) => {
    if (!confirm('Enviar esta campanha agora?')) return
    startTransition(async () => {
      const result = await sendCampaignNowAction(id)
      if (result.success && result.data) {
        setCampaigns((prev) => prev.map((c) => (c.id === id ? result.data! : c)))
        toast.success('Campanha iniciada')
      } else toast.error(result.error ?? 'Erro')
    })
  }

  const handlePause = (id: string) => {
    startTransition(async () => {
      const result = await pauseCampaignAction(id)
      if (result.success && result.data) {
        setCampaigns((prev) => prev.map((c) => (c.id === id ? result.data! : c)))
        toast.success('Campanha pausada')
      } else toast.error(result.error ?? 'Erro')
    })
  }

  const handleCancel = (id: string) => {
    if (!confirm('Cancelar esta campanha?')) return
    startTransition(async () => {
      const result = await cancelCampaignAction(id)
      if (result.success && result.data) {
        setCampaigns((prev) => prev.map((c) => (c.id === id ? result.data! : c)))
        toast.success('Campanha cancelada')
      } else toast.error(result.error ?? 'Erro')
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta campanha? Esta ação não pode ser desfeita.')) return
    startTransition(async () => {
      const result = await deleteCampaignAction(id)
      if (result.success) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id))
        toast.success('Campanha excluída')
      } else toast.error(result.error ?? 'Erro')
    })
  }

  const fmtN = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmt = (n: number) => fmtN.format(n)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Campanhas WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie mensagens em massa via WhatsApp Business
          </p>
        </div>
        <Button onClick={() => router.push('/campaigns/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: MessageSquare, label: 'Total', value: stats.total },
          { icon: Play, label: 'Ativas', value: stats.active },
          { icon: Send, label: 'Mensagens Enviadas', value: stats.totalSent.toLocaleString('pt-BR') },
          { icon: TrendingUp, label: 'Receita Atribuída', value: fmt(stats.totalRevenue) },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className="text-xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Main list */}
        <div className="flex-1 space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)} className="w-full md:w-auto">
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs px-3">Todas</TabsTrigger>
                <TabsTrigger value="draft" className="text-xs px-3">Rascunhos</TabsTrigger>
                <TabsTrigger value="active" className="text-xs px-3">Ativas</TabsTrigger>
                <TabsTrigger value="completed" className="text-xs px-3">Concluídas</TabsTrigger>
                <TabsTrigger value="failed" className="text-xs px-3">Falhas</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar campanhas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Campaign list */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'Nenhuma campanha encontrada' : 'Nenhuma campanha criada ainda'}
              </p>
              {!search && (
                <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push('/campaigns/new')}>
                  <Plus className="h-4 w-4" />
                  Criar primeira campanha
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  onView={() => router.push(`/campaigns/${campaign.id}`)}
                  onSend={() => handleSend(campaign.id)}
                  onPause={() => handlePause(campaign.id)}
                  onCancel={() => handleCancel(campaign.id)}
                  onDelete={() => handleDelete(campaign.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — pricing */}
        {initialPricing.length > 0 && (
          <div className="md:w-60">
            <PricingCard pricing={initialPricing} />
          </div>
        )}
      </div>
    </div>
  )
}
