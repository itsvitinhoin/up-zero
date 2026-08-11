import { Suspense } from 'react'
import PaymentLinksPageClient from "@/components/admin/payment-links-page-client"
import type { PaymentLinkSummary } from "@/components/admin/payment-links-page-client"
import { listPaymentLinksAction } from "@/lib/actions/orders"
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: "Links de Pagamento | Admin",
}

export const instant = false

const PAYMENT_LINK_PAGE_SIZE_OPTIONS = new Set([20, 50, 100])

function parsePaymentLinkPageLimit(value?: string | null): number {
  const parsed = Number.parseInt(String(value || ''), 10)
  return PAYMENT_LINK_PAGE_SIZE_OPTIONS.has(parsed) ? parsed : 20
}

type PaymentLinksPageProps = {
  searchParams?: Promise<{
    limit?: string | string[]
    page?: string | string[]
  }>
}

function firstParam(value?: string | string[]): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default function PaymentLinksPage({ searchParams }: PaymentLinksPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <PaymentLinksPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function PaymentLinksPageContent({ searchParams }: PaymentLinksPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const limit = parsePaymentLinkPageLimit(firstParam(resolvedSearchParams.limit))
  const parsedPage = Number.parseInt(firstParam(resolvedSearchParams.page), 10)
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.trunc(parsedPage) : 1

  const result = await listPaymentLinksAction({
    limit,
    offset: (page - 1) * limit,
  })
  const items: PaymentLinkSummary[] = result.success && result.data ? (result.data.items as PaymentLinkSummary[]) : []
  const total = result.success && result.data ? Number(result.data.total) || 0 : items.length

  return (
    <PaymentLinksPageClient
      initialItems={items}
      initialTotal={total}
      initialLimit={limit}
      initialPage={page}
    />
  )
}
