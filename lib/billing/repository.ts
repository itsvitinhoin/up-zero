import { neon } from '@neondatabase/serverless'
import { BillingError, type Account, type AccountState } from './types'
import { environment } from './provider'
export function billingSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) throw new BillingError(503, 'O serviço de cobrança ainda não está disponível.')
  return neon(url)
}
export type Repository = ReturnType<typeof repository>
export function repository(storeId: number) {
  const sql = billingSql(), env = environment()
  return {
    async read(): Promise<Account> {
      const rows = await sql`SELECT state, operation_id FROM platform_billing_accounts WHERE store_id=${storeId} AND environment=${env}`
      return rows[0] as Account || { state: { cards: [] }, operation_id: null }
    },
    async begin(id: string, actor: string, action: string, fingerprint: string): Promise<AccountState | null> {
      const existing = await sql`SELECT status, fingerprint, error FROM platform_billing_operations WHERE store_id=${storeId} AND environment=${env} AND request_id=${id}`
      if (existing[0]) {
        if (existing[0].fingerprint !== fingerprint) throw new BillingError(409, 'Solicitação já utilizada para outra operação.')
        if (existing[0].status === 'done') return null
        if (existing[0].status === 'failed') throw new BillingError(422, 'Esta tentativa não foi concluída. Confira os dados e inicie uma nova tentativa.')
        throw new BillingError(409, 'Operação aguardando confirmação. Não repita a contratação; contate o suporte se persistir.')
      }
      await sql`INSERT INTO platform_billing_accounts(store_id,environment) VALUES(${storeId},${env}) ON CONFLICT DO NOTHING`
      const rows = await sql`
        WITH claimed AS (
          UPDATE platform_billing_accounts SET operation_id=${id}, updated_at=now()
          WHERE store_id=${storeId} AND environment=${env} AND operation_id IS NULL
            AND NOT EXISTS(SELECT 1 FROM platform_billing_operations WHERE store_id=${storeId} AND environment=${env} AND request_id=${id})
            AND (SELECT count(*) FROM platform_billing_operations WHERE store_id=${storeId} AND environment=${env} AND created_at > now()-interval '1 hour') < 20
          RETURNING state
        ), recorded AS (
          INSERT INTO platform_billing_operations(store_id,environment,request_id,actor_id,action,fingerprint,status)
          SELECT ${storeId},${env},${id},${actor},${action},${fingerprint},'pending' FROM claimed RETURNING request_id
        ) SELECT state FROM claimed, recorded`
      if (!rows[0]) throw new BillingError(409, 'Já existe uma operação em andamento ou o limite de tentativas foi atingido. Aguarde e atualize a página.')
      return rows[0].state as AccountState
    },
    async checkpoint(id: string, state: AccountState) {
      const rows = await sql`UPDATE platform_billing_accounts SET state=${JSON.stringify(state)}::jsonb, updated_at=now() WHERE store_id=${storeId} AND environment=${env} AND operation_id=${id} RETURNING store_id`
      if (!rows.length) throw new BillingError(409, 'Operação aguardando conciliação.', true)
    },
    async finish(id: string, state: AccountState, error?: string) {
      await sql.transaction([
        sql`UPDATE platform_billing_accounts SET state=${JSON.stringify(state)}::jsonb, operation_id=NULL, updated_at=now() WHERE store_id=${storeId} AND environment=${env} AND operation_id=${id}`,
        sql`UPDATE platform_billing_operations SET status=${error ? 'failed' : 'done'}, error=${error || null} WHERE store_id=${storeId} AND environment=${env} AND request_id=${id}`,
      ])
    },
  }
}
