'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { MapPin, Star, Building2, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard, SectionHeader, currencyTooltipFormatter } from '@/components/dashboard/shared'
import { fmt, fmtPct } from '@/lib/dashboard-mock-data'
import { useDashboardData } from '@/contexts/dashboard-data'

export default function DashboardGeographic() {
  const { geoData: GEO_DATA } = useDashboardData()

  const sortedStates = [...GEO_DATA].sort((a, b) => b.requested - a.requested)
  const maxRequested = sortedStates[0]?.requested ?? 1
  const topState     = sortedStates[0]

  const allCities = GEO_DATA.flatMap(g =>
    g.cities.map(c => ({ ...c, stateCode: g.stateCode }))
  ).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  const topCity = allCities[0]

  const totalRequested = GEO_DATA.reduce((s, g) => s + g.requested, 0)
  const spEntry = GEO_DATA.find(g => g.stateCode === 'SP')
  const spPct   = spEntry && totalRequested > 0 ? (spEntry.requested / totalRequested) * 100 : 0

  const top8 = sortedStates.slice(0, 8)

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Distribuição Geográfica"
        description="Análise de clientes e receita por estado e cidade"
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Estados Atendidos"
          value={String(GEO_DATA.length)}
          sub="regiões com clientes ativos"
          icon={<MapPin className="size-4" />}
        />
        <KpiCard
          title="Estado Top"
          value={topState?.stateCode ?? '—'}
          sub={topState ? fmt(topState.requested) + ' solicitado' : ''}
          icon={<Star className="size-4" />}
          accent
        />
        <KpiCard
          title="Cidade Top"
          value={topCity?.city ?? '—'}
          sub={topCity ? fmt(topCity.revenue) + ' receita' : ''}
          icon={<Building2 className="size-4" />}
        />
        <KpiCard
          title="Concentração SP"
          value={fmtPct(spPct)}
          sub="da receita total solicitada"
          icon={<TrendingUp className="size-4" />}
        />
      </div>

      {/* Top states table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Estados por Receita Solicitada</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">UF</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Clientes</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Pedidos</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Solicitado</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Realizado</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Realização %</th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Volume</th>
                </tr>
              </thead>
              <tbody>
                {sortedStates.map((g, i) => {
                  const rate = g.requested > 0 ? (g.fulfilled / g.requested) * 100 : 0
                  const barW = (g.requested / maxRequested) * 100
                  return (
                    <tr
                      key={g.stateCode}
                      className={[
                        'border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
                        i % 2 === 0 ? '' : 'bg-muted/10',
                      ].join(' ')}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">{g.state}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-semibold">{g.stateCode}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{g.customers}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{g.orders}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(g.requested)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{fmt(g.fulfilled)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{rate.toFixed(1)}%</td>
                      <td className="px-5 py-3 min-w-[100px]">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${barW}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top cities + chart + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top cities table */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top 10 Cidades</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-2.5 text-left font-medium text-muted-foreground">Cidade</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">UF</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Cli.</th>
                  <th className="px-5 py-2.5 text-right font-medium text-muted-foreground">Receita</th>
                </tr>
              </thead>
              <tbody>
                {allCities.map((c, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-2.5 font-medium text-foreground text-xs">{c.city}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{c.stateCode}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">{c.customers}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-xs font-medium">{fmt(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Regional bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Receita Solicitada por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={top8} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="geoGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis type="category" dataKey="stateCode" tick={{ fontSize: 11 }} width={28} />
                <Tooltip formatter={(v) => currencyTooltipFormatter(v as number)} />
                <Bar dataKey="requested" fill="url(#geoGradient)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Geographic insights — dynamic */}
      {sortedStates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Insights Geográficos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {sortedStates.slice(0, 4).map((g, i) => {
                const COLORS = [
                  { color: '#6366f1', bg: '#eef2ff' },
                  { color: '#f59e0b', bg: '#fffbeb' },
                  { color: '#10b981', bg: '#d1fae5' },
                  { color: '#a855f7', bg: '#f3e8ff' },
                ]
                const { color, bg } = COLORS[i]
                const rate  = g.requested > 0 ? ((g.fulfilled / g.requested) * 100).toFixed(0) : '0'
                const share = totalRequested > 0 ? ((g.requested / totalRequested) * 100).toFixed(0) : '0'
                const topCity = g.cities[0]
                return (
                  <div key={g.stateCode} className="rounded-xl p-4 border" style={{ backgroundColor: bg, borderColor: color + '40' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs font-semibold text-foreground">{g.stateCode} — {g.state}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {g.customers} cliente{g.customers !== 1 ? 's' : ''}, {g.orders} pedido{g.orders !== 1 ? 's' : ''}.
                      {' '}{share}% da receita total. Taxa de realização {rate}%.
                      {topCity ? ` Cidade top: ${topCity.city}.` : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
