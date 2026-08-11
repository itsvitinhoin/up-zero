import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import PaymentLinkDetailPageClient from '@/components/admin/payment-link-detail-page-client'
import { getPaymentLinkDetailAction } from '@/lib/actions/orders'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: 'Detalhe do Link de Pagamento | Admin',
}

export const instant = false

type PaymentLinkDetailPageProps = {
  params: Promise<{ id: string }>
}

export default function PaymentLinkDetailPage({ params }: PaymentLinkDetailPageProps) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <PaymentLinkDetailPageContent params={params} />
    </Suspense>
  )
}

async function PaymentLinkDetailPageContent({ params }: PaymentLinkDetailPageProps) {
  const { id } = await params
  const numericId = Number(id)

  if (!Number.isFinite(numericId) || numericId <= 0) {
    notFound()
  }

  const result = await getPaymentLinkDetailAction(Math.trunc(numericId))

  if (!result.success || !result.data) {
    notFound()
  }

  return (
    <PaymentLinkDetailPageClient
      initialDetail={result.data}
    />
  )
}
