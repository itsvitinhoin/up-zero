'use client'

import { Target, TrendingUp, Share2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge-2'
import { SectionHeader } from '@/components/dashboard/shared'
import { fmt } from '@/lib/dashboard-mock-data'
import { useDashboardData } from '@/contexts/dashboard-data'

const PLACEHOLDER_CARDS_BASE = [
  {
    id: 'cac',
    icon: Target,
    title: 'CAC',
    subtitle: 'Custo de Aquisição',
    value: 'R$ 0,00',
    description: 'Custo total de marketing / novos clientes',
    available: false,
  },
  {
    id: 'roas',
    icon: TrendingUp,
    title: 'ROAS',
    subtitle: 'Retorno sobre Ad Spend',
    value: '0.0x',
    description: 'Receita gerada / investimento em mídia',
    available: false,
  },
  {
    id: 'attribution',
    icon: Share2,
    title: 'Atribuição',
    subtitle: 'Marketing Attribution',
    value: '—',
    description: 'Origem dos clientes por canal de mídia',
    available: false,
  },
  {
    id: 'ltv',
    icon: Users,
    title: 'LTV',
    subtitle: 'Lifetime Value',
    value: null as string | null,
    description: 'Receita média por cliente ao longo do tempo',
    available: true,
  },
]

const INTEGRATION_ROWS = [
  { metric: 'CAC',        status: 'Em breve',     source: 'Google Ads / Meta',  priority: 'Alta',  available: false },
  { metric: 'ROAS',       status: 'Em breve',     source: 'Google Ads / Meta',  priority: 'Alta',  available: false },
  { metric: 'Attribution',status: 'Em breve',     source: 'UTM Parameters',     priority: 'Média', available: false },
  { metric: 'LTV',        status: '✅ Disponível', source: 'Pedidos internos',   priority: '—',     available: true  },
  { metric: 'Churn Rate', status: 'Em breve',     source: 'CRM',                priority: 'Média', available: false },
  { metric: 'Media ROI',  status: 'Em breve',     source: 'Meta Ads',           priority: 'Alta',  available: false },
]

export default function DashboardFutureMetrics() {
  const { customers } = useDashboardData()
  const avgLTV = customers.length > 0
    ? customers.reduce((s, c) => s + c.totalRevenue, 0) / customers.length
    : 0
  const PLACEHOLDER_CARDS = PLACEHOLDER_CARDS_BASE.map(c =>
    c.id === 'ltv' ? { ...c, value: fmt(avgLTV) } : c
  )

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Métricas de Marketing"
        description="Estrutura preparada para integração futura de dados de marketing e aquisição."
      />

      {/* Placeholder metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLACEHOLDER_CARDS.map(card => {
          const Icon = card.icon
          return (
            <div
              key={card.id}
              className={[
                'rounded-xl border-2 border-dashed p-4 flex flex-col gap-3',
                card.available
                  ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-border bg-muted/30',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={[
                    'rounded-lg p-2',
                    card.available ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground/50',
                  ].join(' ')}>
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-none">{card.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
                  </div>
                </div>
                {card.available ? (
                  <Badge variant="success" appearance="light" size="sm">Disponível</Badge>
                ) : (
                  <Badge variant="secondary" appearance="light" size="sm">Em breve</Badge>
                )}
              </div>
              <div>
                <p className={[
                  'text-2xl font-bold leading-none',
                  card.available ? 'text-foreground' : 'text-muted-foreground/40',
                ].join(' ')}>
                  {card.value}
                </p>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{card.description}</p>
            </div>
          )
        })}
      </div>

      {/* Placeholder charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          {
            title: 'Performance por Canal',
            bars: [70, 45, 85, 30, 60],
            labels: ['Google', 'Meta', 'Direct', 'Email', 'Organic'],
          },
          {
            title: 'Eficiência por Região',
            bars: [90, 55, 40, 75, 65, 35],
            labels: ['SP', 'RJ', 'MG', 'RS', 'PR', 'DF'],
          },
        ].map(chart => (
          <Card
            key={chart.title}
            className="border-2 border-dashed border-border relative overflow-hidden"
          >
            <CardHeader>
              <CardTitle className="text-muted-foreground/60">{chart.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Blurred fake bar chart */}
              <div className="h-[140px] flex items-end gap-3 px-2 blur-[3px] select-none pointer-events-none">
                {chart.bars.map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-t-md bg-indigo-200 dark:bg-indigo-900"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground">{chart.labels[i]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            {/* Em breve overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2 text-center">
                <Badge variant="secondary" appearance="light">Em breve</Badge>
                <p className="text-xs text-muted-foreground">
                  Disponível após integração com plataformas de mídia
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Integration status */}
      <Card>
        <CardHeader>
          <CardTitle>Status de Integração</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Métrica</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fonte de Dados</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {INTEGRATION_ROWS.map((row, i) => (
                  <tr
                    key={row.metric}
                    className={[
                      'border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
                      i % 2 === 0 ? '' : 'bg-muted/10',
                    ].join(' ')}
                  >
                    <td className="px-5 py-3 font-medium text-foreground">{row.metric}</td>
                    <td className="px-4 py-3">
                      {row.available ? (
                        <Badge variant="success" appearance="light" size="sm">{row.status}</Badge>
                      ) : (
                        <Badge variant="secondary" appearance="light" size="sm">{row.status}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.source}</td>
                    <td className="px-4 py-3">
                      {row.priority === 'Alta' ? (
                        <Badge variant="destructive" appearance="light" size="sm">Alta</Badge>
                      ) : row.priority === 'Média' ? (
                        <Badge variant="warning" appearance="light" size="sm">Média</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
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
