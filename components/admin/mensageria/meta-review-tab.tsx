'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Inbox,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { WaIntegrationLog, WaMetaReviewSelection, WaTemplateComponent, WaWebhookEvent } from '@/lib/whatsapp/types'

type ReviewStepStatus = 'Not started' | 'Connected' | 'Ready' | 'Sent' | 'Received' | 'Error'

interface ReviewState {
  oauth: null | {
    connected: boolean
    profile: { id: string; name: string; email?: string }
    connectedAt: string
    expiresAt?: string | null
    tokenType?: string
  }
  selection: WaMetaReviewSelection
  maskedSelection: {
    businessId: string
    wabaId: string
    phoneNumberId: string
    phoneNumberDisplay: string
  }
  serverToServerAuthConfigured: boolean
  requiredScopes: string[]
  removedScopes: string[]
  webhookEvents: (WaWebhookEvent & { fromMasked?: string; phoneNumberIdMasked?: string })[]
  integrationLogs: WaIntegrationLog[]
}

interface Business {
  id: string
  idMasked: string
  name: string
}

interface Waba {
  id: string
  idMasked: string
  name: string
  currency?: string
  ownerBusinessName?: string
  ownerBusinessIdMasked?: string
}

interface PhoneNumber {
  id: string
  idMasked: string
  displayPhoneNumber: string
  displayPhoneNumberMasked: string
  verifiedName: string
  qualityRating: string
  status: string
}

interface MetaTemplate {
  id: string
  name: string
  language: string
  category: string
  status: string
  components: WaTemplateComponent[]
}

interface ApiList<T> {
  data: T[]
  error?: string
  authSource?: 'oauth_user' | 'system_user'
}

interface SendResult {
  ok: boolean
  messageId?: string
  error?: string
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : await res.text().catch(() => res.statusText)
    throw new Error(message)
  }
  return data as T
}

function StepStatusBadge({ status }: { status: ReviewStepStatus }) {
  const styles: Record<ReviewStepStatus, string> = {
    'Not started': 'bg-muted text-muted-foreground',
    Connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    Ready: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    Sent: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    Received: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    Error: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  }

  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', styles[status])}>{status}</span>
}

function componentSummary(component: WaTemplateComponent): string {
  if (component.text) return `${component.type}: ${component.text}`
  if (component.format) return `${component.type}: ${component.format}`
  if (component.buttons?.length) return `${component.type}: ${component.buttons.length} button(s)`
  return component.type
}

function templateVariableCount(template?: MetaTemplate): number {
  const bodyText = template?.components
    .filter((component) => component.type === 'BODY')
    .map((component) => component.text ?? '')
    .join('\n') ?? ''
  const matches = [...bodyText.matchAll(/{{\s*(\d+)\s*}}/g)].map((match) => Number(match[1]))
  return matches.length ? Math.max(...matches) : 0
}

export function MetaReviewTab() {
  const [state, setState] = useState<ReviewState | null>(null)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [wabas, setWabas] = useState<Waba[]>([])
  const [phones, setPhones] = useState<PhoneNumber[]>([])
  const [templates, setTemplates] = useState<MetaTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [recipient, setRecipient] = useState('')
  const [templateVariables, setTemplateVariables] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  const selection = state?.selection ?? {}
  const masked = state?.maskedSelection
  const selectedTemplate = templates.find(
    (template) => template.name === selection.templateName && template.language === selection.templateLanguage,
  )
  const selectedTemplateApproved = selectedTemplate?.status === 'APPROVED' || selection.templateStatus === 'APPROVED'
  const variableCount = templateVariableCount(selectedTemplate)

  const loadState = useCallback(async () => {
    const next = await apiFetch<ReviewState>('/api/mensageria/meta/review-state')
    setState(next)
  }, [])

  const loadBusinesses = useCallback(async () => {
    setAssetError(null)
    try {
      const result = await apiFetch<ApiList<Business>>('/api/mensageria/meta/businesses')
      setBusinesses(result.data)
    } catch (e) {
      setAssetError(String(e instanceof Error ? e.message : e))
      setBusinesses([])
    }
  }, [])

  const loadWabas = useCallback(async (businessId?: string) => {
    if (!businessId) {
      setWabas([])
      return
    }
    setAssetError(null)
    try {
      const result = await apiFetch<ApiList<Waba>>(`/api/mensageria/meta/wabas?businessId=${encodeURIComponent(businessId)}`)
      setWabas(result.data)
    } catch (e) {
      setAssetError(String(e instanceof Error ? e.message : e))
      setWabas([])
    }
  }, [])

  const loadPhones = useCallback(async (wabaId?: string) => {
    if (!wabaId) {
      setPhones([])
      return
    }
    setAssetError(null)
    try {
      const result = await apiFetch<ApiList<PhoneNumber>>(`/api/mensageria/meta/phone-numbers?wabaId=${encodeURIComponent(wabaId)}`)
      setPhones(result.data)
    } catch (e) {
      setAssetError(String(e instanceof Error ? e.message : e))
      setPhones([])
    }
  }, [])

  const loadTemplates = useCallback(async (wabaId?: string) => {
    if (!wabaId) {
      setTemplates([])
      return
    }
    setAssetError(null)
    try {
      const result = await apiFetch<ApiList<MetaTemplate>>(`/api/mensageria/meta/templates?wabaId=${encodeURIComponent(wabaId)}`)
      setTemplates(result.data)
      await loadState()
    } catch (e) {
      setAssetError(String(e instanceof Error ? e.message : e))
      setTemplates([])
    }
  }, [loadState])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      await loadState()
      await loadBusinesses()
    } finally {
      setLoading(false)
    }
  }, [loadBusinesses, loadState])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    void loadWabas(selection.businessId)
  }, [loadWabas, selection.businessId])

  useEffect(() => {
    void loadPhones(selection.wabaId)
    void loadTemplates(selection.wabaId)
  }, [loadPhones, loadTemplates, selection.wabaId])

  useEffect(() => {
    setTemplateVariables((current) => {
      const next = Array.from({ length: variableCount }, (_, index) => current[index] ?? '')
      return next
    })
  }, [variableCount])

  async function saveSelection(nextSelection: WaMetaReviewSelection) {
    const next = await apiFetch<ReviewState>('/api/mensageria/meta/review-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selection: nextSelection }),
    })
    setState(next)
  }

  async function selectBusiness(id: string) {
    const business = businesses.find((item) => item.id === id)
    await saveSelection({
      businessId: id,
      businessName: business?.name ?? '',
      wabaId: '',
      wabaName: '',
      phoneNumberId: '',
      phoneNumberDisplay: '',
      phoneVerifiedName: '',
      templateName: '',
      templateLanguage: '',
      templateStatus: '',
    })
  }

  async function selectWaba(id: string) {
    const waba = wabas.find((item) => item.id === id)
    await saveSelection({
      ...selection,
      wabaId: id,
      wabaName: waba?.name ?? '',
      phoneNumberId: '',
      phoneNumberDisplay: '',
      phoneVerifiedName: '',
      templateName: '',
      templateLanguage: '',
      templateStatus: '',
    })
  }

  async function selectPhone(id: string) {
    const phone = phones.find((item) => item.id === id)
    await saveSelection({
      ...selection,
      phoneNumberId: id,
      phoneNumberDisplay: phone?.displayPhoneNumber ?? '',
      phoneVerifiedName: phone?.verifiedName ?? '',
    })
  }

  async function selectTemplate(value: string) {
    const [name, language] = value.split('::')
    const template = templates.find((item) => item.name === name && item.language === language)
    await saveSelection({
      ...selection,
      templateName: template?.name ?? '',
      templateLanguage: template?.language ?? '',
      templateStatus: template?.status ?? '',
    })
    setSendResult(null)
  }

  async function sendTemplate() {
    setSending(true)
    setSendResult(null)
    try {
      const result = await apiFetch<SendResult>('/api/mensageria/meta/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient,
          templateName: selection.templateName,
          language: selection.templateLanguage,
          variables: templateVariables,
        }),
      })
      setSendResult(result)
      await loadState()
    } catch (e) {
      setSendResult({ ok: false, error: String(e instanceof Error ? e.message : e) })
      await loadState()
    } finally {
      setSending(false)
    }
  }

  const latestIncoming = state?.webhookEvents.find((event) => event.eventType === 'message')
  const hasMessageSent = state?.integrationLogs.some((log) => log.type === 'MESSAGE_SENT') ?? false
  const hasWebhookReply = Boolean(latestIncoming)
  const hasTemplateFetched = state?.integrationLogs.some((log) => log.type === 'TEMPLATES_FETCHED') ?? false
  const hasError = Boolean(assetError) || (sendResult?.ok === false)

  const steps = useMemo(() => [
    { label: 'Step 1: Connect with Meta', status: state?.oauth ? 'Connected' : 'Not started' },
    { label: 'Step 2: Select Business', status: selection.businessId ? 'Ready' : 'Not started' },
    { label: 'Step 3: Select WhatsApp Business Account', status: selection.wabaId ? 'Ready' : 'Not started' },
    { label: 'Step 4: Select WhatsApp Phone Number', status: selection.phoneNumberId ? 'Ready' : 'Not started' },
    { label: 'Step 5: Manage Message Templates', status: selectedTemplateApproved ? 'Ready' : hasTemplateFetched ? 'Ready' : 'Not started' },
    { label: 'Step 6: Send Test WhatsApp Message', status: hasMessageSent ? 'Sent' : 'Not started' },
    { label: 'Step 7: Receive Customer Reply', status: hasWebhookReply ? 'Received' : 'Not started' },
    { label: 'Step 8: Review Integration Logs', status: state?.integrationLogs.length ? 'Ready' : 'Not started' },
  ] satisfies { label: string; status: ReviewStepStatus }[], [
    hasMessageSent,
    hasTemplateFetched,
    hasWebhookReply,
    selectedTemplateApproved,
    selection.businessId,
    selection.phoneNumberId,
    selection.wabaId,
    state?.integrationLogs.length,
    state?.oauth,
  ])

  if (loading && !state) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Meta Review Demo</h2>
          <p className="text-sm text-muted-foreground">
            A complete review path for Meta Login, Business Manager, WABA assets, approved templates, Cloud API sending, webhook replies, and logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <a href="/api/mensageria/meta/oauth/start">
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              Continue with Meta
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/privacy" target="_blank">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Privacy Policy
            </Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Review Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.label} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold">
                    {index + 1}
                  </span>
                  <StepStatusBadge status={hasError && step.status === 'Not started' ? step.status : step.status} />
                </div>
                <div className="mt-2 text-xs font-medium leading-snug">{step.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {state?.serverToServerAuthConfigured && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-xs leading-relaxed text-sky-800 dark:border-sky-800/50 dark:bg-sky-900/20 dark:text-sky-300">
          <strong>Server-to-server authentication notice:</strong>{' '}
          This app uses server-to-server authentication with a Meta System User token. The frontend Meta Login flow may not expose the system token. The screencast demonstrates the resulting business asset selection, template management, message sending, and webhook receiving flow.
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-background p-3 text-xs">
        <div className="font-semibold">Requested permissions for this review</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {state?.requiredScopes.map((scope) => <Badge key={scope} variant="secondary">{scope}</Badge>)}
        </div>
        <div className="mt-2 text-muted-foreground">
          Not requested now: {state?.removedScopes.join(', ')}.
        </div>
      </div>

      {state?.oauth && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
          <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />
          Connected as {state.oauth.profile.name}{state.oauth.profile.email ? ` (${state.oauth.profile.email})` : ''}.
        </div>
      )}

      {assetError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300">
          <AlertCircle className="mr-1.5 inline h-3.5 w-3.5" />
          {assetError}
        </div>
      )}

      <Card className="rounded-xl border border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Business, WABA, and Phone Number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Business Manager</Label>
              <Select value={selection.businessId ?? ''} onValueChange={selectBusiness}>
                <SelectTrigger><SelectValue placeholder="Select Business" /></SelectTrigger>
                <SelectContent>
                  {businesses.map((business) => (
                    <SelectItem key={business.id} value={business.id}>
                      {business.name} ({business.idMasked})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp Business Account</Label>
              <Select value={selection.wabaId ?? ''} onValueChange={selectWaba} disabled={!selection.businessId}>
                <SelectTrigger><SelectValue placeholder="Select WABA" /></SelectTrigger>
                <SelectContent>
                  {wabas.map((waba) => (
                    <SelectItem key={waba.id} value={waba.id}>
                      {waba.name} ({waba.idMasked})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp Phone Number</Label>
              <Select value={selection.phoneNumberId ?? ''} onValueChange={selectPhone} disabled={!selection.wabaId}>
                <SelectTrigger><SelectValue placeholder="Select phone number" /></SelectTrigger>
                <SelectContent>
                  {phones.map((phone) => (
                    <SelectItem key={phone.id} value={phone.id}>
                      {phone.displayPhoneNumberMasked} ({phone.idMasked})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs md:grid-cols-3">
            <div><span className="text-muted-foreground">Business:</span> {selection.businessName || 'Not selected'} {selection.businessId && masked?.businessId ? `(${masked.businessId})` : ''}</div>
            <div><span className="text-muted-foreground">WABA:</span> {selection.wabaName || 'Not selected'} {selection.wabaId && masked?.wabaId ? `(${masked.wabaId})` : ''}</div>
            <div><span className="text-muted-foreground">Phone:</span> {selection.phoneNumberId ? masked?.phoneNumberDisplay : 'Not selected'} {selection.phoneNumberId && masked?.phoneNumberId ? `(${masked.phoneNumberId})` : ''}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Message Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="space-y-1.5 md:w-80">
              <Label>Approved template for test message</Label>
              <Select
                value={selection.templateName && selection.templateLanguage ? `${selection.templateName}::${selection.templateLanguage}` : ''}
                onValueChange={selectTemplate}
                disabled={!templates.some((template) => template.status === 'APPROVED')}
              >
                <SelectTrigger><SelectValue placeholder="Select an approved template" /></SelectTrigger>
                <SelectContent>
                  {templates.filter((template) => template.status === 'APPROVED').map((template) => (
                    <SelectItem key={`${template.name}-${template.language}`} value={`${template.name}::${template.language}`}>
                      {template.name} ({template.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTemplateApproved && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                Approved template selected for test message.
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Language</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Components</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {templates.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-5 text-center text-muted-foreground">No templates loaded from Meta yet.</td></tr>
                ) : templates.map((template) => (
                  <tr key={template.id} className={cn(selection.templateName === template.name && selection.templateLanguage === template.language && 'bg-emerald-50/60 dark:bg-emerald-900/10')}>
                    <td className="px-3 py-2 font-medium">{template.name}</td>
                    <td className="px-3 py-2">{template.language}</td>
                    <td className="px-3 py-2">{template.category}</td>
                    <td className="px-3 py-2"><Badge variant={template.status === 'APPROVED' ? 'default' : 'outline'}>{template.status}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground">{template.components.map(componentSummary).join(' | ') || 'No components'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-xl border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Send Test WhatsApp Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Recipient WhatsApp number</Label>
              <Input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Include country code, for example 5511999990001" />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
              <div><span className="text-muted-foreground">Template:</span> {selection.templateName || 'No approved template selected'}</div>
              <div><span className="text-muted-foreground">Language:</span> {selection.templateLanguage || 'Not selected'}</div>
            </div>

            {templateVariables.map((value, index) => (
              <div className="space-y-1.5" key={index}>
                <Label>{`Template variable {{${index + 1}}}`}</Label>
                <Input
                  value={value}
                  onChange={(event) => setTemplateVariables((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  placeholder={`Value for {{${index + 1}}}`}
                />
              </div>
            ))}

            {sendResult && (
              <div className={cn(
                'rounded-lg border px-3 py-2.5 text-xs',
                sendResult.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300',
              )}>
                {sendResult.ok
                  ? <>Message sent successfully. {sendResult.messageId && <span className="font-mono">Message ID: {sendResult.messageId}</span>}</>
                  : sendResult.error}
              </div>
            )}

            <Button
              onClick={sendTemplate}
              disabled={sending || !selection.phoneNumberId || !selectedTemplateApproved || !recipient.trim()}
              size="sm"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Send WhatsApp Message
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Inbox / Webhook Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestIncoming ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                <div className="font-semibold">Customer reply received.</div>
                <div className="mt-1">From: {latestIncoming.fromMasked}</div>
                <div>Timestamp: {new Date(latestIncoming.receivedAt).toLocaleString('en-US')}</div>
                <div className="mt-1 rounded bg-background/70 p-2 text-foreground">{latestIncoming.textBody || `[${latestIncoming.messageType ?? 'message'}]`}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                No customer reply received yet. After sending the template message, reply from WhatsApp and refresh this panel.
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="text-xs font-semibold">Recent webhook events</div>
              {(state?.webhookEvents ?? []).slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{event.eventType === 'message' ? 'Incoming message' : event.status ?? 'Status update'}</span>
                    <span className="text-muted-foreground">{new Date(event.receivedAt).toLocaleString('en-US')}</span>
                  </div>
                  <div className="mt-0.5 text-muted-foreground">From: {event.fromMasked ?? 'Not available'} | Phone ID: {event.phoneNumberIdMasked ?? 'Not available'}</div>
                  {event.textBody && <div className="mt-1 text-foreground">{event.textBody}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-xl border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Integration Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(state?.integrationLogs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No integration logs yet.</p>
            ) : (state?.integrationLogs ?? []).slice(0, 10).map((log) => (
              <div key={log.id} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{log.label}</span>
                  <StepStatusBadge status={log.status === 'RECEIVED' ? 'Received' : log.status === 'SENT' ? 'Sent' : log.status === 'ERROR' ? 'Error' : 'Ready'} />
                </div>
                {log.detail && <div className="mt-0.5 text-muted-foreground">{log.detail}</div>}
                <div className="mt-0.5 text-muted-foreground">{new Date(log.createdAt).toLocaleString('en-US')}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Screencast Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
              <li>Open the app and click Continue with Meta.</li>
              <li>Grant requested permissions.</li>
              <li>Select Business Manager.</li>
              <li>Select WhatsApp Business Account.</li>
              <li>Select WhatsApp Phone Number.</li>
              <li>Open Message Templates and select an approved template.</li>
              <li>Send a WhatsApp test message to a real WhatsApp number.</li>
              <li>Open WhatsApp and show the received message.</li>
              <li>Reply from WhatsApp.</li>
              <li>Return to the app and show the received reply in Inbox/Webhook Logs.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
