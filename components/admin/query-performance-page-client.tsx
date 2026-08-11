'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Activity, Clock3, Database, Gauge, RefreshCcw, Sigma } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getQueryPerformanceSummaryAction, type QueryPerformanceRow, type QueryPerformanceSummary } from '@/lib/actions/query-performance'

interface QueryPerformancePageClientProps {
  initialData: QueryPerformanceSummary | null
}

function formatMs(value: number) {
  return `${value.toFixed(2)} ms`
}

function formatInt(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function compactSql(query: string) {
  return query.replace(/\s+/g, ' ').trim()
}

function formatShortNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return formatInt(value)
}

function RankingTable(props: {
  title: string
  rows: QueryPerformanceRow[]
  metricLabel: string
  metricValue: (row: QueryPerformanceRow) => string
}) {
  const { title, rows, metricLabel, metricValue } = props

  return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border/40 bg-muted/40 px-4 py-3">
        <h3 className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 border-border/20">
              <TableHead className="w-14 text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">#</TableHead>
              <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Consulta</TableHead>
              <TableHead className="text-right text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">{metricLabel}</TableHead>
              <TableHead className="text-right text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Calls</TableHead>
              <TableHead className="text-right text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Média</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${title}-${index}`} className="border-border/20 hover:bg-muted/40 transition-colors">
                <TableCell>{index + 1}</TableCell>
                <TableCell className="max-w-160 align-top">
                  <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {compactSql(row.query)}
                  </p>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{metricValue(row)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInt(row.calls)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMs(row.meanExecTime)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                  Nenhuma consulta encontrada.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function QueryPerformancePageClient({ initialData }: QueryPerformancePageClientProps) {
  const [data, setData] = useState<QueryPerformanceSummary | null>(initialData)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const capturedAtText = useMemo(() => {
    if (!data?.capturedAt) return '-'
    const date = new Date(data.capturedAt)
    if (Number.isNaN(date.getTime())) return data.capturedAt
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(date)
  }, [data?.capturedAt])

  const kpis = useMemo(() => {
    const topTotalTime = data?.topTotalTime || []
    const topMeanTime = data?.topMeanTime || []
    const topCalls = data?.topCalls || []

    const totalTrackedCalls = topCalls.reduce((acc, row) => acc + row.calls, 0)
    const totalTrackedExecMs = topTotalTime.reduce((acc, row) => acc + row.totalExecTime, 0)
    const avgOfTopMeanMs = topMeanTime.length > 0
      ? topMeanTime.reduce((acc, row) => acc + row.meanExecTime, 0) / topMeanTime.length
      : 0
    const maxMeanMs = topMeanTime.reduce((max, row) => Math.max(max, row.meanExecTime), 0)
    const uniqueRows = new Set(topTotalTime.map((row) => compactSql(row.query))).size
    const totalRowsReturned = topTotalTime.reduce((acc, row) => acc + row.rows, 0)

    return {
      totalTrackedCalls,
      totalTrackedExecMs,
      avgOfTopMeanMs,
      maxMeanMs,
      uniqueRows,
      totalRowsReturned,
    }
  }, [data])

  const refresh = () => {
    setError(null)
    startTransition(async () => {
      const result = await getQueryPerformanceSummaryAction({ limit: 20 })
      if (!result.success || !result.data) {
        setError(result.error || 'Erro ao atualizar estatísticas')
        return
      }
      setData(result.data)
    })
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              Observabilidade SQL
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <Activity className="h-6 w-6 text-primary" />
              Performance de Consultas
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Snapshot em <span className="font-medium text-foreground">{capturedAtText}</span> com ranking por tempo total, média e volume de chamadas.
            </p>
          </div>
          <Button onClick={refresh} disabled={isPending} variant="outline" className="h-10 rounded-full px-5">
            <RefreshCcw className="h-4 w-4" />
            <span className="ml-2">{isPending ? 'Atualizando...' : 'Atualizar'}</span>
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Calls (Top)</p>
              <p className="mt-2 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold leading-none tabular-nums lg:text-2xl">{formatShortNumber(kpis.totalTrackedCalls)}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2 text-slate-700">
              <Sigma className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Tempo total (Top)</p>
              <p className="mt-2 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold leading-none tabular-nums lg:text-2xl">{formatMs(kpis.totalTrackedExecMs)}</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2 text-blue-700">
              <Clock3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-blue-300 to-blue-500" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Média das médias</p>
              <p className="mt-2 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold leading-none tabular-nums lg:text-2xl">{formatMs(kpis.avgOfTopMeanMs)}</p>
            </div>
            <div className="rounded-full bg-violet-100 p-2 text-violet-700">
              <Gauge className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-violet-300 to-violet-500" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Pico de média</p>
              <p className="mt-2 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold leading-none tabular-nums lg:text-2xl">{formatMs(kpis.maxMeanMs)}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <Clock3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-amber-300 to-amber-500" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Consultas únicas</p>
              <p className="mt-2 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold leading-none tabular-nums lg:text-2xl">{formatInt(kpis.uniqueRows)}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Rows processadas</p>
              <p className="mt-2 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold leading-none tabular-nums lg:text-2xl">{formatShortNumber(kpis.totalRowsReturned)}</p>
            </div>
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-sky-300 to-sky-500" />
        </div>
      </div>

      <RankingTable
        title="Top por tempo total"
        rows={data?.topTotalTime || []}
        metricLabel="Tempo total"
        metricValue={(row) => formatMs(row.totalExecTime)}
      />

      <RankingTable
        title="Top por tempo médio"
        rows={data?.topMeanTime || []}
        metricLabel="Tempo médio"
        metricValue={(row) => formatMs(row.meanExecTime)}
      />

      <RankingTable
        title="Top por chamadas"
        rows={data?.topCalls || []}
        metricLabel="Chamadas"
        metricValue={(row) => formatInt(row.calls)}
      />
    </div>
  )
}
