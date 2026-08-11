import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
import { CustomerDetail } from '@/components/admin/customer-detail'
import { getCustomerDetailAction } from '@/lib/actions/customers'
import { getPriceTablesAction } from '@/lib/actions/settings'
import { getOrdersAction } from '@/lib/actions/orders'
import { getAdminsAction } from '@/lib/actions/admins'
import { getOnlineCustomerOfflineLinkAction } from '@/lib/actions/offline'
import type { User } from '@/lib/types'

export const metadata = {
  title: 'Detalhes do Cliente | Admin',
}

export const instant = false

interface Props {
  params: Promise<{ id: string }>
}

export default function CustomerDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <CustomerDetailPageContent params={params} />
    </Suspense>
  )
}

async function CustomerDetailPageContent({ params }: Props) {
  await connection()

  const { id } = await params

  const [customerResult, priceTablesResult, ordersResult, adminsResult, offlineLinkResult] = await Promise.all([
    getCustomerDetailAction(id),
    getPriceTablesAction(),
    getOrdersAction({ customerId: id, cardMode: true }),
    getAdminsAction(),
    getOnlineCustomerOfflineLinkAction(id),
  ])

  if (!customerResult.success || !customerResult.data) {
    notFound()
  }

  const customer = customerResult.data
  const priceTables = priceTablesResult.success && priceTablesResult.data ? priceTablesResult.data : []
  const orders = ordersResult.success && ordersResult.data ? ordersResult.data : []
  const sellers: User[] = adminsResult.success && adminsResult.data
    ? adminsResult.data.map((admin) => ({
        id: String(admin.id),
        name: admin.name,
        email: admin.email,
        passwordHash: '',
        role: 'SELLER',
        isActive: admin.active,
        createdAt: admin.createdAt ? new Date(admin.createdAt) : new Date(0),
        updatedAt: admin.updatedAt ? new Date(admin.updatedAt) : new Date(0),
      }))
    : []
  const seller = sellers.find((item) => item.id === customer.assignedSellerId)
  const priceTable = priceTables.find((table) => table.id === customer.priceTableId)

  const offlineLink =
    offlineLinkResult.success && offlineLinkResult.data ? offlineLinkResult.data : null

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <CustomerDetail
        customer={customer}
        user={undefined}
        seller={seller}
        priceTable={priceTable}
        priceTables={priceTables}
        sellers={sellers}
        auditLogs={[]}
        orders={orders}
        canManage
        offlineLink={offlineLink}
      />
    </div>
  )
}
