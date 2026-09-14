import { BILLING_PRICES } from './catalog'
import type { Job } from '../ai-studio/types'
import type { WhatsAppState } from '../whatsapp/types'
export type UsageView = {
  month: string; updatedAt: string;
  whatsapp: { available: boolean; numbers: { id: string; number: string; name: string; connected: boolean }[]; count: number; amount: number; error?: string };
  studio: { available: boolean; jobs: { id: string; name: string; color: string; date: string; legacyDate: boolean; images: number; complete: boolean; attempts: number; amount: number }[]; count: number; amount: number; error?: string };
}
export function usageMonth(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year:'numeric',month:'2-digit' }).format(now) }
export function phoneUsage(state: Pick<WhatsAppState, 'phoneNumbers' | 'removedPhoneNumberIds'>): UsageView['whatsapp'] {
  const removed = new Set(state.removedPhoneNumberIds || [])
  const numbers = [...new Map((state.phoneNumbers || []).filter(phone => !removed.has(phone.id)).map(phone => [phone.id, {
    id: phone.id, number: phone.displayPhoneNumber, name: phone.verifiedName || 'Sem nome cadastrado', connected: phone.status?.toUpperCase() === 'CONNECTED',
  }])).values()]
  const count = numbers.filter(n => n.connected).length
  return { available: true, numbers, count, amount: count * BILLING_PRICES.whatsappNumberMonthly }
}
export function studioUsage(jobs: Job[], storeId: number, month: string): UsageView['studio'] {
  const items = jobs.filter(job => job.storeId === storeId).filter(job => {
    const date = new Date(job.completedAt || job.createdAt)
    return Number.isFinite(date.getTime()) && usageMonth(date) === month
  }).map(job => {
    const shots = new Set(job.outputs.map(o => o.shot))
    const complete = Boolean(job.completedAt) || ['front','back','side','detail'].every(shot => job.outputs.some(output => output.shot === shot))
    return { id: job.id, name: job.name, color: job.color, date: job.completedAt || job.createdAt, legacyDate: !job.completedAt, images: shots.size, complete, attempts: job.attempts, amount: complete ? BILLING_PRICES.studioGeneration : 0 }
  }).sort((a,b) => b.date.localeCompare(a.date))
  return { available:true, jobs:items, count:items.filter(j=>j.complete).length, amount:items.reduce((sum,j)=>sum+j.amount,0) }
}
