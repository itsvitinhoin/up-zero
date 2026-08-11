'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  getOfflineSellerAssignmentStatsAction,
  type OfflineSellerPoolGapReport,
} from '@/lib/actions/offline'

export function OfflineSellerPoolAlert() {
  const [stats, setStats] = useState<OfflineSellerPoolGapReport | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    void getOfflineSellerAssignmentStatsAction().then((result) => {
      if (cancelled) return
      if (result.success && result.data) {
        setStats(result.data)
      }
      setLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!loaded || !stats) return null

  const hasIssues = stats.unmappedTotal > 0 || stats.outsidePool > 0
  if (!hasIssues) return null

  return (
    <Alert variant="destructive" className="border-amber-500/40 bg-amber-500/5 text-foreground">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Vendedoras offline fora da roleta
      </AlertTitle>
      <AlertDescription className="space-y-2 text-sm text-muted-foreground">
        {stats.unmappedTotal > 0 ? (
          <p>
            {stats.unmappedTotal} vendedora(s) offline ativa(s) ainda não estão vinculadas a uma
            vendedora do site. Clientes dessas vendedoras não receberão atribuição automática.
          </p>
        ) : null}
        {stats.outsidePool > 0 ? (
          <p>
            {stats.outsidePool} vendedora(s) offline mapeada(s) não fazem parte do pool da roleta.
            Isso não impede o match por CPF/CNPJ, mas vale revisar a configuração.
          </p>
        ) : null}
        <p>
          <Link href="/offline/sellers" className="font-medium text-primary underline-offset-4 hover:underline">
            Abrir mapeamento de vendedoras offline
          </Link>
        </p>
      </AlertDescription>
    </Alert>
  )
}
