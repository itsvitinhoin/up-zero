'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { OfflineSellerConflictRow } from '@/lib/actions/offline'
import { usePaginationMeta } from '@/hooks/use-paginated-list'

const CONFLICT_LABELS: Record<string, string> = {
  erp_vs_canonical: 'ERP vs canônica',
  online_vs_canonical: 'Site vs canônica',
  erp_vs_online: 'ERP vs site',
}

interface OfflineConflictsPageClientProps {
  rows: OfflineSellerConflictRow[]
  total: number
  currentPage: number
  pageSize: number
  error?: string | null
}

export function OfflineConflictsPageClient({
  rows,
  total,
  currentPage,
  pageSize,
  error,
}: OfflineConflictsPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { totalPages, showingStart, showingEnd } = usePaginationMeta({
    total,
    currentPage,
    pageSize,
  })

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          Offline
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Conflitos de vendedora</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Clientes vinculados online/offline com vendedoras divergentes. A regra do sistema é: offline
          prevalece na comissão.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead>Cliente offline</TableHead>
              <TableHead>Cliente site</TableHead>
              <TableHead>Canônica</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>ERP</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum conflito pendente.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={`${row.offlineCustomerId}-${row.onlineCustomerId}`}>
                  <TableCell>
                    <div className="font-medium">{row.offlineCustomerName || '-'}</div>
                    <div className="text-xs text-muted-foreground">{row.document || ''}</div>
                  </TableCell>
                  <TableCell>
                    {row.onlineCustomerId ? (
                      <Link
                        href={`/customers/${row.onlineCustomerId}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {row.onlineCustomerName || `Cliente #${row.onlineCustomerId}`}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{row.canonicalSellerName || '-'}</TableCell>
                  <TableCell>{row.onlineSellerName || '-'}</TableCell>
                  <TableCell>{row.offlineSellerName || '-'}</TableCell>
                  <TableCell>{CONFLICT_LABELS[row.conflictType] || row.conflictType}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => {
          const params = new URLSearchParams()
          if (pageSize !== 20) params.set('limit', String(pageSize))
          if (page > 1) params.set('page', String(page))
          const query = params.toString()
          router.replace(query ? `${pathname}?${query}` : pathname)
          router.refresh()
        }}
        showing={{ start: showingStart, end: showingEnd, total }}
      />
    </div>
  )
}
