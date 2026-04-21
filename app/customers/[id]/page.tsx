import { notFound } from 'next/navigation'
import { CustomerDetail } from '@/components/admin/customer-detail'
import { getCustomerDetailAction } from '@/lib/actions/customers'
import { getPriceTablesAction } from '@/lib/actions/settings'
import { getOrdersAction } from '@/lib/actions/orders'
import { getAdminsAction } from '@/lib/actions/admins'
import { adminMockCustomers, adminMockOrders, adminMockPriceTables } from '@/lib/admin-mock-data'
import type { User } from '@/lib/types'

export const metadata = {
  title: 'Detalhes do Cliente | Admin',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params

  const [customerResult, priceTablesResult, ordersResult, adminsResult] = await Promise.all([
    getCustomerDetailAction(id),
    getPriceTablesAction(),
    getOrdersAction({ customerId: id }),
    getAdminsAction(),
  ])

  // Fall back to mock data when the API doesn't have this customer
  const mockCustomer = adminMockCustomers.find((c) => c.id === id)

  if (!customerResult.success || !customerResult.data) {
    if (!mockCustomer) notFound()
  }

  const customer = (customerResult.success && customerResult.data) ? customerResult.data : mockCustomer!

  const priceTables = priceTablesResult.success && priceTablesResult.data?.length
    ? priceTablesResult.data
    : adminMockPriceTables

  const orders = ordersResult.success && ordersResult.data?.length
    ? ordersResult.data
    : adminMockOrders.filter((o) => o.customerId === id)

  const sellers: User[] = adminsResult.success && adminsResult.data?.length
    ? adminsResult.data.map((admin) => ({
        id: String(admin.id),
        name: admin.name,
        email: admin.email,
        passwordHash: '',
        role: 'SELLER',
        isActive: admin.active,
        createdAt: admin.createdAt ? new Date(admin.createdAt) : new Date(),
        updatedAt: admin.updatedAt ? new Date(admin.updatedAt) : new Date(),
      }))
    : [
        { id: 'seller-1', name: 'Ana Souza', email: 'ana@loja.com', passwordHash: '', role: 'SELLER', isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'seller-2', name: 'Renata Lima', email: 'renata@loja.com', passwordHash: '', role: 'SELLER', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ]

  const seller = sellers.find((item) => item.id === customer.assignedSellerId)
  const priceTable = priceTables.find((table) => table.id === customer.priceTableId)

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
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
      />
    </div>
  )
}
