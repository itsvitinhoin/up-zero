import { Suspense } from 'react'
import { subDays } from 'date-fns'
import { connection } from 'next/server'
import AdminOrdersPageClient from "@/components/admin/admin-orders-page-client";
import { getOrdersAction } from "@/lib/actions/orders";
import Loading from './loading'

type AdminOrdersPageProps = {
  searchParams?: Promise<{
    q?: string | string[]
    search?: string | string[]
    status?: string | string[]
    payment_status?: string | string[]
    from?: string | string[]
    to?: string | string[]
    seller?: string | string[]
    assigned_seller_id?: string | string[]
    limit?: string | string[]
    page?: string | string[]
  }>
}

type OrdersSummary = {
  totalOrders: number
  paidOrders: number
  totalRequestedValue: number
  paidOrdersValue: number
}

const VALID_ORDER_STATUSES = new Set(["PENDING", "IN_ANALYSIS", "RELEASED", "CONFIRMED", "PROCESSING", "INVOICED", "SHIPPED", "DELIVERED", "CANCELLED"])
const VALID_PAYMENT_STATUSES = new Set(["PENDING", "PAID", "PARTIAL", "REFUNDED", "CANCELLED"])
const ORDER_PAGE_SIZE_OPTIONS = new Set([20, 50, 100])

function parseOrderPageLimit(value?: string | null): number {
  const parsed = Number.parseInt(String(value || ""), 10)
  return ORDER_PAGE_SIZE_OPTIONS.has(parsed) ? parsed : 20
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminOrdersPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminOrdersPageContent({ searchParams }: AdminOrdersPageProps) {
  await connection()

  const resolvedSearchParams = (await searchParams) ?? {}
  const rawQuery = firstParam(resolvedSearchParams.q) || firstParam(resolvedSearchParams.search)
  const search = rawQuery.trim()
  const rawStatus = firstParam(resolvedSearchParams.status).trim().toUpperCase()
  const status = VALID_ORDER_STATUSES.has(rawStatus) ? rawStatus : undefined
  const rawPaymentStatus = firstParam(resolvedSearchParams.payment_status).trim().toUpperCase()
  const paymentStatus = VALID_PAYMENT_STATUSES.has(rawPaymentStatus) ? rawPaymentStatus : undefined
  const rawFromDate = firstParam(resolvedSearchParams.from).trim()
  const rawToDate = firstParam(resolvedSearchParams.to).trim()
  const rawSeller = (firstParam(resolvedSearchParams.seller) || firstParam(resolvedSearchParams.assigned_seller_id)).trim()
  const assignedSellerId = /^\d+$/.test(rawSeller) ? rawSeller : undefined
  const initialLimit = parseOrderPageLimit(firstParam(resolvedSearchParams.limit))

  const shouldUseDefaultRange = !rawFromDate && !rawToDate
  const defaultToDate = new Date()
  const defaultFromDate = subDays(defaultToDate, 29)
  const fromDate = shouldUseDefaultRange
    ? defaultFromDate.toISOString().slice(0, 10)
    : rawFromDate
  const toDate = shouldUseDefaultRange
    ? defaultToDate.toISOString().slice(0, 10)
    : rawToDate

  const ordersResult = await getOrdersAction({
    status,
    paymentStatus,
    assignedSellerId,
    q: search || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  });

  const initialOrders = ordersResult.success && ordersResult.data ? ordersResult.data : [];
  const initialSummary: OrdersSummary = ordersResult.success && ordersResult.summary
    ? ordersResult.summary
    : {
        totalOrders: initialOrders.length,
        paidOrders: initialOrders.filter((order) => String(order.paymentStatus || '').trim().toUpperCase() === 'PAID').length,
        totalRequestedValue: initialOrders.reduce((acc, order) => acc + Number(order.total || 0), 0),
        paidOrdersValue: initialOrders.filter((order) => String(order.paymentStatus || '').trim().toUpperCase() === 'PAID').reduce((acc, order) => acc + Number(order.total || 0), 0),
      };

  return (
    <AdminOrdersPageClient
      initialOrders={initialOrders}
      initialSummary={initialSummary}
      initialSearch={search}
      initialStatus={status || "all"}
      initialPaymentStatus={paymentStatus || "all"}
      initialFromDate={fromDate}
      initialToDate={toDate}
      initialSellerId={assignedSellerId || "all"}
      initialLimit={initialLimit}
    />
  );
}
