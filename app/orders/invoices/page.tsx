import { Suspense } from "react"
import AdminOrderInvoicesPageClient from "@/components/admin/admin-order-invoices-page-client"
import { AdminRouteSkeleton } from "@/components/admin/admin-route-skeleton"
import { getOrderInvoicesAction } from "@/lib/actions/orders"
import { getFiscalNaturesAction } from "@/lib/actions/fiscal"

export const instant = false

const INVOICE_PAGE_SIZE_OPTIONS = new Set([20, 50, 100])

function parseInvoicePageLimit(value?: string | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return INVOICE_PAGE_SIZE_OPTIONS.has(parsed) ? parsed : 20
}

function firstParam(value?: string | string[]): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

type AdminOrderInvoicesPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    limit?: string | string[]
    status?: string | string[]
    invoice_type?: string | string[]
    q?: string | string[]
  }>
}

export default function AdminOrderInvoicesPage({ searchParams }: AdminOrderInvoicesPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminOrderInvoicesPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminOrderInvoicesPageContent({ searchParams }: AdminOrderInvoicesPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const parsedPage = Number.parseInt(firstParam(resolvedSearchParams.page), 10)
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.trunc(parsedPage) : 1
  const limit = parseInvoicePageLimit(firstParam(resolvedSearchParams.limit))
  const status = firstParam(resolvedSearchParams.status).trim() || "all"
  const invoiceType = firstParam(resolvedSearchParams.invoice_type).trim() || "all"
  const q = firstParam(resolvedSearchParams.q).trim()
  const numericOrderId = /^\d+$/.test(q) ? q : ""

  const [invoicesResult, statsResult, operationNatures] = await Promise.all([
    getOrderInvoicesAction({
      page,
      pageSize: limit,
      ...(status !== "all" ? { status } : {}),
      ...(invoiceType !== "all" ? { invoiceType } : {}),
      ...(numericOrderId ? { orderId: numericOrderId } : {}),
    }),
    getOrderInvoicesAction({ page: 1, pageSize: 200 }),
    getFiscalNaturesAction(),
  ])

  const paginated = invoicesResult.success && invoicesResult.data ? invoicesResult.data : null
  const initialInvoices = paginated?.items ?? []
  const statsInvoices =
    statsResult.success && statsResult.data ? statsResult.data.items : initialInvoices

  return (
    <AdminOrderInvoicesPageClient
      initialInvoices={initialInvoices}
      statsInvoices={statsInvoices}
      operationNatures={operationNatures}
      currentPage={paginated?.page ?? page}
      pageSize={paginated?.pageSize ?? limit}
      totalCount={paginated?.total ?? initialInvoices.length}
      totalPages={paginated?.totalPages ?? 1}
      initialSearch={q}
      initialStatus={status}
      initialInvoiceType={invoiceType}
    />
  )
}
