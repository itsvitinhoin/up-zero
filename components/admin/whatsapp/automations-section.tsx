'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Trash2, Zap } from 'lucide-react'

import { AdminPanel } from '@/components/admin/admin-mobile-ui'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ECOMMERCE_EVENT_DEFINITIONS } from '@/lib/whatsapp/ecommerce-events'
import type { AutomationRule, ECommerceEventType, WhatsAppState } from '@/lib/whatsapp/types'

type Props = { state: WhatsAppState; reload: () => Promise<void> }

async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'Não foi possível concluir a ação.')
  return payload
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

export function WhatsAppAutomationsSection({ state, reload }: Props) {
  const initialPhoneNumberId = state.integration.phoneNumberId ?? state.phoneNumbers[0]?.id ?? ''
  const [form, setForm] = useState({
    name: '', eventType: 'customer.created' as ECommerceEventType,
    phoneNumberId: initialPhoneNumberId,
    templateId: '', delayMinutes: '0',
    senderStrategy: 'fixed_phone' as const,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null)
  const [deletingId, setDeletingId] = useState('')
  const selectedPhone = state.phoneNumbers.find((phone) => phone.id === form.phoneNumberId)
  const availableTemplates = useMemo(() => state.templates.filter((template) => (
    (template.status === 'APPROVED' || template.status === 'PENDING')
    && (!selectedPhone?.wabaId || !template.wabaId || template.wabaId === selectedPhone.wabaId)
  )), [selectedPhone?.wabaId, state.templates])
  const selectedTemplate = state.templates.find((template) => template.id === form.templateId)
  const awaitingApproval = selectedTemplate?.status === 'PENDING'

  useEffect(() => {
    if (availableTemplates.some((template) => template.id === form.templateId)) return
    setForm((value) => ({ ...value, templateId: availableTemplates[0]?.id ?? '' }))
  }, [availableTemplates, form.templateId])

  async function create() {
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...form,
        status: awaitingApproval ? 'Draft' : 'Active',
        activateWhenTemplateApproved: awaitingApproval,
        delayMinutes: Number(form.delayMinutes),
        variableMapping: { '1': 'customer.name', '2': 'order.id', '3': 'order.total' },
      }
      await request('/api/mensageria/automations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      await reload()
      setForm((value) => ({ ...value, name: '' }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a automação.')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(rule: AutomationRule, enabled: boolean) {
    await request('/api/mensageria/automations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rule.id, status: enabled ? 'Active' : 'Paused' }) })
    await reload()
  }

  async function removeAutomation() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeletingId(target.id)
    setError('')
    try {
      await request('/api/mensageria/automations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id }),
      })
      setDeleteTarget(null)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir a automação.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="space-y-5">
      <Alert className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Uma automação por WhatsApp</AlertTitle>
        <AlertDescription>
          Escolha primeiro o número da vendedora. A lista exibirá somente os templates da WABA vinculada a esse número, evitando cruzar contas da Meta.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel title="Criar automação" description="Configure agora e aguarde a aprovação da Meta quando necessário.">
          <div className="space-y-3">
            <Field label="Nome"><Input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Ex: Boas-vindas do cadastro" /></Field>
            <Field label="Evento da UP Zero"><Select value={form.eventType} onValueChange={(eventType) => setForm((value) => ({ ...value, eventType: eventType as ECommerceEventType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ECOMMERCE_EVENT_DEFINITIONS.map((event) => <SelectItem key={event.type} value={event.type}>{event.type} · {event.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="WhatsApp que fará o envio"><Select value={form.phoneNumberId} onValueChange={(phoneNumberId) => setForm((value) => ({ ...value, phoneNumberId, templateId: '' }))}><SelectTrigger><SelectValue placeholder="Selecione a vendedora" /></SelectTrigger><SelectContent>{state.phoneNumbers.map((phone) => <SelectItem key={phone.id} value={phone.id}>{phone.verifiedName ?? 'WhatsApp'} · {phone.displayPhoneNumber}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Template deste número"><Select value={form.templateId} onValueChange={(templateId) => setForm((value) => ({ ...value, templateId }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{availableTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name} · {template.status === 'APPROVED' ? 'Aprovado' : 'Pendente'}</SelectItem>)}</SelectContent></Select>{form.phoneNumberId && availableTemplates.length === 0 ? <p className="text-xs text-amber-700 dark:text-amber-400">Esse número ainda não possui templates sincronizados. Acesse Templates e sincronize a conexão.</p> : null}</Field>
            {awaitingApproval ? <Alert><AlertTitle>Aguardando aprovação da Meta</AlertTitle><AlertDescription>A regra será salva em segurança e ativada automaticamente após a próxima sincronização que retornar o template como aprovado.</AlertDescription></Alert> : null}
            <Field label="Delay (minutos)"><Input type="number" min="0" value={form.delayMinutes} onChange={(event) => setForm((value) => ({ ...value, delayMinutes: event.target.value }))} /></Field>
            {error ? <Alert variant="destructive"><AlertTitle>Não foi possível criar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
            <Button className="w-full gap-2" onClick={() => void create()} disabled={busy || !form.name || !form.phoneNumberId || !form.templateId}><Zap className="h-4 w-4" />{awaitingApproval ? 'Salvar aguardando aprovação' : 'Criar automação ativa'}</Button>
          </div>
        </AdminPanel>

        <AdminPanel title="Automações configuradas" description="Ative, pause e acompanhe resultados.">
          <div className="space-y-3">
            {state.automations.map((rule) => {
              const ruleTemplate = state.templates.find((item) => item.id === rule.templateId)
              const rulePhone = state.phoneNumbers.find((item) => item.id === (rule.phoneNumberId ?? rule.fallbackPhoneNumberId))
              const ruleAwaitingApproval = rule.status === 'Draft' && rule.activateWhenTemplateApproved && ruleTemplate?.status === 'PENDING'
              return (
              <div key={rule.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><strong>{rule.name}</strong><Badge variant="outline">{rule.eventType}</Badge>{ruleAwaitingApproval ? <Badge variant="secondary">Aguardando Meta</Badge> : null}</div>
                    <p className="mt-1 text-sm text-muted-foreground">Template: {state.templates.find((item) => item.id === rule.templateId)?.name ?? 'Não selecionado'} · Delay: {rule.delayMinutes} min</p>
                    <p className="mt-1 text-xs text-muted-foreground">Enviado por: {rulePhone?.verifiedName ?? 'Conexão legada'} · {rulePhone?.displayPhoneNumber ?? 'número não encontrado'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={rule.status === 'Active'} disabled={ruleAwaitingApproval} onCheckedChange={(checked) => void toggle(rule, checked)} />
                    <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Excluir automação ${rule.name}`} onClick={() => setDeleteTarget(rule)} disabled={deletingId === rule.id}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg bg-muted/40 p-2"><strong className="block">{rule.totalRuns}</strong>execuções</div><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/20"><strong className="block">{rule.successfulRuns}</strong>sucessos</div><div className="rounded-lg bg-rose-50 p-2 text-rose-700 dark:bg-rose-950/20"><strong className="block">{rule.failedRuns}</strong>erros</div></div>
              </div>
              )
            })}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel title="Logs de envio" description="Envios concluídos, bloqueios e erros recentes.">
        <div className="space-y-2">{state.automationLogs.slice(0, 10).map((log) => <div key={log.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center"><Badge variant={log.status === 'failed' || log.status === 'blocked' ? 'destructive' : log.status === 'sent' || log.status === 'delivered' ? 'default' : 'secondary'}>{log.status}</Badge><span className="font-medium">{log.eventType}</span><span className="flex-1 text-muted-foreground">{log.description}</span><span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString('pt-BR')}</span></div>)}</div>
      </AdminPanel>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta automação?</AlertDialogTitle>
            <AlertDialogDescription>
              A automação <strong className="text-foreground">{deleteTarget?.name}</strong> deixará de responder ao evento <strong className="text-foreground">{deleteTarget?.eventType}</strong>. Jobs ainda pendentes também serão cancelados. Os logs anteriores serão preservados para auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void removeAutomation() }} disabled={Boolean(deletingId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingId ? 'Excluindo...' : 'Excluir automação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
