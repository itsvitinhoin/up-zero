import { Suspense } from 'react'
import { connection } from 'next/server'
import { CustomersListClient } from '@/components/admin/customers-list-client'
import { getCustomersPaginatedAction, getCustomersSummaryAction } from '@/lib/actions/customers'
import { getCustomerOrderSummaryAction } from '@/lib/actions/orders'
import Loading from './loading'

export const metadata = {
  title: 'Clientes | Admin',
  description: 'Gerenciar clientes da loja',
}

type AdminCustomersPageProps = {
  searchParams?: Promise<{
    q?: string | string[]
    search?: string | string[]
    status?: string | string[]
    type?: string | string[]
    page?: string | string[]
    limit?: string | string[]
    from?: string | string[]
    to?: string | string[]
    period?: string | string[]
    seller?: string | string[]
    assigned_seller_id?: string | string[]
  }>
}

export default function AdminCustomersPage({ searchParams }: AdminCustomersPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminCustomersPageContent searchParams={searchParams} />
    </Suspense>
  )
}

const CUSTOMER_PAGE_SIZE_OPTIONS = new Set([20, 50, 100])

function parseCustomerPageLimit(value?: string | null): number {
  const parsed = Number.parseInt(String(value || ''), 10)
  return CUSTOMER_PAGE_SIZE_OPTIONS.has(parsed) ? parsed : 20
}

async function AdminCustomersPageContent({ searchParams }: AdminCustomersPageProps) {
  await connection()

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
  const customerType = firstParam(resolvedSearchParams.type).trim().toUpperCase()
  const parsedPage = Number(firstParam(resolvedSearchParams.page))
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1
  const pageLimit = parseCustomerPageLimit(firstParam(resolvedSearchParams.limit))

  const normalizedStatus = ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : undefined
  const normalizedCustomerType = ['WHOLESALE', 'RETAIL'].includes(customerType) ? customerType : undefined
  const rawFromDate = firstParam(resolvedSearchParams.from).trim()
  const rawToDate = firstParam(resolvedSearchParams.to).trim()
  const fromDate = rawFromDate
  const toDate = rawToDate
  const sellerFilterRaw = (firstParam(resolvedSearchParams.seller) || firstParam(resolvedSearchParams.assigned_seller_id)).trim()
  const withoutSeller = sellerFilterRaw === 'none'
  const normalizedAssignedSellerId =
    !withoutSeller && /^\d+$/.test(sellerFilterRaw) ? sellerFilterRaw : undefined

  const [customersResult, customersSummaryResult, ordersSummaryResult] = await Promise.all([
    getCustomersPaginatedAction({
      q: search || undefined,
      status: normalizedStatus,
      customerType: normalizedCustomerType,
      page,
      limit: pageLimit,
      from: fromDate || undefined,
      to: toDate || undefined,
      assignedSellerId: normalizedAssignedSellerId,
      withoutSeller: withoutSeller || undefined,
    }),
    getCustomersSummaryAction({
      q: search || undefined,
      status: normalizedStatus,
      customerType: normalizedCustomerType,
      from: fromDate || undefined,
      to: toDate || undefined,
      assignedSellerId: normalizedAssignedSellerId,
      withoutSeller: withoutSeller || undefined,
    }),
    getCustomerOrderSummaryAction(),
  ])

  const initialCustomers = customersResult.success && customersResult.data
    ? customersResult.data.items
    : []

  const initialPagination = customersResult.success && customersResult.data
    ? {
        total: customersResult.data.total,
        page: customersResult.data.page,
        limit: customersResult.data.limit,
        totalPages: customersResult.data.totalPages,
      }
    : {
        total: 0,
        page,
        limit: pageLimit,
        totalPages: 1,
      }

  const customerOrderSummary =
    ordersSummaryResult.success && ordersSummaryResult.data
      ? ordersSummaryResult.data
      : {}

  const initialSummary =
    customersSummaryResult.success && customersSummaryResult.data
      ? customersSummaryResult.data
      : {
          total: initialPagination.total,
          approved: initialCustomers.filter((customer) => customer.status === 'APPROVED').length,
          pending: initialCustomers.filter((customer) => customer.status === 'PENDING').length,
          rejected: initialCustomers.filter((customer) => customer.status === 'REJECTED').length,
          wholesale: initialCustomers.filter((customer) => customer.customerType === 'WHOLESALE').length,
          retail: initialCustomers.filter((customer) => customer.customerType === 'RETAIL').length,
        }

  return (
    <CustomersListClient
      initialCustomers={initialCustomers}
      initialPagination={initialPagination}
      initialSummary={initialSummary}
      customerOrderSummary={customerOrderSummary}
      initialSearch={search}
      initialStatus={normalizedStatus || 'all'}
      initialType={normalizedCustomerType || 'all'}
      initialFromDate={fromDate}
      initialToDate={toDate}
      initialSellerId={withoutSeller ? 'none' : normalizedAssignedSellerId || 'all'}
    />
  )
}
