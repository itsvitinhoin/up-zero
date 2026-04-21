'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives used across all dashboard sections
// ─────────────────────────────────────────────────────────────────────────────

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge-2'
import type { DOrderStatus, DCurve, DRFMSegment } from '@/lib/dashboard-mock-data'

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string
  value: string
  sub?: string
  trend?: number // positive = up, negative = down, null = neutral
  trendLabel?: string
  icon?: React.ReactNode
  accent?: boolean
  className?: string
  children?: React.ReactNode
}

export function KpiCard({ title, value, sub, trend, trendLabel, icon, accent, className, children }: KpiCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4 flex flex-col gap-2.5 shadow-xs',
      accent && 'border-primary/20 bg-primary/5',
      className
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium truncate">{title}</span>
        {icon && <span className="text-muted-foreground/60 shrink-0">{icon}</span>}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tracking-tight leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      {trend !== undefined && trend !== null && (
        <div className="flex items-center gap-1.5">
          {trend > 0 ? (
            <Badge variant="success" appearance="light" size="sm">
              <TrendingUp className="size-3" />{trendLabel ?? `+${trend.toFixed(1)}%`}
            </Badge>
          ) : trend < 0 ? (
            <Badge variant="destructive" appearance="light" size="sm">
              <TrendingDown className="size-3" />{trendLabel ?? `${trend.toFixed(1)}%`}
            </Badge>
          ) : (
            <Badge variant="secondary" appearance="light" size="sm">
              <Minus className="size-3" />{trendLabel ?? 'Estável'}
            </Badge>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Gap Bar ───────────────────────────────────────────────────────────────────
interface GapBarProps {
  requested: number
  fulfilled: number
  className?: string
}

export function GapBar({ requested, fulfilled, className }: GapBarProps) {
  const pct = requested > 0 ? (fulfilled / requested) * 100 : 0
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Taxa de realização</span>
        <span className="font-semibold text-foreground">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function SectionHeader({ title, description, children }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: DOrderStatus }) {
  const map: Record<DOrderStatus, { variant: 'warning' | 'info' | 'success' | 'destructive' | 'secondary' | 'primary'; label: string }> = {
    PENDING:    { variant: 'warning',     label: 'Pendente' },
    CONFIRMED:  { variant: 'info',        label: 'Confirmado' },
    PROCESSING: { variant: 'info',        label: 'Processando' },
    INVOICED:   { variant: 'primary',     label: 'Faturado' },
    SHIPPED:    { variant: 'primary',     label: 'Enviado' },
    DELIVERED:  { variant: 'success',     label: 'Entregue' },
    CANCELLED:  { variant: 'destructive', label: 'Cancelado' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant} appearance="light" size="sm">{label}</Badge>
}

// ── Curve Badge ───────────────────────────────────────────────────────────────
export function CurveBadge({ curve }: { curve: DCurve }) {
  const map: Record<DCurve, 'success' | 'warning' | 'secondary'> = { A: 'success', B: 'warning', C: 'secondary' }
  return <Badge variant={map[curve]} appearance="light" size="sm">Curva {curve}</Badge>
}

// ── RFM Badge ─────────────────────────────────────────────────────────────────
export function RfmBadge({ segment }: { segment: DRFMSegment }) {
  const map: Record<DRFMSegment, 'success' | 'primary' | 'info' | 'warning' | 'destructive'> = {
    Champions: 'success', Loyal: 'primary', Promising: 'info', 'At Risk': 'warning', Lost: 'destructive',
  }
  return <Badge variant={map[segment]} appearance="light" size="sm">{segment}</Badge>
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ message = 'Nenhum dado encontrado' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

// ── Stats Row ─────────────────────────────────────────────────────────────────
interface StatsRowProps {
  label: string
  value: string
  sub?: string
}

export function StatsRow({ label, value, sub }: StatsRowProps) {
  return (
    <div className="p-2.5 bg-muted/60 flex items-center justify-between rounded-lg">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-foreground">{value}</span>
        {sub && <span className="text-xs text-muted-foreground ml-1.5">{sub}</span>}
      </div>
    </div>
  )
}

// ── Tooltip formatter ─────────────────────────────────────────────────────────
export function currencyTooltipFormatter(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}
