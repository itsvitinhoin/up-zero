import type { AudienceFilters, Device, Member, Purchase, PushState } from './types'

function inPeriod(value: string, from: string, to: string, days: number, now: Date, timezone: string) {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return false
  const calendarDay = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time))
  if (from && calendarDay < from) return false
  if (to && calendarDay > to) return false
  return !days || time >= now.getTime() - days * 86400000
}
export function validOrder(order: Purchase) { return !['CANCELED', 'CANCELLED', 'DRAFT', 'REJECTED', 'REFUNDED'].includes(order.status.toUpperCase()) }
export function purchased(order: Purchase) { return validOrder(order) && (order.paymentStatus === 'PAID' || ['CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status)) }
export function eligibleDevices(memberId: string, devices: Device[], platform = 'ALL') {
  return devices.filter(d => d.memberId === memberId && d.active && d.permission === 'GRANTED' && !!d.token && (platform === 'ALL' || d.platform === platform))
}
export function audienceMembers(filters: AudienceFilters, state: { members: Member[]; devices: Omit<Device, 'token'>[]; orders: Purchase[]; settings?: { timezone: string } }, now = new Date()) {
  const timezone = state.settings?.timezone || 'America/Sao_Paulo'
  const devicesByMember = new Map<string, Omit<Device, 'token'>[]>(), ordersByMember = new Map<string, Purchase[]>()
  for (const d of state.devices) { const list = devicesByMember.get(d.memberId) ?? []; list.push(d); devicesByMember.set(d.memberId, list) }
  for (const o of state.orders) {
    if (!validOrder(o) || !inPeriod(o.createdAt, filters.orderFrom, filters.orderTo, filters.orderLastDays, now, timezone)) continue
    const list = ordersByMember.get(o.memberId) ?? []; list.push(o); ordersByMember.set(o.memberId, list)
  }
  const name = filters.name.toLocaleLowerCase('pt-BR'), document = filters.document.replace(/\D/g, '')
  return state.members.filter((member: Member) => {
    if (member.kind === 'ADMIN') return false
    if (name && !member.name.toLocaleLowerCase('pt-BR').includes(name)) return false
    if (document && !member.document.replace(/\D/g, '').includes(document)) return false
    if (filters.status !== 'ALL' && member.status !== filters.status) return false
    if (filters.installed === 'YES' && !member.downloadedAt) return false
    if (filters.installed === 'NO' && member.downloadedAt) return false
    if ((filters.downloadFrom || filters.downloadTo) && (!member.downloadedAt || !inPeriod(member.downloadedAt, filters.downloadFrom, filters.downloadTo, 0, now, timezone))) return false
    if (filters.platform !== 'ALL' && !(devicesByMember.get(member.id) ?? []).some(d => d.active && d.platform === filters.platform)) return false
    const orders = ordersByMember.get(member.id) ?? []
    if (filters.hasOrdered === 'YES' && !orders.length) return false
    if (filters.hasOrdered === 'NO' && orders.length) return false
    const purchases = orders.filter(purchased).length
    return (filters.minPurchases === null || purchases >= filters.minPurchases) && (filters.maxPurchases === null || purchases <= filters.maxPurchases)
  })
}
export function audienceSize(filters: AudienceFilters, state: PushState, now = new Date()) {
  const members = audienceMembers(filters, state, now)
  return { memberCount: members.length, deviceCount: members.reduce((n, m) => n + eligibleDevices(m.id, state.devices, filters.platform).length, 0) }
}
