import { Suspense } from "react"
import AdminOrderLabelsPageClient from "@/components/admin/admin-order-labels-page-client"
import { AdminRouteSkeleton } from "@/components/admin/admin-route-skeleton"
import { getOrderLabelsAction } from "@/lib/actions/orders"

export const instant = false

const LABEL_PAGE_SIZE_OPTIONS = new Set([20, 50, 100])

function parseLabelPageLimit(value?: string | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return LABEL_PAGE_SIZE_OPTIONS.has(parsed) ? parsed : 20
}

function firstParam(value?: string | string[]): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

type AdminOrderLabelsPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    limit?: string | string[]
    status?: string | string[]
    label_mode?: string | string[]
    q?: string | string[]
  }>
}

export default function AdminOrderLabelsPage({ searchParams }: AdminOrderLabelsPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminOrderLabelsPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminOrderLabelsPageContent({ searchParams }: AdminOrderLabelsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const parsedPage = Number.parseInt(firstParam(resolvedSearchParams.page), 10)
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.trunc(parsedPage) : 1
  const limit = parseLabelPageLimit(firstParam(resolvedSearchParams.limit))
  const status = firstParam(resolvedSearchParams.status).trim() || "all"
  const labelMode = firstParam(resolvedSearchParams.label_mode).trim() || "all"
  const q = firstParam(resolvedSearchParams.q).trim()
  const numericOrderId = /^\d+$/.test(q) ? q : ""

  const [labelsResult, statsResult] = await Promise.all([
    getOrderLabelsAction({
      page,
      pageSize: limit,
      ...(status !== "all" ? { status } : {}),
      ...(labelMode !== "all" ? { labelMode } : {}),
      ...(numericOrderId ? { orderId: numericOrderId } : {}),
      ...(q && !numericOrderId ? { search: q } : {}),
    }),
    getOrderLabelsAction({ page: 1, pageSize: 200 }),
  ])

  const paginated = labelsResult.success && labelsResult.data ? labelsResult.data : null
  const initialLabels = paginated?.items ?? []
  const statsLabels =
    statsResult.success && statsResult.data ? statsResult.data.items : initialLabels

  return (
    <AdminOrderLabelsPageClient
      initialLabels={initialLabels}
      statsLabels={statsLabels}
      currentPage={paginated?.page ?? page}
      pageSize={paginated?.pageSize ?? limit}
      totalCount={paginated?.total ?? initialLabels.length}
      totalPages={paginated?.totalPages ?? 1}
      initialSearch={q}
      initialStatus={status}
      initialLabelMode={labelMode}
    />
  )
}
