import { businessDate, salesChannels, salesSchema, shiftDate, type SalesCustomer, type SalesOrder } from './sales'

/** Deterministic fictional orders. This generator is used exclusively by the local demo. */
export function createDemoSales(stores: { id: number; createdAt: string }[], now: string) {
  const through = businessDate(now), from = shiftDate(through, -119)
  const names = ['Mariana Boutique', 'Estilo da Vila', 'Renata Modas', 'Espaço Bela', 'Clara Multimarcas', 'Vista Livre', 'Paula Concept', 'Canto da Moda', 'Novo Vestir', 'Ateliê Luiza']
  const cities = [['São Paulo', 'SP'], ['Belo Horizonte', 'MG'], ['Curitiba', 'PR'], ['Recife', 'PE'], ['Goiânia', 'GO']]
  const customers: SalesCustomer[] = [], orders: SalesOrder[] = []
  stores.forEach((store, brandIndex) => {
    names.forEach((name, index) => {
      const registeredDay = [businessDate(store.createdAt), shiftDate(through, -(95 - index * 6))].sort().at(-1)!
      const registeredAt = `${registeredDay}T03:00:00.000Z`
      const [city, state] = cities[(index + brandIndex) % cities.length]
      const id = String(index + 1)
      customers.push({ id, storeId: store.id, name, email: `cliente${index + 1}.marca${brandIndex + 1}@example.test`, city, state, registeredAt })
      // The last customer is deliberately without orders for empty-customer coverage.
      if (index === 9) return
      for (let offset = 0; offset < 120; offset++) {
        const day = shiftDate(through, -offset)
        if (day < registeredDay || (offset + index * 3 + brandIndex) % (5 + index % 4) !== 0) continue
        const createdAt = `${day}T15:00:00.000Z`
        if (Date.parse(createdAt) > Date.parse(now)) continue
        const seed = offset * 13 + index * 17 + brandIndex * 29
        const status: SalesOrder['status'] = seed % 19 === 0 ? 'cancelled' : offset < 2 ? 'pending' : seed % 5 === 0 ? 'partial' : 'fulfilled'
        const requestedItems = 12 + seed % 70, unit = 3500 + (seed % 20) * 500
        const fulfilledItems = status === 'cancelled' || status === 'pending' ? 0 : status === 'partial' ? Math.floor(requestedItems * 0.65) : requestedItems
        orders.push({ id: `PED-${index + 1}-${offset}`, storeId: store.id, customerId: id, channel: salesChannels[seed % 3], createdAt, status, requested: requestedItems * unit, fulfilled: fulfilledItems * unit, requestedItems, fulfilledItems })
      }
    })
  })
  return salesSchema.parse({ customers, orders, coverageFrom: from, coverageThrough: through, updatedAt: now })
}
