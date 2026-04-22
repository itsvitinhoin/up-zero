'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  MessageSquare,
  DollarSign,
  Settings,
  Eye,
  Loader2,
  Send,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { createCampaignAction, scheduleCampaignAction, sendCampaignNowAction } from '@/lib/actions/campaigns'
import type {
  AttributionWindow,
  Campaign,
  CampaignPricingSnapshot,
  MessageCategory,
  SmartList,
} from '@/lib/campaigns/types'
import type { WaConnection, WaTemplate } from '@/lib/whatsapp/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STEP_LABELS = [
  { icon: Users, label: 'Audiência' },
  { icon: MessageSquare, label: 'Mensagem' },
  { icon: DollarSign, label: 'Custo' },
  { icon: Settings, label: 'Envio' },
  { icon: Eye, label: 'Confirmação' },
]

const CATEGORY_LABELS: Record<MessageCategory, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
  SERVICE: 'Serviço',
}

const CATEGORY_DESCRIPTIONS: Record<MessageCategory, string> = {
  MARKETING: 'Promoções, ofertas e reengajamento',
  UTILITY: 'Confirmações, notificações transacionais',
  AUTHENTICATION: 'Verificação de identidade, OTPs',
  SERVICE: 'Respostas a mensagens iniciadas pelo cliente',
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                done && 'bg-primary text-primary-foreground',
                active && 'border-2 border-primary text-primary',
                !done && !active && 'border border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : <step.icon className="h-3.5 w-3.5" />}
            </div>
            <span className={cn('hidden md:block text-xs font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
              {step.label}
            </span>
            {i < total - 1 && (
              <div className={cn('hidden md:block h-px w-8 transition-colors', done ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface WizardState {
  name: string
  description: string
  // Step 1 — audience
  audienceType: 'SMART_LIST' | 'CUSTOM_FILTER'
  smartListId: string
  smartListName: string
  estimatedAudience: number
  eligibleAudience: number
  excludedCount: number
  invalidCount: number
  // Step 2 — template
  connectionId: string
  wabaId: string
  phoneNumberId: string
  templateId: string
  templateName: string
  templateCategory: MessageCategory
  templateLanguage: string
  templateBody: string
  templateVariables: Record<string, string>
  // Step 4 — schedule
  sendMode: 'now' | 'scheduled'
  scheduledAt: string
  attributionWindowDays: AttributionWindow
}

interface Props {
  initialSmartLists: SmartList[]
  initialPricing: CampaignPricingSnapshot[]
  preSelectedSmartListId?: string
  preSelectedSmartListName?: string
}

export function CampaignWizardClient({
  initialSmartLists,
  initialPricing,
  preSelectedSmartListId,
  preSelectedSmartListName,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()

  const [state, setState] = useState<WizardState>({
    name: '',
    description: '',
    audienceType: 'SMART_LIST',
    smartListId: preSelectedSmartListId ?? '',
    smartListName: preSelectedSmartListName ?? '',
    estimatedAudience: 0,
    eligibleAudience: 0,
    excludedCount: 0,
    invalidCount: 0,
    connectionId: '',
    wabaId: '',
    phoneNumberId: '',
    templateId: '',
    templateName: '',
    templateCategory: 'MARKETING',
    templateLanguage: 'pt_BR',
    templateBody: '',
    templateVariables: {},
    sendMode: 'now',
    scheduledAt: '',
    attributionWindowDays: 7,
  })

  const [connections, setConnections] = useState<WaConnection[]>([])
  const [templates, setTemplates] = useState<WaTemplate[]>([])

  useEffect(() => {
    fetch('/api/mensageria/connections')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConnections(data)
      })
      .catch(() => {})
    fetch('/api/mensageria/templates')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data)
      })
      .catch(() => {})
  }, [])

  // Auto-fill audience numbers from selected smart list
  useEffect(() => {
    if (!state.smartListId) return
    const list = initialSmartLists.find((l) => l.id === state.smartListId)
    if (list) {
      setState((prev) => ({
        ...prev,
        smartListName: list.name,
        estimatedAudience: list.resultCount,
        eligibleAudience: Math.max(0, list.resultCount - 3),
        excludedCount: 2,
        invalidCount: 1,
      }))
    }
  }, [state.smartListId, initialSmartLists])

  // Auto-fill template details
  useEffect(() => {
    if (!state.templateId) return
    const tpl = templates.find((t) => t.id === state.templateId)
    if (tpl) {
      setState((prev) => ({
        ...prev,
        templateName: tpl.name,
        templateBody: tpl.body,
        templateVariables: Object.fromEntries(tpl.variables.map((v) => [v, ''])),
      }))
    }
  }, [state.templateId, templates])

  // Auto-fill connection details
  useEffect(() => {
    if (!state.connectionId) return
    const conn = connections.find((c) => c.id === state.connectionId)
    if (conn) {
      setState((prev) => ({
        ...prev,
        wabaId: conn.businessAccountId,
        phoneNumberId: conn.phoneNumberId,
      }))
    }
  }, [state.connectionId, connections])

  const activePricing = useMemo(() => {
    return initialPricing.find((p) => p.category === state.templateCategory && p.market === 'BR')
  }, [initialPricing, state.templateCategory])

  const estimatedCost = useMemo(() => {
    if (!activePricing) return 0
    return activePricing.unitPrice * state.eligibleAudience
  }, [activePricing, state.eligibleAudience])

  const update = (patch: Partial<WizardState>) => setState((prev) => ({ ...prev, ...patch }))
  const fmtCurrencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmt = (n: number) => fmtCurrencyFormatter.format(n)
  const fmtUnitFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })
  const fmtUnit = (n: number) => fmtUnitFormatter.format(n)

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createCampaignAction({
        name: state.name,
        description: state.description,
        audienceSourceType: 'SMART_LIST',
        smartListId: state.smartListId || null,
        connectionId: state.connectionId,
        wabaId: state.wabaId,
        phoneNumberId: state.phoneNumberId,
        whatsappTemplateId: state.templateId,
        templateName: state.templateName,
        templateCategory: state.templateCategory,
        templateLanguage: state.templateLanguage,
        templateVariables: state.templateVariables,
        scheduledAt: state.sendMode === 'scheduled' && state.scheduledAt ? new Date(state.scheduledAt) : null,
        estimatedAudienceCount: state.estimatedAudience,
        eligibleAudienceCount: state.eligibleAudience,
        excludedCount: state.excludedCount,
        invalidCount: state.invalidCount,
        attributionWindowDays: state.attributionWindowDays,
      })

      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Erro ao criar campanha')
        return
      }

      const campaignId = result.data.id

      if (state.sendMode === 'now') {
        const sendResult = await sendCampaignNowAction(campaignId)
        if (sendResult.success) {
          toast.success('Campanha iniciada!')
        } else {
          toast.warning('Campanha criada, mas não foi possível iniciar o envio automaticamente')
        }
      } else if (state.sendMode === 'scheduled' && state.scheduledAt) {
        await scheduleCampaignAction(campaignId, new Date(state.scheduledAt))
        toast.success('Campanha agendada!')
      } else {
        toast.success('Campanha salva como rascunho')
      }

      router.push(`/campaigns/${campaignId}`)
    })
  }

  const canNext = useMemo(() => {
    if (step === 0) return !!state.name && (state.audienceType !== 'SMART_LIST' || !!state.smartListId)
    if (step === 1) return !!state.templateId && !!state.connectionId
    if (step === 2) return true
    if (step === 3) return state.sendMode === 'now' || !!state.scheduledAt
    return true
  }, [step, state])

  // ─── Step renders ──────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome da Campanha <span className="text-destructive">*</span></Label>
          <Input
            placeholder="ex: Black Friday VIP"
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Input
            placeholder="Opcional..."
            value={state.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Tipo de Audiência</Label>
        <RadioGroup
          value={state.audienceType}
          onValueChange={(v) => update({ audienceType: v as WizardState['audienceType'] })}
          className="grid md:grid-cols-2 gap-3"
        >
          <Card
            className={cn(
              'cursor-pointer transition-all',
              state.audienceType === 'SMART_LIST' && 'border-primary ring-1 ring-primary/30',
            )}
            onClick={() => update({ audienceType: 'SMART_LIST' })}
          >
            <CardContent className="pt-4 pb-3 flex items-start gap-3">
              <RadioGroupItem value="SMART_LIST" id="t-smart" className="mt-0.5" />
              <div>
                <Label htmlFor="t-smart" className="font-medium cursor-pointer">Smart List</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Segmento salvo com regras dinâmicas</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={cn(
              'cursor-pointer transition-all',
              state.audienceType === 'CUSTOM_FILTER' && 'border-primary ring-1 ring-primary/30',
            )}
            onClick={() => update({ audienceType: 'CUSTOM_FILTER' })}
          >
            <CardContent className="pt-4 pb-3 flex items-start gap-3">
              <RadioGroupItem value="CUSTOM_FILTER" id="t-custom" className="mt-0.5" />
              <div>
                <Label htmlFor="t-custom" className="font-medium cursor-pointer">Filtro Personalizado</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Defina filtros para esta campanha</p>
              </div>
            </CardContent>
          </Card>
        </RadioGroup>
      </div>

      {state.audienceType === 'SMART_LIST' && (
        <div className="space-y-1.5">
          <Label>Selecionar Smart List <span className="text-destructive">*</span></Label>
          <Select value={state.smartListId} onValueChange={(v) => update({ smartListId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma lista..." />
            </SelectTrigger>
            <SelectContent>
              {initialSmartLists
                .filter((l) => l.status === 'ACTIVE')
                .map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    <div className="flex items-center gap-2">
                      <span>{l.name}</span>
                      <Badge variant="outline" className="text-xs">{l.resultCount.toLocaleString('pt-BR')} clientes</Badge>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {state.estimatedAudience > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <div className="text-xl font-bold">{state.estimatedAudience.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-muted-foreground">Base total</div>
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-600">{state.eligibleAudience.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-muted-foreground">Elegíveis</div>
              </div>
              <div>
                <div className="text-xl font-bold text-muted-foreground">{state.excludedCount + state.invalidCount}</div>
                <div className="text-xs text-muted-foreground">Excluídos</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Conexão WhatsApp <span className="text-destructive">*</span></Label>
        <Select value={state.connectionId} onValueChange={(v) => update({ connectionId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma conexão..." />
          </SelectTrigger>
          <SelectContent>
            {connections.length === 0 && (
              <SelectItem value="_none" disabled>Nenhuma conexão disponível</SelectItem>
            )}
            {connections.map((conn) => (
              <SelectItem key={conn.id} value={conn.id}>
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', conn.status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-muted')} />
                  <span>{conn.name}</span>
                  <span className="text-muted-foreground text-xs">{conn.phoneNumber}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {connections.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Configure uma conexão WhatsApp em{' '}
            <a href="/mensageria" className="text-primary underline">Automações</a> primeiro.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Categoria da Mensagem</Label>
        <RadioGroup
          value={state.templateCategory}
          onValueChange={(v) => update({ templateCategory: v as MessageCategory })}
          className="grid md:grid-cols-2 gap-2"
        >
          {(Object.entries(CATEGORY_LABELS) as [MessageCategory, string][]).map(([cat, label]) => {
            const price = initialPricing.find((p) => p.category === cat && p.market === 'BR')
            return (
              <Card
                key={cat}
                className={cn(
                  'cursor-pointer transition-all',
                  state.templateCategory === cat && 'border-primary ring-1 ring-primary/30',
                )}
                onClick={() => update({ templateCategory: cat })}
              >
                <CardContent className="pt-3 pb-3 flex items-center gap-3">
                  <RadioGroupItem value={cat} id={`cat-${cat}`} />
                  <div className="flex-1">
                    <Label htmlFor={`cat-${cat}`} className="font-medium text-sm cursor-pointer">{label}</Label>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground">{CATEGORY_DESCRIPTIONS[cat]}</p>
                      {price && (
                        <span className="text-xs font-mono font-medium text-primary shrink-0 ml-2">
                          {fmtUnit(price.unitPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <Label>Template de Mensagem <span className="text-destructive">*</span></Label>
        <Select value={state.templateId} onValueChange={(v) => update({ templateId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um template..." />
          </SelectTrigger>
          <SelectContent>
            {templates.map((tpl) => (
              <SelectItem key={tpl.id} value={tpl.id}>
                {tpl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.templateBody && (
          <div className="mt-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="text-xs font-medium text-muted-foreground mb-1">Preview</div>
            <p className="text-sm">{state.templateBody}</p>
          </div>
        )}
      </div>

      {Object.keys(state.templateVariables).length > 0 && (
        <div className="space-y-2">
          <Label>Variáveis do Template</Label>
          {Object.keys(state.templateVariables).map((varName) => (
            <div key={varName} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-32 shrink-0">{`{{${varName}}}`}</span>
              <Input
                className="h-8 text-sm"
                placeholder={`Valor para ${varName}...`}
                value={state.templateVariables[varName]}
                onChange={(e) =>
                  update({ templateVariables: { ...state.templateVariables, [varName]: e.target.value } })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-5">
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-2">
            <DollarSign className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-amber-800 dark:text-amber-400">Estimativa de Custo</span>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                O custo real depende das mensagens efetivamente entregues pela Meta.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="pt-4 pb-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Audiência base</span>
              <span>{state.estimatedAudience.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Elegíveis</span>
              <span className="text-emerald-600 font-medium">{state.eligibleAudience.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Excluídos</span>
              <span className="text-muted-foreground">{state.excludedCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Telefone inválido</span>
              <span className="text-muted-foreground">{state.invalidCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Categoria</span>
              <span>{CATEGORY_LABELS[state.templateCategory]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preço por mensagem</span>
              <span className="font-mono">{activePricing ? fmtUnit(activePricing.unitPrice) : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mercado</span>
              <span>Brasil (BRL)</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Custo Estimado</span>
              <span className="text-primary text-base">{fmt(estimatedCost)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-1.5">
        <Label>Janela de Atribuição</Label>
        <Select
          value={String(state.attributionWindowDays)}
          onValueChange={(v) => update({ attributionWindowDays: Number(v) as AttributionWindow })}
        >
          <SelectTrigger className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 dia após receber</SelectItem>
            <SelectItem value="3">3 dias após receber</SelectItem>
            <SelectItem value="7">7 dias após receber</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Pedidos feitos dentro desta janela serão atribuídos à campanha.
        </p>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label>Quando enviar?</Label>
        <RadioGroup
          value={state.sendMode}
          onValueChange={(v) => update({ sendMode: v as WizardState['sendMode'] })}
          className="grid md:grid-cols-2 gap-3"
        >
          <Card
            className={cn('cursor-pointer', state.sendMode === 'now' && 'border-primary ring-1 ring-primary/30')}
            onClick={() => update({ sendMode: 'now' })}
          >
            <CardContent className="pt-4 pb-3 flex items-start gap-3">
              <RadioGroupItem value="now" id="s-now" className="mt-0.5" />
              <div>
                <Label htmlFor="s-now" className="font-medium cursor-pointer flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Enviar agora
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Inicia o envio imediatamente após confirmar</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={cn('cursor-pointer', state.sendMode === 'scheduled' && 'border-primary ring-1 ring-primary/30')}
            onClick={() => update({ sendMode: 'scheduled' })}
          >
            <CardContent className="pt-4 pb-3 flex items-start gap-3">
              <RadioGroupItem value="scheduled" id="s-sched" className="mt-0.5" />
              <div>
                <Label htmlFor="s-sched" className="font-medium cursor-pointer flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Agendar
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Defina uma data e hora para envio</p>
              </div>
            </CardContent>
          </Card>
        </RadioGroup>
      </div>

      {state.sendMode === 'scheduled' && (
        <div className="space-y-1.5">
          <Label>Data e hora do envio <span className="text-destructive">*</span></Label>
          <Input
            type="datetime-local"
            value={state.scheduledAt}
            onChange={(e) => update({ scheduledAt: e.target.value })}
            className="w-60"
          />
        </div>
      )}
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 p-4 space-y-3 text-sm">
        <div className="font-semibold text-base">{state.name}</div>
        {state.description && <div className="text-muted-foreground text-sm">{state.description}</div>}
        <Separator />
        <div className="grid gap-2">
          {[
            { label: 'Audiência', value: state.smartListName || 'Filtro personalizado' },
            { label: 'Destinatários elegíveis', value: state.eligibleAudience.toLocaleString('pt-BR') },
            { label: 'Template', value: state.templateName },
            { label: 'Categoria', value: CATEGORY_LABELS[state.templateCategory] },
            { label: 'Custo estimado', value: fmt(estimatedCost) },
            { label: 'Envio', value: state.sendMode === 'now' ? 'Imediato' : `Agendado para ${state.scheduledAt}` },
            { label: 'Janela de atribuição', value: `${state.attributionWindowDays} dias` },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="pt-3 pb-3 text-xs text-amber-700 dark:text-amber-400">
          Ao confirmar, você autoriza o envio de mensagens WhatsApp para os clientes da audiência selecionada.
          O custo real pode variar conforme a entrega efetiva pela Meta.
        </CardContent>
      </Card>
    </div>
  )

  const STEPS = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4]

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/campaigns')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-base font-semibold">Nova Campanha</h1>
          <p className="text-xs text-muted-foreground">Passo {step + 1} de {STEP_LABELS.length}</p>
        </div>
        <div className="ml-auto">
          <StepIndicator current={step} total={STEP_LABELS.length} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">{STEP_LABELS[step].label}</h2>
        </div>

        {STEPS[step]()}
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 border-t border-border/60 bg-card/95 backdrop-blur px-6 py-4 flex items-center justify-between max-w-2xl mx-auto w-full">
        <Button
          variant="outline"
          onClick={() => (step === 0 ? router.push('/campaigns') : setStep(step - 1))}
        >
          {step === 0 ? 'Cancelar' : <><ArrowLeft className="h-4 w-4 mr-1" /> Anterior</>}
        </Button>

        {step < STEP_LABELS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</>
            ) : state.sendMode === 'now' ? (
              <><Send className="h-4 w-4" /> Confirmar e Enviar</>
            ) : (
              <><Check className="h-4 w-4" /> Confirmar</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
