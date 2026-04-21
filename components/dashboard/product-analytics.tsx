'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { Button } from '@/components/ui/button-1'
import { KpiCard, SectionHeader, CurveBadge, currencyTooltipFormatter } from '@/components/dashboard/shared'
import { fmt, fmtN, type DCurve } from '@/lib/dashboard-mock-data'
import { useDashboardData } from '@/contexts/dashboard-data'

const CURVE_BAR_COLORS: Record<DCurve, string> = { A: '#10b981', B: '#f59e0b', C: '#94a3b8' }

export default function DashboardProductAnalytics() {
  const [sort, setSort] = useState<'revenue' | 'units'>('revenue')
  const { products: DASHBOARD_PRODUCTS } = useDashboardData()

  const totalRevenueRequested = DASHBOARD_PRODUCTS.reduce((s, p) => s + p.revenueRequested, 0)
  const totalRevenueFulfilled = DASHBOARD_PRODUCTS.reduce((s, p) => s + p.revenueFulfilled, 0)
  const totalUnitsFulfilled = DASHBOARD_PRODUCTS.reduce((s, p) => s + p.unitsFulfilled, 0)
  const activeCount = DASHBOARD_PRODUCTS.length

  // Top 8 by revenueFulfilled
  const topProducts = [...DASHBOARD_PRODUCTS]
    .sort((a, b) => b.revenueFulfilled - a.revenueFulfilled)
    .slice(0, 8)
    .map(p => ({
      name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
      fullName: p.name,
      value: p.revenueFulfilled,
      curve: p.curve,
    }))

  // Size distribution
  const sizeMap: Record<string, number> = {}
  for (const p of DASHBOARD_PRODUCTS) {
    for (const s of p.sizes) {
      sizeMap[s.size] = (sizeMap[s.size] ?? 0) + s.units
    }
  }
  const sizeOrder = ['P', 'M', 'G', 'GG', '36', '38', '40', '42']
  const sizeData = sizeOrder
    .filter(s => sizeMap[s] !== undefined)
    .map(s => ({ size: s, units: sizeMap[s] }))

  // Color distribution
  const colorMap: Record<string, { units: number; hex: string }> = {}
  for (const p of DASHBOARD_PRODUCTS) {
    for (const c of p.colors) {
      if (!colorMap[c.color]) colorMap[c.color] = { units: 0, hex: c.hex }
      colorMap[c.color].units += c.units
    }
  }
  const totalColorUnits = Object.values(colorMap).reduce((s, c) => s + c.units, 0)
  const colorData = Object.entries(colorMap)
    .sort((a, b) => b[1].units - a[1].units)
    .slice(0, 6)
    .map(([color, { units, hex }]) => ({ color, units, hex, pct: totalColorUnits > 0 ? (units / totalColorUnits) * 100 : 0 }))

  // Table sort
  const sorted = [...DASHBOARD_PRODUCTS].sort((a, b) =>
    sort === 'revenue' ? b.revenueFulfilled - a.revenueFulfilled : b.unitsFulfilled - a.unitsFulfilled
  )

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Análise de Produtos"
        description="Inteligência de produtos, receita e distribuição de estoque"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Produtos Ativos" value={fmtN(activeCount)} />
        <KpiCard title="Receita Realizada Total" value={fmt(totalRevenueFulfilled, true)} />
        <KpiCard title="Receita Solicitada Total" value={fmt(totalRevenueRequested, true)} />
        <KpiCard title="Unidades Vendidas" value={fmtN(totalUnitsFulfilled)} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Products Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top 8 Produtos por Receita Realizada</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                <XAxis
                  type="number"
                  tickFormatter={v => fmt(v, true)}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => currencyTooltipFormatter(v as number)}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {topProducts.map((entry, i) => (
                    <Cell key={i} fill={CURVE_BAR_COLORS[entry.curve as DCurve]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 justify-end">
              {(['A', 'B', 'C'] as DCurve[]).map(c => (
                <div key={c} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-sm inline-block" style={{ background: CURVE_BAR_COLORS[c] }} />
                  Curva {c}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Size Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tamanho</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sizeData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="size" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  formatter={(v) => fmtN(v as number)}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12 }}
                />
                <Bar dataKey="units" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Color Distribution */}
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Cores</p>
              {colorData.map(c => (
                <div key={c.color} className="flex items-center gap-2">
                  <span className="size-3 rounded-full shrink-0 border border-border/50" style={{ background: c.hex }} />
                  <span className="text-xs text-foreground flex-1 truncate">{c.color}</span>
                  <div className="flex items-center gap-2 w-28">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{c.pct.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance de Produtos</CardTitle>
          <CardToolbar>
            <Button
              variant={sort === 'revenue' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSort('revenue')}
            >
              Por Receita
            </Button>
            <Button
              variant={sort === 'units' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSort('units')}
            >
              Por Unidades
            </Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Solicitado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Realizado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Unidades</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Curva</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Taxa Realiz.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((p, i) => {
                  const taxa = p.revenueRequested > 0 ? (p.revenueFulfilled / p.revenueRequested) * 100 : 0
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.category}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmt(p.revenueRequested, true)}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(p.revenueFulfilled, true)}</td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">{fmtN(p.unitsFulfilled)}</td>
                      <td className="px-4 py-3 text-center"><CurveBadge curve={p.curve} /></td>
                      <td className="px-4 py-3 text-right">
                        <span className={taxa >= 80 ? 'text-emerald-700 font-semibold' : taxa >= 60 ? 'text-amber-700' : 'text-red-700'}>
                          {taxa.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
