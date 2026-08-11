'use client'

import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { DashboardDataProvider } from '@/contexts/dashboard-data'
import B2BDashboard from '@/components/dashboard/b2b-dashboard'
import type { DashboardMetricsPayload } from '@/lib/actions/dashboard-metrics'

interface DashboardPageClientProps {
  initialFromISO: string
  initialToISO: string
  initialMetricsData: DashboardMetricsPayload | null
  initialError: string | null
  initialRangeKey: string
  initialOrders: Parameters<typeof DashboardDataProvider>[0]['initialOrders']
  initialCustomers: Parameters<typeof DashboardDataProvider>[0]['initialCustomers']
  initialProducts: Parameters<typeof DashboardDataProvider>[0]['initialProducts']
  initialCustomerTotal: number
  initialCustomerTotalPages: number
  initialProductTotal: number
  initialProductTotalPages: number
  initialTopVisitedProducts: Array<Record<string, unknown>>
  initialTopSoldProducts: Array<Record<string, unknown>>
  initialSellerLinkFunnels: Array<Record<string, unknown>>
  initialSalesBySeller: { name: string; revenue: number }[]
  canExportReports: boolean
}

export default function DashboardPageClient({
  initialFromISO,
  initialToISO,
  initialMetricsData,
  initialError,
  initialRangeKey,
  initialOrders,
  initialCustomers,
  initialProducts,
  initialCustomerTotal,
  initialCustomerTotalPages,
  initialProductTotal,
  initialProductTotalPages,
  initialTopVisitedProducts,
  initialTopSoldProducts,
  initialSellerLinkFunnels,
  initialSalesBySeller,
  canExportReports,
}: DashboardPageClientProps) {
  const initialDateRange = useMemo<DateRange>(
    () => ({
      from: new Date(initialFromISO),
      to: new Date(initialToISO),
    }),
    [initialFromISO, initialToISO],
  )

  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange)

  return (
    <DashboardDataProvider
      dateRange={dateRange}
      initialMetricsData={initialMetricsData}
      initialError={initialError}
      initialRangeKey={initialRangeKey}
      initialOrders={initialOrders}
      initialCustomers={initialCustomers}
      initialProducts={initialProducts}
      initialSalesBySeller={initialSalesBySeller}
    >
      <B2BDashboard
        dateRange={dateRange}
        setDateRange={setDateRange}
        initialSalesBySeller={initialSalesBySeller}
        initialOrders={initialOrders}
        initialCustomers={initialCustomers}
        initialProducts={initialProducts}
        initialCustomerTotal={initialCustomerTotal}
        initialCustomerTotalPages={initialCustomerTotalPages}
        initialProductTotal={initialProductTotal}
        initialProductTotalPages={initialProductTotalPages}
        initialTopVisitedProducts={initialTopVisitedProducts}
        initialTopSoldProducts={initialTopSoldProducts}
        initialSellerLinkFunnels={initialSellerLinkFunnels}
        canExportReports={canExportReports}
      />
    </DashboardDataProvider>
  )
}
