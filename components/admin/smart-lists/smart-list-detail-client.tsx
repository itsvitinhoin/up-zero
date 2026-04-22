'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Edit,
  Star,
  Archive,
  Trash2,
  Play,
  Users,
  Loader2,
  Clock,
  Zap,
  Send,
  MoreHorizontal,
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
  archiveSmartListAction,
  deleteSmartListAction,
  toggleSmartListFavoriteAction,
} from '@/lib/actions/smart-lists'
import type { FilterField, FilterGroup, FilterRule, SmartList } from '@/lib/campaigns/types'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const FIELD_LABELS: Partial<Record<FilterField, string>> = {
  'customer.name': 'Nome',
  'customer.email': 'E-mail',
  'customer.phone': 'Telefone',
  'customer.status': 'Status',
  'customer.city': 'Cidade',
  'customer.state': 'Estado',
  'customer.zipCode': 'CEP',
  'orders.hasPurchased': 'Realizou compra',
  'orders.neverPurchased': 'Nunca comprou',
  'orders.lastPurchaseDaysAgo': 'Última compra (dias)',
  'orders.count': 'Qtd pedidos',
  'orders.totalSpend': 'Total gasto',
  'orders.avgTicket': 'Ticket médio',
  'crm.inactiveDays': 'Inativo (dias)',
  'crm.isVip': 'É VIP',
  'crm.approvedNoPurchase': 'Aprovado sem compra',
  'crm.purchasedOnce': 'Comprou uma vez',
}

const OP_LABELS: Partial<Record<string, string>> = {
  equals: '=',
  not_equals: '≠',
  greater_than: '>',
  less_than: '<',
  contains: 'contém',
  more_than_x_days_ago: '> X dias',
  in_last_x_days: '< X dias',
  is_true: '= sim',
  is_false: '= não',
  exists: 'existe',
  not_exists: 'não existe',
}

function RuleChip({ rule }: { rule: FilterRule }) {
  const fieldLabel = FIELD_LABELS[rule.field] ?? rule.field.split('.').pop() ?? rule.field
  const opLabel = OP_LABELS[rule.operator] ?? rule.operator
  const needsValue = !['is_true', 'is_false', 'exists', 'not_exists'].includes(rule.operator)
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
      <span className="font-medium">{fieldLabel}</span>
      <span className="text-muted-foreground">{opLabel}</span>
      {needsValue && <span className="font-medium text-primary">{String(rule.value)}</span>}
    </span>
  )
}

function GroupDisplay({ group, depth = 0 }: { group: FilterGroup; depth?: number }) {
  if (group.rules.length === 0 && group.groups.length === 0) {
    return <span className="text-xs text-muted-foreground italic">Sem condições definidas</span>
  }
  return (
    <div className={depth > 0 ? 'pl-4 border-l-2 border-primary/20 space-y-2' : 'space-y-2'}>
      {group.rules.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {group.rules.map((rule, i) => (
            <div key={rule.id} className="flex items-center gap-1.5">
              <RuleChip rule={rule} />
              {i < group.rules.length - 1 && (
                <span className="text-xs font-medium text-muted-foreground">
                  {group.logic === 'ALL' ? 'E' : 'OU'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {group.groups.map((sub) => (
        <GroupDisplay key={sub.id} group={sub} depth={depth + 1} />
      ))}
    </div>
  )
}

interface PreviewData {
  count: number
  metrics: { totalRevenue: number; avgTicket: number; avgOrderCount: number }
}

interface Props {
  list: SmartList
}

export function SmartListDetailClient({ list: initialList }: Props) {
  const router = useRouter()
  const [list, setList] = useState(initialList)
  const [isPending, startTransition] = useTransition()
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)

  const handleTestList = async () => {
    setIsPreviewLoading(true)
    try {
      const res = await fetch(`/api/smart-lists/${list.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: list.rules, exclusions: list.exclusions }),
      })
      const data = await res.json()
      setPreview(data)
    } catch {
      toast.error('Erro ao calcular preview')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleToggleFavorite = () => {
    startTransition(async () => {
      const result = await toggleSmartListFavoriteAction(list.id)
      if (result.success && result.data) setList(result.data)
      else toast.error(result.error ?? 'Erro')
    })
  }

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveSmartListAction(list.id)
      if (result.success && result.data) {
        setList(result.data)
        toast.success(result.data.status === 'ARCHIVED' ? 'Lista arquivada' : 'Lista reativada')
      } else toast.error(result.error ?? 'Erro')
    })
  }

  const handleDelete = () => {
    if (!confirm('Tem certeza que deseja excluir esta lista?')) return
    startTransition(async () => {
      const result = await deleteSmartListAction(list.id)
      if (result.success) {
        toast.success('Lista excluída')
        router.push('/smart-lists')
      } else toast.error(result.error ?? 'Erro')
    })
  }

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/smart-lists')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{list.name}</h1>
              {list.isFavorite && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
            </div>
            <p className="text-sm text-muted-foreground">{list.description || 'Sem descrição'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleTestList} disabled={isPreviewLoading}>
            {isPreviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Testar
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => router.push(`/campaigns/new?smartListId=${list.id}&smartListName=${encodeURIComponent(list.name)}`)}
          >
            <Send className="h-3.5 w-3.5" />
            Criar Campanha
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => router.push(`/smart-lists/${list.id}/edit`)}>
                <Edit className="h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleFavorite}>
                <Star className="h-4 w-4" /> {list.isFavorite ? 'Remover favorito' : 'Favoritar'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4" /> {list.status === 'ARCHIVED' ? 'Reativar' : 'Arquivar'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status badges + meta */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge className={list.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}>
          {list.status === 'ACTIVE' ? 'Ativa' : 'Arquivada'}
        </Badge>
        {list.type === 'DYNAMIC' ? (
          <Badge variant="outline" className="gap-1"><Zap className="h-3 w-3" />Dinâmica</Badge>
        ) : (
          <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Estática</Badge>
        )}
        <Badge variant="outline">{list.visibilityScope === 'TEAM' ? 'Equipe' : list.visibilityScope}</Badge>
        <span className="text-muted-foreground">
          Criada por {list.createdBy} em {format(new Date(list.createdAt), "dd 'de' MMM yyyy", { locale: ptBR })}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Stats */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Métricas da Lista</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">
                {(preview?.count ?? list.resultCount).toLocaleString('pt-BR')}
              </div>
              <div className="text-xs text-muted-foreground">clientes</div>
            </div>
            {preview && (
              <>
                <Separator />
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receita total</span>
                    <span className="font-medium">{fmt.format(preview.metrics.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ticket médio</span>
                    <span className="font-medium">{fmt.format(preview.metrics.avgTicket)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pedidos médios</span>
                    <span className="font-medium">{preview.metrics.avgOrderCount.toFixed(1)}</span>
                  </div>
                </div>
              </>
            )}
            {list.lastCalculatedAt && (
              <div className="text-xs text-muted-foreground pt-1">
                Última atualização: {format(new Date(list.lastCalculatedAt), "dd/MM/yyyy 'às' HH:mm")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rules */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Regras de Inclusão</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground mb-2">
              Lógica: <span className="font-medium text-foreground">{list.rules.logic === 'ALL' ? 'TODAS as condições (AND)' : 'QUALQUER condição (OR)'}</span>
            </div>
            <GroupDisplay group={list.rules} />

            {list.exclusions.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="text-sm font-medium text-destructive/80 mb-2">Exclusões</div>
                <div className="flex flex-wrap gap-2">
                  {list.exclusions.map((rule) => (
                    <RuleChip key={rule.id} rule={rule} />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 p-4">
        <div>
          <div className="text-sm font-medium">Enviar campanha para esta lista</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Crie uma campanha WhatsApp direcionada para os {list.resultCount} clientes desta lista
          </div>
        </div>
        <Button
          className="gap-2 shrink-0"
          onClick={() => router.push(`/campaigns/new?smartListId=${list.id}&smartListName=${encodeURIComponent(list.name)}`)}
        >
          <Send className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>
    </div>
  )
}
