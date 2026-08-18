import 'server-only'

import { adminMockCustomers, withAdminMockCustomers } from '@/lib/admin-mock-data'
import { getB2CLeadsAction, getB2CResellerSourceAction, getB2CSettingsAction } from '@/lib/actions/b2c-leads'
import { getCustomersAction } from '@/lib/actions/customers'
import { getCustomerOrderSummaryAction } from '@/lib/actions/orders'
import {
  DEFAULT_B2C_DISTRIBUTION_SETTINGS,
  type B2CDistributionSettings,
  type EligibleB2CReseller,
} from '@/lib/b2c-leads/types'

export async function getB2CAdminData() {
  const [leadsResult, settingsResult, resellerSourceResult, customersResult, orderSummaryResult] = await Promise.all([
    getB2CLeadsAction(),
    getB2CSettingsAction(),
    getB2CResellerSourceAction(),
    getCustomersAction(),
    getCustomerOrderSummaryAction(),
  ])

  const customers = withAdminMockCustomers(
    customersResult.success && customersResult.data ? customersResult.data : [],
  )
  const fallbackOrderSummary = Object.fromEntries(
    adminMockCustomers.map((customer, index) => [
      customer.id,
      { ordersCount: [5, 1, 9][index] ?? 0, totalSpent: [8420, 274.9, 15490][index] ?? 0 },
    ]),
  )
  const orderSummary = orderSummaryResult.success && orderSummaryResult.data
    ? orderSummaryResult.data
    : fallbackOrderSummary

  const mappedResellers: EligibleB2CReseller[] = customers
    .filter((customer) => customer.customerType === 'WHOLESALE')
    .map((customer, index) => {
      const summary = orderSummary[customer.id] ?? { ordersCount: 0, totalSpent: 0 }
      const approved = customer.status === 'APPROVED'
      const hasOrders = summary.ordersCount > 0
      return {
        id: customer.id,
        name: customer.tradeName || customer.companyName || customer.contactName,
        email: customer.email || null,
        phone: customer.phone || null,
        city: customer.city || null,
        state: customer.state || null,
        document: customer.cnpj || '',
        ordersCount: summary.ordersCount,
        totalSpent: summary.totalSpent,
        lastOrderAt: hasOrders ? new Date(Date.now() - (index + 1) * 12 * 86_400_000).toISOString() : null,
        eligible: approved && hasOrders,
        eligibilityReason: !approved
          ? 'Cadastro ainda não aprovado'
          : !hasOrders
            ? 'Ainda não realizou pedido'
            : 'Aprovado e com pedido realizado',
      }
    })

  const safeSourceResellers = resellerSourceResult.success && resellerSourceResult.data
    ? resellerSourceResult.data.resellers
    : []
  const sourceOrMappedResellers = safeSourceResellers.length > 0 ? safeSourceResellers : mappedResellers
  const baseResellers = sourceOrMappedResellers.some((reseller) => reseller.eligible)
    ? sourceOrMappedResellers
    : adminMockCustomers.map((customer, index): EligibleB2CReseller => {
        const summary = fallbackOrderSummary[customer.id] ?? { ordersCount: 0, totalSpent: 0 }
        return {
          id: customer.id,
          name: customer.tradeName || customer.companyName || customer.contactName,
          email: customer.email || null,
          phone: customer.phone || null,
          city: customer.city || null,
          state: customer.state || null,
          document: customer.cnpj || '',
          ordersCount: summary.ordersCount,
          totalSpent: summary.totalSpent,
          lastOrderAt: summary.ordersCount > 0 ? new Date(Date.now() - (index + 1) * 12 * 86_400_000).toISOString() : null,
          eligible: customer.status === 'APPROVED' && summary.ordersCount > 0,
          eligibilityReason: customer.status !== 'APPROVED'
            ? 'Cadastro ainda não aprovado'
            : summary.ordersCount === 0
              ? 'Ainda não realizou pedido'
              : 'Aprovado e com pedido realizado',
        }
      })

  const demoPortalReseller: EligibleB2CReseller = {
    id: '9001',
    name: 'Cliente Demo B2B',
    email: 'cliente.demo@upvitrine.local',
    phone: '11999999999',
    city: 'São Paulo',
    state: 'SP',
    document: '11222333000181',
    ordersCount: 12,
    totalSpent: 18940,
    lastOrderAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    eligible: true,
    eligibilityReason: 'Conta local conectada à caixa de oportunidades da vitrine',
  }
  const resellers = [demoPortalReseller, ...baseResellers.filter((reseller) => reseller.id !== demoPortalReseller.id)]
  const savedSettings = settingsResult.success && settingsResult.data
    ? settingsResult.data
    : DEFAULT_B2C_DISTRIBUTION_SETTINGS
  const settings: B2CDistributionSettings = {
    ...DEFAULT_B2C_DISTRIBUTION_SETTINGS,
    ...savedSettings,
    filters: {
      ...DEFAULT_B2C_DISTRIBUTION_SETTINGS.filters,
      ...savedSettings.filters,
    },
  }

  return {
    leads: leadsResult.success && leadsResult.data ? leadsResult.data : [],
    leadsError: leadsResult.success ? null : leadsResult.error || 'Não foi possível carregar os dados B2C.',
    settings,
    settingsError: settingsResult.success ? null : settingsResult.error || 'Não foi possível carregar as configurações B2C.',
    resellerSource: resellerSourceResult.success ? resellerSourceResult.data || null : null,
    resellerSourceError: resellerSourceResult.success ? null : resellerSourceResult.error || 'Não foi possível carregar a fonte de revendedores.',
    resellers,
  }
}
