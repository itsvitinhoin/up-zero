'use client'

import { UserCheck, ShoppingBag, CheckCircle2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge-2'
import { KpiCard, SectionHeader, StatsRow } from '@/components/dashboard/shared'
import { useDashboardData } from '@/contexts/dashboard-data'

export default function DashboardSalesFunnel() {
  const { funnelData: FUNNEL_DATA } = useDashboardData()
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Funil de Conversão"
        description="Análise do ciclo de vida dos clientes — do cadastro à recompra"
      />

      {/* Top KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Cadastros Aprovados"
          value="25"
          icon={<UserCheck className="size-4" />}
          accent
        />
        <KpiCard
          title="Realizaram 1º Pedido"
          value="22"
          sub="88% dos cadastros"
          icon={<ShoppingBag className="size-4" />}
        />
        <KpiCard
          title="Pedido Realizado"
          value="19"
          sub="76% dos cadastros"
          icon={<CheckCircle2 className="size-4" />}
        />
        <KpiCard
          title="Recompra (2x+)"
          value="14"
          sub="56% dos cadastros"
          icon={<RefreshCw className="size-4" />}
        />
      </div>

      {/* Main funnel visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Funil Visual de Conversão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {FUNNEL_DATA.map((stage, idx) => {
            const prev = idx > 0 ? FUNNEL_DATA[idx - 1] : null
            const dropOff = prev ? prev.value - stage.value : 0
            const dropOffPct = prev ? ((prev.value - stage.value) / prev.value * 100).toFixed(0) : '0'

            return (
              <div key={stage.label} className="space-y-1.5">
                {idx > 0 && dropOff > 0 && (
                  <div className="flex items-center gap-2 pl-4">
                    <span className="text-xs text-destructive font-medium">
                      -{dropOff} clientes (-{dropOffPct}%)
                    </span>
                  </div>
                )}
                <div className="relative" style={{ paddingLeft: `${idx * 4}%`, paddingRight: `${idx * 4}%` }}>
                  <div
                    className="relative h-12 rounded-lg flex items-center justify-between px-4 transition-all"
                    style={{ backgroundColor: stage.color }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-lg">{stage.value}</span>
                      <span className="text-white/90 text-sm font-medium">{stage.label}</span>
                    </div>
                    <span className="text-white/90 text-xs font-bold bg-white/20 rounded px-2 py-0.5 shrink-0">
                      {stage.pct}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Conversion metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Velocidade de Conversão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatsRow label="Dias médios para 1ª compra" value="13.8 dias" />
            <StatsRow label="Estado com maior conversão" value="SP" sub="94%" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Qualidade dos Pedidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatsRow label="Taxa de atendimento" value="86.4%" />
            <StatsRow label="Em risco de churn (90d)" value="5 clientes" />
            <StatsRow label="Oportunidade reengajamento" value="3 clientes" sub="At Risk" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversão por Etapa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatsRow label="Cadastro → 1º Pedido" value="88%" />
            <StatsRow label="1º Pedido → Atendido" value="86%" />
            <StatsRow label="1x → 2x ou mais" value="64%" />
            <StatsRow label="2x → 3x ou mais" value="64%" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
