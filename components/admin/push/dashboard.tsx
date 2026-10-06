'use client'

import Link from 'next/link'
import { Plus, Smartphone, Send, CalendarClock, Zap } from 'lucide-react'
import { AdminPanel, AdminStatCard, AdminStatGrid } from '@/components/admin/admin-mobile-ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { automationLabels } from '@/lib/push/types'
import { Empty, PushPage, Status, formatDate, usePushView } from './shared'

export function PushDashboard() {
  const data = usePushView(), view = data.view
  const members = new Set(view?.members.filter(m => m.kind !== 'ADMIN').map(m => m.id))
  return <PushPage title="Push" description="Envie notificações e automatize a comunicação pelo aplicativo." data={data} actions={view?.canSend ? <Button asChild><Link href="/push/campaigns/new"><Plus className="h-4 w-4" />Nova campanha</Link></Button> : undefined}>
    <AdminStatGrid><AdminStatCard icon={Smartphone} label="Dispositivos elegíveis" value={view?.devices.filter(d => d.active && d.permission === 'GRANTED' && members.has(d.memberId)).length || 0} hint="Com permissão para receber notificações" /><AdminStatCard icon={Send} label="Envios aceitos recentes" value={view?.logs.filter(j => j.status === 'ACCEPTED').length || 0} hint="Entre os últimos 100 registros" /><AdminStatCard icon={CalendarClock} label="Campanhas agendadas" value={view?.campaigns.filter(c => c.status === 'SCHEDULED').length || 0} /><AdminStatCard icon={Zap} label="Automações ativas" value={view?.automations.filter(a => a.enabled).length || 0} /></AdminStatGrid>
    <div className="grid items-start gap-5 xl:grid-cols-2"><AdminPanel title="Últimos disparos" action={<Button asChild variant="ghost" size="sm"><Link href="/push/campaigns">Ver campanhas</Link></Button>}><div className="space-y-3">{view?.campaigns.slice().reverse().slice(0, 5).map(c => <div key={c.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{c.name}</p><Status value={c.status} /></div><p className="mt-2 text-xs text-muted-foreground">{formatDate(c.scheduledAt || c.createdAt, view.settings.timezone)} · {c.accepted} aceitos · {c.failed} falhas</p></div>)}{!view?.campaigns.length ? <Empty>Suas campanhas aparecerão aqui.</Empty> : null}</div></AdminPanel>
    <AdminPanel title="Automações" action={<Button asChild variant="ghost" size="sm"><Link href="/push/automations">Configurar</Link></Button>}><div className="space-y-3">{view?.automations.map(a => <div key={a.kind} className="flex items-center justify-between gap-3 rounded-xl border p-4"><p className="text-sm font-medium">{automationLabels[a.kind]}</p><Badge variant={a.enabled ? 'default' : 'secondary'}>{a.enabled ? 'Ativa' : a.configured ? 'Pausada' : 'Não configurada'}</Badge></div>)}</div></AdminPanel></div>
    <AdminPanel title="Públicos que acompanham seus clientes" description="Crie listas por nome, documento, status, dispositivo, cadastro no app e compras. Novos integrantes são incluídos automaticamente."><Button asChild variant="outline"><Link href="/push/audiences">Gerenciar públicos</Link></Button></AdminPanel>
  </PushPage>
}
