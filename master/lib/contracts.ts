import { z } from 'zod'
import { salesSchema } from './sales'

export const permissionSchema = z.enum(['stores.read', 'stores.write', 'keys.read', 'modules.write', 'billing.read', 'audit.read', 'team.read', 'sales.read'])
export type Permission = z.infer<typeof permissionSchema>
export const sessionSchema = z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.string(), permissions: z.array(permissionSchema), mode: z.enum(['demo', 'live']) })
export type MasterSession = z.infer<typeof sessionSchema>
export const moduleCodes = ['b2b', 'b2c', 'offline', 'wms', 'whatsapp', 'studio', 'campaigns'] as const
export const moduleSchema = z.object({ code: z.enum(moduleCodes), override: z.enum(['plan', 'enabled', 'disabled']), expiresAt: z.string().nullable() })
export type ModuleGrant = z.infer<typeof moduleSchema>
export const storeSchema = z.object({
  id: z.number().int().positive(), name: z.string(), domain: z.string(), owner: z.string(), email: z.string(),
  status: z.enum(['active', 'trial', 'suspended']), plan: z.enum(['starter', 'pro']),
  subscription: z.enum(['active', 'trial', 'cancelled']), createdAt: z.string(),
  hasApiKey: z.boolean(), modules: z.array(moduleSchema), revision: z.number().int().nonnegative(),
})
export type Store = z.infer<typeof storeSchema>
export const invoiceSchema = z.object({ id: z.string(), storeId: z.number(), description: z.string(), amount: z.number().int().nonnegative(), dueAt: z.string(), paidAt: z.string().nullable(), status: z.enum(['paid', 'pending', 'overdue', 'cancelled']) })
export const auditSchema = z.object({ id: z.string(), actor: z.string(), storeId: z.number().nullable(), action: z.string(), reason: z.string(), before: z.string().nullable(), after: z.string().nullable(), createdAt: z.string() })
export const workspaceSchema = z.object({
  stores: z.array(storeSchema), invoices: z.array(invoiceSchema), audit: z.array(auditSchema),
  team: z.array(sessionSchema), updatedAt: z.string(),
  sales: salesSchema.nullable().default(null),
}).superRefine((workspace, context) => {
  const stores = new Set(workspace.stores.map(store => store.id))
  if (workspace.sales?.customers.some(customer => !stores.has(customer.storeId)))
    context.addIssue({ code: 'custom', message: 'Cliente vinculado a uma marca fora do escopo.' })
})
export type Workspace = z.infer<typeof workspaceSchema>
export const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('store.update'), revision: z.number().int().nonnegative(), status: storeSchema.shape.status, plan: storeSchema.shape.plan, reason: z.string().trim().min(5).max(300) }).strict(),
  z.object({ action: z.literal('module.update'), revision: z.number().int().nonnegative(), code: z.enum(moduleCodes), override: moduleSchema.shape.override, expiresAt: z.iso.datetime().nullable(), reason: z.string().trim().min(5).max(300) }).strict(),
  z.object({ action: z.enum(['key.reveal', 'key.copy']) }).strict(),
])
export type Mutation = z.infer<typeof mutationSchema>
export class MasterError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function requirePermission(session: MasterSession, permission: Permission) {
  if (!session.permissions.includes(permission)) throw new MasterError(403, 'Seu perfil não tem permissão para esta ação.')
}
export const moduleNames: Record<ModuleGrant['code'], string> = { b2b: 'B2B', b2c: 'B2C', offline: 'Offline', wms: 'WMS', whatsapp: 'WhatsApp', studio: 'Estúdio IA', campaigns: 'Campanhas' }
// Matriz inicial de demonstração. Homologar o catálogo comercial antes de integrar.
export function planIncludes(plan: Store['plan'], code: ModuleGrant['code']) {
  return code === 'b2b' || (plan === 'pro' && ['b2c', 'offline', 'studio'].includes(code))
}
export function moduleEnabled(store: Store, grant: ModuleGrant, now: number) {
  const expired = grant.expiresAt !== null && Date.parse(grant.expiresAt) <= now
  return grant.override === 'plan' || expired ? planIncludes(store.plan, grant.code) : grant.override === 'enabled'
}
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
export const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(value))
