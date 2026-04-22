'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button-1'
import { Badge } from '@/components/ui/badge-2'
import { KpiCard, SectionHeader, StatusBadge, EmptyState, GapBar, currencyTooltipFormatter } from '@/components/dashboard/shared'
import { fmt, type DOrderStatus } from '@/lib/dashboard-mock-data'
import { useDashboardData } from '@/contexts/dashboard-data'

const PAGE_SIZE = 10

const ALL_STATUSES: DOrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'INVOICED', 'SHIPPED', 'DELIVERED', 'CANCELLED']
const STATUS_LABEL: Record<DOrderStatus, string> = {
  PENDING: 'Pendente', CONFIRMED: 'Confirmado', PROCESSING: 'Processando',
  INVOICED: 'Faturado', SHIPPED: 'Enviado', DELIVERED: 'Entregue', CANCELLED: 'Cancelado',
}

export default function DashboardOrders() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | DOrderStatus>('ALL')
  const [page, setPage] = useState(1)
  const { orders: DASHBOARD_ORDERS, weeklyRevenue: WEEKLY_REVENUE } = useDashboardData()

  // Summary KPIs
  const totalOrders = DASHBOARD_ORDERS.length
  const activeOrders = DASHBOARD_ORDERS.filter(o => o.status !== 'CANCELLED')
  const receitaSolicitada = activeOrders.reduce((s, o) => s + o.total, 0)
  const receitaRealizada = DASHBOARD_ORDERS.reduce((s, o) => s + o.fulfilledTotal, 0)
  const gapMedio = activeOrders.length > 0
    ? activeOrders.reduce((s, o) => s + (o.total > 0 ? (o.total - o.fulfilledTotal) / o.total * 100 : 0), 0) / activeOrders.length
    : 0

  // Status counts for pills
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<DOrderStatus, number>> = {}
    for (const s of ALL_STATUSES) {
      counts[s] = DASHBOARD_ORDERS.filter(o => o.status === s).length
    }
    return counts
  }, [])

  // Filtered + paginated
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return DASHBOARD_ORDERS.filter(o => {
      const matchSearch = !q || o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.state.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [search, statusFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleStatusFilter(s: 'ALL' | DOrderStatus) {
    setStatusFilter(s)
    setPage(1)
  }
  function handleSearch(v: string) {
    setSearch(v)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Inteligência de Pedidos"
        description="Visão completa de pedidos, receita solicitada e realizada"
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Pedidos" value={String(totalOrders)} accent />
        <KpiCard title="Receita Solicitada" value={fmt(receitaSolicitada, true)} />
        <KpiCard title="Receita Realizada" value={fmt(receitaRealizada, true)} />
        <KpiCard title="Gap Médio" value={`${gapMedio.toFixed(1)}%`} />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle>Receita por Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={WEEKLY_REVENUE} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => fmt(v, true)}
                width={72}
              />
              <Tooltip formatter={(v: unknown) => currencyTooltipFormatter(v as number)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="requested" name="Solicitado" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fulfilled" name="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <GapBar
            requested={WEEKLY_REVENUE.reduce((s, w) => s + w.requested, 0)}
            fulfilled={WEEKLY_REVENUE.reduce((s, w) => s + w.fulfilled, 0)}
            className="mt-4"
          />
        </CardContent>
      </Card>

      {/* Orders table */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <CardToolbar>
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar por pedido, cliente ou estado…"
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background outline-none focus:ring-2 focus:ring-ring w-64"
            />
          </CardToolbar>
        </CardHeader>

        {/* Status filter pills */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
          <button
            onClick={() => handleStatusFilter('ALL')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            Todos
            <Badge variant="secondary" appearance="light" size="sm">{totalOrders}</Badge>
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => handleStatusFilter(s)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {STATUS_LABEL[s]}
              <Badge variant="secondary" appearance="light" size="sm">{statusCounts[s] ?? 0}</Badge>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {paginated.length === 0 ? (
            <EmptyState message="Nenhum pedido encontrado" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Pedido</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Solicitado</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Realizado</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Gap</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Itens</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map(order => {
                  const gap = order.total - order.fulfilledTotal
                  return (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">#{order.id}</td>
                      <td className="px-5 py-3 font-medium">{order.customerName}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {order.date.toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-3 text-right">{fmt(order.total)}</td>
                      <td className="px-5 py-3 text-right">{fmt(order.fulfilledTotal)}</td>
                      <td className="px-5 py-3 text-right">
                        {gap > 0
                          ? <span className="text-destructive font-medium">-{fmt(gap)}</span>
                          : <span className="text-emerald-600 font-medium">Completo</span>
                        }
                      </td>
                      <td className="px-5 py-3 text-right hidden sm:table-cell">{order.items}</td>
                      <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-5 py-3 hidden sm:table-cell">{order.state}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <CardFooter className="justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} pedidos
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {Math.max(1, totalPages)}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Próximo
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
