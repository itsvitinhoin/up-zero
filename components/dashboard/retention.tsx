'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Dot
} from 'recharts'
import { RefreshCw, AlertTriangle, Activity, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button-1'
import { KpiCard, SectionHeader } from '@/components/dashboard/shared'
import { useDashboardData } from '@/contexts/dashboard-data'

const COL_LABELS = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']

function cellClass(value: number | null, colIndex: number) {
  if (colIndex === 0) return 'bg-indigo-100 text-indigo-800 font-bold'
  if (value === null) return 'bg-muted/20 text-muted-foreground/30'
  if (value >= 75) return 'bg-emerald-100 text-emerald-800'
  if (value >= 55) return 'bg-blue-100 text-blue-800'
  if (value >= 35) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function daysSince(date: Date | null): number {
  if (!date) return Infinity
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export default function DashboardRetention() {
  const { cohortData: COHORT_DATA, customers: DASHBOARD_CUSTOMERS } = useDashboardData()
  const activeCustomers = DASHBOARD_CUSTOMERS.filter(c => c.status === 'active').length

  // Avg M1 retention
  const m1Values = COHORT_DATA.map(row => row.months[1]).filter((v): v is number => v !== null)
  const avgM1 = m1Values.length > 0 ? m1Values.reduce((s, v) => s + v, 0) / m1Values.length : 0

  // Retention trend data (cohorts with M1)
  const trendData = COHORT_DATA
    .filter(row => row.months[1] !== null)
    .map(row => ({ cohort: row.cohort, retention: row.months[1] as number }))

  // Re-engagement candidates
  const reEngagementCandidates = DASHBOARD_CUSTOMERS.filter(
    c => c.status === 'at_risk' || c.status === 'inactive'
  )

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Retenção e Cohorts"
        description="Análise de recompra, cohorts e oportunidades de reengajamento"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Taxa de Recompra"
          value="56%"
          sub="Clientes com 2+ pedidos"
          icon={<RefreshCw className="size-4" />}
        />
        <KpiCard
          title="Clientes Ativos"
          value={String(activeCustomers)}
          sub="Status ativo"
          icon={<Users className="size-4" />}
        />
        <KpiCard
          title="Em Risco"
          value="3"
          sub="Necessitam atenção"
          icon={<AlertTriangle className="size-4" />}
          className="border-amber-200 bg-amber-50/40"
        />
        <KpiCard
          title="Cohort M1 Médio"
          value={`${avgM1.toFixed(0)}%`}
          sub="Retenção média no M1"
          icon={<Activity className="size-4" />}
        />
      </div>

      {/* Cohort Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Heatmap de Cohorts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-24">Cohort</th>
                  {COL_LABELS.map(label => (
                    <th key={label} className="px-2 py-3 text-center text-xs font-medium text-muted-foreground w-16">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COHORT_DATA.map(row => (
                  <tr key={row.cohort} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-medium text-foreground whitespace-nowrap">{row.cohort}</td>
                    {COL_LABELS.map((_, colIdx) => {
                      const value = row.months[colIdx] ?? null
                      const cls = cellClass(value, colIdx)
                      return (
                        <td key={colIdx} className="px-2 py-2.5 text-center">
                          <span className={`inline-flex items-center justify-center rounded text-xs font-medium w-10 h-6 ${cls}`}>
                            {value === null ? '—' : `${value}%`}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 border-t border-border flex-wrap">
            {[
              { label: '≥ 75%', cls: 'bg-emerald-100 text-emerald-800' },
              { label: '55–74%', cls: 'bg-blue-100 text-blue-800' },
              { label: '35–54%', cls: 'bg-yellow-100 text-yellow-800' },
              { label: '< 35%', cls: 'bg-red-100 text-red-800' },
              { label: 'M0 (100%)', cls: 'bg-indigo-100 text-indigo-800' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={`inline-block w-8 h-4 rounded text-xs text-center leading-4 font-medium ${item.cls}`}></span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Retention Trend + Re-engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Retention Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tendência de Retenção M1</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="cohort"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  formatter={(v) => `${v}%`}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="retention"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={<Dot r={4} fill="#6366f1" />}
                  activeDot={{ r: 6, fill: '#6366f1' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Re-engagement Opportunities */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Oportunidades de Reengajamento</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {reEngagementCandidates.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground px-4">
                Nenhum cliente em risco no momento
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-64 overflow-y-auto">
                {reEngagementCandidates.map(c => {
                  const days = daysSince(c.lastPurchaseAt)
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {days === Infinity
                            ? 'Nunca comprou'
                            : `sem compras há ${days} dia${days === 1 ? '' : 's'}`}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0">
                        Contatar
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
