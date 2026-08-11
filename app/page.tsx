import { subDays } from 'date-fns'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { AdminDashboardSkeleton } from '@/components/admin/admin-route-skeleton'
import { getB2BDashboardMetricsAction } from '@/lib/actions/dashboard-metrics'
import { getCustomersAction } from '@/lib/actions/customers'
import { getCustomersPaginatedAction } from '@/lib/actions/customers'
import { getOrdersAction } from '@/lib/actions/orders'
import { getPaginatedStoreProductsAction } from '@/lib/actions/products'
import { getAdminStoreIdFromToken, getSession } from '@/lib/auth'
import type { DOrder } from '@/lib/dashboard-mock-data'
import DashboardPageClient from './page-client'
import AdminWelcomePage from '@/components/admin/admin-welcome-page'
import { hasAdminPermission } from '@/lib/server-admin-permissions'

type DashboardLiveDataPayload = {
  topVisitedProducts?: Array<Record<string, unknown>>
  topSoldProducts?: Array<Record<string, unknown>>
  sellerLinkFunnels?: Array<Record<string, unknown>>
}

export const instant = false

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL ?? 'http://localhost:8080').trim()
  if (!base) return null
  return base.replace(/\/$/, '')
}

function normalizeOrderStatus(value: unknown): DOrder['status'] {
  const raw = String(value || 'PENDING').toUpperCase()
  if (raw === 'PENDING' || raw === 'CONFIRMED' || raw === 'SHIPPED' || raw === 'CANCELLED') {
    return raw
  }
  return 'PENDING'
}

async function fetchJson<T>(path: string, token: string | null): Promise<T | null> {
  const base = getBackendBaseUrl()
  if (!base) return null

  try {
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(new URL(path, base), {
      headers,
      cache: 'no-store',
    })

    if (!response.ok) return null
    return await response.json() as T
  } catch {
    return null
  }
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  )
}

async function DashboardPageContent() {
  await connection()

  const canViewReports = await hasAdminPermission('reports.view')
  if (!canViewReports) {
    const session = await getSession()
    return <AdminWelcomePage userName={session?.name || 'Admin'} />
  }

  return <DashboardReportsContent />
}

async function DashboardReportsContent() {
  const initialTo = new Date()
  const initialFrom = subDays(initialTo, 29)
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value ?? null
  const storeId = await getAdminStoreIdFromToken()

  const [initialResult, ordersResult, customersResult, customerPageResult, productPageResult] = await Promise.all([
    getB2BDashboardMetricsAction({
      from: initialFrom,
      to: initialTo,
    }),
    getOrdersAction({
      from: initialFrom.toISOString().slice(0, 10),
      to: initialTo.toISOString().slice(0, 10),
    }),
    getCustomersAction(),
    getCustomersPaginatedAction({ page: 1, limit: 10 }),
    getPaginatedStoreProductsAction({ page: 1, limit: 10 }),
  ])

  const fromISO = initialFrom.toISOString().slice(0, 10)
  const toISO = initialTo.toISOString().slice(0, 10)

  const rawCustomers = (await fetchJson<Array<Record<string, unknown>>>(
    `/customers?limit=50${storeId ? `&store_id=${storeId}` : ''}`,
    adminToken,
  )) ?? []
  const rawOrders = (await fetchJson<Array<Record<string, unknown>>>(
    `/orders?from=${fromISO}&to=${toISO}${storeId ? `&store_id=${storeId}` : ''}`,
    adminToken,
  )) ?? []
  const liveData = await fetchJson<DashboardLiveDataPayload>(
    `/internal/admin/dashboard-live-data?from=${fromISO}&to=${toISO}&customers_page=1&customers_limit=10&products_page=1&products_limit=10${storeId ? `&store_id=${storeId}` : ''}`,
    adminToken,
  )
  const initialTopVisitedProducts = Array.isArray(liveData?.topVisitedProducts)
    ? liveData.topVisitedProducts
    : []
  const initialTopSoldProducts = Array.isArray(liveData?.topSoldProducts)
    ? liveData.topSoldProducts
    : []
  const initialSellerLinkFunnels = Array.isArray(liveData?.sellerLinkFunnels)
    ? liveData.sellerLinkFunnels
    : []
  const buildOrderRows = (): DOrder[] => {
    if (ordersResult.success && (ordersResult.data ?? []).length > 0) {
      return (ordersResult.data ?? []).map((order) => ({
        id: String(order.id),
        customerId: String(order.customerId),
        customerName: String(order.customerName || '-'),
        state: String(order.shippingState || '-'),
        city: String(order.shippingCity || '-'),
        status: normalizeOrderStatus(order.status),
        total: Number(order.total || 0),
        fulfilledTotal: Number(order.fulfilledTotal || 0),
        items: Number(order.totalItems || 0),
        fulfilledItems: Number(order.fulfilledItems || 0),
        paymentMethod: String(order.paymentMethod || 'PIX'),
        date: order.createdAt,
        month: new Date(order.createdAt).toLocaleDateString('en-CA', { month: '2-digit', year: 'numeric' }),
      }))
    }

    return rawOrders.map((order) => {
      const createdAt = new Date(String(order.created_at || order.createdAt || new Date().toISOString()))
      const shipping = (order.meta && typeof order.meta === 'object' && 'checkout' in order.meta)
        ? (order.meta as Record<string, unknown>).checkout as Record<string, unknown> | undefined
        : undefined
      const address = shipping && typeof shipping === 'object' ? shipping.address as Record<string, unknown> | undefined : undefined
      const payment = shipping && typeof shipping === 'object' ? shipping.payment as Record<string, unknown> | undefined : undefined

      return {
        id: String(order.id),
        customerId: String(order.customer_id || order.customerId || ''),
        customerName: String(order.customer_company_name || order.customer_trade_name || order.customer_name || '-'),
        state: String(address?.state || order.shipping_state || '-'),
        city: String(address?.city || order.shipping_city || '-'),
        status: normalizeOrderStatus(order.status),
        total: Number(order.order_subtotal_cents ?? 0) / 100,
        fulfilledTotal: Number(order.order_fulfilled_subtotal_cents ?? 0) / 100,
        items: Number(order.order_total_items ?? 0),
        fulfilledItems: Number(order.order_fulfilled_items ?? 0),
        paymentMethod: String(payment?.code || order.payment_method || 'PIX'),
        date: createdAt,
        month: createdAt.toLocaleDateString('en-CA', { month: '2-digit', year: 'numeric' }),
      }
    })
  }

  const serverOrders = buildOrderRows()
  const serverCustomerPage = customerPageResult.success ? (customerPageResult.data?.items ?? []) : []
  const serverProductPage = productPageResult.success ? (productPageResult.data?.items ?? []) : []
  const initialCustomerTotal = customerPageResult.success ? Number(customerPageResult.data?.total ?? serverCustomerPage.length) : serverCustomerPage.length
  const initialCustomerTotalPages = customerPageResult.success ? Number(customerPageResult.data?.totalPages ?? 1) : 1
  const initialProductTotal = productPageResult.success ? Number(productPageResult.data?.total ?? serverProductPage.length) : serverProductPage.length
  const initialProductTotalPages = productPageResult.success ? Number(productPageResult.data?.totalPages ?? 1) : 1
  const serverCustomers = (rawCustomers.length > 0
    ? rawCustomers.map((customer) => ({
        id: String(customer.id),
        companyName: String(customer.company_name || ''),
        tradeName: String(customer.trade_name || ''),
        contactName: String(customer.contact_name || ''),
        email: String(customer.email || ''),
        state: String(customer.state || '-'),
        city: String(customer.city || '-'),
        segment: String(customer.segment || 'Sem segmento'),
        status: String(customer.status || 'PENDING'),
        createdAt: String(customer.created_at || new Date().toISOString()),
        assignedSellerName: customer.assigned_seller_name ? String(customer.assigned_seller_name) : null,
      }))
    : (customersResult.success ? (customersResult.data ?? []) : []).map((customer) => ({
        id: String(customer.id),
        companyName: String(customer.companyName || ''),
        tradeName: String(customer.tradeName || ''),
        contactName: String(customer.contactName || ''),
        email: String(customer.email || ''),
        state: String(customer.state || '-'),
        city: String(customer.city || '-'),
        segment: String(customer.segment || 'Sem segmento'),
        status: String(customer.status || 'PENDING'),
        createdAt: String(customer.createdAt || new Date().toISOString()),
        assignedSellerName: customer.assignedSellerName ? String(customer.assignedSellerName) : null,
      }))
  ).map((customer) => {
    const customerOrders = serverOrders.filter((order) => String(order.customerId) === String(customer.id))
    const sortedOrders = [...customerOrders].sort((a, b) => a.date.getTime() - b.date.getTime())
    const firstPurchaseAt = sortedOrders[0]?.date ?? null
    const lastPurchaseAt = sortedOrders[sortedOrders.length - 1]?.date ?? null
    const totalOrders = customerOrders.length
    const totalRevenue = customerOrders.reduce((sum, order) => sum + Number(order.fulfilledTotal || 0), 0)
    const totalRequested = customerOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)

    return {
      id: String(customer.id),
      name: String((customer as { companyName?: string; tradeName?: string; contactName?: string }).companyName || (customer as { companyName?: string; tradeName?: string; contactName?: string }).tradeName || (customer as { companyName?: string; tradeName?: string; contactName?: string }).contactName || `Cliente #${customer.id}`),
      email: String((customer as { email?: string }).email || ''),
      state: String((customer as { state?: string }).state || '-'),
      city: String((customer as { city?: string }).city || '-'),
      segment: String((customer as { segment?: string }).segment || 'Sem segmento'),
      status: String((customer as { status?: string }).status || 'PENDING') === 'APPROVED' ? 'active' : String((customer as { status?: string }).status || 'PENDING') === 'REJECTED' ? 'inactive' : 'at_risk',
      rfmSegment: 'Lost',
      registeredAt: new Date(String((customer as { createdAt?: string }).createdAt || new Date().toISOString())),
      firstPurchaseAt,
      lastPurchaseAt,
      totalOrders,
      totalRevenue,
      totalRequested,
      avgTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      frequency: totalOrders,
      daysToPurchase: firstPurchaseAt ? Math.max(0, Math.round((firstPurchaseAt.getTime() - new Date(String((customer as { createdAt?: string }).createdAt || new Date().toISOString())).getTime()) / 86400000)) : null,
      assignedSellerName: (customer as { assignedSellerName?: string | null }).assignedSellerName ?? null,
    }
  })

  const serverSalesBySeller = Object.entries(
    serverCustomers.reduce<Record<string, number>>((acc, customer) => {
      const seller = String((customer as { assignedSellerName?: string | null }).assignedSellerName || 'Sem vendedora')
      acc[seller] = (acc[seller] ?? 0) + Number((customer as { totalRevenue?: number }).totalRevenue || 0)
      return acc
    }, {})
  )
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  const initialMetricsData = initialResult.success ? initialResult.data : null
  const initialError = initialResult.success ? null : initialResult.error
  const initialRangeKey = `${toDayKey(initialFrom)}|${toDayKey(initialTo)}`

  return (
    <DashboardPageClient
      initialFromISO={initialFrom.toISOString()}
      initialToISO={initialTo.toISOString()}
      initialMetricsData={initialMetricsData}
      initialError={initialError}
      initialRangeKey={initialRangeKey}
      initialOrders={serverOrders}
      initialCustomers={serverCustomerPage.map((customer) => ({
        id: String(customer.id),
        name: String(customer.companyName || customer.tradeName || customer.contactName || `Cliente #${customer.id}`),
        email: String(customer.email || ''),
        state: String(customer.state || '-'),
        city: String(customer.city || '-'),
        segment: String(customer.segment || 'Sem segmento'),
        status: String(customer.status || 'PENDING') === 'APPROVED' ? 'active' : String(customer.status || 'PENDING') === 'REJECTED' ? 'inactive' : 'at_risk',
        rfmSegment: 'Lost',
        registeredAt: new Date(String(customer.createdAt || new Date().toISOString())),
        firstPurchaseAt: null,
        lastPurchaseAt: null,
        totalOrders: 0,
        totalRevenue: 0,
        totalRequested: 0,
        avgTicket: 0,
        frequency: 0,
        daysToPurchase: null,
        assignedSellerName: customer.assignedSellerName ?? null,
      }))}
      initialProducts={serverProductPage.map((product) => ({
        id: String(product.id),
        name: String(product.name || `Produto #${product.id}`),
        sku: String(product.sku || ''),
        category: String(product.categoryId || product.categoryIds?.[0] || 'Sem categoria'),
        basePrice: Number(product.basePrice || 0),
        revenueRequested: 0,
        revenueFulfilled: 0,
        unitsRequested: 0,
        unitsFulfilled: 0,
        stock: (product.variants || []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0),
        dailySales: 0,
        daysLeft: 0,
        curve: 'C' as const,
        sizes: [],
        colors: [],
        monthlyRevenue: [],
      }))}
      initialCustomerTotal={initialCustomerTotal}
      initialCustomerTotalPages={initialCustomerTotalPages}
      initialProductTotal={initialProductTotal}
      initialProductTotalPages={initialProductTotalPages}
      initialTopVisitedProducts={initialTopVisitedProducts}
      initialTopSoldProducts={initialTopSoldProducts}
      initialSellerLinkFunnels={initialSellerLinkFunnels}
      initialSalesBySeller={serverSalesBySeller}
      canExportReports={false}
    />
  )
}
