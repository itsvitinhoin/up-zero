'use client'

import {
  CircleDollarSign, TrendingUp, Target, ShoppingCart,
  Receipt, Users, UserCheck, RefreshCw,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard, GapBar, SectionHeader, currencyTooltipFormatter } from '@/components/dashboard/shared'
import { fmt, fmtN, fmtPct } from '@/lib/dashboard-mock-data'
import { useDashboardData } from '@/contexts/dashboard-data'

const FUNNEL_LABELS = [
  'Cadastros Aprovados', '1º Pedido', 'Pedido Atendido', '2ª Compra', '3ª Compra+',
]

export default function DashboardOverview() {
  const { monthlyRevenue: MONTHLY_REVENUE, totals: TOTALS, funnelData, isLoading, error } = useDashboardData()

  const last7 = MONTHLY_REVENUE.slice(-7)
  const last6 = MONTHLY_REVENUE.slice(-6)

  const FUNNEL = funnelData.map((f, i) => ({
    label: FUNNEL_LABELS[i] ?? f.label,
    value: f.value,
    pct:   i === 0 ? null : `${f.pct}%`,
    color: f.color,
  }))

  const fulfillRate = TOTALS.fulfillmentRate
  const rateColor   = fulfillRate >= 85 ? 'success' : fulfillRate >= 70 ? 'warning' : 'destructive'
  const rateAccent  = fulfillRate >= 85
  const gap         = TOTALS.totalRequested - TOTALS.totalFulfilled

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Erro ao carregar dados: {error}
        </div>
      )}
      {isLoading && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground animate-pulse">
          Carregando dados da API…
        </div>
      )}
      <SectionHeader
        title="Visão Geral"
        description="Resumo executivo do período atual"
      />

      {/* Row 1 — KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Receita Realizada"
          value={fmt(TOTALS.totalFulfilled)}
          icon={<CircleDollarSign className="size-4" />}
          trend={12.4}
          accent
        />
        <KpiCard
          title="Receita Solicitada"
          value={fmt(TOTALS.totalRequested)}
          icon={<TrendingUp className="size-4" />}
          sub="Total pedido pelos clientes"
        />
        <KpiCard
          title="Taxa de Realização"
          value={fmtPct(TOTALS.fulfillmentRate)}
          icon={<Target className="size-4" />}
          accent={rateAccent}
          className={
            rateColor === 'success' ? 'border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20' :
            rateColor === 'warning' ? 'border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20' :
            'border-red-500/20 bg-red-50/50 dark:bg-red-950/20'
          }
        />
        <KpiCard
          title="Pedidos"
          value={fmtN(TOTALS.totalOrders)}
          icon={<ShoppingCart className="size-4" />}
          sub={`${TOTALS.pendingOrders} pendentes`}
        />
      </div>

      {/* Row 2 — KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Ticket Médio"
          value={fmt(TOTALS.avgTicket)}
          icon={<Receipt className="size-4" />}
          trend={5.2}
        />
        <KpiCard
          title="Clientes Ativos"
          value={fmtN(TOTALS.activeCustomers)}
          icon={<Users className="size-4" />}
          sub={`${TOTALS.newCustomers} novos este mês`}
        />
        <KpiCard
          title="Conversão"
          value={fmtPct(TOTALS.conversionRate)}
          icon={<UserCheck className="size-4" />}
          sub="Cadastro → 1ª compra"
        />
        <KpiCard
          title="Taxa de Recompra"
          value={fmtPct(TOTALS.repeatRate)}
          icon={<RefreshCw className="size-4" />}
          sub="Compraram 2x ou mais"
        />
      </div>

      {/* Gap comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitado vs Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <p className="text-xs text-muted-foreground mb-1">Solicitado</p>
              <p className="text-3xl font-bold text-foreground">{fmt(TOTALS.totalRequested)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total pedido</p>
            </div>
            <div className="flex flex-col items-center px-4 shrink-0">
              <p className="text-xl font-bold text-destructive">−{fmt(gap)}</p>
              <p className="text-xs text-muted-foreground whitespace-nowrap">gap de R$ {gap.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="flex-1 min-w-[140px] text-right">
              <p className="text-xs text-muted-foreground mb-1">Realizado</p>
              <p className="text-3xl font-bold text-emerald-600">{fmt(TOTALS.totalFulfilled)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Efetivamente atendido</p>
            </div>
          </div>
          <GapBar requested={TOTALS.totalRequested} fulfilled={TOTALS.totalFulfilled} />
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tendência de Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={last7} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillFul" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => currencyTooltipFormatter(value as number)} />
                <Legend />
                <Area type="monotone" dataKey="requested" name="Solicitado" stroke="#6366f1" fill="url(#fillReq)" strokeWidth={2} />
                <Area type="monotone" dataKey="fulfilled" name="Realizado" stroke="#10b981" fill="url(#fillFul)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Novos vs Recorrentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={last6} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="newCustomers" name="Novos" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="returningCustomers" name="Recorrentes" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch gap-0 flex-wrap">
            {FUNNEL.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-border bg-muted/40 min-w-[100px] text-center">
                  <span className="text-2xl font-bold" style={{ color: step.color }}>{step.value}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{step.label}</span>
                  {step.pct && (
                    <span className="text-xs font-semibold mt-0.5" style={{ color: step.color }}>{step.pct}</span>
                  )}
                </div>
                {i < FUNNEL.length - 1 && (
                  <svg className="shrink-0 mx-1 text-muted-foreground" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
