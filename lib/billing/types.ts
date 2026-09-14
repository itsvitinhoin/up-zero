import { z } from 'zod'
import type { CommercialPlan } from './catalog'
export class BillingError extends Error {
  constructor(public status: number, message: string, public uncertain = false) { super(message) }
}
const digits = (min: number, max: number) => z.string().transform(v => v.replace(/[\s.\-/()]/g, '')).pipe(z.string().regex(/^\d+$/).min(min).max(max))
export const holderSchema = z.object({
  name: z.string().trim().min(3).max(100), email: z.string().email().max(200),
  cpfCnpj: digits(11, 14).refine(v => v.length === 11 || v.length === 14),
  postalCode: digits(8, 8), addressNumber: z.string().trim().min(1).max(20), phone: digits(10, 11),
}).strict()
export const cardSchema = z.object({
  holderName: z.string().trim().min(3).max(100), number: digits(13, 19),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/), expiryYear: z.string().regex(/^20\d{2}$/), ccv: z.string().regex(/^\d{3,4}$/),
}).strict().refine(v => new Date(Number(v.expiryYear), Number(v.expiryMonth), 1) > new Date(), 'Cartão vencido.')
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add-card'), requestId: z.uuid(), holder: holderSchema, card: cardSchema, consent: z.literal(true) }).strict(),
  z.object({ action: z.literal('subscribe'), requestId: z.uuid(), plan: z.enum(['plan_starter', 'plan_profissional']), methodId: z.uuid(), consent: z.literal(true) }).strict(),
  z.object({ action: z.literal('change-plan'), requestId: z.uuid(), plan: z.enum(['plan_starter', 'plan_profissional']), consent: z.literal(true) }).strict(),
  z.object({ action: z.literal('default-card'), requestId: z.uuid(), methodId: z.uuid(), consent: z.literal(true) }).strict(),
  z.object({ action: z.literal('remove-card'), requestId: z.uuid(), methodId: z.uuid() }).strict(),
  z.object({ action: z.literal('cancel'), requestId: z.uuid(), consent: z.literal(true) }).strict(),
])
export type BillingCommand = z.infer<typeof commandSchema>
export type StoredCard = { id: string; last4: string; brand: string; expiryMonth: string; expiryYear: string; token: string }
export type AccountState = {
  customerId?: string; cards: StoredCard[]; defaultMethodId?: string;
  subscription?: { id: string; plan: CommercialPlan; status: string; nextDueDate: string; value: number; methodId: string }
}
export type Account = { state: AccountState; operation_id: string | null }
export type BillingView = {
  configured: boolean; canManage: boolean; pending: boolean;
  methods: Omit<StoredCard, 'token'>[]; defaultMethodId?: string;
  subscription?: AccountState['subscription'];
  invoices: { id: string; description: string; amount: number; status: string; dueDate: string; paidAt?: string }[];
}
