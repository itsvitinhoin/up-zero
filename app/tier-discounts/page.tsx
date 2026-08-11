import React from "react"
import { Suspense } from "react"
import AdminTierDiscountsPageClient from "@/components/admin/admin-tier-discounts-page-client"
import { AdminRouteSkeleton } from "@/components/admin/admin-route-skeleton"
import type { TierDiscount } from "@/lib/types"
import { getTierDiscountsAction } from "@/lib/actions/settings"
import { connection } from "next/server"

export const metadata = {
  title: 'Descontos por Quantidade | Admin',
  description: 'Configure descontos progressivos baseados na quantidade',
}

export const instant = false

export default function AdminTierDiscountsPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminTierDiscountsPageContent />
    </Suspense>
  )
}

async function AdminTierDiscountsPageContent() {
  await connection()

  let tiers: TierDiscount[] = []

  try {
    const result = await getTierDiscountsAction()
    if (result.success && result.data) {
      tiers = result.data
    }
  } catch (err) {
    console.error('Erro ao buscar tiers:', err)
  }

  return <AdminTierDiscountsPageClient initialTiers={tiers} />
}
