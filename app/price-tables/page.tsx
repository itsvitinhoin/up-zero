import React from "react"
import AdminPriceTablesPageClient from "@/components/admin/admin-price-tables-page-client"
import { getPriceTablesAction } from "@/lib/actions/settings"
import type { PriceTable } from "@/lib/types"

export const metadata = {
  title: 'Regras de Preço | Admin',
  description: 'Configure preços diferenciados para clientes B2B',
}

export default async function AdminPriceTablesPage() {
  let priceTables: PriceTable[] = []

  try {
    const result = await getPriceTablesAction()
    if (result.success && result.data) {
      priceTables = result.data
    }
  } catch (error) {
    console.error('Erro ao carregar tabelas de preços:', error)
  }

  return <AdminPriceTablesPageClient initialPriceTables={priceTables} />
}
