'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { Globe, MousePointerClick, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge-2'
import { KpiCard, SectionHeader, currencyTooltipFormatter } from '@/components/dashboard/shared'

// ── Static traffic mock data (replace with GA4 / UTM backend integration) ─────

const UTM_SOURCES = [
  { source: 'instagram',  medium: 'social',   sessions: 1240, conversions: 87, revenue: 28400 },
  { source: 'google',     medium: 'cpc',      sessions: 980,  conversions: 64, revenue: 22100 },
  { source: 'whatsapp',   medium: 'direct',   sessions: 760,  conversions: 91, revenue: 31200 },
  { source: 'email',      medium: 'email',    sessions: 540,  conversions: 53, revenue: 18700 },
  { source: 'facebook',   medium: 'social',   sessions: 430,  conversions: 28, revenue: 9600  },
  { source: 'organic',    medium: 'organic',  sessions: 380,  conversions: 19, revenue: 6500  },
  { source: 'referral',   medium: 'referral', sessions: 210,  conversions: 12, revenue: 4100  },
]

const CHANNEL_COLORS: Record<string, string> = {
  social:   '#6366f1',
  cpc:      '#f59e0b',
  direct:   '#10b981',
  email:    '#3b82f6',
  organic:  '#8b5cf6',
  referral: '#ec4899',
}

const CAMPAIGNS = [
  { name: 'Verão 2026 — Instagram',    source: 'instagram', clicks: 3200, conversions: 54, cpa: 280, revenue: 15120 },
  { name: 'Google Brand',              source: 'google',    clicks: 1800, conversions: 41, cpa: 190, revenue: 7790  },
  { name: 'Black Friday Reativação',   source: 'email',     clicks: 2100, conversions: 38, cpa: 160, revenue: 10640 },
  { name: 'Lançamento Coleção Rosa',   source: 'instagram', clicks: 2700, conversions: 33, cpa: 310, revenue: 10230 },
  { name: 'Remarketing Carrinho',      source: 'google',    clicks: 980,  conversions: 23, cpa: 210, revenue: 4830  },
  { name: 'Newsletter Semanal',        source: 'email',     clicks: 1400, conversions: 15, cpa: 140, revenue: 4200  },
]

const MONTHLY_SESSIONS = [
  { month: 'Out/25', sessions: 2800, conversions: 210 },
  { month: 'Nov/25', sessions: 3100, conversions: 238 },
  { month: 'Dez/25', sessions: 4200, conversions: 344 },
  { month: 'Jan/26', sessions: 2950, conversions: 218 },
  { month: 'Fev/26', sessions: 3400, conversions: 271 },
  { month: 'Mar/26', sessions: 3800, conversions: 306 },
  { month: 'Abr/26', sessions: 4100, conversions: 354 },
]

// ── Derived ────────────────────────────────────────────────────────────────────

const totalSessions   = UTM_SOURCES.reduce((s, r) => s + r.sessions, 0)
const totalConversions = UTM_SOURCES.reduce((s, r) => s + r.conversions, 0)
const totalRevenue    = UTM_SOURCES.reduce((s, r) => s + r.revenue, 0)
const convRate        = totalSessions > 0 ? ((totalConversions / totalSessions) * 100).toFixed(1) : '0'

const channelBreakdown = Object.entries(
  UTM_SOURCES.reduce<Record<string, { sessions: number; revenue: number }>>((acc, r) => {
    if (!acc[r.medium]) acc[r.medium] = { sessions: 0, revenue: 0 }
    acc[r.medium].sessions += r.sessions
    acc[r.medium].revenue  += r.revenue
    return acc
  }, {})
).map(([medium, d]) => ({ medium, ...d, color: CHANNEL_COLORS[medium] ?? '#94a3b8' }))
  .sort((a, b) => b.revenue - a.revenue)

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)

// ── Component ──────────────────────────────────────────────────────────────────

export default function DashboardTraffic() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tráfego & Aquisição"
        description="Sessões, conversões e receita por fonte de tráfego e campanha UTM"
      >
        <Badge variant="secondary" appearance="light" size="sm">Dados de exemplo — conecte GA4 ou UTM backend</Badge>
      </SectionHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Sessões Totais"
          value={new Intl.NumberFormat('pt-BR').format(totalSessions)}
          sub="últimos 30 dias"
          icon={<Globe className="size-4" />}
          accent
        />
        <KpiCard
          title="Conversões"
          value={String(totalConversions)}
          sub="visitantes → pedido"
          icon={<MousePointerClick className="size-4" />}
        />
        <KpiCard
          title="Taxa de Conversão"
          value={`${convRate}%`}
          sub="sessões convertidas"
          icon={<TrendingUp className="size-4" />}
        />
        <KpiCard
          title="Receita por Canal"
          value={fmtBRL(totalRevenue)}
          sub="atribuída a UTM"
          icon={<Users className="size-4" />}
        />
      </div>

      {/* Sessions trend + channel pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sessões & Conversões por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={MONTHLY_SESSIONS} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sessions"    name="Sessões"    stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="conversions" name="Conversões" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receita por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={channelBreakdown}
                  dataKey="revenue"
                  nameKey="medium"
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {channelBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => currencyTooltipFormatter(v as number)} />
                <Legend formatter={(v) => v} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* UTM Sources table + bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sources table */}
        <Card>
          <CardHeader>
            <CardTitle>Fontes de Tráfego (UTM Source)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fonte</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Mídia</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Sessões</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Conv.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Tx. Conv.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {UTM_SOURCES.map(r => {
                  const rate = r.sessions > 0 ? ((r.conversions / r.sessions) * 100).toFixed(1) : '0'
                  const dot  = CHANNEL_COLORS[r.medium] ?? '#94a3b8'
                  return (
                    <tr key={r.source} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground capitalize">{r.source}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                          {r.medium}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.sessions.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.conversions}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">{rate}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmtBRL(r.revenue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Revenue by source bar */}
        <Card>
          <CardHeader>
            <CardTitle>Receita por Fonte</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={UTM_SOURCES.slice().sort((a, b) => b.revenue - a.revenue)}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => currencyTooltipFormatter(v as number)} />
                <Bar dataKey="revenue" name="Receita" radius={[0, 4, 4, 0]}>
                  {UTM_SOURCES.slice().sort((a, b) => b.revenue - a.revenue).map((entry, i) => (
                    <Cell key={i} fill={CHANNEL_COLORS[entry.medium] ?? '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns table */}
      <Card>
        <CardHeader>
          <CardTitle>Campanhas UTM</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Campanha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fonte</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Cliques</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Conversões</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">CPA</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Receita</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {CAMPAIGNS.map((c, i) => {
                  const roas = c.cpa > 0 ? (c.revenue / (c.cpa * c.conversions)).toFixed(1) : '—'
                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: CHANNEL_COLORS[c.source] ?? '#94a3b8' }} />
                          {c.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.clicks.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.conversions}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtBRL(c.cpa)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtBRL(c.revenue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={Number(roas) >= 3 ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                          {roas}x
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
