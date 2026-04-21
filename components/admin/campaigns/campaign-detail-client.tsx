'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Send,
  Pause,
  X,
  Play,
  Users,
  MessageSquare,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Eye,
  Reply,
  ShoppingCart,
  Clock,
  MoreHorizontal,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  cancelCampaignAction,
  pauseCampaignAction,
  sendCampaignNowAction,
} from '@/lib/actions/campaigns'
import type { Campaign, CampaignStatus, MessageCategory } from '@/lib/campaigns/types'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  SCHEDULED: { label: 'Agendada', className: 'bg-blue-100 text-blue-700' },
  RUNNING: { label: 'Enviando', className: 'bg-amber-100 text-amber-700' },
  PAUSED: { label: 'Pausada', className: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: 'Concluída', className: 'bg-emerald-100 text-emerald-700' },
  PARTIALLY_COMPLETED: { label: 'Parcialmente Concluída', className: 'bg-yellow-100 text-yellow-700' },
  FAILED: { label: 'Falha', className: 'bg-red-100 text-red-700' },
  CANCELED: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
}

const CATEGORY_LABELS: Record<MessageCategory, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
  SERVICE: 'Serviço',
}

function FunnelBar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toLocaleString('pt-BR')} <span className="text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

interface Props {
  campaign: Campaign
}

export function CampaignDetailClient({ campaign: initialCampaign }: Props) {
  const router = useRouter()
  const [campaign, setCampaign] = useState(initialCampaign)
  const [isPending, startTransition] = useTransition()

  const fmtFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmt = (n: number) => fmtFormatter.format(n)
  const fmtUnit = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }).format(n)

  const perf = campaign.performance
  const canSend = ['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)
  const canPause = campaign.status === 'RUNNING'
  const canCancel = ['RUNNING', 'SCHEDULED', 'PAUSED'].includes(campaign.status)

  const handleSend = () => {
    if (!confirm('Enviar esta campanha agora?')) return
    startTransition(async () => {
      const result = await sendCampaignNowAction(campaign.id)
      if (result.success && result.data) {
        setCampaign(result.data)
        toast.success('Campanha iniciada')
      } else toast.error(result.error ?? 'Erro')
    })
  }

  const handlePause = () => {
    startTransition(async () => {
      const result = await pauseCampaignAction(campaign.id)
      if (result.success && result.data) {
        setCampaign(result.data)
        toast.success('Campanha pausada')
      } else toast.error(result.error ?? 'Erro')
    })
  }

  const handleCancel = () => {
    if (!confirm('Cancelar esta campanha?')) return
    startTransition(async () => {
      const result = await cancelCampaignAction(campaign.id)
      if (result.success && result.data) {
        setCampaign(result.data)
        toast.success('Campanha cancelada')
      } else toast.error(result.error ?? 'Erro')
    })
  }

  const statusCfg = STATUS_CONFIG[campaign.status]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5" onClick={() => router.push('/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{campaign.name}</h1>
              <Badge className={cn('text-xs', statusCfg.className)}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{campaign.description || 'Sem descrição'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {canSend && (
            <Button size="sm" className="gap-1.5" onClick={handleSend} disabled={isPending}>
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          )}
          {canPause && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePause} disabled={isPending}>
              <Pause className="h-3.5 w-3.5" /> Pausar
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canCancel && (
                <DropdownMenuItem onClick={handleCancel} className="text-orange-600">
                  <X className="h-4 w-4" /> Cancelar campanha
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" />Campanha</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Template</span>
              <span className="font-medium truncate ml-4">{campaign.templateName || campaign.whatsappTemplateId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Categoria</span>
              <span>{CATEGORY_LABELS[campaign.templateCategory]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Idioma</span>
              <span>{campaign.templateLanguage}</span>
            </div>
            {campaign.scheduledAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agendado</span>
                <span>{format(new Date(campaign.scheduledAt), "dd/MM/yy HH:mm")}</span>
              </div>
            )}
            {campaign.startedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Iniciado</span>
                <span>{format(new Date(campaign.startedAt), "dd/MM/yy HH:mm")}</span>
              </div>
            )}
            {campaign.finishedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Finalizado</span>
                <span>{format(new Date(campaign.finishedAt), "dd/MM/yy HH:mm")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Audiência</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base estimada</span>
              <span>{campaign.estimatedAudienceCount.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Elegíveis</span>
              <span className="text-emerald-600 font-medium">{campaign.eligibleAudienceCount.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Excluídos</span>
              <span>{campaign.excludedCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inválidos</span>
              <span>{campaign.invalidCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Custo</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preço estimado/msg</span>
              <span className="font-mono">{fmtUnit(campaign.estimatedUnitCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo estimado</span>
              <span>{fmt(campaign.estimatedTotalCost)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span className="text-muted-foreground">Custo real</span>
              <span className="text-primary">{fmt(campaign.actualTotalCost)}</span>
            </div>
            {perf && perf.totalDelivered > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Custo/entregue</span>
                <span className="font-mono">{fmtUnit(campaign.actualTotalCost / perf.totalDelivered)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel + Attribution */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" />Funil de Entrega</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {perf ? (
              <>
                <FunnelBar value={perf.totalTargeted} max={perf.totalTargeted} label="Segmentados" color="bg-slate-400" />
                <FunnelBar value={perf.totalEligible} max={perf.totalTargeted} label="Elegíveis" color="bg-blue-400" />
                <FunnelBar value={perf.totalSent} max={perf.totalTargeted} label="Enviados" color="bg-violet-400" />
                <FunnelBar value={perf.totalDelivered} max={perf.totalTargeted} label="Entregues" color="bg-emerald-400" />
                <FunnelBar value={perf.totalRead} max={perf.totalTargeted} label="Lidos" color="bg-teal-400" />
                <FunnelBar value={perf.totalReplied} max={perf.totalTargeted} label="Responderam" color="bg-cyan-400" />
                <Separator />
                <FunnelBar value={perf.totalOrders} max={perf.totalTargeted} label="Geraram Pedido" color="bg-amber-400" />
              </>
            ) : (
              <div className="space-y-3">
                <FunnelBar value={campaign.estimatedAudienceCount} max={campaign.estimatedAudienceCount} label="Estimativa" color="bg-muted-foreground/30" />
                <div className="text-center py-4 text-xs text-muted-foreground">Dados disponíveis após o envio</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attribution */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Atribuição de Receita</CardTitle></CardHeader>
          <CardContent>
            {perf && perf.totalOrders > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Pedidos atribuídos', value: campaign.attributedOrderCount.toString() },
                    { label: 'Receita atribuída', value: fmt(campaign.attributedRevenue) },
                    { label: 'Ticket médio', value: campaign.attributedOrderCount > 0 ? fmt(campaign.attributedRevenue / campaign.attributedOrderCount) : '—' },
                    { label: 'ROI', value: campaign.roi > 0 ? `${(campaign.roi * 100).toFixed(0)}%` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-border/60 p-3 text-center">
                      <div className="text-base font-bold text-primary">{value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  Janela de atribuição: {campaign.attributionWindowDays} dias após receber a mensagem
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Sem pedidos atribuídos ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Janela: {campaign.attributionWindowDays} dias
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      {campaign.timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campaign.timeline.map((event, i) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    {i < campaign.timeline.length - 1 && (
                      <div className="flex-1 w-px bg-border min-h-4" />
                    )}
                  </div>
                  <div className="pb-3">
                    <div className="text-sm font-medium">{event.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(event.occurredAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error breakdown — visible if there are failures */}
      {perf && perf.totalFailed > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Erros e Exclusões ({perf.totalFailed})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              {perf.totalFailed} mensagens falharam. Verifique conexão, opt-in e qualidade do template.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
