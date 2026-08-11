'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge-2'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import { KpiCard, SectionHeader, RfmBadge, StatsRow, EmptyState } from '@/components/dashboard/shared'
import {
  DASHBOARD_CUSTOMERS, TOTALS, fmt, fmtPct, type DRFMSegment,
} from '@/lib/dashboard-mock-data'

const PAGE_SIZE = 10
const RFM_SEGMENTS: DRFMSegment[] = ['Champions', 'Loyal', 'Promising', 'At Risk', 'Lost']

export default function DashboardCustomers() {
  const [search, setSearch] = useState('')
  const [rfmFilter, setRfmFilter] = useState<'ALL' | DRFMSegment>('ALL')
  const [page, setPage] = useState(1)

  // KPI counts
  const total = DASHBOARD_CUSTOMERS.length
  const ativos = DASHBOARD_CUSTOMERS.filter(c => c.status === 'active').length
  const emRisco = DASHBOARD_CUSTOMERS.filter(c => c.status === 'at_risk').length
  const inativos = DASHBOARD_CUSTOMERS.filter(c => c.status === 'inactive').length

  // RFM counts for filter pills
  const rfmCounts = useMemo(() => {
    const counts: Partial<Record<DRFMSegment, number>> = {}
    for (const seg of RFM_SEGMENTS) {
      counts[seg] = DASHBOARD_CUSTOMERS.filter(c => c.rfmSegment === seg).length
    }
    return counts
  }, [])

  // Filtered + paginated
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return DASHBOARD_CUSTOMERS.filter(c => {
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q) || c.segment.toLowerCase().includes(q)
      const matchRfm = rfmFilter === 'ALL' || c.rfmSegment === rfmFilter
      return matchSearch && matchRfm
    })
  }, [search, rfmFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleRfm(s: 'ALL' | DRFMSegment) { setRfmFilter(s); setPage(1) }
  function handleSearch(v: string) { setSearch(v); setPage(1) }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Inteligência de Clientes"
        description="Análise de comportamento, valor e segmentação da base"
      />

      {/* Top KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Total Clientes" value={String(total)} accent />
        <KpiCard title="Ativos" value={String(ativos)} />
        <KpiCard title="Em Risco" value={String(emRisco)} />
        <KpiCard title="Inativos" value={String(inativos)} />
        <KpiCard title="Taxa Recompra" value={fmtPct(TOTALS.repeatRate)} />
      </div>

      {/* Behavior metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1 */}
        <Card>
          <CardHeader>
            <CardTitle>Análise de Conversão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatsRow label="Cadastros" value="25" />
            <StatsRow label="Compraram" value="22" />
            <StatsRow label="Conversão" value="88%" />
            <StatsRow label="Dias p/ 1ª compra" value="13.8 dias" />
          </CardContent>
        </Card>

        {/* Card 2 */}
        <Card>
          <CardHeader>
            <CardTitle>Valor do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatsRow label="Maior receita" value="Ipê Boutique" sub="R$ 29.360" />
            <StatsRow label="Ticket médio geral" value={fmt(TOTALS.avgTicket)} />
            <StatsRow label="Maior frequência" value="Arte & Moda" sub="30 dias" />
          </CardContent>
        </Card>

        {/* Card 3 */}
        <Card>
          <CardHeader>
            <CardTitle>Segmentação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatsRow label="Moda feminina" value="8 clientes" />
            <StatsRow label="Casual feminino" value="6 clientes" />
            <StatsRow label="Resortwear" value="3 clientes" />
            <StatsRow label="Alto padrão" value="3 clientes" />
            <StatsRow label="Multimarcas" value="2 clientes" />
          </CardContent>
        </Card>
      </div>

      {/* Customer table */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardToolbar>
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar por nome, estado ou segmento…"
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background outline-none focus:ring-2 focus:ring-ring w-64"
            />
          </CardToolbar>
        </CardHeader>

        {/* RFM filter pills */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
          <button
            onClick={() => handleRfm('ALL')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${rfmFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            Todos
            <Badge variant="secondary" appearance="light" size="sm">{total}</Badge>
          </button>
          {RFM_SEGMENTS.map(seg => (
            <button
              key={seg}
              onClick={() => handleRfm(seg)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${rfmFilter === seg ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {seg}
              <Badge variant="secondary" appearance="light" size="sm">{rfmCounts[seg] ?? 0}</Badge>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {paginated.length === 0 ? (
            <EmptyState message="Nenhum cliente encontrado" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Segmento</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Pedidos</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Receita</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Ticket Médio</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Última Compra</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">RFM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map(c => {
                  const statusVariant = c.status === 'active' ? 'success' : c.status === 'at_risk' ? 'warning' : 'secondary'
                  const statusLabel = c.status === 'active' ? 'Ativo' : c.status === 'at_risk' ? 'Em Risco' : 'Inativo'
                  const lastPurchase = c.lastPurchaseAt
                    ? new Date(c.lastPurchaseAt).toLocaleDateString('pt-BR')
                    : '—'
                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium">{c.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.state}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.segment}</td>
                      <td className="px-5 py-3 text-right">{c.totalOrders}</td>
                      <td className="px-5 py-3 text-right">{fmt(c.totalRevenue)}</td>
                      <td className="px-5 py-3 text-right">{c.avgTicket > 0 ? fmt(c.avgTicket) : '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground">{lastPurchase}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant} appearance="light" size="sm">{statusLabel}</Badge>
                      </td>
                      <td className="px-5 py-3"><RfmBadge segment={c.rfmSegment} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <CardFooter>
          <AdminPaginationControls
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showing={{
              start: Math.min((page - 1) * PAGE_SIZE + 1, filtered.length),
              end: Math.min(page * PAGE_SIZE, filtered.length),
              total: filtered.length,
            }}
          />
        </CardFooter>
      </Card>
    </div>
  )
}
