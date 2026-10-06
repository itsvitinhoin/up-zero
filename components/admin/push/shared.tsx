'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Bell, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { AdminHero, AdminPage } from '@/components/admin/admin-mobile-ui'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { PushView } from '@/lib/push/types'

export function usePushView(settings = false) {
  const [view, setView] = useState<PushView | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const controllers = useRef(new Set<AbortController>()), revision = useRef(0)
  const reload = useCallback(async () => {
    const controller = new AbortController(), generation = ++revision.current
    controllers.current.add(controller)
    try {
      const response = await fetch(`/api/push/${settings ? 'settings' : 'state'}`, { cache: 'no-store', signal: controller.signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar Push.')
      if (generation === revision.current) { setView(payload); setError('') }
      return payload as PushView
    } catch (cause) { if (!controller.signal.aborted && generation === revision.current) setError(cause instanceof Error ? cause.message : 'Erro ao carregar Push.'); return null }
    finally { controllers.current.delete(controller) }
  }, [settings])
  useEffect(() => {
    const initial = setTimeout(() => void reload(), 0)
    const timer = setInterval(() => { if (!document.hidden) void reload() }, 30000)
    const activeControllers = controllers.current
    const generationRef = revision
    return () => { clearTimeout(initial); clearInterval(timer); generationRef.current++; for (const controller of activeControllers) controller.abort() }
  }, [reload])
  async function run<T = unknown>(action: string, value: unknown, success = 'Alterações salvas.') {
    setBusy(true)
    try {
      const response = await fetch(`/api/push/${action.replace('.', '/')}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar.')
      await reload(); toast.success(success)
      return payload.data as T
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); return null }
    finally { setBusy(false) }
  }
  return { view, error, busy, reload, run }
}
export function PushPage({ title, description, actions, children, data, configuration = false }: { title: string; description: string; actions?: ReactNode; children: ReactNode; data: ReturnType<typeof usePushView>; configuration?: boolean }) {
  return <AdminPage><AdminHero icon={Bell} title={title} description={description} actions={actions} />
    {data.error ? <Alert variant="destructive"><AlertTitle>Não foi possível atualizar os dados</AlertTitle><AlertDescription>{data.error}</AlertDescription><Button variant="outline" className="mt-3" onClick={() => void data.reload()}><RefreshCw className="h-4 w-4" />Tentar novamente</Button></Alert> : null}
    {!data.view && !data.error ? <AdminRouteSkeleton /> : null}
    {data.view && !configuration && (!data.view.settings.enabled || !data.view.readiness.provider || !data.view.readiness.events) ? <Alert><Bell className="h-4 w-4" /><AlertTitle>Canal Push aguardando configuração</AlertTitle><AlertDescription><span>Você pode preparar públicos, campanhas e automações. Para disparar, configure e ative o canal em <Link href="/settings/push" className="font-medium underline">Configurações → Push</Link>.</span></AlertDescription></Alert> : null}
    {data.view ? children : null}
  </AdminPage>
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}</div>
}
export const statusLabels: Record<string, string> = { DRAFT: 'Rascunho', SCHEDULED: 'Agendada', QUEUED: 'Na fila', SENDING: 'Enviando', COMPLETED: 'Concluída', PARTIAL: 'Parcial', FAILED: 'Falha', CANCELED: 'Cancelada', ACCEPTED: 'Aceito pelo serviço', SKIPPED: 'Ignorado', PENDING: 'Pendente', APPROVED: 'Aprovado', REJECTED: 'Rejeitado' }
export function Status({ value }: { value: string }) {
  const color = ['COMPLETED', 'ACCEPTED', 'APPROVED', 'ACTIVE'].includes(value) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : ['FAILED', 'REJECTED'].includes(value) ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : ['SENDING', 'SCHEDULED', 'QUEUED', 'PENDING'].includes(value) ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'bg-muted text-muted-foreground'
  return <Badge className={color}>{statusLabels[value] || value}</Badge>
}
export function formatDate(value?: string | null, timezone = 'America/Sao_Paulo') { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: timezone }).format(new Date(value)) : '—' }
export function Empty({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div> }
