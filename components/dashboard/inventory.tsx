'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge-2'
import { KpiCard, SectionHeader, CurveBadge, currencyTooltipFormatter } from '@/components/dashboard/shared'
import { fmt, fmtN, type DCurve } from '@/lib/dashboard-mock-data'
import { useDashboardData } from '@/contexts/dashboard-data'

const CURVE_COLORS_HEX: Record<DCurve, string> = { A: '#10b981', B: '#f59e0b', C: '#94a3b8' }

function AlertBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft <= 7) return <Badge variant="destructive" appearance="light" size="sm">Crítico</Badge>
  if (daysLeft <= 20) return <Badge variant="warning" appearance="light" size="sm">Baixo</Badge>
  if (daysLeft <= 60) return <Badge variant="success" appearance="light" size="sm">OK</Badge>
  return <Badge variant="secondary" appearance="light" size="sm">Excesso</Badge>
}

export default function DashboardInventory() {
  const { products: DASHBOARD_PRODUCTS } = useDashboardData()
  const critical = DASHBOARD_PRODUCTS.filter(p => p.daysLeft <= 7)
  const lowStock = DASHBOARD_PRODUCTS.filter(p => p.daysLeft > 7 && p.daysLeft <= 20)
  const excess = DASHBOARD_PRODUCTS.filter(p => p.daysLeft > 60)

  const sorted = [...DASHBOARD_PRODUCTS].sort((a, b) => a.daysLeft - b.daysLeft)

  // ABC curve analysis
  const totalRevenue = DASHBOARD_PRODUCTS.reduce((s, p) => s + p.revenueFulfilled, 0)
  const curveGroups: Record<DCurve, typeof DASHBOARD_PRODUCTS> = { A: [], B: [], C: [] }
  for (const p of DASHBOARD_PRODUCTS) curveGroups[p.curve].push(p)
  const curveRevenue = (curve: DCurve) =>
    curveGroups[curve].reduce((s, p) => s + p.revenueFulfilled, 0)
  const curvePct = (curve: DCurve) =>
    totalRevenue > 0 ? (curveRevenue(curve) / totalRevenue) * 100 : 0

  const curveChartData = (['A', 'B', 'C'] as DCurve[]).map(c => ({
    curve: `Curva ${c}`,
    value: curveRevenue(c),
    c,
  }))

  // Top 5 products for size matrix
  const top5 = [...DASHBOARD_PRODUCTS]
    .sort((a, b) => b.revenueFulfilled - a.revenueFulfilled)
    .slice(0, 5)
  const allSizes = Array.from(new Set(top5.flatMap(p => p.sizes.map(s => s.size))))
  const sizeOrder = ['P', 'M', 'G', 'GG', '36', '38', '40', '42']
  const orderedSizes = sizeOrder.filter(s => allSizes.includes(s))

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Inteligência de Estoque"
        description="Alertas de reposição, análise ABC e distribuição de estoque"
      />

      {/* Alert Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Críticos (≤ 7 dias)"
          value={String(critical.length)}
          className="border-red-200 bg-red-50/50"
        >
          {critical.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {critical.map(p => (
                <li key={p.id} className="text-xs text-red-700 truncate">• {p.name}</li>
              ))}
            </ul>
          )}
        </KpiCard>

        <KpiCard
          title="Baixo Estoque (8-20 dias)"
          value={String(lowStock.length)}
          className="border-amber-200 bg-amber-50/50"
        />

        <KpiCard
          title="Excesso (> 60 dias)"
          value={String(excess.length)}
          className="border-blue-200 bg-blue-50/50"
        />
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tabela de Estoque — Ordenada por Urgência</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Estoque Atual</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Venda/Dia</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Dias Rest.</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Alerta</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Curva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map(p => {
                  const daysClass =
                    p.daysLeft <= 7
                      ? 'bg-red-50 text-red-700 font-bold'
                      : p.daysLeft <= 20
                        ? 'bg-amber-50 text-amber-700'
                        : p.daysLeft <= 60
                          ? 'bg-green-50 text-green-700'
                          : 'text-muted-foreground'
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.category}</td>
                      <td className="px-4 py-3 text-right">{fmtN(p.stock)}</td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">{p.dailySales}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${daysClass}`}>
                          {p.daysLeft}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center"><AlertBadge daysLeft={p.daysLeft} /></td>
                      <td className="px-4 py-3 text-center"><CurveBadge curve={p.curve} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ABC Curve Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Análise de Curva ABC</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['A', 'B', 'C'] as DCurve[]).map(curve => (
              <div key={curve} className="space-y-3">
                <div className="flex items-center justify-between">
                  <CurveBadge curve={curve} />
                  <span className="text-sm font-semibold text-foreground">{curvePct(curve).toFixed(1)}% da receita</span>
                </div>
                <p className="text-xs text-muted-foreground">{curveGroups[curve].length} produto(s) — {fmt(curveRevenue(curve), true)}</p>
                <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {curveGroups[curve].map(p => (
                    <li key={p.id} className="text-xs flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                      <span className="text-foreground truncate">{p.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {totalRevenue > 0 ? ((p.revenueFulfilled / totalRevenue) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={curveChartData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="curve" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmt(v, true)} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  formatter={(v) => currencyTooltipFormatter(v as number)}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {curveChartData.map((entry, i) => (
                    <Cell key={i} fill={CURVE_COLORS_HEX[entry.c]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Size × Stock Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Matriz Tamanho × Estoque (Top 5 Produtos)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Produto</th>
                  {orderedSizes.map(s => (
                    <th key={s} className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {top5.map(p => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                    {orderedSizes.map(s => {
                      const entry = p.sizes.find(sz => sz.size === s)
                      return (
                        <td key={s} className="px-4 py-3 text-center text-xs">
                          {entry ? (
                            <span className="font-medium text-foreground">{entry.units}</span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
