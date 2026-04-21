'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { AdminHero, AdminPage } from '@/components/admin/admin-mobile-ui'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { cn } from '@/lib/utils'
import type {
  WaAutomationRule,
  WaConnection,
  WaEventType,
  WaMessageLog,
  WaOnboardingType,
  WaSettings,
  WaTemplate,
} from '@/lib/whatsapp/types'
import { FacebookOAuthButton } from '@/components/admin/mensageria/facebook-oauth'
import type { WaOAuthCredentials } from '@/components/admin/mensageria/facebook-oauth'

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options)
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}

// ─── event type labels ────────────────────────────────────────────────────────

const EVENT_LABELS: Record<WaEventType, string> = {
  CUSTOMER_REGISTERED: 'Cadastro Recebido',
  CUSTOMER_APPROVED: 'Cadastro Aprovado',
  CUSTOMER_REJECTED: 'Cadastro Rejeitado',
  ORDER_RECEIVED: 'Pedido Recebido',
  ORDER_PAID: 'Pagamento Confirmado',
  ORDER_SHIPPED: 'Pedido Enviado',
  ORDER_DELIVERED: 'Pedido Entregue',
  ORDER_CANCELLED: 'Pedido Cancelado',
  CART_ABANDONED: 'Carrinho Abandonado',
  PAYMENT_FAILED: 'Pagamento Falhou',
}

const ALL_EVENT_TYPES = Object.keys(EVENT_LABELS) as WaEventType[]

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONNECTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    DISCONNECTED: 'bg-muted text-muted-foreground',
    ERROR: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    SENT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
    DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
    SKIPPED: 'bg-muted text-muted-foreground',
  }
  const labels: Record<string, string> = {
    CONNECTED: 'Conectado',
    DISCONNECTED: 'Desconectado',
    ERROR: 'Erro',
    PENDING: 'Pendente',
    SENT: 'Enviado',
    DELIVERED: 'Entregue',
    FAILED: 'Falhou',
    SKIPPED: 'Ignorado',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', map[status] ?? 'bg-muted text-muted-foreground')}>
      {labels[status] ?? status}
    </span>
  )
}

function OnboardingBadge({ type }: { type: WaOnboardingType }) {
  const config: Record<WaOnboardingType, { label: string; className: string }> = {
    new_number:          { label: 'Novo número',     className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
    connected:           { label: 'Conectado',        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    existing_app_number: { label: 'Migração (App)',   className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    migration_required:  { label: 'Migração pendente', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  }
  const { label, className } = config[type] ?? config.new_number
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium', className)}>
      {label}
    </span>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

interface StatsData {
  totalSent: number
  totalFailed: number
  totalSkipped: number
  activeRules: number
  activeConnections: number
  todaySent: number
  recentEvents: { id: string; type: WaEventType; triggeredAt: string; source: string }[]
}

function OverviewTab() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<StatsData>('/api/mensageria/stats')
      setStats(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!stats) return null

  const statCards = [
    { label: 'Enviados Hoje', value: stats.todaySent, icon: Send, color: 'text-emerald-500' },
    { label: 'Total Enviados', value: stats.totalSent, icon: MessageSquare, color: 'text-sky-500' },
    { label: 'Falhas', value: stats.totalFailed, icon: AlertCircle, color: 'text-rose-500' },
    { label: 'Automações Ativas', value: stats.activeRules, icon: Zap, color: 'text-amber-500' },
    { label: 'Conexões Ativas', value: stats.activeConnections, icon: Wifi, color: 'text-violet-500' },
    { label: 'Ignoradas', value: stats.totalSkipped, icon: Clock, color: 'text-muted-foreground' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="rounded-xl border border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn('h-5 w-5 shrink-0', s.color)} />
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl border border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Eventos Recentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4">Nenhum evento registrado.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {stats.recentEvents.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium">{EVENT_LABELS[evt.type] ?? evt.type}</span>
                  <div className="flex items-center gap-2">
                    {evt.source === 'MANUAL' && (
                      <Badge variant="outline" className="text-xs py-0 px-1.5">Manual</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(evt.triggeredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── shared helpers ───────────────────────────────────────────────────────────

function InlineBanner({ ok, message }: { ok: boolean; message: string }) {
  return (
    <div className={cn(
      'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-snug',
      ok
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300'
        : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300',
    )}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
      <span>{message}</span>
    </div>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-rose-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{msg}</p>
}

// ─── Connections tab ──────────────────────────────────────────────────────────

interface TestResult { ok: boolean; message: string }

function validateConn(c: Partial<WaConnection>): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!c.name?.trim()) errs.name = 'Nome é obrigatório.'
  if (c.provider === 'META_CLOUD') {
    if (!c.phoneNumberId?.trim()) errs.phoneNumberId = 'Phone Number ID ausente. Use "Reconectar com Facebook" para preencher.'
    if (!c.businessAccountId?.trim()) errs.businessAccountId = 'Business Account ID ausente. Use "Reconectar com Facebook" para preencher.'
  }
  return errs
}

function ConnectionsTab() {
  const [connections, setConnections] = useState<WaConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editConn, setEditConn] = useState<Partial<WaConnection>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  // Auto-save state — tracks the immediate save triggered by Embedded Signup onSuccess
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null)
  // Ref keeps connections list fresh inside async callbacks without stale closures
  const connectionsRef = useRef<WaConnection[]>([])

  useEffect(() => { connectionsRef.current = connections }, [connections])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin}/api/mensageria/webhook`)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<WaConnection[]>('/api/mensageria/connections')
      setConnections(data)
      connectionsRef.current = data
      console.log(
        '[ConnectionsTab] connections loaded:',
        data.length,
        data.map((c) => ({ id: c.id, phoneNumberId: c.phoneNumberId, status: c.status })),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function testConn(id: string) {
    setTesting(id)
    setTestResults((p) => { const n = { ...p }; delete n[id]; return n })
    try {
      const res = await fetch('/api/mensageria/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      setTestResults((p) => ({
        ...p,
        [id]: {
          ok: data.ok,
          message: data.ok
            ? (data.error ?? 'Conexão estabelecida com sucesso!')
            : (data.error ?? 'Falha ao conectar. Verifique as credenciais.'),
        },
      }))
      await load()
    } catch (e) {
      setTestResults((p) => ({
        ...p,
        [id]: { ok: false, message: `Erro inesperado: ${String(e)}` },
      }))
    } finally {
      setTesting(null)
    }
  }

  // ── Auto-save immediately when Embedded Signup onSuccess fires ──────────────
  async function saveFromOAuth(creds: WaOAuthCredentials) {
    console.log('[ConnectionsTab] Embedded Signup onSuccess received:', {
      phone_number_id: creds.phoneNumberId,
      waba_id: creds.businessAccountId,
      business_id: creds.businessId ?? '(not returned)',
      has_token: !!creds.accessToken,
    })

    setAutoSaveState('saving')
    setAutoSaveError(null)

    // Upsert: reuse existing connection that shares this phone_number_id
    const existing = connectionsRef.current.find((c) => c.phoneNumberId === creds.phoneNumberId)
    const connId = existing?.id ?? editConn.id
    const webhookToken =
      existing?.webhookVerifyToken ??
      editConn.webhookVerifyToken ??
      `verify-${Math.random().toString(36).slice(2, 10)}`

    const fallbackName = creds.verifiedName || `WhatsApp ${creds.phoneNumberId}`
    const payload: Partial<WaConnection> = {
      ...(connId ? { id: connId } : {}),
      provider: 'META_CLOUD' as const,
      name: editConn.name?.trim() || fallbackName,
      accessToken: creds.accessToken,
      businessAccountId: creds.businessAccountId,
      businessId: creds.businessId,
      phoneNumberId: creds.phoneNumberId,
      phoneNumber: creds.phoneNumber || creds.verifiedName,
      onboardingType: creds.onboardingType,
      platformType: creds.platformType,
      webhookVerifyToken: webhookToken,
    }

    console.log('[ConnectionsTab] persisting connection:', {
      method: connId ? 'PATCH (upsert)' : 'POST (new)',
      id: connId,
      phone_number_id: payload.phoneNumberId,
      waba_id: payload.businessAccountId,
      business_id: payload.businessId,
    })

    try {
      const method = connId ? 'PATCH' : 'POST'
      const res = await fetch('/api/mensageria/connections', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errMsg: string
        try {
          const errBody = await res.json() as { error?: string }
          errMsg = errBody.error ?? res.statusText
        } catch {
          errMsg = await res.text().catch(() => res.statusText)
        }
        console.error('[ConnectionsTab] save failed:', res.status, errMsg)
        setAutoSaveError(`Erro ao salvar a conexão (${res.status}): ${errMsg}`)
        setAutoSaveState('error')
        return
      }

      const saved = await res.json() as WaConnection
      console.log('[ConnectionsTab] connection persisted successfully:', {
        id: saved.id,
        status: saved.status,
        phone_number_id: saved.phoneNumberId,
        waba_id: saved.businessAccountId,
        business_id: saved.businessId,
        storeId: saved.storeId,
      })

      setAutoSaveState('saved')
      setFormErrors({})

      // Update editConn with confirmed server-side data (ID, status, storeId)
      setEditConn((p) => ({
        ...p,
        ...payload,
        id: saved.id,
        webhookVerifyToken: saved.webhookVerifyToken,
        status: saved.status,
        storeId: saved.storeId,
      }))

      // Refresh the connections list so the card appears immediately
      const refreshRes = await fetch('/api/mensageria/connections')
      if (refreshRes.ok) {
        const freshList = await refreshRes.json() as WaConnection[]
        console.log('[ConnectionsTab] connections after save:', freshList.length, 'record(s)', freshList.map((c) => ({ id: c.id, status: c.status })))
        setConnections(freshList)
        connectionsRef.current = freshList
      } else {
        console.warn('[ConnectionsTab] UI refresh failed after save — triggering full reload')
        void load()
      }
    } catch (e) {
      console.error('[ConnectionsTab] network error during auto-save:', e)
      setAutoSaveError(`Erro de rede ao salvar: ${String(e)}`)
      setAutoSaveState('error')
    }
  }

  function openNew() {
    setEditConn({
      provider: 'META_CLOUD',
      webhookVerifyToken: `verify-${Math.random().toString(36).slice(2, 10)}`,
    })
    setFormErrors({})
    setSaveError(null)
    setAutoSaveState('idle')
    setAutoSaveError(null)
    setEditOpen(true)
  }

  function openEdit(conn: WaConnection) {
    setEditConn(conn)
    setFormErrors({})
    setSaveError(null)
    setAutoSaveState('idle')
    setAutoSaveError(null)
    setEditOpen(true)
  }

  async function save() {
    const errs = validateConn(editConn)
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
    setSaving(true)
    setSaveError(null)
    try {
      const method = editConn.id ? 'PATCH' : 'POST'
      const res = await fetch('/api/mensageria/connections', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editConn),
      })
      if (!res.ok) {
        const text = await res.text()
        setSaveError(`Erro ao salvar: ${text}`)
        return
      }
      setEditOpen(false)
      await load()
    } catch (e) {
      setSaveError(`Erro de rede: ${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteConn(id: string) {
    await apiFetch('/api/mensageria/connections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeleteId(null)
    await load()
  }

  const f = (field: keyof WaConnection) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditConn((p) => ({ ...p, [field]: e.target.value }))
    setFormErrors((p) => { const n = { ...p }; delete n[field]; return n })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie as conexões WhatsApp Business.</p>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova Conexão
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <Card key={conn.id} className="rounded-xl border border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      conn.status === 'CONNECTED' ? 'bg-emerald-100 dark:bg-emerald-900/30' : conn.status === 'ERROR' ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-muted',
                    )}>
                      {conn.status === 'CONNECTED'
                        ? <Wifi className="h-5 w-5 text-emerald-600" />
                        : <WifiOff className={cn('h-5 w-5', conn.status === 'ERROR' ? 'text-rose-500' : 'text-muted-foreground')} />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{conn.name}</div>
                      <div className="text-xs text-muted-foreground">{conn.phoneNumber || conn.phoneNumberId || conn.provider}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={conn.status} />
                    {conn.onboardingType && conn.onboardingType !== 'connected' && (
                      <OnboardingBadge type={conn.onboardingType} />
                    )}
                  </div>
                </div>

                {/* IDs from Embedded Signup */}
                {(conn.phoneNumberId || conn.businessAccountId || conn.businessId) && (
                  <div className="mt-2 space-y-0.5 text-[10px] font-mono text-muted-foreground">
                    {conn.phoneNumberId && (
                      <div>phone_number_id: <span className="text-foreground select-all">{conn.phoneNumberId}</span></div>
                    )}
                    {conn.businessAccountId && (
                      <div>waba_id: <span className="text-foreground select-all">{conn.businessAccountId}</span></div>
                    )}
                    {conn.businessId && (
                      <div>business_id: <span className="text-foreground select-all">{conn.businessId}</span></div>
                    )}
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Enviados hoje: <span className="text-foreground font-medium">{conn.messagesSentToday}</span></span>
                  <span>Total: <span className="text-foreground font-medium">{conn.messagesTotal}</span></span>
                  {conn.lastMessageAt && (
                    <span>Última msg: <span className="text-foreground font-medium">{new Date(conn.lastMessageAt).toLocaleDateString('pt-BR')}</span></span>
                  )}
                </div>

                {testResults[conn.id] && (
                  <div className="mt-3">
                    <InlineBanner ok={testResults[conn.id].ok} message={testResults[conn.id].message} />
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" disabled={testing === conn.id} onClick={() => testConn(conn.id)}>
                    {testing === conn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                    <span className="ml-1.5">Testar</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEdit(conn)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 ml-auto" onClick={() => setDeleteId(conn.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {connections.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conexão configurada. Clique em "Nova Conexão" para começar.</p>
          )}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setAutoSaveState('idle')
            setAutoSaveError(null)
            setSaveError(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editConn.id ? 'Editar Conexão' : 'Nova Conexão WhatsApp'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* Embedded Signup OAuth button — onSuccess triggers immediate auto-save */}
            <FacebookOAuthButton
              isReconnect={!!editConn.id}
              onSuccess={(creds: WaOAuthCredentials) => { void saveFromOAuth(creds) }}
            />

            {/* Auto-save status banners */}
            {autoSaveState === 'saving' && (
              <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-800/50 dark:bg-sky-900/20 px-3 py-2.5 text-xs text-sky-800 dark:text-sky-300">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>Salvando conexão automaticamente...</span>
              </div>
            )}
            {autoSaveState === 'saved' && (
              <div className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs',
                editConn.onboardingType === 'migration_required'
                  ? 'border-orange-200 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300'
                  : editConn.onboardingType === 'existing_app_number'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300',
              )}>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {editConn.onboardingType === 'migration_required'
                    ? 'Conexão salva com status pendente. Complete a migração no WhatsApp Manager e depois atualize a conexão.'
                    : editConn.onboardingType === 'existing_app_number'
                    ? 'Conexão salva. O número será migrado do WhatsApp Business App para a Cloud API.'
                    : editConn.onboardingType === 'new_number'
                    ? 'Número novo registrado com sucesso na Cloud API.'
                    : 'Conexão reconectada com sucesso.'}
                  {' '}Copie a URL do Webhook abaixo e configure no Meta.
                </span>
              </div>
            )}
            {autoSaveState === 'error' && autoSaveError && (
              <InlineBanner ok={false} message={autoSaveError} />
            )}

            {/* Onboarding IDs — shown once available */}
            {editConn.phoneNumberId && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-0.5 text-[10px] font-mono text-muted-foreground">
                <div className="text-xs font-semibold text-foreground mb-1 font-sans">IDs do Embedded Signup</div>
                <div>phone_number_id: <span className="text-foreground select-all">{editConn.phoneNumberId}</span></div>
                <div>waba_id: <span className="text-foreground select-all">{editConn.businessAccountId || '—'}</span></div>
                <div>business_id: <span className="text-foreground select-all">{editConn.businessId ?? '—'}</span></div>
                {editConn.phoneNumber && (
                  <div>nome verificado: <span className="text-foreground">{editConn.phoneNumber}</span></div>
                )}
              </div>
            )}

            {/* Require OAuth before saving */}
            {(formErrors.phoneNumberId || formErrors.businessAccountId) && (
              <InlineBanner ok={false} message='Clique em "Conectar com Facebook" para autenticar antes de salvar.' />
            )}

            {/* Connection name — editable at any time */}
            <div className="space-y-1">
              <Label>Nome da conexão <span className="text-rose-500">*</span></Label>
              <Input
                value={editConn.name ?? ''}
                onChange={f('name')}
                placeholder="Ex: WhatsApp Principal"
                className={formErrors.name ? 'border-rose-400' : ''}
              />
              <FieldError msg={formErrors.name} />
            </div>

            {/* Webhook info — read-only; user copies these into Meta Developer Portal */}
            {webhookUrl && (
              <div className="space-y-1.5">
                <Label>URL do Webhook</Label>
                <div className="flex gap-1.5">
                  <Input value={webhookUrl} readOnly className="text-xs font-mono bg-muted" />
                  <Button type="button" variant="outline" size="sm" className="shrink-0 px-2" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="flex gap-1.5 items-center">
                    <Input value={editConn.webhookVerifyToken ?? ''} readOnly className="text-xs font-mono bg-muted flex-1" />
                    <Button type="button" variant="outline" size="sm" className="shrink-0 px-2" onClick={() => navigator.clipboard.writeText(editConn.webhookVerifyToken ?? '')}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Cole a URL em <strong>Callback URL</strong> e o token em <strong>Verify Token</strong> no Meta for Developers → WhatsApp → Webhook.</p>
                </div>
              </div>
            )}

            {saveError && <InlineBanner ok={false} message={saveError} />}
          </div>
          <DialogFooter>
            {autoSaveState === 'saved' ? (
              <>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Fechar</Button>
                {/* Allow name update after auto-save */}
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Atualizar nome
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={saving || autoSaveState === 'saving' || !editConn.phoneNumberId}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Salvar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conexão?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => deleteId && deleteConn(deleteId)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Automations tab ──────────────────────────────────────────────────────────

function validateRule(r: Partial<WaAutomationRule>, templates: WaTemplate[], connections: WaConnection[]): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!r.name?.trim()) errs.name = 'Nome é obrigatório.'
  if (!r.templateId) {
    errs.templateId = templates.length === 0
      ? 'Crie um modelo na aba Modelos antes de criar uma automação.'
      : 'Selecione um modelo de mensagem.'
  } else if (!templates.find((t) => t.id === r.templateId)) {
    errs.templateId = 'Modelo selecionado não existe mais. Selecione outro.'
  }
  if (!r.connectionId) {
    errs.connectionId = connections.length === 0
      ? 'Crie uma conexão na aba Conexões antes de criar uma automação.'
      : 'Selecione uma conexão.'
  } else {
    const conn = connections.find((c) => c.id === r.connectionId)
    if (!conn) errs.connectionId = 'Conexão selecionada não existe mais. Selecione outra.'
    else if (conn.status !== 'CONNECTED') errs.connectionId = `Conexão "${conn.name}" está ${conn.status === 'DISCONNECTED' ? 'desconectada' : 'com erro'}. Clique em "Testar" na aba Conexões.`
  }
  if ((r.allowedHoursStart ?? 0) > (r.allowedHoursEnd ?? 23)) {
    errs.allowedHours = 'Hora de início não pode ser maior que hora de fim.'
  }
  return errs
}

function AutomationsTab() {
  const [rules, setRules] = useState<WaAutomationRule[]>([])
  const [templates, setTemplates] = useState<WaTemplate[]>([])
  const [connections, setConnections] = useState<WaConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editRule, setEditRule] = useState<Partial<WaAutomationRule>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [migrating, setMigrating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, t, c] = await Promise.all([
        apiFetch<WaAutomationRule[]>('/api/mensageria/automations'),
        apiFetch<WaTemplate[]>('/api/mensageria/templates'),
        apiFetch<WaConnection[]>('/api/mensageria/connections'),
      ])
      setRules(r)
      setTemplates(t)
      setConnections(c)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Auto-migrate rules that reference deleted/missing connections when only one connection is available
  const brokenRuleIds = rules
    .filter((r) => !connections.find((c) => c.id === r.connectionId))
    .map((r) => r.id)
  const hasOnlyOneConn = connections.length === 1
  const needsMigration = brokenRuleIds.length > 0 && connections.length > 0

  async function migrateRules(targetConnId: string) {
    setMigrating(true)
    try {
      await Promise.all(
        brokenRuleIds.map((id) =>
          apiFetch('/api/mensageria/automations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, connectionId: targetConnId }),
          }),
        ),
      )
      await load()
    } finally {
      setMigrating(false)
    }
  }

  async function toggleRule(rule: WaAutomationRule) {
    await apiFetch('/api/mensageria/automations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
    })
    await load()
  }

  async function save() {
    const errs = validateRule(editRule, templates, connections)
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
    setSaving(true)
    setSaveError(null)
    try {
      const method = editRule.id ? 'PATCH' : 'POST'
      const res = await fetch('/api/mensageria/automations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRule),
      })
      if (!res.ok) {
        setSaveError(`Erro ao salvar: ${await res.text()}`)
        return
      }
      setEditOpen(false)
      await load()
    } catch (e) {
      setSaveError(`Erro de rede: ${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRule(id: string) {
    await apiFetch('/api/mensageria/automations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeleteId(null)
    await load()
  }

  const defaultRule: Partial<WaAutomationRule> = {
    trigger: 'CUSTOMER_APPROVED',
    conditions: [],
    isActive: true,
    cooldownMinutes: 0,
    dailyLimit: 200,
    allowedHoursStart: 8,
    allowedHoursEnd: 20,
    templateId: templates[0]?.id ?? '',
    connectionId: connections[0]?.id ?? '',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure regras de envio automático.</p>
        <Button size="sm" onClick={() => { setEditRule(defaultRule); setFormErrors({}); setSaveError(null); setEditOpen(true) }}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova Automação
        </Button>
      </div>

      {/* Migration banner: rules reference a deleted connection */}
      {!loading && needsMigration && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/20 px-3 py-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p>
              <span className="font-semibold">{brokenRuleIds.length} automação{brokenRuleIds.length > 1 ? 'ões' : ''}</span>
              {' '}referencia{brokenRuleIds.length === 1 ? '' : 'm'} uma conexão que foi removida.
              {hasOnlyOneConn
                ? ` Clique em "Atualizar" para vinculá-las à conexão ativa.`
                : ` Selecione a conexão para atualizar.`}
            </p>
            {hasOnlyOneConn ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
                disabled={migrating}
                onClick={() => migrateRules(connections[0].id)}
              >
                {migrating ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                Atualizar para &quot;{connections[0].name}&quot;
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Select onValueChange={(v) => migrateRules(v)} disabled={migrating}>
                  <SelectTrigger className="h-7 text-xs w-48">
                    <SelectValue placeholder="Selecionar conexão" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {migrating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const tpl = templates.find((t) => t.id === rule.templateId)
            const conn = connections.find((c) => c.id === rule.connectionId)
            const warnings: string[] = []
            if (!tpl) warnings.push('Modelo não encontrado — edite a regra e selecione um modelo válido.')
            else if (!tpl.isActive) warnings.push(`Modelo "${tpl.name}" está inativo — ative-o na aba Modelos.`)
            if (!conn) warnings.push('Conexão não encontrada — edite a regra e selecione uma conexão válida.')
            else if (conn.status !== 'CONNECTED') warnings.push(`Conexão "${conn.name}" está ${conn.status === 'DISCONNECTED' ? 'desconectada' : 'com erro'} — clique em "Testar" na aba Conexões.`)

            return (
              <Card key={rule.id} className={cn('rounded-xl border', warnings.length > 0 ? 'border-amber-300 dark:border-amber-700' : rule.isActive ? 'border-border/50' : 'border-border/30 opacity-60')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{rule.name}</span>
                        <Badge variant="outline" className="text-xs py-0">{EVENT_LABELS[rule.trigger]}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        <div>Modelo: <span className={cn('text-foreground', !tpl && 'text-rose-500')}>{tpl?.name ?? `❌ ${rule.templateId}`}</span></div>
                        <div>Conexão: <span className={cn('text-foreground', (!conn || conn.status !== 'CONNECTED') && 'text-amber-600 dark:text-amber-400')}>{conn ? `${conn.name} ${conn.status === 'CONNECTED' ? '✓' : '✗'}` : `❌ ${rule.connectionId}`}</span></div>
                        <div className="flex gap-3">
                          {rule.cooldownMinutes > 0 && <span>Cooldown: {rule.cooldownMinutes}min</span>}
                          {rule.dailyLimit > 0 && <span>Limite/dia: {rule.dailyLimit}</span>}
                          <span>Horário: {rule.allowedHoursStart}h–{rule.allowedHoursEnd}h</span>
                        </div>
                      </div>
                      {warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Switch checked={rule.isActive} onCheckedChange={() => toggleRule(rule)} />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setEditRule(rule); setFormErrors({}); setSaveError(null); setEditOpen(true) }}>
                      <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Editar
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 ml-auto"
                      onClick={() => setDeleteId(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRule.id ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome <span className="text-rose-500">*</span></Label>
              <Input value={editRule.name ?? ''} onChange={(e) => { setEditRule((p) => ({ ...p, name: e.target.value })); setFormErrors((p) => { const n = { ...p }; delete n.name; return n }) }} className={formErrors.name ? 'border-rose-400' : ''} />
              <FieldError msg={formErrors.name} />
            </div>
            <div className="space-y-1">
              <Label>Evento Gatilho</Label>
              <Select value={editRule.trigger} onValueChange={(v) => setEditRule((p) => ({ ...p, trigger: v as WaEventType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{EVENT_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Modelo de Mensagem <span className="text-rose-500">*</span></Label>
              <Select value={editRule.templateId ?? ''} onValueChange={(v) => { setEditRule((p) => ({ ...p, templateId: v })); setFormErrors((p) => { const n = { ...p }; delete n.templateId; return n }) }}>
                <SelectTrigger className={formErrors.templateId ? 'border-rose-400' : ''}><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                <SelectContent>
                  {templates.filter((t) => t.isActive).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  {templates.filter((t) => !t.isActive).map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-muted-foreground">{t.name} (inativo)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={formErrors.templateId} />
            </div>
            <div className="space-y-1">
              <Label>Conexão <span className="text-rose-500">*</span></Label>
              <Select value={editRule.connectionId ?? ''} onValueChange={(v) => { setEditRule((p) => ({ ...p, connectionId: v })); setFormErrors((p) => { const n = { ...p }; delete n.connectionId; return n }) }}>
                <SelectTrigger className={formErrors.connectionId ? 'border-rose-400' : ''}><SelectValue placeholder="Selecione uma conexão" /></SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.status === 'CONNECTED' ? '✓' : c.status === 'ERROR' ? '✗' : '○'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={formErrors.connectionId} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cooldown (min)</Label>
                <Input type="number" min={0} value={editRule.cooldownMinutes ?? 0} onChange={(e) => setEditRule((p) => ({ ...p, cooldownMinutes: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">0 = sem cooldown</p>
              </div>
              <div className="space-y-1">
                <Label>Limite diário</Label>
                <Input type="number" min={0} value={editRule.dailyLimit ?? 200} onChange={(e) => setEditRule((p) => ({ ...p, dailyLimit: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">0 = sem limite</p>
              </div>
              <div className="space-y-1">
                <Label>Início (hora)</Label>
                <Input type="number" min={0} max={23} value={editRule.allowedHoursStart ?? 8} onChange={(e) => { setEditRule((p) => ({ ...p, allowedHoursStart: Number(e.target.value) })); setFormErrors((p) => { const n = { ...p }; delete n.allowedHours; return n }) }} className={formErrors.allowedHours ? 'border-rose-400' : ''} />
              </div>
              <div className="space-y-1">
                <Label>Fim (hora, inclusivo)</Label>
                <Input type="number" min={0} max={23} value={editRule.allowedHoursEnd ?? 20} onChange={(e) => { setEditRule((p) => ({ ...p, allowedHoursEnd: Number(e.target.value) })); setFormErrors((p) => { const n = { ...p }; delete n.allowedHours; return n }) }} className={formErrors.allowedHours ? 'border-rose-400' : ''} />
              </div>
            </div>
            {formErrors.allowedHours && <FieldError msg={formErrors.allowedHours} />}
            <div className="flex items-center gap-2">
              <Switch id="rule-active" checked={editRule.isActive ?? true} onCheckedChange={(v) => setEditRule((p) => ({ ...p, isActive: v }))} />
              <Label htmlFor="rule-active">Ativa</Label>
            </div>
            {saveError && <InlineBanner ok={false} message={saveError} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover automação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => deleteId && deleteRule(deleteId)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Templates tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<WaTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editTpl, setEditTpl] = useState<Partial<WaTemplate>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<WaTemplate[]>('/api/mensageria/templates')
      setTemplates(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function toggleTpl(tpl: WaTemplate) {
    await apiFetch('/api/mensageria/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tpl.id, isActive: !tpl.isActive }),
    })
    await load()
  }

  async function save() {
    setSaving(true)
    try {
      if (editTpl.id) {
        await apiFetch('/api/mensageria/templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editTpl),
        })
      } else {
        await apiFetch('/api/mensageria/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editTpl),
        })
      }
      setEditOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function deleteTpl(id: string) {
    await apiFetch('/api/mensageria/templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeleteId(null)
    await load()
  }

  const variables = ['{{customerName}}', '{{orderId}}', '{{orderTotal}}', '{{cartValue}}', '{{storeUrl}}', '{{trackingCode}}']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Modelos de mensagem com variáveis dinâmicas.</p>
        <Button size="sm" onClick={() => { setEditTpl({ isActive: true, body: '' }); setEditOpen(true) }}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo Modelo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <Card key={tpl.id} className={cn('rounded-xl border', tpl.isActive ? 'border-border/50' : 'border-border/30 opacity-60')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm">{tpl.name}</span>
                  <Switch checked={tpl.isActive} onCheckedChange={() => toggleTpl(tpl)} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">{tpl.body}</p>
                {tpl.variables.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tpl.variables.map((v) => (
                      <span key={v} className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{`{{${v}}}`}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setEditTpl(tpl); setEditOpen(true) }}>
                    <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 ml-auto"
                    onClick={() => setDeleteId(tpl.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTpl.id ? 'Editar Modelo' : 'Novo Modelo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editTpl.name ?? ''} onChange={(e) => setEditTpl((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Pedido Confirmado" />
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                value={editTpl.body ?? ''}
                onChange={(e) => setEditTpl((p) => ({ ...p, body: e.target.value }))}
                rows={5}
                placeholder="Olá, {{customerName}}! Seu pedido #{{orderId}} foi confirmado."
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {variables.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono hover:bg-muted/80 transition-colors"
                    onClick={() => setEditTpl((p) => ({ ...p, body: (p.body ?? '') + v }))}
                  >
                    <Copy className="h-2.5 w-2.5" />{v}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="tpl-active" checked={editTpl.isActive ?? true} onCheckedChange={(v) => setEditTpl((p) => ({ ...p, isActive: v }))} />
              <Label htmlFor="tpl-active">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover modelo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => deleteId && deleteTpl(deleteId)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Events tab (trigger tester + history) ────────────────────────────────────

interface RuleResult {
  ruleId: string
  ruleName: string
  status: 'DELIVERED' | 'FAILED' | 'SKIPPED'
  skipReason?: string
  errorMessage?: string
  phone?: string
  message?: string
}

interface FireResult {
  ok: boolean
  rulesMatched: number
  results: RuleResult[]
  error?: string
  parseError?: string
}

const PAYLOAD_TEMPLATES: Record<WaEventType, string> = {
  CUSTOMER_APPROVED:    '{\n  "customerName": "João Silva",\n  "customerPhone": "11999990001"\n}',
  CUSTOMER_REJECTED:    '{\n  "customerName": "João Silva",\n  "customerPhone": "11999990001"\n}',
  CUSTOMER_REGISTERED:  '{\n  "customerName": "João Silva",\n  "customerPhone": "11999990001"\n}',
  ORDER_RECEIVED:       '{\n  "customerName": "Maria Souza",\n  "customerPhone": "11988880002",\n  "orderId": "PED-0001",\n  "orderTotal": 250.00\n}',
  ORDER_PAID:           '{\n  "customerName": "Maria Souza",\n  "customerPhone": "11988880002",\n  "orderId": "PED-0001",\n  "orderTotal": 250.00\n}',
  ORDER_SHIPPED:        '{\n  "customerName": "Carlos Lima",\n  "customerPhone": "11977770003",\n  "orderId": "PED-0002"\n}',
  ORDER_DELIVERED:      '{\n  "customerName": "Carlos Lima",\n  "customerPhone": "11977770003",\n  "orderId": "PED-0002"\n}',
  ORDER_CANCELLED:      '{\n  "customerName": "Ana Costa",\n  "customerPhone": "11966660004",\n  "orderId": "PED-0003"\n}',
  CART_ABANDONED:       '{\n  "customerName": "Roberto Alves",\n  "customerPhone": "11955550005",\n  "cartValue": 180.00\n}',
  PAYMENT_FAILED:       '{\n  "customerName": "Fernanda Reis",\n  "customerPhone": "11944440006",\n  "orderId": "PED-0004"\n}',
}

interface DirectSendResult {
  ok: boolean
  messageId?: string
  error?: string
}

function EventsTab() {
  const [connections, setConnections] = useState<WaConnection[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  // Direct send state
  const [directConnId, setDirectConnId] = useState('')
  const [directPhone, setDirectPhone] = useState('')
  const [directMessage, setDirectMessage] = useState('Olá! Esta é uma mensagem de teste enviada via WhatsApp Business API. 🎉')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<DirectSendResult | null>(null)

  // Event fire state
  const [triggerType, setTriggerType] = useState<WaEventType>('CUSTOMER_APPROVED')
  const [triggerPayload, setTriggerPayload] = useState(PAYLOAD_TEMPLATES['CUSTOMER_APPROVED'])
  const [firing, setFiring] = useState(false)
  const [fireResult, setFireResult] = useState<FireResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, conns] = await Promise.all([
        apiFetch<StatsData>('/api/mensageria/stats'),
        apiFetch<WaConnection[]>('/api/mensageria/connections'),
      ])
      setStats(data)
      setConnections(conns)
      // Auto-select first connected connection (only if nothing selected yet)
      setDirectConnId((prev) => {
        if (prev) return prev
        const first = conns.find((c) => c.status === 'CONNECTED') ?? conns[0]
        return first?.id ?? ''
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function sendDirect() {
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/mensageria/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: directConnId, phone: directPhone, message: directMessage }),
      })
      const data = await res.json() as DirectSendResult
      setSendResult(data)
    } catch (e) {
      setSendResult({ ok: false, error: `Erro de rede: ${String(e)}` })
    } finally {
      setSending(false)
    }
  }

  function handleTypeChange(v: WaEventType) {
    setTriggerType(v)
    setTriggerPayload(PAYLOAD_TEMPLATES[v])
    setFireResult(null)
  }

  async function fire() {
    setFiring(true)
    setFireResult(null)

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(triggerPayload)
    } catch (e) {
      setFireResult({ ok: false, rulesMatched: 0, results: [], parseError: `JSON inválido: ${String(e)}` })
      setFiring(false)
      return
    }

    try {
      const res = await fetch('/api/mensageria/events/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: triggerType, payload }),
      })
      const data = await res.json() as FireResult
      setFireResult(data)
      await load()
    } catch (e) {
      setFireResult({ ok: false, rulesMatched: 0, results: [], error: `Erro de rede: ${String(e)}` })
    } finally {
      setFiring(false)
    }
  }

  const statusColors = {
    DELIVERED: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300',
    FAILED:    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300',
    SKIPPED:   'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300',
  }
  const statusIcons = {
    DELIVERED: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
    FAILED:    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
    SKIPPED:   <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
  }
  const statusLabels = { DELIVERED: 'Enviado', FAILED: 'Falhou', SKIPPED: 'Ignorado' }

  const connectedConns = connections.filter((c) => c.status === 'CONNECTED')
  const noConnections = connections.length === 0
  const noConnected = connectedConns.length === 0 && connections.length > 0

  return (
    <div className="space-y-6">

      {/* ── Direct send ─────────────────────────────────────────────────────── */}
      <Card className="rounded-xl border border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-sky-500" /> Enviar Mensagem de Teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">

          {noConnections && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Nenhuma conexão configurada. Vá para a aba <strong>Conexões</strong> e conecte uma conta WhatsApp Business.</span>
            </div>
          )}

          {noConnected && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Nenhuma conexão ativa. Clique em <strong>Testar</strong> na aba Conexões para verificar a conexão.</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Conexão WhatsApp</Label>
            <Select
              value={directConnId}
              onValueChange={(v) => { setDirectConnId(v); setSendResult(null) }}
              disabled={connections.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conexão" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.status === 'CONNECTED' ? ' ✓' : c.status === 'ERROR' ? ' ✗' : ' ○'}
                    {c.phoneNumber ? ` — ${c.phoneNumber}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Número de destino</Label>
            <Input
              value={directPhone}
              onChange={(e) => { setDirectPhone(e.target.value); setSendResult(null) }}
              placeholder="11999990001  (DDD + número, sem +55)"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Formato: DDD + número, ex: 11999990001. O +55 é adicionado automaticamente.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea
              value={directMessage}
              onChange={(e) => { setDirectMessage(e.target.value); setSendResult(null) }}
              rows={3}
              placeholder="Digite a mensagem de teste..."
            />
          </div>

          {sendResult && (
            sendResult.ok ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20 px-3 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Mensagem enviada com sucesso!
                  {sendResult.messageId && <span className="ml-1 font-mono opacity-70">ID: {sendResult.messageId}</span>}
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-900/20 px-3 py-2.5 text-xs text-rose-800 dark:text-rose-300">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{sendResult.error}</span>
              </div>
            )
          )}

          <Button
            onClick={sendDirect}
            disabled={sending || !directConnId || !directPhone.trim() || !directMessage.trim()}
            size="sm"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
            Enviar mensagem real
          </Button>
        </CardContent>
      </Card>

      {/* ── Automation event trigger ─────────────────────────────────────────── */}
      <Card className="rounded-xl border border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-500" /> Testar Automação via Evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tipo de Evento</Label>
            <Select value={triggerType} onValueChange={handleTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{EVENT_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payload (JSON)</Label>
            <Textarea
              value={triggerPayload}
              onChange={(e) => { setTriggerPayload(e.target.value); setFireResult(null) }}
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          {fireResult?.parseError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{fireResult.parseError}</span>
            </div>
          )}
          {fireResult?.error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{fireResult.error}</span>
            </div>
          )}

          {fireResult?.ok && (
            <div className="space-y-2">
              {fireResult.rulesMatched === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                  <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Nenhuma automação configurada para <strong>{EVENT_LABELS[triggerType]}</strong>. Crie uma na aba Automações.</span>
                </div>
              ) : (
                fireResult.results.map((r) => (
                  <div key={r.ruleId} className={cn('rounded-lg border px-3 py-2.5 text-xs space-y-1', statusColors[r.status])}>
                    <div className="flex items-center gap-2 font-medium">
                      {statusIcons[r.status]}
                      <span>{r.ruleName}</span>
                      <span className="ml-auto font-semibold">{statusLabels[r.status]}</span>
                    </div>
                    {r.phone && <div className="pl-5 opacity-80">Para: {r.phone}</div>}
                    {(r.skipReason || r.errorMessage) && (
                      <div className="pl-5 opacity-90">{r.skipReason ?? r.errorMessage}</div>
                    )}
                    {r.message && r.status === 'DELIVERED' && (
                      <div className="pl-5 opacity-70 italic line-clamp-2">&quot;{r.message}&quot;</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <Button onClick={fire} disabled={firing} size="sm">
            {firing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
            Disparar evento
          </Button>
        </CardContent>
      </Card>

      {/* Event history */}
      <Card className="rounded-xl border border-border/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Histórico de Eventos</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={load}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !stats || stats.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4">Nenhum evento registrado.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {stats.recentEvents.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{EVENT_LABELS[evt.type] ?? evt.type}</span>
                    {evt.source === 'MANUAL' && (
                      <Badge variant="outline" className="ml-2 text-xs py-0 px-1.5">Manual</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(evt.triggeredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Logs tab ─────────────────────────────────────────────────────────────────

function LogsTab() {
  const [logs, setLogs] = useState<WaMessageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''
      const data = await apiFetch<WaMessageLog[]>(`/api/mensageria/logs${qs}`)
      setLogs(data)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void load() }, [load])

  async function clearLogs() {
    setClearing(true)
    await apiFetch('/api/mensageria/logs', { method: 'DELETE' })
    await load()
    setClearing(false)
  }

  const skipLabels: Record<string, string> = {
    COOLDOWN: 'Cooldown',
    DAILY_LIMIT: 'Limite diário',
    OUTSIDE_HOURS: 'Fora do horário',
    NO_PHONE: 'Sem telefone',
    RULE_INACTIVE: 'Regra inativa',
    CONDITION_FAILED: 'Condição não atendida',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DELIVERED">Entregues</SelectItem>
            <SelectItem value="SENT">Enviados</SelectItem>
            <SelectItem value="FAILED">Falhas</SelectItem>
            <SelectItem value="SKIPPED">Ignorados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={load}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
        <Button
          variant="ghost" size="sm"
          className="ml-auto h-9 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
          onClick={clearLogs}
          disabled={clearing}
        >
          {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
          Limpar logs
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id} className="rounded-xl border border-border/50">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{log.recipientName}</span>
                      <span className="text-xs text-muted-foreground font-mono">{log.recipientPhone}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {log.ruleName} · {EVENT_LABELS[log.eventType] ?? log.eventType}
                    </div>
                    <p className="text-xs mt-1 leading-relaxed line-clamp-2 text-muted-foreground">{log.message}</p>
                    {log.skipReason && (
                      <p className="text-xs text-amber-600 mt-0.5">{skipLabels[log.skipReason] ?? log.skipReason}</p>
                    )}
                    {log.errorMessage && (
                      <p className="text-xs text-rose-500 mt-0.5">{log.errorMessage}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <StatusBadge status={log.status} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.sentAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [cfg, setCfg] = useState<WaSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiFetch<WaSettings>('/api/mensageria/settings').then(setCfg).finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!cfg) return
    setSaving(true)
    try {
      const updated = await apiFetch<WaSettings>('/api/mensageria/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      setCfg(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!cfg) return null

  return (
    <div className="space-y-6 max-w-lg">
      <Card className="rounded-xl border border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Configurações Globais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Limite de envios por dia (global)</Label>
            <Input
              type="number" min={0}
              value={cfg.globalDailyLimit}
              onChange={(e) => setCfg((p) => p ? { ...p, globalDailyLimit: Number(e.target.value) } : p)}
            />
            <p className="text-xs text-muted-foreground">0 = sem limite global</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Horário padrão início</Label>
              <Input
                type="number" min={0} max={23}
                value={cfg.defaultAllowedHoursStart}
                onChange={(e) => setCfg((p) => p ? { ...p, defaultAllowedHoursStart: Number(e.target.value) } : p)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Horário padrão fim</Label>
              <Input
                type="number" min={0} max={23}
                value={cfg.defaultAllowedHoursEnd}
                onChange={(e) => setCfg((p) => p ? { ...p, defaultAllowedHoursEnd: Number(e.target.value) } : p)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fuso Horário</Label>
            <Select value={cfg.timezone} onValueChange={(v) => setCfg((p) => p ? { ...p, timezone: v } : p)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Sao_Paulo">America/Sao_Paulo (GMT-3)</SelectItem>
                <SelectItem value="America/Manaus">America/Manaus (GMT-4)</SelectItem>
                <SelectItem value="America/Belem">America/Belem (GMT-3)</SelectItem>
                <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={save} disabled={saving} className={cn(saved && 'bg-emerald-600 hover:bg-emerald-700')}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : saved ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : <Settings className="h-4 w-4 mr-1.5" />}
            {saved ? 'Salvo!' : 'Salvar Configurações'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MensageriaPage() {
  return (
    <AdminPage>
      <AdminHero
        title="Mensageria"
        description="Automação de mensagens WhatsApp Business"
      />

      <Tabs defaultValue="overview" className="mt-4">
        <div className="overflow-x-auto pb-0.5 -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="h-9 w-max min-w-full md:w-auto">
            <TabsTrigger value="overview" className="text-xs px-3">Visão Geral</TabsTrigger>
            <TabsTrigger value="connections" className="text-xs px-3">Conexões</TabsTrigger>
            <TabsTrigger value="automations" className="text-xs px-3">Automações</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs px-3">Modelos</TabsTrigger>
            <TabsTrigger value="events" className="text-xs px-3">Enviar Teste</TabsTrigger>
            <TabsTrigger value="logs" className="text-xs px-3">Logs</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs px-3">Config.</TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-4">
          <TabsContent value="overview" className="mt-0"><OverviewTab /></TabsContent>
          <TabsContent value="connections" className="mt-0"><ConnectionsTab /></TabsContent>
          <TabsContent value="automations" className="mt-0"><AutomationsTab /></TabsContent>
          <TabsContent value="templates" className="mt-0"><TemplatesTab /></TabsContent>
          <TabsContent value="events" className="mt-0"><EventsTab /></TabsContent>
          <TabsContent value="logs" className="mt-0"><LogsTab /></TabsContent>
          <TabsContent value="settings" className="mt-0"><SettingsTab /></TabsContent>
        </div>
      </Tabs>
    </AdminPage>
  )
}
