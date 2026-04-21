'use client'

import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge-2'
import { SectionHeader, StatsRow, currencyTooltipFormatter } from '@/components/dashboard/shared'
import { fmt, fmtPct } from '@/lib/dashboard-mock-data'
import { useDashboardData } from '@/contexts/dashboard-data'

type Period = '7d' | '30d' | 'mes' | '90d'
const PERIODS: { key: Period; label: string }[] = [
  { key: '7d',  label: '7d'  },
  { key: '30d', label: '30d' },
  { key: 'mes', label: 'Mês' },
  { key: '90d', label: '90d' },
]

// Revenue by payment method (hardcoded from DASHBOARD_ORDERS aggregation)
const BY_PAYMENT = [
  { method: 'PIX',    total: 287400, color: '#10b981' },
  { method: 'Boleto', total: 84200,  color: '#f59e0b' },
  { method: 'Cartão', total: 52800,  color: '#6366f1' },
]

const STATUS_ROWS = [
  { status: 'DELIVERED',  label: 'Entregue',    variant: 'success'     as const },
  { status: 'PENDING',    label: 'Pendente',     variant: 'warning'     as const },
  { status: 'PROCESSING', label: 'Processando',  variant: 'info'        as const },
  { status: 'SHIPPED',    label: 'Enviado',      variant: 'primary'     as const },
  { status: 'CONFIRMED',  label: 'Confirmado',   variant: 'info'        as const },
  { status: 'CANCELLED',  label: 'Cancelado',    variant: 'destructive' as const },
]

const PERIOD_MONTHS: Record<Period, number> = { '7d': 2, '30d': 3, 'mes': 2, '90d': 4 }

export default function DashboardSalesAnalytics() {
  const [period, setPeriod] = useState<Period>('mes')
  const { monthlyRevenue: MONTHLY_REVENUE, orders: DASHBOARD_ORDERS } = useDashboardData()

  const sliceN = PERIOD_MONTHS[period]
  const chartData = MONTHLY_REVENUE.slice(-sliceN)
  const barData = MONTHLY_REVENUE.slice(-sliceN)

  const statusRevenue = DASHBOARD_ORDERS.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + o.total
    return acc
  }, {})

  const stateRevenue = DASHBOARD_ORDERS.reduce<Record<string, number>>((acc, o) => {
    acc[o.state] = (acc[o.state] ?? 0) + o.total
    return acc
  }, {})
  const TOP_STATES = Object.entries(stateRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxStateRev = TOP_STATES[0]?.[1] ?? 1

  const last4 = MONTHLY_REVENUE.slice(-sliceN)
  const avgTicketData = MONTHLY_REVENUE.slice(-sliceN).map(m => ({
    month: m.month,
    avgTicket: m.orders > 0 ? Math.round(m.fulfilled / m.orders) : 0,
  }))

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Análise de Vendas"
        description="Detalhamento de receita, pedidos e desempenho"
      >
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                period === p.key
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </SectionHeader>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Receita por Período</CardTitle>
            <CardToolbar>
              <Badge variant="secondary" appearance="light" size="sm">{period}</Badge>
            </CardToolbar>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="saFillReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="saFillFul" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => currencyTooltipFormatter(value as number)} />
                <Area type="monotone" dataKey="requested" name="Solicitado" stroke="#6366f1" fill="url(#saFillReq)" strokeWidth={2} />
                <Area type="monotone" dataKey="fulfilled" name="Realizado" stroke="#10b981" fill="url(#saFillFul)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos por Período</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="orders" name="Pedidos" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdown 4-col grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Por Forma de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle>Por Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {BY_PAYMENT.map((p) => (
              <div key={p.method} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-sm text-muted-foreground">{p.method}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{fmt(p.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Por Status */}
        <Card>
          <CardHeader>
            <CardTitle>Por Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {STATUS_ROWS.filter((r) => statusRevenue[r.status]).map((r) => (
              <div key={r.status} className="flex items-center justify-between gap-2">
                <Badge variant={r.variant} appearance="light" size="sm">{r.label}</Badge>
                <span className="text-sm font-semibold text-foreground">{fmt(statusRevenue[r.status] ?? 0)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Por Estado Top 5 */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Estados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {TOP_STATES.map(([state, rev]) => (
              <div key={state} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{state}</span>
                  <span className="text-muted-foreground">{fmt(rev)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(rev / maxStateRev) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Solicitado vs Realizado — mini table */}
        <Card>
          <CardHeader>
            <CardTitle>Sol. vs Real.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="grid grid-cols-4 text-xs text-muted-foreground font-medium pb-1 border-b border-border">
              <span>Mês</span>
              <span className="text-right">Sol.</span>
              <span className="text-right">Real.</span>
              <span className="text-right text-destructive">Gap</span>
            </div>
            {last4.map((m) => {
              const gap = m.requested - m.fulfilled
              const gapPct = m.requested > 0 ? (gap / m.requested) * 100 : 0
              return (
                <div key={m.month} className="grid grid-cols-4 text-xs items-center">
                  <span className="text-muted-foreground">{m.month.split('/')[0]}</span>
                  <span className="text-right font-medium">{(m.requested / 1000).toFixed(0)}k</span>
                  <span className="text-right font-medium text-emerald-600">{(m.fulfilled / 1000).toFixed(0)}k</span>
                  <span className="text-right text-destructive">{fmtPct(gapPct)}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Avg ticket trend */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência do Ticket Médio</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={avgTicketData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="saFillTicket" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
              <Tooltip formatter={(value) => currencyTooltipFormatter(value as number)} />
              <Area type="monotone" dataKey="avgTicket" name="Ticket Médio" stroke="#6366f1" fill="url(#saFillTicket)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
