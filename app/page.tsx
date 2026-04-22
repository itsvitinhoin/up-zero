'use client'

import { useState } from 'react'
import { subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { DashboardDataProvider } from '@/contexts/dashboard-data'
import B2BDashboard from '@/components/dashboard/b2b-dashboard'

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to:   new Date(),
  })
  return (
    <DashboardDataProvider dateRange={dateRange}>
      <B2BDashboard dateRange={dateRange} setDateRange={setDateRange} />
    </DashboardDataProvider>
  )
}
