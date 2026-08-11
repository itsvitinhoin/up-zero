'use client'

import { useEffect, useState } from 'react'
import { getPriceTablesAction } from '@/lib/actions/settings'
import { getAdminsAction, type Admin } from '@/lib/actions/admins'
import type { PriceTable } from '@/lib/types'

const COMMERCIAL_DEDUPE_WINDOW_MS = 4000

let commercialCache: {
  priceTables: PriceTable[]
  sellers: Admin[]
  loadedAt: number
} | null = null

let commercialInFlight: Promise<{ priceTables: PriceTable[]; sellers: Admin[] }> | null = null

export function useCommercialData() {
  const [priceTables, setPriceTables] = useState<PriceTable[]>([])
  const [sellers, setSellers] = useState<Admin[]>([])
  const [isLoadingCommercialData, setIsLoadingCommercialData] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadCommercialData() {
      const now = Date.now()
      if (commercialCache && now - commercialCache.loadedAt < COMMERCIAL_DEDUPE_WINDOW_MS) {
        setPriceTables(commercialCache.priceTables)
        setSellers(commercialCache.sellers)
        setIsLoadingCommercialData(false)
        return
      }

      setIsLoadingCommercialData(true)

      if (!commercialInFlight) {
        commercialInFlight = (async () => {
          const [tablesResult, sellersResult] = await Promise.all([
            getPriceTablesAction(),
            getAdminsAction(),
          ])

          return {
            priceTables: tablesResult.success && tablesResult.data ? tablesResult.data : [],
            sellers: sellersResult.success && sellersResult.data ? sellersResult.data : [],
          }
        })()
      }

      const resolved = await commercialInFlight
      commercialInFlight = null

      if (!mounted) return

      setPriceTables(resolved.priceTables)
      setSellers(resolved.sellers)
      commercialCache = {
        priceTables: resolved.priceTables,
        sellers: resolved.sellers,
        loadedAt: Date.now(),
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
