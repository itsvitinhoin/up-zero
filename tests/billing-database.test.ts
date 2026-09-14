import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomInt } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { repository, billingSql } from '../lib/billing/repository'

test('Postgres serializes concurrent operations and persists idempotency per store', { skip: process.env.RUN_BILLING_DB_TEST !== '1' }, async () => {
  loadEnvConfig(process.cwd())
  const previous = process.env.ASAAS_ENVIRONMENT
  process.env.ASAAS_ENVIRONMENT='sandbox'
  // Negative IDs cannot be authenticated as a real store. Delete only records owned by this fixture.
  const storeId = -randomInt(100000000,2000000000), repo = repository(storeId), sql = billingSql()
  const first = randomUUID(), second = randomUUID()
  try {
    const results = await Promise.allSettled([repo.begin(first,'test','remove-card','a'), repo.begin(second,'test','remove-card','b')])
    assert.equal(results.filter(r => r.status === 'fulfilled').length,1)
    assert.equal(results.filter(r => r.status === 'rejected').length,1)
    const account = await repo.read(); assert.ok(account.operation_id)
    const winner = account.operation_id!, fingerprint = winner === first ? 'a' : 'b'
    await repo.finish(winner,account.state)
    assert.equal((await repo.read()).operation_id,null)
    assert.equal(await repo.begin(winner,'test','remove-card',fingerprint),null)
    await assert.rejects(repo.begin(winner,'test','subscribe','changed'))
  } finally {
    await sql.transaction([
      sql`DELETE FROM platform_billing_operations WHERE store_id=${storeId} AND environment='sandbox'`,
      sql`DELETE FROM platform_billing_accounts WHERE store_id=${storeId} AND environment='sandbox'`,
    ])
    if (previous === undefined) delete process.env.ASAAS_ENVIRONMENT; else process.env.ASAAS_ENVIRONMENT=previous
  }
})
