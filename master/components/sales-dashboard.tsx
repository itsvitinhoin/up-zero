'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowDownUp, CircleDollarSign, ShoppingCart, Receipt, Users, Search, ArrowUpRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { KpiCard } from '@/components/dashboard/shared'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import { useWorkspace } from './master-shell'
import { selectClass } from './store-list'
import { dateLabel, money } from '../lib/contracts'
import { aggregateSales, entityKey, rangeError, salesChannels, shiftDate, type SalesData, type SalesFilters } from '../lib/sales'

const integer = (value: number) => new Intl.NumberFormat('pt-BR').format(value)
const percent = (value: number | null) => value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const currency = (value: number | null) => value === null ? '—' : money(value)
const channelName = (channel: string) => channel === 'OFFLINE' ? 'Offline' : channel
const orderStatuses = { pending: 'Pendente', confirmed: 'Confirmado', partial: 'Parcialmente atendido', fulfilled: 'Atendido', cancelled: 'Cancelado' }
const dateShort = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`
type Aggregation = ReturnType<typeof aggregateSales>

export function SalesDashboard({ customersOnly = false }: { customersOnly?: boolean }) {
  const { data, session } = useWorkspace()
  if (!session.permissions.includes('sales.read')) return <p role="alert">Seu perfil não permite consultar a movimentação das marcas.</p>
  if (!data.sales) return (
    <section className="rounded-xl border bg-card p-8">
      <h2 className="text-lg font-semibold">Movimentação aguardando integração</h2>
      <p className="mt-2 text-muted-foreground">Os dados de clientes e pedidos das marcas ainda não estão disponíveis. Os indicadores serão exibidos quando essa conexão estiver pronta.</p>
    </section>
  )
  return <SalesContent sales={data.sales} customersOnly={customersOnly} />
}

function SalesContent({ sales, customersOnly }: { sales: SalesData; customersOnly: boolean }) {
  const { data } = useWorkspace()
  const [filters, setFilters] = useState<SalesFilters>(() => ({
    from: [sales.coverageFrom, `${sales.coverageThrough.slice(0, 7)}-01`].sort().at(-1)!,
    through: sales.coverageThrough, storeId: 'all', channel: 'all',
  }))
  const error = rangeError(sales, filters)
  const result = useMemo(() => error ? null : aggregateSales(sales, data.stores.map(store => store.id), filters), [sales, data.stores, filters, error])
  const setFilter = <K extends keyof SalesFilters>(key: K, value: SalesFilters[K]) => setFilters(previous => ({ ...previous, [key]: value }))
  const selectedName = data.stores.find(store => String(store.id) === filters.storeId)?.name ?? 'Todas as marcas'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">De<Input aria-label="Data inicial da movimentação" type="date" value={filters.from} min={sales.coverageFrom} max={sales.coverageThrough} onChange={event => setFilter('from', event.target.value)} className="w-auto" /></label>
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">Até<Input aria-label="Data final da movimentação" type="date" value={filters.through} min={sales.coverageFrom} max={sales.coverageThrough} onChange={event => setFilter('through', event.target.value)} className="w-auto" /></label>
        <label className="flex min-w-44 flex-1 flex-col gap-1.5 text-xs text-muted-foreground">Marca<select aria-label="Filtrar movimentação por marca" value={filters.storeId} onChange={event => setFilter('storeId', event.target.value)} className={selectClass}><option value="all">Todas as marcas</option>{data.stores.map(store => <option key={store.id} value={String(store.id)}>{store.name}</option>)}</select></label>
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">Canal<select aria-label="Filtrar movimentação por canal" value={filters.channel} onChange={event => setFilter('channel', event.target.value)} className={selectClass}><option value="all">Todos os canais</option>{salesChannels.map(channel => <option key={channel} value={channel}>{channelName(channel)}</option>)}</select></label>
        <Button variant="outline" onClick={() => setFilters(previous => ({ ...previous, from: [sales.coverageFrom, shiftDate(sales.coverageThrough, -29)].sort().at(-1)!, through: sales.coverageThrough }))}>Últimos 30 dias</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{selectedName} · Pedidos pela data de criação · Horário de Brasília</span>
        <span>Dados disponíveis de {dateShort(sales.coverageFrom)}/{sales.coverageFrom.slice(0, 4)} a {dateShort(sales.coverageThrough)}/{sales.coverageThrough.slice(0, 4)}</span>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{error}</p> : result && <>
        <SalesKpis result={result} />
        {customersOnly ? <CustomersTable result={result} scopeKey={JSON.stringify(filters)} /> : <>
          <SalesCharts result={result} />
          <BrandTable result={result} selectBrand={storeId => setFilter('storeId', String(storeId))} />
        </>}
        <details className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
          <summary className="flex cursor-pointer items-center gap-2 font-medium text-foreground"><Info className="size-4" />Como os indicadores são calculados</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
            <li>Solicitado: soma dos valores dos pedidos válidos criados no período. Atendido: valor atendido desses mesmos pedidos até a atualização dos dados; não representa recebimentos bancários.</li>
            <li>Pedidos válidos: todos os pedidos, exceto cancelados. Ticket médio: atendido ÷ pedidos válidos. Atendimento: atendido ÷ solicitado. Os consolidados são calculados pelas somas, sem média dos percentuais das marcas.</li>
            <li>Clientes com pedido: cadastros por marca com pelo menos um pedido válido no recorte. Recompra: clientes com dois ou mais pedidos válidos no recorte ÷ clientes com pedido.</li>
            <li>Base de clientes: cadastros nas marcas selecionadas até o fim do período, incluindo quem não comprou. Um comprador cadastrado em duas marcas conta como dois cadastros; nomes e e-mails não são usados para unificar identidades.</li>
            <li>O filtro de canal se aplica aos pedidos; a base cadastrada das marcas permanece a mesma. Sem denominador, taxas e ticket aparecem como “—”.</li>
          </ul>
        </details>
        <p className="text-xs text-muted-foreground">Movimentação atualizada em {dateLabel(sales.updatedAt)} às {new Date(sales.updatedAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}.</p>
      </>}
    </div>
  )
}

function SalesKpis({ result }: { result: Aggregation }) {
  return <>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard className="[&_.text-2xl]:text-xl" title="Faturamento solicitado" value={money(result.requested)} sub="Valor dos pedidos válidos" icon={<CircleDollarSign className="size-4" />} />
      <KpiCard className="[&_.text-2xl]:text-xl" title="Faturamento atendido" value={money(result.fulfilled)} sub="Valor atendido desses pedidos" icon={<CircleDollarSign className="size-4" />} accent />
      <KpiCard className="[&_.text-2xl]:text-xl" title="Pedidos válidos" value={integer(result.orders)} sub={`${integer(result.cancelled)} cancelados excluídos`} icon={<ShoppingCart className="size-4" />} />
      <KpiCard className="[&_.text-2xl]:text-xl" title="Ticket médio" value={currency(result.ticket)} sub="Atendido ÷ pedidos válidos" icon={<Receipt className="size-4" />} />
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard className="[&_.text-2xl]:text-xl" title="Clientes com pedido" value={integer(result.buyers)} sub={`${integer(result.registered)} cadastros na base das marcas`} icon={<Users className="size-4" />} />
      <KpiCard className="[&_.text-2xl]:text-xl" title="Taxa de atendimento" value={percent(result.fulfillmentRate)} sub={`${money(result.gap)} de diferença a atender`} />
      <KpiCard className="[&_.text-2xl]:text-xl" title="Recompra no período" value={percent(result.repeatRate)} sub={`${integer(result.repeatBuyers)} clientes com 2+ pedidos`} />
      <KpiCard className="[&_.text-2xl]:text-xl" title="Itens solicitados" value={integer(result.requestedItems)} sub={`${integer(result.fulfilledItems)} atendidos · ${result.itemsPerOrder?.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) ?? '—'} por pedido`} />
    </div>
  </>
}

function SalesCharts({ result }: { result: Aggregation }) {
  return <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
    <Card className="min-w-0"><CardHeader><CardTitle>Evolução da movimentação</CardTitle><p className="mt-2 text-xs text-muted-foreground">Solicitado e atendido por dia de criação dos pedidos</p></CardHeader><CardContent>
      <div className="mb-4 flex gap-5 text-xs"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-indigo-500" />Solicitado</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" />Atendido</span></div>
      <div className="h-64 w-full text-xs"><ResponsiveContainer width="100%" height="100%">
        <AreaChart data={result.days} accessibilityLayer margin={{ left: 0, right: 10, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickFormatter={dateShort} minTickGap={28} tickLine={false} axisLine={false} />
          <YAxis width={65} tickFormatter={value => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) / 100)} tickLine={false} axisLine={false} />
          <Tooltip labelFormatter={label => `Pedidos de ${dateShort(String(label))}`} formatter={value => currency(Number(value))} contentStyle={{ borderRadius: 10, background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
          <Area type="linear" dataKey="requested" name="Solicitado" stroke="#6366f1" fill="#6366f1" fillOpacity={0.08} strokeWidth={2} isAnimationActive={false} />
          <Area type="linear" dataKey="fulfilled" name="Atendido" stroke="#10b981" fill="#10b981" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer></div><p className="mt-2 text-xs text-muted-foreground">Valores em R$ · {integer(result.activeBrands)} marcas com pedidos válidos</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Movimentação por canal</CardTitle><p className="mt-2 text-xs text-muted-foreground">Participação no faturamento atendido</p></CardHeader><CardContent className="space-y-6">
      {result.channels.map(channel => <div key={channel.channel}><div className="flex items-center justify-between gap-2"><h3 className="font-medium">{channelName(channel.channel)}</h3><span className="font-semibold tabular-nums">{money(channel.fulfilled)}</span></div><div className="my-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${result.fulfilled ? channel.fulfilled / result.fulfilled * 100 : 0}%` }} /></div><p className="text-xs text-muted-foreground">{integer(channel.orders)} pedidos · {money(channel.requested)} solicitado</p></div>)}
      {!result.orders && <p className="text-xs text-muted-foreground">Nenhum pedido válido no recorte selecionado.</p>}
    </CardContent></Card>
  </div>
}

function BrandTable({ result, selectBrand }: { result: Aggregation; selectBrand: (id: number) => void }) {
  const { data } = useWorkspace()
  return <section className="overflow-hidden rounded-xl border bg-card">
    <div className="border-b p-5"><h2 className="font-semibold">Desempenho das marcas</h2><p className="mt-1 text-xs text-muted-foreground">Consolidado do mesmo período e canal · selecione uma marca para detalhar</p></div>
    <Table className="master-table"><TableHeader><TableRow><TableHead className="pl-5">Marca</TableHead><TableHead className="text-right">Clientes com pedido</TableHead><TableHead className="text-right">Solicitado</TableHead><TableHead className="text-right">Atendido</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Ticket médio</TableHead><TableHead className="pr-5 text-right">Atendimento</TableHead></TableRow></TableHeader><TableBody>
      {[...result.brands].sort((a, b) => b.fulfilled - a.fulfilled || a.storeId - b.storeId).map(brand => <TableRow key={brand.storeId}><TableCell className="py-4 pl-5"><Button variant="link" className="h-auto p-0 text-left" onClick={() => selectBrand(brand.storeId)}>{data.stores.find(store => store.id === brand.storeId)?.name ?? `Marca #${brand.storeId}`}<ArrowUpRight className="size-3" /></Button></TableCell><TableCell className="text-right tabular-nums">{integer(brand.buyers)}</TableCell><TableCell className="text-right tabular-nums">{money(brand.requested)}</TableCell><TableCell className="text-right font-medium tabular-nums">{money(brand.fulfilled)}</TableCell><TableCell className="text-right tabular-nums">{integer(brand.orders)}</TableCell><TableCell className="text-right tabular-nums">{currency(brand.ticket)}</TableCell><TableCell className="pr-5 text-right">{percent(brand.fulfillmentRate)}</TableCell></TableRow>)}
      <TableRow className="bg-muted/50 font-semibold"><TableCell className="pl-5">Total consolidado</TableCell><TableCell className="text-right">{integer(result.buyers)}</TableCell><TableCell className="text-right">{money(result.requested)}</TableCell><TableCell className="text-right">{money(result.fulfilled)}</TableCell><TableCell className="text-right">{integer(result.orders)}</TableCell><TableCell className="text-right">{currency(result.ticket)}</TableCell><TableCell className="pr-5 text-right">{percent(result.fulfillmentRate)}</TableCell></TableRow>
    </TableBody></Table>
  </section>
}

function CustomersTable({ result, scopeKey }: { result: Aggregation; scopeKey: string }) {
  return <CustomerList key={scopeKey} result={result} />
}

function CustomerList({ result }: { result: Aggregation }) {
  const { data } = useWorkspace()
  const [search, setSearch] = useState(''), [activity, setActivity] = useState('all'), [sort, setSort] = useState('fulfilled'), [page, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = result.customers.find(customer => entityKey(customer.storeId, customer.id) === selectedKey) ?? null
  const storeName = (id: number) => data.stores.find(store => store.id === id)?.name ?? `Marca #${id}`
  const query = search.trim().toLocaleLowerCase('pt-BR')
  const rows = result.customers.filter(customer => `${customer.name} ${customer.email} ${customer.city} ${customer.state} ${storeName(customer.storeId)}`.toLocaleLowerCase('pt-BR').includes(query) && (activity === 'all' || (activity === 'buyers' ? customer.orders > 0 : customer.orders === 0)))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : (b[sort as 'fulfilled' | 'requested' | 'orders' | 'ticket'] ?? -1) - (a[sort as 'fulfilled' | 'requested' | 'orders' | 'ticket'] ?? -1) || a.name.localeCompare(b.name, 'pt-BR'))
  const pages = Math.max(1, Math.ceil(rows.length / 10)), current = Math.min(page, pages)
  const customerOrders = selected ? result.sourceOrders.filter(order => order.storeId === selected.storeId && order.customerId === selected.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []
  return <div className="space-y-4">
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-semibold">Lista de clientes</h2><p className="mt-1 text-xs text-muted-foreground">{integer(result.registered)} cadastros no recorte · busca e ordenação abaixo afetam apenas a lista</p></div><Badge variant="outline">Um cadastro por cliente e marca</Badge></div>
      <div className="flex flex-wrap gap-3 border-b p-4"><div className="relative min-w-52 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Buscar clientes na lista" placeholder="Buscar cliente, e-mail, cidade ou marca…" className="pl-9" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></div><select aria-label="Filtrar clientes por atividade" className={selectClass} value={activity} onChange={event => { setActivity(event.target.value); setPage(1) }}><option value="all">Todos os clientes</option><option value="buyers">Com pedidos válidos</option><option value="without">Sem pedidos válidos</option></select><div className="flex items-center gap-2"><ArrowDownUp className="size-4 text-muted-foreground" /><select aria-label="Ordenar clientes" className={selectClass} value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}><option value="fulfilled">Maior atendido</option><option value="requested">Maior solicitado</option><option value="orders">Mais pedidos</option><option value="ticket">Maior ticket médio</option><option value="name">Nome do cliente</option></select></div></div>
      <Table className="master-table"><TableHeader><TableRow><TableHead className="pl-5">Cliente / marca</TableHead><TableHead>Localização</TableHead><TableHead className="text-right">Solicitado</TableHead><TableHead className="text-right">Atendido</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Ticket médio</TableHead><TableHead className="text-right">Atendimento</TableHead><TableHead className="pr-5">Último pedido</TableHead></TableRow></TableHeader><TableBody>
        {rows.slice((current - 1) * 10, current * 10).map(customer => <TableRow key={entityKey(customer.storeId, customer.id)}><TableCell className="py-4 pl-5"><button className="text-left font-semibold hover:underline focus-visible:outline-2" onClick={() => setSelectedKey(entityKey(customer.storeId, customer.id))} aria-label={`Detalhar ${customer.name} em ${storeName(customer.storeId)}`}>{customer.name}</button><p className="mt-1 text-xs text-muted-foreground">{storeName(customer.storeId)}</p></TableCell><TableCell className="text-xs">{customer.city}<p className="text-muted-foreground">{customer.state}</p></TableCell><TableCell className="text-right tabular-nums">{money(customer.requested)}</TableCell><TableCell className="text-right font-medium tabular-nums">{money(customer.fulfilled)}</TableCell><TableCell className="text-right tabular-nums">{integer(customer.orders)}</TableCell><TableCell className="text-right tabular-nums">{currency(customer.ticket)}</TableCell><TableCell className="text-right">{percent(customer.fulfillmentRate)}</TableCell><TableCell className="pr-5 text-xs">{customer.lastOrder ? dateLabel(customer.lastOrder) : 'Sem pedido no período'}</TableCell></TableRow>)}
      </TableBody></Table>
      {!rows.length && <p className="p-10 text-center text-muted-foreground">Nenhum cliente encontrado. Ajuste a busca ou os filtros.</p>}
    </section>
    <AdminPaginationControls currentPage={current} totalPages={pages} onPageChange={setPage} showing={{ start: rows.length ? (current - 1) * 10 + 1 : 0, end: Math.min(current * 10, rows.length), total: rows.length }} />
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelectedKey(null) }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{selected?.name}</DialogTitle><DialogDescription>{selected && `${storeName(selected.storeId)} · ${selected.email} · ${selected.city}/${selected.state}`}</DialogDescription></DialogHeader>
      {selected && <><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><KpiCard className="[&_.text-2xl]:text-xl" title="Solicitado" value={money(selected.requested)} /><KpiCard className="[&_.text-2xl]:text-xl" title="Atendido" value={money(selected.fulfilled)} /><KpiCard className="[&_.text-2xl]:text-xl" title="Pedidos válidos" value={integer(selected.orders)} /><KpiCard className="[&_.text-2xl]:text-xl" title="Ticket médio" value={currency(selected.ticket)} /></div><h3 className="mt-2 text-sm font-semibold">Pedidos no período e canal selecionados</h3><Table><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Data</TableHead><TableHead>Canal</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Solicitado</TableHead><TableHead className="text-right">Atendido</TableHead></TableRow></TableHeader><TableBody>{customerOrders.map(order => <TableRow key={order.id}><TableCell>{order.id}</TableCell><TableCell>{dateLabel(order.createdAt)}</TableCell><TableCell>{channelName(order.channel)}</TableCell><TableCell><Badge variant={order.status === 'cancelled' ? 'rose' : order.status === 'fulfilled' ? 'emerald' : 'secondary'}>{orderStatuses[order.status]}</Badge></TableCell><TableCell className="text-right">{money(order.requested)}</TableCell><TableCell className="text-right">{money(order.fulfilled)}</TableCell></TableRow>)}</TableBody></Table>{!customerOrders.length && <p className="py-5 text-muted-foreground">Este cliente não tem pedidos no recorte selecionado.</p>}<p className="text-xs text-muted-foreground">Pedidos cancelados são exibidos para consulta e excluídos dos indicadores.</p></>}
    </DialogContent></Dialog>
  </div>
}
