'use server'

import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'
import type { ApiResponse } from '@/lib/types'

type QueryPerformanceApiRow = {
  query?: string
  calls?: number
  total_exec_time?: number
  mean_exec_time?: number
  rows?: number
  shared_blks_hit?: number
  shared_blks_read?: number
  temp_blks_written?: number
}

type QueryPerformanceApiResponse = {
  captured_at?: string
  top_total_time?: QueryPerformanceApiRow[]
  top_mean_time?: QueryPerformanceApiRow[]
  top_calls?: QueryPerformanceApiRow[]
}

export type QueryPerformanceRow = {
  query: string
  calls: number
  totalExecTime: number
  meanExecTime: number
  rows: number
  sharedBlksHit: number
  sharedBlksRead: number
  tempBlksWritten: number
}

export type QueryPerformanceSummary = {
  capturedAt: string
  topTotalTime: QueryPerformanceRow[]
  topMeanTime: QueryPerformanceRow[]
  topCalls: QueryPerformanceRow[]
}

function resolveBackendBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_RUST_URL?.trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

function mapRow(row: QueryPerformanceApiRow): QueryPerformanceRow {
  return {
    query: String(row.query || ''),
    calls: Number(row.calls || 0),
    totalExecTime: Number(row.total_exec_time || 0),
    meanExecTime: Number(row.mean_exec_time || 0),
    rows: Number(row.rows || 0),
    sharedBlksHit: Number(row.shared_blks_hit || 0),
    sharedBlksRead: Number(row.shared_blks_read || 0),
    tempBlksWritten: Number(row.temp_blks_written || 0),
  }
}

export async function getQueryPerformanceSummaryAction(input?: {
  limit?: number
}): Promise<ApiResponse<QueryPerformanceSummary>> {
  const session = await getSession()
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value

  if (!session && !adminToken) {
    return { success: false, error: 'Não autorizado' }
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return { success: false, error: 'Backend URL não configurado' }
  }

  const limit = Math.max(1, Math.min(100, Number(input?.limit || 20) || 20))
  const searchParams = new URLSearchParams()
  searchParams.set('limit', String(limit))

  const response = await fetch(`${base}/query-performance/summary?${searchParams.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { success: false, error: errorText || 'Erro ao carregar performance de consultas' }
  }

  const payload = (await response.json()) as QueryPerformanceApiResponse
  const data: QueryPerformanceSummary = {
    capturedAt: payload.captured_at || new Date().toISOString(),
    topTotalTime: Array.isArray(payload.top_total_time) ? payload.top_total_time.map(mapRow) : [],
    topMeanTime: Array.isArray(payload.top_mean_time) ? payload.top_mean_time.map(mapRow) : [],
    topCalls: Array.isArray(payload.top_calls) ? payload.top_calls.map(mapRow) : [],
  }

  return { success: true, data }
}
