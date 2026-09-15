'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Search, Store as StoreIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import { ApiKeyCell } from './api-key-cell'
import { useWorkspace } from './master-shell'
import type { Store } from '../lib/contracts'

export const statusNames = { active: 'Ativa', trial: 'Em teste', suspended: 'Suspensa' }
export function StoreStatus({ status }: { status: Store['status'] }) { return <Badge variant={status === 'active' ? 'emerald' : status === 'trial' ? 'blue' : 'rose'}><span className="size-1.5 rounded-full bg-current" />{statusNames[status]}</Badge> }
export const selectClass = 'h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
export function StoreList() {
  const { data } = useWorkspace(), [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [plan, setPlan] = useState('all'), [page, setPage] = useState(1)
  const query = search.trim().toLocaleLowerCase('pt-BR')
  const filtered = data.stores.filter(store => `${store.name} ${store.id} ${store.domain} ${store.email} ${store.owner}`.toLocaleLowerCase('pt-BR').includes(query) && (status === 'all' || store.status === status) && (plan === 'all' || store.plan === plan))
  const pages = Math.max(1, Math.ceil(filtered.length / 8)), current = Math.min(page, pages), rows = filtered.slice((current - 1) * 8, current * 8)
  function reset() { setSearch(''); setStatus('all'); setPlan('all'); setPage(1) }
  return <div className="space-y-4"><div className="rounded-xl border bg-card shadow-xs"><div className="flex flex-wrap items-center gap-3 border-b p-4"><div className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Buscar lojas" className="pl-9" placeholder="Buscar por loja, domínio, responsável ou ID…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></div><select aria-label="Filtrar situação" className={selectClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="all">Todas as situações</option><option value="active">Ativas</option><option value="trial">Em teste</option><option value="suspended">Suspensas</option></select><select aria-label="Filtrar plano" className={selectClass} value={plan} onChange={event => { setPlan(event.target.value); setPage(1) }}><option value="all">Todos os planos</option><option value="starter">Starter</option><option value="pro">Pro</option></select>{(search || status !== 'all' || plan !== 'all') && <Button variant="ghost" size="sm" onClick={reset}><X />Limpar</Button>}</div>
      <Table className="master-table"><TableHeader><TableRow className="bg-muted/30"><TableHead className="pl-5">Loja</TableHead><TableHead>Responsável</TableHead><TableHead>Plano</TableHead><TableHead>Situação</TableHead><TableHead>Chave API</TableHead><TableHead><span className="sr-only">Detalhes</span></TableHead></TableRow></TableHeader><TableBody>{rows.map(store => <TableRow key={store.id}><TableCell className="py-5 pl-5"><Link href={`/lojas/${store.id}`} className="flex items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-xs font-semibold">{store.name.split(' ').slice(0, 2).map(word => word[0]).join('')}</div><div><p className="font-semibold hover:underline">{store.name}</p><p className="mt-1 text-xs text-muted-foreground">{store.domain} <span className="mx-1">·</span> #{store.id}</p></div></Link></TableCell><TableCell><p>{store.owner}</p><p className="mt-1 text-xs text-muted-foreground">{store.email}</p></TableCell><TableCell><Badge variant={store.plan === 'pro' ? 'violet' : 'outline'}>{store.plan === 'pro' ? 'Pro' : 'Starter'}</Badge></TableCell><TableCell><StoreStatus status={store.status} /></TableCell><TableCell><ApiKeyCell store={store} /></TableCell><TableCell><Button asChild variant="ghost" size="icon-sm"><Link href={`/lojas/${store.id}`} aria-label={`Abrir ${store.name}`}><ArrowUpRight /></Link></Button></TableCell></TableRow>)}</TableBody></Table>
      {rows.length === 0 && <div className="grid justify-items-center gap-3 p-14 text-center"><StoreIcon className="size-8 text-muted-foreground" /><h2 className="font-semibold">Nenhuma loja encontrada</h2><p className="text-muted-foreground">{data.stores.length ? 'Ajuste a busca ou os filtros para ver outras lojas.' : 'As lojas aparecerão aqui quando estiverem cadastradas na plataforma.'}</p>{data.stores.length > 0 && <Button variant="outline" onClick={reset}>Limpar filtros</Button>}</div>}
    </div><AdminPaginationControls currentPage={current} totalPages={pages} onPageChange={setPage} showing={{ start: filtered.length ? (current - 1) * 8 + 1 : 0, end: Math.min(current * 8, filtered.length), total: filtered.length }} /></div>
}
