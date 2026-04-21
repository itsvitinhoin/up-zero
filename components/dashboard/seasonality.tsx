'use client'

import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { SectionHeader, currencyTooltipFormatter } from '@/components/dashboard/shared'
import { fmt } from '@/lib/dashboard-mock-data'
import { useDashboardData } from '@/contexts/dashboard-data'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Quarterly aggregation
const QUARTERLY = [
  { month: 'Q1 (Jan–Mar)', requested: 287400, fulfilled: 245400, orders: 97 },
  { month: 'Q2 (Abr–Jun)', requested: 258400, fulfilled: 231300, orders: 91 },
  { month: 'Q3 (Jul–Set)', requested: 261900, fulfilled: 222600, orders: 86 },
  { month: 'Q4 (Out–Dez)', requested: 293700, fulfilled: 250400, orders: 96 },
]

export default function DashboardSeasonality() {
  const [view, setView] = useState<'monthly' | 'quarterly'>('monthly')
  const { monthlyRevenue: MONTHLY_REVENUE, seasonalityByCategory: SEASONALITY_BY_CATEGORY, seasonalityOrdersByMonth: SEASONALITY_ORDERS_BY_MONTH } = useDashboardData()

  const allValues = SEASONALITY_BY_CATEGORY.flatMap(row =>
    MONTHS.map(m => row[m])
  )
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1

  const avgOrders =
    SEASONALITY_ORDERS_BY_MONTH.length > 0
      ? SEASONALITY_ORDERS_BY_MONTH.reduce((s, d) => s + d.orders, 0) / SEASONALITY_ORDERS_BY_MONTH.length
      : 0

  const chartData = view === 'monthly' ? MONTHLY_REVENUE : QUARTERLY

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sazonalidade & Tendências"
        description="Análise de padrões sazonais e tendências ao longo do ano"
      />

      {/* Main trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência de Receita</CardTitle>
          <CardToolbar>
            {(['monthly', 'quarterly'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
                  view === v
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
                ].join(' ')}
              >
                {v === 'monthly' ? 'Mensal' : 'Trimestral'}
              </button>
            ))}
          </CardToolbar>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradFul" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => currencyTooltipFormatter(v as number)} />
              <Legend />
              <Area type="monotone" dataKey="requested" name="Solicitado" stroke="#6366f1" fill="url(#gradReq)" strokeWidth={2} />
              <Area type="monotone" dataKey="fulfilled" name="Realizado" stroke="#10b981" fill="url(#gradFul)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Orders by month bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={SEASONALITY_ORDERS_BY_MONTH} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine
                y={avgOrders}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: `Média ${avgOrders.toFixed(0)}`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
              />
              <Bar dataKey="orders" name="Pedidos" radius={[4, 4, 0, 0]}>
                {SEASONALITY_ORDERS_BY_MONTH.map((d, i) => (
                  <Cell key={i} fill={d.orders > 38 ? '#f59e0b' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            Meses em <span className="font-semibold text-amber-500">amarelo</span> acima de 38 pedidos (destaque sazonal).
            Linha pontilhada = média anual.
          </p>
        </CardContent>
      </Card>

      {/* Category seasonality heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Sazonalidade por Categoria</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground sticky left-0 bg-muted/40 z-10 min-w-[110px]">
                    Categoria
                  </th>
                  {MONTH_LABELS.map(m => (
                    <th key={m} className="px-3 py-3 text-center font-medium text-muted-foreground min-w-[48px]">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEASONALITY_BY_CATEGORY.map(row => (
                  <tr key={row.category} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 font-medium text-foreground sticky left-0 bg-card z-10">
                      {row.category}
                    </td>
                    {MONTHS.map((m, mi) => {
                      const val = row[m]
                      const intensity = Math.round((val / maxVal) * 100)
                      // Map to opacity classes: low = 10, high = 90
                      const opacity = Math.max(0.08, (intensity / 100) * 0.9)
                      return (
                        <td key={mi} className="px-3 py-2.5 text-center">
                          <div
                            className="rounded-md px-1 py-1 text-xs font-semibold mx-auto w-10"
                            style={{
                              backgroundColor: `rgba(99,102,241,${opacity})`,
                              color: opacity > 0.5 ? '#fff' : 'var(--foreground)',
                            }}
                          >
                            {val}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
            Valores representam índice de demanda relativo. Azul mais escuro = maior demanda.
          </p>
        </CardContent>
      </Card>

      {/* Seasonal insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Pico de Verão (Dez–Jan)',
            value: '+22%',
            desc: 'Receita 22% acima da média nos meses de verão. Vestidos e Blusas lideram.',
            color: '#f59e0b',
            bg: '#fffbeb',
          },
          {
            label: 'Baixa de Inverno (Jun–Jul)',
            value: '−18%',
            desc: 'Pedidos 18% abaixo da média. Blazers mantêm performance melhor que outras categorias.',
            color: '#6366f1',
            bg: '#eef2ff',
          },
          {
            label: 'Melhor mês — Dezembro',
            value: fmt(118000),
            desc: '44 pedidos e R$ 118k solicitado. Maior volume do ano impulsionado por festas.',
            color: '#10b981',
            bg: '#d1fae5',
          },
        ].map(ins => (
          <Card
            key={ins.label}
            className="border-2"
            style={{ borderColor: ins.color + '40', backgroundColor: ins.bg }}
          >
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: ins.color }} />
                <span className="text-xs font-semibold text-foreground">{ins.label}</span>
              </div>
              <p className="text-2xl font-bold mb-2" style={{ color: ins.color }}>{ins.value}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{ins.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
