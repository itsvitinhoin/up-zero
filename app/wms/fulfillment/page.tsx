import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/actions/auth'
import { getWmsFulfillmentAction } from '@/lib/actions/wms'
import AdminWmsFulfillmentClient from '@/components/admin/admin-wms-fulfillment-client'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = { title: 'WMS - Fulfillment | Admin' }

export const instant = false

export default function WmsFulfillmentPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <WmsFulfillmentPageContent />
    </Suspense>
  )
}

async function WmsFulfillmentPageContent() {
  const session = await getAdminSession()
  if (!session) redirect('/login')
  const renderedAtMs = Date.now()

  const result = await getWmsFulfillmentAction()
  const orders = result.success ? result.data : []
  const loadError = result.success ? null : result.error

  return (
    <AdminWmsFulfillmentClient
      initialOrders={orders}
      loadError={loadError}
      renderedAtMs={renderedAtMs}
    />
  )
}
