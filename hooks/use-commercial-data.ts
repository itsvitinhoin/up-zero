'use client'

import { useEffect, useState } from 'react'
import { getPriceTablesAction } from '@/lib/actions/settings'
import { getAdminsAction, type Admin } from '@/lib/actions/admins'
import type { PriceTable } from '@/lib/types'

export function useCommercialData() {
  const [priceTables, setPriceTables] = useState<PriceTable[]>([])
  const [sellers, setSellers] = useState<Admin[]>([])
  const [isLoadingCommercialData, setIsLoadingCommercialData] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadCommercialData() {
      setIsLoadingCommercialData(true)

      const [tablesResult, sellersResult] = await Promise.all([
        getPriceTablesAction(),
        getAdminsAction(),
      ])

      if (!mounted) return

      if (tablesResult.success && tablesResult.data) {
        setPriceTables(tablesResult.data)
      }

      if (sellersResult.success && sellersResult.data) {
        setSellers(sellersResult.data)
      }

      setIsLoadingCommercialData(false)
    }

    void loadCommercialData()

    return () => {
      mounted = false
    }
  }, [])

  return {
    priceTables,
    sellers,
    isLoadingCommercialData,
  }
}
