import { CustomersListClient } from '@/components/admin/customers-list-client'
import { getCustomersAction, getCustomersSummaryAction } from '@/lib/actions/customers'
import { getCustomerOrderSummaryAction } from '@/lib/actions/orders'
import { adminMockCustomers, withAdminMockCustomers } from '@/lib/admin-mock-data'

export const metadata = {
  title: 'Clientes | Admin',
  description: 'Gerenciar clientes da loja',
}

type AdminCustomersPageProps = {
  searchParams?: Promise<{
    q?: string | string[]
    search?: string | string[]
    status?: string | string[]
  }>
}

export default async function AdminCustomersPage({ searchParams }: AdminCustomersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}

  const firstParam = (value?: string | string[]) => {
    if (Array.isArray(value)) return value[0] ?? ''
    return value ?? ''
  }

  const rawQuery =
    typeof firstParam(resolvedSearchParams.q) === 'string' && firstParam(resolvedSearchParams.q).length > 0
      ? firstParam(resolvedSearchParams.q)
      : typeof firstParam(resolvedSearchParams.search) === 'string'
        ? firstParam(resolvedSearchParams.search)
        : ''
  const search = rawQuery.trim()
  const status = firstParam(resolvedSearchParams.status).trim().toUpperCase()

  const normalizedStatus = ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : undefined
  const hasFilters = search.length > 0 || Boolean(normalizedStatus)

  const [customersResult, summaryResult, ordersSummaryResult] = await Promise.all([
    getCustomersAction({
      q: search || undefined,
      status: normalizedStatus,
    }),
    hasFilters ? getCustomersSummaryAction() : Promise.resolve(null),
    getCustomerOrderSummaryAction(),
  ])

  const initialCustomers = withAdminMockCustomers(
    customersResult.success && customersResult.data
      ? customersResult.data
      : [],
  )

  const initialSummary = hasFilters && summaryResult?.success && summaryResult.data
    ? summaryResult.data
    : {
        total: initialCustomers.length,
        pending: initialCustomers.filter((customer) => customer.status === 'PENDING').length,
        approved: initialCustomers.filter((customer) => customer.status === 'APPROVED').length,
        rejected: initialCustomers.filter((customer) => customer.status === 'REJECTED').length,
      }

  const customerOrderSummary =
    ordersSummaryResult.success && ordersSummaryResult.data
      ? ordersSummaryResult.data
      : Object.fromEntries(
          adminMockCustomers.map((customer, index) => [
            customer.id,
            {
              ordersCount: [5, 1, 9][index] ?? 0,
              totalSpent: [8420, 274.9, 15490][index] ?? 0,
            },
          ]),
        )

  return (
    <CustomersListClient
      initialCustomers={initialCustomers}
      initialSummary={initialSummary}
      customerOrderSummary={customerOrderSummary}
      initialSearch={search}
      initialStatus={normalizedStatus || 'all'}
    />
  )
}
