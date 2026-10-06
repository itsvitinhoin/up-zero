'use client'

import { useMemo, useState } from 'react'
import { Plus, RefreshCw, Users, Smartphone, Pencil } from 'lucide-react'
import { AdminPanel, AdminStatCard, AdminStatGrid } from '@/components/admin/admin-mobile-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { audienceMembers } from '@/lib/push/audience'
import { emptyFilters, filtersSchema, type AudienceFilters } from '@/lib/push/types'
import { AudienceFilterForm } from './audience-filters'
import { Empty, Field, PushPage, Status, usePushView } from './shared'

export function PushAudiences() {
  const data = usePushView(), [search, setSearch] = useState(''), [filters, setFilters] = useState<AudienceFilters>(emptyFilters)
  const [editor, setEditor] = useState<{ id?: string; name: string; filters: AudienceFilters } | null>(null)
  const members = useMemo(() => data.view ? audienceMembers(editor?.filters || filters, data.view) : [], [data.view, editor, filters])
  const eligibleCount = data.view?.devices.filter(d => members.some(m => m.id === d.memberId) && d.active && d.permission === 'GRANTED' && ((editor?.filters || filters).platform === 'ALL' || d.platform === (editor?.filters || filters).platform)).length || 0
  async function save() {
    if (!editor || !filtersSchema.safeParse(editor.filters).success) return
    if (await data.run('audience.save', editor, 'Público dinâmico salvo.')) setEditor(null)
  }
  return <PushPage title="Públicos de Push" description="Salve os critérios uma vez. Os integrantes da lista acompanham automaticamente os dados do aplicativo." data={data} actions={<Button disabled={!data.view?.canEdit} onClick={() => setEditor({ name: '', filters })}><Plus className="h-4 w-4" />Novo público</Button>}>
    <AdminStatGrid><AdminStatCard icon={Users} label="Pessoas no aplicativo" value={data.view?.members.filter(m => m.downloadedAt && m.kind !== 'ADMIN').length || 0} /><AdminStatCard icon={Users} label="Públicos dinâmicos" value={data.view?.audiences.length || 0} /><AdminStatCard icon={Smartphone} label="Dispositivos elegíveis" value={data.view?.devices.filter(d => d.active && d.permission === 'GRANTED' && data.view?.members.find(m => m.id === d.memberId)?.kind !== 'ADMIN').length || 0} /><AdminStatCard icon={RefreshCw} label="Atualização" value="Automática" hint="Recalculado ao consultar e antes de disparar" /></AdminStatGrid>
    <AdminPanel title="Seus públicos" description="Listas reutilizáveis para campanhas e segmentos do aplicativo." action={<Input aria-label="Buscar públicos" placeholder="Buscar público pelo nome" value={search} onChange={e => setSearch(e.target.value)} className="sm:max-w-xs" />}>
      <div className="space-y-3">{data.view?.audiences.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).map(a => <div key={a.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{a.name} <Badge variant="secondary">Dinâmico</Badge></p><p className="mt-1 text-sm text-muted-foreground">{a.memberCount} pessoas · {a.deviceCount} dispositivos elegíveis</p></div><Button variant="outline" disabled={!data.view?.canEdit} onClick={() => setEditor({ id: a.id, name: a.name, filters: a.filters })}><Pencil className="h-4 w-4" />Editar critérios</Button></div>)}{!data.view?.audiences.length ? <Empty>Crie seu primeiro público usando os filtros abaixo.</Empty> : null}</div>
    </AdminPanel>
    <AdminPanel title="Explorar a base do aplicativo" description="Combine nome, documento, status, dispositivo e comportamento de compra. Salve a combinação como um público.">
      <AudienceFilterForm value={filters} onChange={setFilters} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{members.length} pessoas · {eligibleCount} dispositivos elegíveis</p><Button disabled={!data.view?.canEdit} onClick={() => setEditor({ name: '', filters })}><Plus className="h-4 w-4" />Salvar filtros como público</Button></div>
      <div className="mt-5 space-y-2">{members.slice(0, 30).map(m => <div key={m.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.document || 'Documento não informado'}</p></div><Status value={m.status} /></div>)}{!members.length ? <Empty>Nenhuma pessoa corresponde aos filtros. A base é preenchida pelos cadastros do aplicativo.</Empty> : members.length > 30 ? <p className="text-xs text-muted-foreground">Exibindo uma amostra de 30 pessoas.</p> : null}</div>
    </AdminPanel>
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !data.busy) setEditor(null) }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{editor?.id ? 'Editar público' : 'Novo público dinâmico'}</DialogTitle><DialogDescription>Novos cadastros e novas compras entram ou saem da lista conforme estes critérios.</DialogDescription></DialogHeader>{editor ? <div className="space-y-5"><Field label="Nome do público"><Input aria-label="Nome do público" placeholder="Ex.: Android com 2 compras nos últimos 30 dias" value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></Field><AudienceFilterForm value={editor.filters} onChange={value => setEditor({ ...editor, filters: value })} /><p className="text-sm">Prévia atual: {members.length} pessoas · {eligibleCount} dispositivos elegíveis.</p>{!filtersSchema.safeParse(editor.filters).success ? <p className="text-sm text-destructive">Revise o intervalo de datas e a quantidade mínima/máxima.</p> : null}<div className="flex justify-end gap-2"><Button variant="outline" disabled={data.busy} onClick={() => setEditor(null)}>Cancelar</Button><Button disabled={data.busy || !editor.name.trim() || !filtersSchema.safeParse(editor.filters).success} onClick={() => void save()}>Salvar público</Button></div></div> : null}</DialogContent></Dialog>
  </PushPage>
}
