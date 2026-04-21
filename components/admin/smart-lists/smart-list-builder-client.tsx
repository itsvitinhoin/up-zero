'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  Play,
  Save,
  ArrowLeft,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  GripVertical,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { createSmartListAction } from '@/lib/actions/smart-lists'
import type { FilterField, FilterGroup, FilterOperator, FilterRule, SmartList, SmartListType } from '@/lib/campaigns/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Field registry ───────────────────────────────────────────────────────────

interface FieldDef {
  label: string
  category: string
  operators: FilterOperator[]
  valueType: 'text' | 'number' | 'select' | 'boolean' | 'days'
  options?: { value: string; label: string }[]
}

const FIELD_REGISTRY: Record<FilterField, FieldDef> = {
  'customer.name': { label: 'Nome do cliente', category: 'Perfil', operators: ['contains', 'not_contains', 'equals'], valueType: 'text' },
  'customer.email': { label: 'E-mail', category: 'Perfil', operators: ['contains', 'not_contains', 'equals'], valueType: 'text' },
  'customer.phone': { label: 'Telefone', category: 'Perfil', operators: ['contains', 'equals', 'exists', 'not_exists'], valueType: 'text' },
  'customer.document': { label: 'CNPJ', category: 'Perfil', operators: ['contains', 'equals'], valueType: 'text' },
  'customer.status': { label: 'Status', category: 'Perfil', operators: ['equals', 'not_equals'], valueType: 'select', options: [{ value: 'APPROVED', label: 'Aprovado' }, { value: 'PENDING', label: 'Pendente' }, { value: 'REJECTED', label: 'Rejeitado' }] },
  'customer.createdAt': { label: 'Cadastrado há X dias', category: 'Perfil', operators: ['greater_than', 'less_than', 'between'], valueType: 'days' },
  'customer.seller': { label: 'Representante', category: 'Perfil', operators: ['equals', 'not_equals', 'exists', 'not_exists'], valueType: 'text' },
  'customer.source': { label: 'Origem', category: 'Perfil', operators: ['equals', 'not_equals'], valueType: 'text' },
  'customer.city': { label: 'Cidade', category: 'Localização', operators: ['equals', 'not_equals', 'contains', 'in_list', 'not_in_list'], valueType: 'text' },
  'customer.state': { label: 'Estado (UF)', category: 'Localização', operators: ['equals', 'not_equals', 'in_list', 'not_in_list'], valueType: 'text' },
  'customer.zipCode': { label: 'CEP', category: 'Localização', operators: ['contains', 'equals'], valueType: 'text' },
  'orders.hasPurchased': { label: 'Realizou compra', category: 'Comportamento', operators: ['is_true', 'is_false'], valueType: 'boolean' },
  'orders.neverPurchased': { label: 'Nunca comprou', category: 'Comportamento', operators: ['is_true'], valueType: 'boolean' },
  'orders.lastPurchaseDaysAgo': { label: 'Última compra (dias atrás)', category: 'Comportamento', operators: ['greater_than', 'less_than', 'between', 'in_last_x_days', 'more_than_x_days_ago'], valueType: 'days' },
  'orders.firstPurchaseDaysAgo': { label: 'Primeira compra (dias atrás)', category: 'Comportamento', operators: ['greater_than', 'less_than'], valueType: 'days' },
  'orders.count': { label: 'Número de pedidos', category: 'Comportamento', operators: ['equals', 'greater_than', 'less_than', 'between'], valueType: 'number' },
  'orders.totalSpend': { label: 'Total gasto (R$)', category: 'Comportamento', operators: ['greater_than', 'less_than', 'between'], valueType: 'number' },
  'orders.avgTicket': { label: 'Ticket médio (R$)', category: 'Comportamento', operators: ['greater_than', 'less_than', 'between'], valueType: 'number' },
  'orders.frequency': { label: 'Frequência de compras', category: 'Comportamento', operators: ['greater_than', 'less_than'], valueType: 'number' },
  'orders.hasStatus': { label: 'Status do pedido', category: 'Pedidos', operators: ['equals', 'not_equals'], valueType: 'select', options: [{ value: 'PAID', label: 'Pago' }, { value: 'PENDING', label: 'Pendente' }, { value: 'CANCELLED', label: 'Cancelado' }] },
  'orders.value': { label: 'Valor do pedido (R$)', category: 'Pedidos', operators: ['greater_than', 'less_than', 'between'], valueType: 'number' },
  'orders.paymentMethod': { label: 'Método de pagamento', category: 'Pedidos', operators: ['equals', 'not_equals'], valueType: 'select', options: [{ value: 'PIX', label: 'PIX' }, { value: 'BOLETO', label: 'Boleto' }, { value: 'FATURADO', label: 'Faturado' }] },
  'orders.installmentCount': { label: 'Número de parcelas', category: 'Pedidos', operators: ['equals', 'greater_than'], valueType: 'number' },
  'orders.couponUsed': { label: 'Usou cupom', category: 'Pedidos', operators: ['is_true', 'is_false'], valueType: 'boolean' },
  'orders.hasDiscount': { label: 'Tem desconto', category: 'Pedidos', operators: ['is_true', 'is_false'], valueType: 'boolean' },
  'orders.boughtProduct': { label: 'Comprou produto', category: 'Produtos', operators: ['equals', 'contains'], valueType: 'text' },
  'orders.boughtCategory': { label: 'Comprou categoria', category: 'Produtos', operators: ['equals', 'contains'], valueType: 'text' },
  'orders.boughtCollection': { label: 'Comprou coleção', category: 'Produtos', operators: ['equals', 'contains'], valueType: 'text' },
  'orders.boughtVariant': { label: 'Comprou variante', category: 'Produtos', operators: ['equals'], valueType: 'text' },
  'orders.boughtColor': { label: 'Comprou cor', category: 'Produtos', operators: ['equals', 'contains'], valueType: 'text' },
  'orders.boughtSize': { label: 'Comprou tamanho', category: 'Produtos', operators: ['equals'], valueType: 'text' },
  'orders.notBoughtCategory': { label: 'Não comprou categoria', category: 'Produtos', operators: ['equals'], valueType: 'text' },
  'crm.inactiveDays': { label: 'Inativo há X dias', category: 'CRM', operators: ['greater_than', 'less_than', 'between'], valueType: 'days' },
  'crm.purchasedOnce': { label: 'Comprou apenas uma vez', category: 'CRM', operators: ['is_true', 'is_false'], valueType: 'boolean' },
  'crm.approvedNoPurchase': { label: 'Aprovado sem compra', category: 'CRM', operators: ['is_true'], valueType: 'boolean' },
  'crm.frequencyDropped': { label: 'Frequência caiu', category: 'CRM', operators: ['is_true'], valueType: 'boolean' },
  'crm.totalSpendAbove': { label: 'Total gasto acima de', category: 'CRM', operators: ['greater_than'], valueType: 'number' },
  'crm.isVip': { label: 'É cliente VIP', category: 'CRM', operators: ['is_true', 'is_false'], valueType: 'boolean' },
  'list.belongsTo': { label: 'Pertence à lista', category: 'Lista', operators: ['in_list'], valueType: 'text' },
  'list.notBelongsTo': { label: 'Não pertence à lista', category: 'Lista', operators: ['not_in_list'], valueType: 'text' },
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'igual a',
  not_equals: 'diferente de',
  contains: 'contém',
  not_contains: 'não contém',
  greater_than: 'maior que',
  less_than: 'menor que',
  between: 'entre',
  in_last_x_days: 'nos últimos X dias',
  more_than_x_days_ago: 'há mais de X dias',
  exists: 'existe',
  not_exists: 'não existe',
  in_list: 'está na lista',
  not_in_list: 'não está na lista',
  is_true: 'é verdadeiro',
  is_false: 'é falso',
}

const FIELD_CATEGORIES = ['Perfil', 'Localização', 'Comportamento', 'Pedidos', 'Produtos', 'CRM', 'Lista']

// ─── Rule row ─────────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  onChange,
  onDelete,
}: {
  rule: FilterRule
  onChange: (r: FilterRule) => void
  onDelete: () => void
}) {
  const def = FIELD_REGISTRY[rule.field]
  const needsValue = !['is_true', 'is_false', 'exists', 'not_exists'].includes(rule.operator)

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-xl border border-border/60 bg-muted/30">
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

      {/* Field selector */}
      <Select value={rule.field} onValueChange={(v) => onChange({ ...rule, field: v as FilterField })}>
        <SelectTrigger className="h-8 text-xs w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {FIELD_CATEGORIES.map((cat) => (
            <div key={cat}>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{cat}</div>
              {(Object.entries(FIELD_REGISTRY) as [FilterField, FieldDef][])
                .filter(([, d]) => d.category === cat)
                .map(([field, d]) => (
                  <SelectItem key={field} value={field} className="text-xs pl-4">
                    {d.label}
                  </SelectItem>
                ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select value={rule.operator} onValueChange={(v) => onChange({ ...rule, operator: v as FilterOperator })}>
        <SelectTrigger className="h-8 text-xs w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {def.operators.map((op) => (
            <SelectItem key={op} value={op} className="text-xs">
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value */}
      {needsValue && (
        <>
          {def.valueType === 'select' ? (
            <Select
              value={String(rule.value ?? '')}
              onValueChange={(v) => onChange({ ...rule, value: v })}
            >
              <SelectTrigger className="h-8 text-xs flex-1 max-w-36">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {def.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-8 text-xs flex-1 max-w-36"
              placeholder={def.valueType === 'number' || def.valueType === 'days' ? '0' : 'Valor...'}
              type={def.valueType === 'number' || def.valueType === 'days' ? 'number' : 'text'}
              value={String(rule.value ?? '')}
              onChange={(e) => onChange({ ...rule, value: def.valueType === 'number' || def.valueType === 'days' ? Number(e.target.value) : e.target.value })}
            />
          )}
        </>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ─── Group editor ─────────────────────────────────────────────────────────────

function GroupEditor({
  group,
  onChange,
  onDelete,
  depth = 0,
}: {
  group: FilterGroup
  onChange: (g: FilterGroup) => void
  onDelete?: () => void
  depth?: number
}) {
  const addRule = () => {
    const newRule: FilterRule = {
      id: `r-${Date.now()}`,
      field: 'customer.status',
      operator: 'equals',
      value: 'APPROVED',
    }
    onChange({ ...group, rules: [...group.rules, newRule] })
  }

  const addGroup = () => {
    const newGroup: FilterGroup = {
      id: `g-${Date.now()}`,
      logic: 'ALL',
      rules: [],
      groups: [],
    }
    onChange({ ...group, groups: [...group.groups, newGroup] })
  }

  const updateRule = (idx: number, rule: FilterRule) => {
    const rules = [...group.rules]
    rules[idx] = rule
    onChange({ ...group, rules })
  }

  const deleteRule = (idx: number) => {
    onChange({ ...group, rules: group.rules.filter((_, i) => i !== idx) })
  }

  const updateSubGroup = (idx: number, g: FilterGroup) => {
    const groups = [...group.groups]
    groups[idx] = g
    onChange({ ...group, groups })
  }

  const deleteSubGroup = (idx: number) => {
    onChange({ ...group, groups: group.groups.filter((_, i) => i !== idx) })
  }

  return (
    <div className={cn('space-y-2', depth > 0 && 'pl-4 border-l-2 border-primary/20')}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">
          {depth === 0 ? 'Clientes onde' : 'Grupo onde'}
        </span>
        <Select value={group.logic} onValueChange={(v) => onChange({ ...group, logic: v as 'ALL' | 'ANY' })}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">TODAS (AND)</SelectItem>
            <SelectItem value="ANY" className="text-xs">QUALQUER (OR)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">condições são atendidas</span>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {group.rules.map((rule, idx) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            onChange={(r) => updateRule(idx, r)}
            onDelete={() => deleteRule(idx)}
          />
        ))}
        {group.groups.map((subGroup, idx) => (
          <GroupEditor
            key={subGroup.id}
            group={subGroup}
            onChange={(g) => updateSubGroup(idx, g)}
            onDelete={() => deleteSubGroup(idx)}
            depth={depth + 1}
          />
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addRule}>
          <Plus className="h-3 w-3" /> Condição
        </Button>
        {depth < 2 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addGroup}>
            <Plus className="h-3 w-3" /> Grupo
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Preview panel ────────────────────────────────────────────────────────────

interface PreviewData {
  count: number
  metrics: { totalRevenue: number; avgTicket: number; avgOrderCount: number }
}

function PreviewPanel({ listId, preview, loading }: { listId: string | null; preview: PreviewData | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Preview da Audiência
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculando...
          </div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{preview.count.toLocaleString('pt-BR')}</div>
              <div className="text-xs text-muted-foreground mt-1">clientes nesta lista</div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receita total</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.metrics.totalRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ticket médio</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.metrics.avgTicket)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pedidos médios</span>
                <span className="font-medium">{preview.metrics.avgOrderCount.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Clique em "Testar Lista" para ver o resultado
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  { id: 't-vip', name: 'Clientes VIP', description: 'Total gasto > R$ 5.000', rules: { id: 'g1', logic: 'ALL' as const, rules: [{ id: 'r1', field: 'crm.isVip' as FilterField, operator: 'is_true' as FilterOperator, value: true }], groups: [] } },
  { id: 't-inactive', name: 'Inativos 30 dias', description: 'Última compra há mais de 30 dias', rules: { id: 'g2', logic: 'ALL' as const, rules: [{ id: 'r2', field: 'orders.lastPurchaseDaysAgo' as FilterField, operator: 'more_than_x_days_ago' as FilterOperator, value: 30 }], groups: [] } },
  { id: 't-approved', name: 'Aprovados sem compra', description: 'Aprovados que nunca compraram', rules: { id: 'g3', logic: 'ALL' as const, rules: [{ id: 'r3', field: 'crm.approvedNoPurchase' as FilterField, operator: 'is_true' as FilterOperator, value: true }], groups: [] } },
  { id: 't-once', name: 'Compra única', description: 'Compraram apenas uma vez', rules: { id: 'g4', logic: 'ALL' as const, rules: [{ id: 'r4', field: 'crm.purchasedOnce' as FilterField, operator: 'is_true' as FilterOperator, value: true }], groups: [] } },
  { id: 't-sp', name: 'Clientes SP', description: 'Estado = SP', rules: { id: 'g5', logic: 'ALL' as const, rules: [{ id: 'r5', field: 'customer.state' as FilterField, operator: 'equals' as FilterOperator, value: 'SP' }], groups: [] } },
  { id: 't-highticket', name: 'Alto valor', description: 'Ticket médio > R$ 1.000', rules: { id: 'g6', logic: 'ALL' as const, rules: [{ id: 'r6', field: 'orders.avgTicket' as FilterField, operator: 'greater_than' as FilterOperator, value: 1000 }], groups: [] } },
]

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  initialList?: SmartList
}

export function SmartListBuilderClient({ initialList }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)

  const [name, setName] = useState(initialList?.name ?? '')
  const [description, setDescription] = useState(initialList?.description ?? '')
  const [type, setType] = useState<SmartListType>(initialList?.type ?? 'DYNAMIC')
  const [activeTab, setActiveTab] = useState<'builder' | 'templates'>('builder')

  const [rules, setRules] = useState<FilterGroup>(
    initialList?.rules ?? {
      id: `g-${Date.now()}`,
      logic: 'ALL',
      rules: [],
      groups: [],
    },
  )
  const [exclusions, setExclusions] = useState<import('@/lib/campaigns/types').FilterRule[]>(
    initialList?.exclusions ?? [],
  )

  const handleTestList = useCallback(async () => {
    setIsPreviewLoading(true)
    try {
      const listId = initialList?.id ?? 'preview'
      const res = await fetch(`/api/smart-lists/${listId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, exclusions }),
      })
      if (!res.ok) throw new Error('Preview failed')
      const data = await res.json()
      setPreview(data)
    } catch {
      toast.error('Erro ao calcular preview')
    } finally {
      setIsPreviewLoading(false)
    }
  }, [initialList?.id, rules, exclusions])

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Digite um nome para a lista')
      return
    }
    startTransition(async () => {
      const result = await createSmartListAction({
        name,
        description,
        type,
        visibilityScope: 'TEAM',
        rules,
        exclusions,
      })
      if (result.success && result.data) {
        toast.success('Lista criada com sucesso!')
        router.push(`/smart-lists/${result.data.id}`)
      } else {
        toast.error(result.error ?? 'Erro ao criar lista')
      }
    })
  }

  const loadTemplate = (tpl: typeof TEMPLATES[0]) => {
    setRules(tpl.rules)
    if (!name) setName(tpl.name)
    if (!description) setDescription(tpl.description)
    setActiveTab('builder')
    toast.success('Template carregado')
  }

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-card/95 backdrop-blur px-6 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/smart-lists')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <Input
            placeholder="Nome da lista..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 border-0 bg-transparent p-0 text-base font-semibold focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleTestList} disabled={isPreviewLoading}>
            {isPreviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Testar Lista
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Left panel */}
        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Info */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                placeholder="Descrição opcional..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de lista</Label>
              <Select value={type} onValueChange={(v) => setType(v as SmartListType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DYNAMIC">Dinâmica — atualiza automaticamente</SelectItem>
                  <SelectItem value="STATIC">Estática — snapshot fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs: builder / templates */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'builder' | 'templates')}>
            <TabsList className="h-9">
              <TabsTrigger value="builder" className="text-xs">Construtor de Regras</TabsTrigger>
              <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="mt-4 space-y-5">
              {/* Inclusion rules */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Incluir clientes onde...</CardTitle>
                </CardHeader>
                <CardContent>
                  <GroupEditor group={rules} onChange={setRules} />
                </CardContent>
              </Card>

              {/* Exclusion rules */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-destructive/80">Excluir clientes onde...</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {exclusions.map((rule, idx) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      onChange={(r) => setExclusions((prev) => prev.map((x, i) => (i === idx ? r : x)))}
                      onDelete={() => setExclusions((prev) => prev.filter((_, i) => i !== idx))}
                    />
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      setExclusions((prev) => [
                        ...prev,
                        {
                          id: `ex-${Date.now()}`,
                          field: 'customer.status',
                          operator: 'equals',
                          value: 'REJECTED',
                        },
                      ])
                    }
                  >
                    <Plus className="h-3 w-3" /> Adicionar exclusão
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              <div className="grid gap-3 md:grid-cols-2">
                {TEMPLATES.map((tpl) => (
                  <Card
                    key={tpl.id}
                    className="cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => loadTemplate(tpl)}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="font-medium text-sm">{tpl.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{tpl.description}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right panel — preview */}
        <div className="hidden md:flex w-72 flex-col gap-4 border-l border-border/60 p-4 overflow-auto">
          <PreviewPanel listId={initialList?.id ?? null} preview={preview} loading={isPreviewLoading} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumo das regras</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div>Lógica: <span className="font-medium text-foreground">{rules.logic === 'ALL' ? 'TODAS as condições' : 'QUALQUER condição'}</span></div>
              <div>Regras: <span className="font-medium text-foreground">{rules.rules.length}</span></div>
              <div>Grupos: <span className="font-medium text-foreground">{rules.groups.length}</span></div>
              <div>Exclusões: <span className="font-medium text-foreground">{exclusions.length}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
