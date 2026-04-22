'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge-2'
import { SectionHeader, RfmBadge, EmptyState } from '@/components/dashboard/shared'
import { fmt, type DRFMSegment } from '@/lib/dashboard-mock-data'
import { useDashboardData } from '@/contexts/dashboard-data'

const ALL = 'ALL'

export default function DashboardRFM() {
  const [selectedSegment, setSelectedSegment] = useState<DRFMSegment | 'ALL'>(ALL)
  const { rfmData: RFM_DATA, customers: DASHBOARD_CUSTOMERS } = useDashboardData()

  const pieData = RFM_DATA.map(r => ({ name: r.segment, value: r.count, fill: r.color }))

  const filteredCustomers =
    selectedSegment === ALL
      ? DASHBOARD_CUSTOMERS
      : DASHBOARD_CUSTOMERS.filter(c => c.rfmSegment === selectedSegment)

  const segmentCount = (seg: DRFMSegment) =>
    DASHBOARD_CUSTOMERS.filter(c => c.rfmSegment === seg).length

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Análise RFM"
        description="Segmentação de clientes por Recência, Frequência e Valor Monetário"
      />

      {/* RFM Logic Explanation */}
      <Card className="bg-muted/30">
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                letter: 'R', label: 'Recência', color: '#6366f1', bg: '#eef2ff',
                desc: 'Há quantos dias o cliente fez o último pedido.',
                scores: 'Score 5 = ≤ 30 dias · 4 = 31–60 · 3 = 61–90 · 2 = 91–180 · 1 = > 180 dias',
              },
              {
                letter: 'F', label: 'Frequência', color: '#10b981', bg: '#d1fae5',
                desc: 'Quantos pedidos o cliente já realizou no total.',
                scores: 'Score 5 = 5+ pedidos · 4 = 4 · 3 = 3 · 2 = 2 · 1 = apenas 1 pedido',
              },
              {
                letter: 'M', label: 'Monetário', color: '#f59e0b', bg: '#fef3c7',
                desc: 'Ticket médio dos pedidos realizados pelo cliente.',
                scores: 'Score 5 = R$ 5.000+ · 4 = R$ 3.500+ · 3 = R$ 2.500+ · 2 = R$ 1.500+ · 1 = abaixo',
              },
            ].map(dim => (
              <div key={dim.letter} className="flex gap-3">
                <div className="size-9 rounded-xl flex items-center justify-center font-bold text-lg shrink-0" style={{ backgroundColor: dim.bg, color: dim.color }}>
                  {dim.letter}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{dim.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{dim.desc}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed">{dim.scores}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border/60">
            <p className="text-xs font-semibold text-foreground mb-2">Como os segmentos são definidos</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { seg: 'Champions', rule: 'R ≥ 4, F ≥ 4 e M ≥ 4' },
                { seg: 'Loyal',     rule: 'F ≥ 3 e R ≥ 3' },
                { seg: 'Promising', rule: 'R ≥ 3 e F ≤ 2' },
                { seg: 'At Risk',   rule: 'R ≤ 2 e F ≥ 3' },
                { seg: 'Lost',      rule: 'Demais casos' },
              ].map(s => (
                <div key={s.seg} className="bg-background rounded-lg p-2 border border-border/50">
                  <p className="text-[11px] font-semibold text-foreground">{s.seg}</p>
                  <p className="text-[11px] text-muted-foreground">{s.rule}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              <span className="font-semibold text-foreground">Exemplo:</span> cliente com último pedido há 20 dias (R=5), 3 pedidos no total (F=3) e ticket médio de R$&nbsp;2.800,00 (M=3) → classificado como <span className="font-semibold text-indigo-600">Loyal</span>, pois F ≥ 3 e R ≥ 3.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Segment cards grid + Pie chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Segment cards (5 stacked in one col on lg) */}
        <div className="flex flex-col gap-3">
          {RFM_DATA.map(r => (
            <button
              key={r.segment}
              onClick={() => setSelectedSegment(selectedSegment === r.segment ? ALL : r.segment)}
              className={[
                'rounded-xl border p-3 text-left transition-all cursor-pointer',
                selectedSegment === r.segment
                  ? 'border-2 shadow-sm'
                  : 'border-border bg-card hover:shadow-sm',
              ].join(' ')}
              style={
                selectedSegment === r.segment
                  ? { backgroundColor: r.bgColor, borderColor: r.color }
                  : { backgroundColor: r.bgColor + '66' }
              }
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="text-sm font-semibold text-foreground">{r.segment}</span>
                </div>
                <Badge variant="secondary" appearance="light" size="sm">{r.count}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{r.pct}% dos clientes</span>
                <span className="font-semibold text-foreground">{fmt(r.avgRevenue)} avg</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{r.description}</p>
            </button>
          ))}
        </div>

        {/* Pie chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Distribuição por Segmento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v} clientes`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Customer table */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes por Segmento</CardTitle>
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSegment(ALL)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                selectedSegment === ALL
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
              ].join(' ')}
            >
              Todos
              <span className="rounded-full bg-background/30 px-1.5 text-[10px]">
                {DASHBOARD_CUSTOMERS.length}
              </span>
            </button>
            {RFM_DATA.map(r => (
              <button
                key={r.segment}
                onClick={() => setSelectedSegment(selectedSegment === r.segment ? ALL : r.segment)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                  selectedSegment === r.segment
                    ? 'border-2 text-white'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
                ].join(' ')}
                style={
                  selectedSegment === r.segment
                    ? { backgroundColor: r.color, borderColor: r.color }
                    : {}
                }
              >
                {r.segment}
                <span className="rounded-full bg-background/30 px-1.5 text-[10px]">
                  {segmentCount(r.segment)}
                </span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Pedidos</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Receita</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Segmento RFM</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Último Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c, i) => (
                    <tr
                      key={c.id}
                      className={[
                        'border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
                        i % 2 === 0 ? '' : 'bg-muted/10',
                      ].join(' ')}
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.state}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.totalOrders}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(c.totalRevenue)}</td>
                      <td className="px-4 py-3">
                        <RfmBadge segment={c.rfmSegment} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {c.lastPurchaseAt
                          ? c.lastPurchaseAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
