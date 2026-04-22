import React from "react"
import AdminTierDiscountsPageClient from "@/components/admin/admin-tier-discounts-page-client"
import type { TierDiscount } from "@/lib/types"
import { getTierDiscountsAction } from "@/lib/actions/settings"

export const metadata = {
  title: 'Descontos por Quantidade | Admin',
  description: 'Configure descontos progressivos baseados na quantidade',
}

export default async function AdminTierDiscountsPage() {
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
