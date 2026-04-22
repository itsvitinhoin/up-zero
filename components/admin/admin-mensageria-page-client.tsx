'use client'

import { useState, useTransition, type ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  Filter,
  GitBranch,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShoppingCart,
  Smartphone,
  Tag,
  Timer,
  Trash2,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminHero, AdminPage, AdminStatCard, AdminStatGrid } from '@/components/admin/admin-mobile-ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  createMessageFlowAction,
  createMessageTemplateAction,
  deleteMessageFlowAction,
  deleteMessageTemplateAction,
  getMensageriaOverviewAction,
  toggleMessageFlowAction,
  toggleMessageTemplateAction,
  updateMessageFlowAction,
  updateMessageTemplateAction,
  upsertWhatsAppConfigAction,
} from '@/lib/actions/messaging'
import type {
  FlowAction,
  FlowActionType,
  FlowCondition,
  FlowConditionOperator,
  FlowConditionType,
  FlowStep,
  MessageFlow,
  MessageTemplate,
  MessageTriggerType,
  WhatsAppConfig,
} from '@/lib/types'

const TRIGGER_LABELS: Record<MessageTriggerType, { label: string; description: string; category: 'customer' | 'order' | 'payment' }> = {
  CUSTOMER_REGISTERED: { label: 'Cadastro Realizado', description: 'Quando um cliente se cadastra', category: 'customer' },
  CUSTOMER_APPROVED: { label: 'Cadastro Aprovado', description: 'Quando o cadastro e aprovado', category: 'customer' },
  CUSTOMER_REJECTED: { label: 'Cadastro Rejeitado', description: 'Quando o cadastro e rejeitado', category: 'customer' },
  ORDER_CONFIRMED: { label: 'Pedido Confirmado', description: 'Quando o pedido e confirmado', category: 'order' },
  ORDER_PROCESSING: { label: 'Pedido em Separacao', description: 'Quando o pedido entra em separacao', category: 'order' },
  ORDER_SHIPPED: { label: 'Pedido Enviado', description: 'Quando o pedido e despachado', category: 'order' },
  ORDER_DELIVERED: { label: 'Pedido Entregue', description: 'Quando o pedido e entregue', category: 'order' },
  ORDER_CANCELLED: { label: 'Pedido Cancelado', description: 'Quando o pedido e cancelado', category: 'order' },
  CART_ABANDONED: { label: 'Carrinho Abandonado', description: 'Quando o cliente abandona o carrinho', category: 'order' },
  PAYMENT_CONFIRMED: { label: 'Pagamento Confirmado', description: 'Quando o pagamento e aprovado', category: 'payment' },
  PAYMENT_FAILED: { label: 'Pagamento Recusado', description: 'Quando o pagamento falha', category: 'payment' },
}

const AVAILABLE_VARIABLES = [
  { key: '{{nome}}', description: 'Nome do cliente' },
  { key: '{{empresa}}', description: 'Nome da empresa' },
  { key: '{{pedido}}', description: 'Numero do pedido' },
  { key: '{{status}}', description: 'Status atual' },
  { key: '{{valor}}', description: 'Valor total' },
  { key: '{{rastreio}}', description: 'Codigo de rastreio' },
  { key: '{{link}}', description: 'Link do pedido' },
  { key: '{{vendedora}}', description: 'Nome da vendedora' },
  { key: '{{whatsapp_vendedora}}', description: 'WhatsApp da vendedora' },
]

const CONDITION_TYPE_LABELS: Record<FlowConditionType, { label: string; icon: ReactNode }> = {
  CUSTOMER_STATUS: { label: 'Status do Cliente', icon: <Users className="h-4 w-4" /> },
  ORDER_STATUS: { label: 'Status do Pedido', icon: <ShoppingCart className="h-4 w-4" /> },
  ORDER_VALUE: { label: 'Valor do Pedido', icon: <CreditCard className="h-4 w-4" /> },
  CUSTOMER_SEGMENT: { label: 'Segmento do Cliente', icon: <Tag className="h-4 w-4" /> },
  PAYMENT_METHOD: { label: 'Metodo de Pagamento', icon: <CreditCard className="h-4 w-4" /> },
  TIME_DELAY: { label: 'Tempo de Espera', icon: <Timer className="h-4 w-4" /> },
  SELLER_ASSIGNED: { label: 'Vendedor Atribuido', icon: <UserCheck className="h-4 w-4" /> },
}

const ACTION_TYPE_LABELS: Record<FlowActionType, { label: string; icon: ReactNode }> = {
  SEND_WHATSAPP: { label: 'Enviar WhatsApp', icon: <MessageCircle className="h-4 w-4 text-green-600" /> },
  SEND_EMAIL: { label: 'Enviar E-mail', icon: <Mail className="h-4 w-4 text-blue-600" /> },
  SEND_SMS: { label: 'Enviar SMS', icon: <MessageSquare className="h-4 w-4 text-purple-600" /> },
  WAIT: { label: 'Aguardar', icon: <Timer className="h-4 w-4 text-amber-600" /> },
  ASSIGN_SELLER: { label: 'Atribuir Vendedor', icon: <UserCheck className="h-4 w-4 text-cyan-600" /> },
  ADD_TAG: { label: 'Adicionar Tag', icon: <Tag className="h-4 w-4 text-pink-600" /> },
  UPDATE_STATUS: { label: 'Atualizar Status', icon: <RefreshCw className="h-4 w-4 text-indigo-600" /> },
}

const DEFAULT_TEMPLATE_FORM: Pick<MessageTemplate, 'trigger' | 'name' | 'content' | 'isActive' | 'channel' | 'delayMinutes'> = {
  trigger: 'CUSTOMER_REGISTERED',
  name: '',
  content: '',
  isActive: true,
  channel: 'WHATSAPP',
  delayMinutes: 0,
}

const DEFAULT_FLOW_FORM: Pick<MessageFlow, 'name' | 'description' | 'trigger' | 'isActive' | 'steps'> = {
  name: '',
  description: null,
  trigger: 'CUSTOMER_REGISTERED',
  isActive: true,
  steps: [],
}

type MensageriaInitialData = {
  whatsappConfig: WhatsAppConfig
  templates: MessageTemplate[]
  flows: MessageFlow[]
}

type AdminMensageriaPageClientProps = {
  initialData?: MensageriaInitialData
}

export default function AdminMensageriaPageClient({ initialData }: AdminMensageriaPageClientProps) {
  const [activeTab, setActiveTab] = useState('automacoes')
  const [isInitialLoading, startInitialLoading] = useTransition()
  const [isPersisting, startPersisting] = useTransition()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>({
    isEnabled: initialData?.whatsappConfig?.isEnabled ?? false,
    provider: initialData?.whatsappConfig?.provider ?? 'META_CLOUD',
    phoneNumberId: initialData?.whatsappConfig?.phoneNumberId ?? '',
    accessToken: initialData?.whatsappConfig?.accessToken ?? '',
    businessAccountId: initialData?.whatsappConfig?.businessAccountId ?? '',
    webhookVerifyToken: initialData?.whatsappConfig?.webhookVerifyToken ?? '',
    isConnected: initialData?.whatsappConfig?.isConnected ?? false,
    connectedAt: initialData?.whatsappConfig?.connectedAt ?? null,
  })
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialData?.templates ?? [])
  const [newTemplate, setNewTemplate] = useState(DEFAULT_TEMPLATE_FORM)

  const [flows, setFlows] = useState<MessageFlow[]>(initialData?.flows ?? [])
  const [isFlowDialogOpen, setIsFlowDialogOpen] = useState(false)
  const [editingFlow, setEditingFlow] = useState<MessageFlow | null>(null)
  const [newFlow, setNewFlow] = useState(DEFAULT_FLOW_FORM)

  const loadMensageriaData = () => {
    startInitialLoading(async () => {
      const result = await getMensageriaOverviewAction()
      if (!result.success || !result.data) {
        return
      }

      setWhatsappConfig(result.data.whatsappConfig)
      setTemplates(result.data.templates)
      setFlows(result.data.flows)
    })
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    const nextConfig: WhatsAppConfig = {
      ...whatsappConfig,
      isEnabled: true,
      isConnected: true,
      connectedAt: new Date(),
    }
    const result = await upsertWhatsAppConfigAction(nextConfig)
    if (result.success && result.data) {
      setWhatsappConfig(result.data)
    }
    setIsConnecting(false)
  }

  const handleDisconnect = async () => {
    const nextConfig: WhatsAppConfig = {
      ...whatsappConfig,
      isConnected: false,
      connectedAt: null,
    }
    const result = await upsertWhatsAppConfigAction(nextConfig)
    if (result.success && result.data) {
      setWhatsappConfig(result.data)
    }
  }

  const handleToggleTemplate = (id: string) => {
    startPersisting(async () => {
      const target = templates.find((template) => template.id === id)
      if (!target) return
      const nextActive = !target.isActive

      const result = await toggleMessageTemplateAction(id, nextActive)
      if (!result.success) return

      setTemplates((prev) => prev.map((template) => (
        template.id === id ? { ...template, isActive: nextActive, updatedAt: new Date() } : template
      )))
    })
  }

  const handleSaveTemplate = () => {
    startPersisting(async () => {
      if (editingTemplate) {
        const result = await updateMessageTemplateAction(editingTemplate.id, {
          name: editingTemplate.name,
          trigger: editingTemplate.trigger,
          isActive: editingTemplate.isActive,
          channel: editingTemplate.channel,
          content: editingTemplate.content,
          variables: editingTemplate.variables || [],
          delayMinutes: editingTemplate.delayMinutes,
        })
        if (!result.success) return
      } else {
        const result = await createMessageTemplateAction({
          name: newTemplate.name,
          trigger: newTemplate.trigger,
          isActive: newTemplate.isActive,
          channel: newTemplate.channel,
          content: newTemplate.content,
          variables: [],
          delayMinutes: newTemplate.delayMinutes,
        })
        if (!result.success) return
      }

      setIsDialogOpen(false)
      setEditingTemplate(null)
      setNewTemplate(DEFAULT_TEMPLATE_FORM)
      loadMensageriaData()
    })
  }

  const handleDeleteTemplate = (id: string) => {
    startPersisting(async () => {
      const result = await deleteMessageTemplateAction(id)
      if (!result.success) return
      setTemplates((prev) => prev.filter((template) => template.id !== id))
    })
  }

  const openEditDialog = (template: MessageTemplate) => {
    setEditingTemplate(template)
    setIsDialogOpen(true)
  }

  const handleToggleFlow = (id: string) => {
    startPersisting(async () => {
      const target = flows.find((flow) => flow.id === id)
      if (!target) return
      const nextActive = !target.isActive

      const result = await toggleMessageFlowAction(id, nextActive)
      if (!result.success) return

      setFlows((prev) => prev.map((flow) => (
        flow.id === id ? { ...flow, isActive: nextActive, updatedAt: new Date() } : flow
      )))
    })
  }

  const handleDeleteFlow = (id: string) => {
    startPersisting(async () => {
      const result = await deleteMessageFlowAction(id)
      if (!result.success) return
      setFlows((prev) => prev.filter((flow) => flow.id !== id))
    })
  }

  const handleSaveFlow = () => {
    startPersisting(async () => {
      if (editingFlow) {
        const result = await updateMessageFlowAction(editingFlow.id, {
          name: editingFlow.name,
          description: editingFlow.description,
          trigger: editingFlow.trigger,
          isActive: editingFlow.isActive,
          steps: editingFlow.steps,
        })
        if (!result.success) return
      } else if (newFlow.name) {
        const result = await createMessageFlowAction({
          name: newFlow.name,
          description: newFlow.description,
          trigger: newFlow.trigger,
          isActive: newFlow.isActive,
          steps: newFlow.steps,
        })
        if (!result.success) return
      }

      setIsFlowDialogOpen(false)
      setEditingFlow(null)
      setNewFlow(DEFAULT_FLOW_FORM)
      loadMensageriaData()
    })
  }

  const openEditFlowDialog = (flow: MessageFlow) => {
    setEditingFlow(flow)
    setIsFlowDialogOpen(true)
  }

  const openCreateFlowDialog = () => {
    setEditingFlow(null)
    setNewFlow(DEFAULT_FLOW_FORM)
    setIsFlowDialogOpen(true)
  }

  const addStepToFlow = () => {
    const targetSteps = editingFlow?.steps ?? newFlow.steps
    const newStep: FlowStep = {
      id: `step_${Date.now()}`,
      name: `Passo ${targetSteps.length + 1}`,
      conditions: [],
      conditionLogic: 'AND',
      actions: [],
      nextStepId: null,
    }

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: [...editingFlow.steps, newStep] })
      return
    }

    setNewFlow({ ...newFlow, steps: [...newFlow.steps, newStep] })
  }

  const removeStepFromFlow = (stepId: string) => {
    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: editingFlow.steps.filter((step) => step.id !== stepId) })
      return
    }

    setNewFlow({ ...newFlow, steps: newFlow.steps.filter((step) => step.id !== stepId) })
  }

  const addConditionToStep = (stepId: string) => {
    const condition: FlowCondition = {
      id: `cond_${Date.now()}`,
      type: 'CUSTOMER_STATUS',
      operator: 'EQUALS',
      value: '',
    }

    const updateSteps = (steps: FlowStep[]) => steps.map((step) => (
      step.id === stepId ? { ...step, conditions: [...step.conditions, condition] } : step
    ))

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: updateSteps(editingFlow.steps) })
      return
    }

    setNewFlow({ ...newFlow, steps: updateSteps(newFlow.steps) })
  }

  const addActionToStep = (stepId: string) => {
    const action: FlowAction = {
      id: `act_${Date.now()}`,
      type: 'SEND_WHATSAPP',
      config: {},
    }

    const updateSteps = (steps: FlowStep[]) => steps.map((step) => (
      step.id === stepId ? { ...step, actions: [...step.actions, action] } : step
    ))

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: updateSteps(editingFlow.steps) })
      return
    }

    setNewFlow({ ...newFlow, steps: updateSteps(newFlow.steps) })
  }

  const openCreateDialog = () => {
    setEditingTemplate(null)
    setNewTemplate(DEFAULT_TEMPLATE_FORM)
    setIsDialogOpen(true)
  }

  const updateConditionField = (
    stepId: string,
    conditionId: string,
    field: keyof FlowCondition,
    value: FlowCondition['type'] | FlowCondition['operator'] | FlowCondition['value'],
  ) => {
    const updateSteps = (steps: FlowStep[]) => steps.map((step) => (
      step.id === stepId
        ? {
            ...step,
            conditions: step.conditions.map((condition) => (
              condition.id === conditionId ? { ...condition, [field]: value } : condition
            )),
          }
        : step
    ))

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: updateSteps(editingFlow.steps) })
      return
    }

    setNewFlow({ ...newFlow, steps: updateSteps(newFlow.steps) })
  }

  const removeConditionFromStep = (stepId: string, conditionId: string) => {
    const updateSteps = (steps: FlowStep[]) => steps.map((step) => (
      step.id === stepId
        ? { ...step, conditions: step.conditions.filter((condition) => condition.id !== conditionId) }
        : step
    ))

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: updateSteps(editingFlow.steps) })
      return
    }

    setNewFlow({ ...newFlow, steps: updateSteps(newFlow.steps) })
  }

  const updateActionType = (stepId: string, actionId: string, type: FlowActionType) => {
    const updateSteps = (steps: FlowStep[]) => steps.map((step) => (
      step.id === stepId
        ? {
            ...step,
            actions: step.actions.map((action) => (
              action.id === actionId ? { ...action, type, config: {} } : action
            )),
          }
        : step
    ))

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: updateSteps(editingFlow.steps) })
      return
    }

    setNewFlow({ ...newFlow, steps: updateSteps(newFlow.steps) })
  }

  const updateActionConfig = (stepId: string, actionId: string, key: keyof FlowAction['config'], value: string | number) => {
    const updateSteps = (steps: FlowStep[]) => steps.map((step) => (
      step.id === stepId
        ? {
            ...step,
            actions: step.actions.map((action) => (
              action.id === actionId ? { ...action, config: { ...action.config, [key]: value } } : action
            )),
          }
        : step
    ))

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: updateSteps(editingFlow.steps) })
      return
    }

    setNewFlow({ ...newFlow, steps: updateSteps(newFlow.steps) })
  }

  const removeActionFromStep = (stepId: string, actionId: string) => {
    const updateSteps = (steps: FlowStep[]) => steps.map((step) => (
      step.id === stepId
        ? { ...step, actions: step.actions.filter((action) => action.id !== actionId) }
        : step
    ))

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: updateSteps(editingFlow.steps) })
      return
    }

    setNewFlow({ ...newFlow, steps: updateSteps(newFlow.steps) })
  }

  const updateStepName = (stepId: string, value: string) => {
    const updateSteps = (steps: FlowStep[]) => steps.map((step) => (
      step.id === stepId ? { ...step, name: value } : step
    ))

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: updateSteps(editingFlow.steps) })
      return
    }

    setNewFlow({ ...newFlow, steps: updateSteps(newFlow.steps) })
  }

  const updateStepLogic = (stepId: string, value: 'AND' | 'OR') => {
    const updateSteps = (steps: FlowStep[]) => steps.map((step) => (
      step.id === stepId ? { ...step, conditionLogic: value } : step
    ))

    if (editingFlow) {
      setEditingFlow({ ...editingFlow, steps: updateSteps(editingFlow.steps) })
      return
    }

    setNewFlow({ ...newFlow, steps: updateSteps(newFlow.steps) })
  }

  const currentTemplate = editingTemplate ?? newTemplate
  const currentFlow = editingFlow ?? newFlow
  const isBusy = isInitialLoading || isPersisting || isConnecting

  return (
    <AdminPage>
      <AdminHero
        icon={MessageSquare}
        eyebrow="Mensageria"
        title="Automacoes e WhatsApp"
        description="Configure mensagens automaticas via WhatsApp e e-mail com foco em leitura rapida no mobile."
        actions={
          <div className="flex items-center gap-2">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            {whatsappConfig.isConnected ? (
              <Badge variant="default" className="min-h-10 gap-1 rounded-2xl bg-green-500 px-3">
                <CheckCircle2 className="h-3 w-3" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="default" className="min-h-10 gap-1 rounded-2xl bg-red-500 px-3">
                <XCircle className="h-3 w-3" />
                Desconectado
              </Badge>
            )}
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 lg:space-y-6">
        <div className="lg:hidden overflow-x-auto -mx-4 px-4 scrollbar-hide">
          <TabsList className="inline-flex w-auto min-w-max h-12 gap-1 bg-primary/10">
            <TabsTrigger value="automacoes" className="h-10 px-4 text-sm gap-2">
              <Zap className="h-4 w-4" />
              Automacoes
            </TabsTrigger>
            <TabsTrigger value="fluxos" className="h-10 px-4 text-sm gap-2">
              <GitBranch className="h-4 w-4" />
              Fluxos
            </TabsTrigger>
            <TabsTrigger value="configuracao" className="h-10 px-4 text-sm gap-2">
              <Settings className="h-4 w-4" />
              Configuracao API
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsList className="hidden lg:grid w-full grid-cols-3 max-w-lg bg-primary/10">
          <TabsTrigger value="automacoes" className="gap-2">
            <Zap className="h-4 w-4" />
            Automacoes
          </TabsTrigger>
          <TabsTrigger value="fluxos" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Fluxos
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuracao API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automacoes" className="space-y-4 lg:space-y-6">
          <AdminStatGrid>
            <AdminStatCard icon={CheckCircle2} label="Ativas" value={templates.filter((template) => template.isActive).length} hint="Mensagens habilitadas" tone="success" />
            <AdminStatCard icon={Send} label="Enviadas" value="1.234" hint="Ultimos 30 dias" tone="info" />
            <AdminStatCard icon={Eye} label="Leitura" value="89%" hint="Taxa media" />
            <AdminStatCard icon={XCircle} label="Falhas" value="12" hint="Exigem revisao" tone="danger" />
          </AdminStatGrid>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Mensagens Automaticas</CardTitle>
                <CardDescription>Configure mensagens para cada evento</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateDialog} className="h-10 lg:h-9">
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="hidden lg:inline">Nova Mensagem</span>
                    <span className="lg:hidden">Nova</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingTemplate ? 'Editar Mensagem' : 'Nova Mensagem Automatica'}</DialogTitle>
                    <DialogDescription>Configure quando e o que sera enviado automaticamente</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Automacao</Label>
                        <Input value={currentTemplate.name} onChange={(event) => editingTemplate ? setEditingTemplate({ ...editingTemplate, name: event.target.value }) : setNewTemplate({ ...newTemplate, name: event.target.value })} placeholder="Ex: Boas-vindas" />
                      </div>
                      <div className="space-y-2">
                        <Label>Gatilho</Label>
                        <Select value={currentTemplate.trigger} onValueChange={(value: MessageTriggerType) => editingTemplate ? setEditingTemplate({ ...editingTemplate, trigger: value }) : setNewTemplate({ ...newTemplate, trigger: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="header-customer" disabled className="font-semibold text-xs text-muted-foreground">CLIENTE</SelectItem>
                            {Object.entries(TRIGGER_LABELS).filter(([, item]) => item.category === 'customer').map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
                            <SelectItem value="header-order" disabled className="font-semibold text-xs text-muted-foreground">PEDIDO</SelectItem>
                            {Object.entries(TRIGGER_LABELS).filter(([, item]) => item.category === 'order').map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
                            <SelectItem value="header-payment" disabled className="font-semibold text-xs text-muted-foreground">PAGAMENTO</SelectItem>
                            {Object.entries(TRIGGER_LABELS).filter(([, item]) => item.category === 'payment').map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Mensagem</Label>
                      <Textarea value={currentTemplate.content} onChange={(event) => editingTemplate ? setEditingTemplate({ ...editingTemplate, content: event.target.value }) : setNewTemplate({ ...newTemplate, content: event.target.value })} placeholder="Digite a mensagem..." rows={4} />
                      <div className="flex flex-wrap gap-1 mt-2">
                        {AVAILABLE_VARIABLES.map((variable) => (
                          <Button key={variable.key} variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                            const newContent = `${currentTemplate.content || ''} ${variable.key}`.trim()
                            editingTemplate
                              ? setEditingTemplate({ ...editingTemplate, content: newContent })
                              : setNewTemplate({ ...newTemplate, content: newContent })
                          }}>
                            {variable.key}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Clique nas variaveis acima para adicionar ao texto</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Atraso (minutos)</Label>
                        <Input type="number" min="0" value={currentTemplate.delayMinutes} onChange={(event) => {
                          const value = Number.parseInt(event.target.value, 10) || 0
                          editingTemplate
                            ? setEditingTemplate({ ...editingTemplate, delayMinutes: value })
                            : setNewTemplate({ ...newTemplate, delayMinutes: value })
                        }} />
                        <p className="text-xs text-muted-foreground">0 = envio imediato</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Canal</Label>
                        <Select value={currentTemplate.channel} onValueChange={(value: 'WHATSAPP' | 'EMAIL' | 'SMS') => editingTemplate ? setEditingTemplate({ ...editingTemplate, channel: value }) : setNewTemplate({ ...newTemplate, channel: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                            <SelectItem value="EMAIL">E-mail</SelectItem>
                            <SelectItem value="SMS" disabled>SMS (em breve)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Pre-visualizacao</Label>
                      <div className="bg-[#e5ddd5] rounded-lg p-4">
                        <div className="bg-white rounded-lg p-3 max-w-[80%] shadow-sm">
                          <p className="text-sm whitespace-pre-wrap">
                            {(currentTemplate.content || 'Sua mensagem aparecera aqui...')
                              .replace('{{nome}}', 'Maria Silva')
                              .replace('{{empresa}}', 'Loja da Maria')
                              .replace('{{pedido}}', '12345')
                              .replace('{{status}}', 'Confirmado')
                              .replace('{{valor}}', 'R$ 1.500,00')
                              .replace('{{rastreio}}', 'BR123456789')
                              .replace('{{link}}', 'loja.com/pedido/12345')
                              .replace('{{vendedora}}', 'Ana Paula')
                              .replace('{{whatsapp_vendedora}}', '(11) 99999-9999')}
                          </p>
                          <p className="text-[10px] text-gray-500 text-right mt-1">12:00</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSaveTemplate}>{editingTemplate ? 'Salvar Alteracoes' : 'Criar Mensagem'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {(['customer', 'order', 'payment'] as const).map((category) => {
                const categoryTemplates = templates.filter((template) => TRIGGER_LABELS[template.trigger]?.category === category)
                if (categoryTemplates.length === 0) return null

                return (
                  <div key={category} className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{category === 'customer' ? 'Cliente' : category === 'order' ? 'Pedido' : 'Pagamento'}</h3>
                    {categoryTemplates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-full shrink-0 ${template.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <MessageSquare className={`h-4 w-4 ${template.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{template.name}</p>
                              <Badge variant="outline" className="text-xs">{TRIGGER_LABELS[template.trigger]?.label}</Badge>
                              {template.delayMinutes > 0 ? <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />{template.delayMinutes}min</Badge> : null}
                            </div>
                            <p className="text-sm text-muted-foreground truncate mt-1">{template.content.substring(0, 60)}...</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch checked={template.isActive} onCheckedChange={() => handleToggleTemplate(template.id)} />
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(template)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(template.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}

              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma automacao configurada</p>
                  <Button onClick={openCreateDialog} className="mt-4"><Plus className="mr-2 h-4 w-4" />Criar primeira automacao</Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fluxos" className="space-y-4 lg:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold">Fluxos de Automacao</h2>
              <p className="text-sm text-muted-foreground">Crie fluxos com condicoes e acoes baseados em eventos do sistema</p>
            </div>
            <Button onClick={openCreateFlowDialog}><Plus className="mr-2 h-4 w-4" />Novo Fluxo</Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-full bg-green-100"><Play className="h-4 w-4 text-green-600" /></div><div><p className="text-2xl font-bold">{flows.filter((flow) => flow.isActive).length}</p><p className="text-xs text-muted-foreground">Fluxos Ativos</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-full bg-blue-100"><GitBranch className="h-4 w-4 text-blue-600" /></div><div><p className="text-2xl font-bold">{flows.reduce((total, flow) => total + flow.steps.length, 0)}</p><p className="text-xs text-muted-foreground">Total de Passos</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-full bg-purple-100"><Filter className="h-4 w-4 text-purple-600" /></div><div><p className="text-2xl font-bold">{flows.reduce((total, flow) => total + flow.steps.reduce((stepTotal, step) => stepTotal + step.conditions.length, 0), 0)}</p><p className="text-xs text-muted-foreground">Condicoes</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-full bg-amber-100"><Zap className="h-4 w-4 text-amber-600" /></div><div><p className="text-2xl font-bold">{flows.reduce((total, flow) => total + flow.steps.reduce((stepTotal, step) => stepTotal + step.actions.length, 0), 0)}</p><p className="text-xs text-muted-foreground">Acoes</p></div></div></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Seus Fluxos</CardTitle>
              <CardDescription>Gerencie fluxos de automacao com condicoes baseadas em cadastros, pedidos e pagamentos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {flows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nenhum fluxo criado ainda</p><p className="text-sm">Crie seu primeiro fluxo de automacao</p></div>
              ) : flows.map((flow) => (
                <div key={flow.id} className={`p-4 border rounded-lg transition-colors ${flow.isActive ? 'bg-card' : 'bg-muted/50 opacity-75'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{flow.name}</h3>
                        <Badge variant="outline" className="text-xs">{TRIGGER_LABELS[flow.trigger]?.label || flow.trigger}</Badge>
                        {flow.isActive ? <Badge className="bg-green-600 text-xs">Ativo</Badge> : <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                      </div>
                      {flow.description ? <p className="text-sm text-muted-foreground mt-1">{flow.description}</p> : null}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {flow.steps.map((step, index) => (
                          <div key={step.id} className="flex items-center gap-1">
                            <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                              <span className="font-medium">{index + 1}.</span>
                              <span>{step.name}</span>
                              {step.conditions.length > 0 ? <Badge variant="outline" className="h-4 px-1 text-xs ml-1">{step.conditions.length} cond.</Badge> : null}
                              {step.actions.length > 0 ? <Badge variant="secondary" className="h-4 px-1 text-xs ml-1">{step.actions.length} acao</Badge> : null}
                            </div>
                            {index < flow.steps.length - 1 ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : null}
                          </div>
                        ))}
                        {flow.steps.length === 0 ? <span className="text-xs text-muted-foreground">Nenhum passo configurado</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={flow.isActive} onCheckedChange={() => handleToggleFlow(flow.id)} />
                      <Button variant="ghost" size="icon" onClick={() => openEditFlowDialog(flow)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteFlow(flow.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Dialog open={isFlowDialogOpen} onOpenChange={setIsFlowDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFlow ? 'Editar Fluxo' : 'Novo Fluxo de Automacao'}</DialogTitle>
                <DialogDescription>Configure o gatilho, condicoes e acoes do fluxo</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Fluxo</Label>
                    <Input value={currentFlow.name} onChange={(event) => editingFlow ? setEditingFlow({ ...editingFlow, name: event.target.value }) : setNewFlow({ ...newFlow, name: event.target.value })} placeholder="Ex: Recuperacao de Carrinho" />
                  </div>
                  <div className="space-y-2">
                    <Label>Gatilho</Label>
                    <Select value={currentFlow.trigger} onValueChange={(value: MessageTriggerType) => editingFlow ? setEditingFlow({ ...editingFlow, trigger: value }) : setNewFlow({ ...newFlow, trigger: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRIGGER_LABELS).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descricao (opcional)</Label>
                  <Textarea value={currentFlow.description || ''} onChange={(event) => editingFlow ? setEditingFlow({ ...editingFlow, description: event.target.value || null }) : setNewFlow({ ...newFlow, description: event.target.value || null })} placeholder="Descreva o objetivo deste fluxo..." rows={2} />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Passos do Fluxo</Label>
                    <Button variant="outline" size="sm" onClick={addStepToFlow}><Plus className="mr-2 h-4 w-4" />Adicionar Passo</Button>
                  </div>

                  {currentFlow.steps.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground"><GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Nenhum passo adicionado</p><p className="text-xs">Clique em \"Adicionar Passo\" para comecar</p></div>
                  ) : (
                    <div className="space-y-4">
                      {currentFlow.steps.map((step, stepIndex) => (
                        <div key={step.id} className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">{stepIndex + 1}</div>
                              <Input value={step.name} onChange={(event) => updateStepName(step.id, event.target.value)} className="h-8 w-48" placeholder="Nome do passo" />
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeStepFromFlow(step.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" />Condicoes{step.conditions.length > 0 ? <Select value={step.conditionLogic} onValueChange={(value: 'AND' | 'OR') => updateStepLogic(step.id, value)}><SelectTrigger className="h-6 w-16 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AND">E</SelectItem><SelectItem value="OR">OU</SelectItem></SelectContent></Select> : null}</Label>
                              <Button variant="ghost" size="sm" onClick={() => addConditionToStep(step.id)}><Plus className="h-3 w-3" /></Button>
                            </div>
                            {step.conditions.length === 0 ? <p className="text-xs text-muted-foreground pl-6">Sem condicoes (sempre executa)</p> : (
                              <div className="space-y-2 pl-6">
                                {step.conditions.map((condition) => (
                                  <div key={condition.id} className="space-y-2 rounded-md border p-3 md:flex md:items-center md:gap-2 md:space-y-0 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground min-w-0 md:w-44">{CONDITION_TYPE_LABELS[condition.type].icon}<span className="truncate">{CONDITION_TYPE_LABELS[condition.type].label}</span></div>
                                    <Select value={condition.type} onValueChange={(value: FlowConditionType) => updateConditionField(step.id, condition.id, 'type', value)}>
                                      <SelectTrigger className="h-8 md:w-40"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {Object.keys(CONDITION_TYPE_LABELS).map((key) => <SelectItem key={key} value={key}>{CONDITION_TYPE_LABELS[key as FlowConditionType].label}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    <Select value={condition.operator} onValueChange={(value: FlowConditionOperator) => updateConditionField(step.id, condition.id, 'operator', value)}>
                                      <SelectTrigger className="h-8 md:w-32"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="EQUALS">Igual a</SelectItem>
                                        <SelectItem value="NOT_EQUALS">Diferente de</SelectItem>
                                        <SelectItem value="GREATER_THAN">Maior que</SelectItem>
                                        <SelectItem value="LESS_THAN">Menor que</SelectItem>
                                        <SelectItem value="CONTAINS">Contem</SelectItem>
                                        <SelectItem value="IN">Esta em</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input value={String(condition.value)} onChange={(event) => updateConditionField(step.id, condition.id, 'value', event.target.value)} className="h-8 flex-1" placeholder="Valor" />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeConditionFromStep(step.id, condition.id)}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" />Acoes</Label>
                              <Button variant="ghost" size="sm" onClick={() => addActionToStep(step.id)}><Plus className="h-3 w-3" /></Button>
                            </div>
                            {step.actions.length === 0 ? <p className="text-xs text-muted-foreground pl-6">Nenhuma acao configurada</p> : (
                              <div className="space-y-2 pl-6">
                                {step.actions.map((action) => (
                                  <div key={action.id} className="space-y-2 rounded-md border p-3 md:flex md:items-center md:gap-2 md:space-y-0 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground min-w-0 md:w-44">{ACTION_TYPE_LABELS[action.type].icon}<span className="truncate">{ACTION_TYPE_LABELS[action.type].label}</span></div>
                                    <Select value={action.type} onValueChange={(value: FlowActionType) => updateActionType(step.id, action.id, value)}>
                                      <SelectTrigger className="h-8 md:w-44"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {Object.keys(ACTION_TYPE_LABELS).map((key) => <SelectItem key={key} value={key}>{ACTION_TYPE_LABELS[key as FlowActionType].label}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    {action.type === 'WAIT' ? (
                                      <div className="flex items-center gap-1 flex-1">
                                        <Input type="number" value={action.config.delayMinutes || ''} onChange={(event) => updateActionConfig(step.id, action.id, 'delayMinutes', Number(event.target.value) || 0)} className="h-8 w-20" placeholder="30" />
                                        <span className="text-xs text-muted-foreground">min</span>
                                      </div>
                                    ) : action.type === 'SEND_WHATSAPP' || action.type === 'SEND_EMAIL' || action.type === 'SEND_SMS' ? (
                                      <Input value={action.config.message || ''} onChange={(event) => updateActionConfig(step.id, action.id, 'message', event.target.value)} className="h-8 flex-1" placeholder="Mensagem ou ID do template" />
                                    ) : (
                                      <Input
                                        value={action.type === 'ADD_TAG' ? action.config.tag || '' : action.type === 'UPDATE_STATUS' ? action.config.status || '' : action.config.sellerId || ''}
                                        onChange={(event) => updateActionConfig(step.id, action.id, action.type === 'ADD_TAG' ? 'tag' : action.type === 'UPDATE_STATUS' ? 'status' : 'sellerId', event.target.value)}
                                        className="h-8 flex-1"
                                        placeholder={action.type === 'ADD_TAG' ? 'Nome da tag' : action.type === 'UPDATE_STATUS' ? 'Novo status' : 'ID do vendedor'}
                                      />
                                    )}
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeActionFromStep(step.id, action.id)}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFlowDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveFlow}>{editingFlow ? 'Salvar Alteracoes' : 'Criar Fluxo'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="configuracao" className="space-y-4 lg:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />WhatsApp Business API</CardTitle>
              <CardDescription>Conecte sua conta do WhatsApp Business usando o cadastro incorporado da Meta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={`p-4 rounded-lg border-2 ${whatsappConfig.isConnected ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-start gap-3">
                  {whatsappConfig.isConnected ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <Smartphone className="h-5 w-5 text-gray-500 shrink-0" />}
                  <div className="flex-1">
                    <p className={`font-medium ${whatsappConfig.isConnected ? 'text-green-800' : 'text-gray-800'}`}>{whatsappConfig.isConnected ? 'WhatsApp Conectado' : 'WhatsApp nao conectado'}</p>
                    <p className={`text-sm ${whatsappConfig.isConnected ? 'text-green-600' : 'text-gray-600'}`}>{whatsappConfig.isConnected ? `Conectado em ${whatsappConfig.connectedAt?.toLocaleDateString('pt-BR')} - Numero: ${whatsappConfig.phoneNumberId || '123456789012345'}` : 'Clique no botao abaixo para conectar sua conta do WhatsApp Business'}</p>
                  </div>
                  {whatsappConfig.isConnected ? <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-destructive hover:text-destructive">Desconectar</Button> : null}
                </div>
              </div>

              {!whatsappConfig.isConnected ? (
                <>
                  <div className="text-center py-8 space-y-6">
                    <div className="mx-auto w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#25D366]" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">Conectar WhatsApp Business</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">Use o cadastro incorporado da Meta para conectar sua conta do WhatsApp Business de forma rapida e segura.</p>
                    </div>
                    <Button size="lg" onClick={handleConnect} disabled={isConnecting} className="h-14 px-8 text-base bg-[#1877F2] hover:bg-[#166FE5] text-white">
                      {isConnecting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Conectando...</> : <><svg viewBox="0 0 24 24" className="mr-2 h-5 w-5" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>Continuar com Facebook</>}
                    </Button>
                    <p className="text-xs text-muted-foreground">Voce sera redirecionado para o Facebook para autorizar a conexao</p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-medium">Como funciona o cadastro incorporado</h3>
                    <div className="grid gap-4">
                      {[['1', 'Faca login com o Facebook', 'Use sua conta do Facebook que gerencia o Meta Business'], ['2', 'Selecione ou crie uma conta Business', 'Escolha uma conta existente ou crie uma nova para sua empresa'], ['3', 'Conecte seu numero de WhatsApp', 'Adicione um numero de telefone novo ou migre um existente'], ['4', 'Pronto para enviar mensagens', 'Sua integracao estara ativa e pronta para uso']].map(([index, title, description]) => (
                        <div key={index} className="flex gap-4 items-start"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">{index}</div><div><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{description}</p></div></div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-blue-600" /><p className="text-sm font-medium text-blue-800">Requisitos para conectar</p></div>
                    <ul className="text-sm text-blue-700 space-y-1 ml-6 list-disc">
                      <li>Conta do Facebook com acesso ao Meta Business Suite</li>
                      <li>Numero de telefone que pode receber SMS ou ligacao</li>
                      <li>Nome de exibicao da empresa (sera mostrado aos clientes)</li>
                      <li>Categoria de negocio da sua empresa</li>
                    </ul>
                  </div>

                  <details className="group">
                    <summary className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />Configuracao manual avancada</summary>
                    <div className="mt-4 space-y-4 pl-6 border-l-2 border-muted">
                      <p className="text-sm text-muted-foreground">Se voce ja possui as credenciais da API do WhatsApp, pode configurar manualmente:</p>
                      <div className="space-y-3">
                        <div className="space-y-2"><Label htmlFor="phoneNumberId">Phone Number ID</Label><Input id="phoneNumberId" value={whatsappConfig.phoneNumberId} onChange={(event) => setWhatsappConfig((prev) => ({ ...prev, phoneNumberId: event.target.value }))} placeholder="Ex: 123456789012345" className="h-12 lg:h-10" /></div>
                        <div className="space-y-2"><Label htmlFor="businessAccountId">Business Account ID</Label><Input id="businessAccountId" value={whatsappConfig.businessAccountId} onChange={(event) => setWhatsappConfig((prev) => ({ ...prev, businessAccountId: event.target.value }))} placeholder="Ex: 123456789012345" className="h-12 lg:h-10" /></div>
                        <div className="space-y-2"><Label htmlFor="accessToken">Access Token Permanente</Label><Input id="accessToken" type="password" value={whatsappConfig.accessToken} onChange={(event) => setWhatsappConfig((prev) => ({ ...prev, accessToken: event.target.value }))} placeholder="Cole seu token de acesso aqui" className="h-12 lg:h-10" /></div>
                        <Button variant="outline" onClick={handleConnect} disabled={isConnecting || !whatsappConfig.phoneNumberId || !whatsappConfig.accessToken} className="h-12 lg:h-10">{isConnecting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Conectando...</> : 'Conectar Manualmente'}</Button>
                      </div>
                    </div>
                  </details>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <h3 className="font-medium">Detalhes da Conexao</h3>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"><div><p className="text-sm text-muted-foreground">Phone Number ID</p><p className="font-mono text-sm">{whatsappConfig.phoneNumberId || '123456789012345'}</p></div><Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button></div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"><div><p className="text-sm text-muted-foreground">Business Account ID</p><p className="font-mono text-sm">{whatsappConfig.businessAccountId || '987654321098765'}</p></div><Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button></div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"><div><p className="text-sm text-muted-foreground">Webhook URL</p><p className="font-mono text-sm truncate max-w-50 lg:max-w-none">https://sualoja.com.br/api/webhooks/whatsapp</p></div><Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button></div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"><div><p className="text-sm text-muted-foreground">Webhook Verify Token</p><p className="font-mono text-sm">{whatsappConfig.webhookVerifyToken || 'b2b_webhook_abc123'}</p></div><Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button></div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div><h3 className="font-medium">Templates de Mensagem</h3><p className="text-sm text-muted-foreground">Templates aprovados pela Meta</p></div>
                      <Button variant="outline" size="sm" asChild><a href="https://business.facebook.com/wa/manage/message-templates" target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-3 w-3" />Gerenciar no Meta</a></Button>
                    </div>
                    <div className="space-y-2">
                      {[
                        { name: 'boas_vindas', status: 'APPROVED', language: 'pt_BR' },
                        { name: 'pedido_confirmado', status: 'APPROVED', language: 'pt_BR' },
                        { name: 'pedido_enviado', status: 'PENDING', language: 'pt_BR' },
                      ].map((template) => (
                        <div key={template.name} className="flex items-center justify-between p-3 border rounded-lg"><div className="flex items-center gap-3"><MessageSquare className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium text-sm">{template.name}</p><p className="text-xs text-muted-foreground">{template.language}</p></div></div><Badge variant={template.status === 'APPROVED' ? 'default' : 'secondary'}>{template.status === 'APPROVED' ? 'Aprovado' : 'Pendente'}</Badge></div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-medium">Enviar Mensagem de Teste</h3>
                    <div className="flex gap-3"><Input placeholder="5511999999999" className="h-12 lg:h-10 flex-1" /><Button className="h-12 lg:h-10"><Send className="mr-2 h-4 w-4" />Enviar</Button></div>
                    <p className="text-xs text-muted-foreground">Inclua o codigo do pais (55 para Brasil) sem espacos ou caracteres especiais</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Links Uteis</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="h-9" asChild><a href="https://business.facebook.com/settings/whatsapp-business-accounts" target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-3 w-3" />Meta Business</a></Button>
                      <Button variant="outline" size="sm" className="h-9" asChild><a href="https://business.facebook.com/wa/manage/phone-numbers" target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-3 w-3" />Numeros de Telefone</a></Button>
                      <Button variant="outline" size="sm" className="h-9" asChild><a href="https://business.facebook.com/wa/manage/insights" target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-3 w-3" />Metricas</a></Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminPage>
  )
}
