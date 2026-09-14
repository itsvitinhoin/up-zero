import { loadEnvConfig } from '@next/env'
import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'
loadEnvConfig(process.cwd())
async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) throw new Error('Database unavailable')
  const sql = neon(url)
  const migration = await readFile(new URL('../db/migrations/003_platform_billing.sql', import.meta.url), 'utf8')
  const statements = migration.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)
  await sql.transaction(statements.map(statement => sql.query(statement, [])))
  console.log('Estrutura de Billing criada/verificada com sucesso. Nenhuma cobrança ou assinatura foi criada.')
}
main().catch(() => { console.error('Não foi possível aplicar a migração de Billing. Verifique a conexão com o banco.'); process.exitCode = 1 })
