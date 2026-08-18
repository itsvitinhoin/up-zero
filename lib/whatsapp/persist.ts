import { neon } from '@neondatabase/serverless'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { WhatsAppState } from './types'

export interface PersistedStateSnapshot {
  data: WhatsAppState | null
  revision?: number
  source: 'postgres' | 'disk'
}

const LOCAL_DATA_DIR = process.env.WA_DATA_DIR ?? path.join(process.cwd(), '.data')
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, 'whatsapp.json')
const LOCAL_SECRETS_FILE = path.join(LOCAL_DATA_DIR, 'whatsapp-secrets.json')
const STORE_SCOPE = String(process.env.STORE_ID ?? process.env.LOCAL_ADMIN_STORE_ID ?? 'default')
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, '_') || 'default'

let schemaReady: Promise<void> | undefined

class PersistedStateConflictError extends Error {
  constructor() {
    super('WhatsApp state changed while it was being saved.')
    this.name = 'PersistedStateConflictError'
  }
}

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim()
}

function sqlClient() {
  const url = databaseUrl()
  if (!url) return null
  return neon(url)
}

async function ensureSchema() {
  const sql = sqlClient()
  if (!sql) return

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS whatsapp_state (
        store_scope TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        revision BIGINT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS whatsapp_secrets (
        store_scope TEXT NOT NULL,
        secret_name TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (store_scope, secret_name)
      )
    `
  })().catch((error) => {
    schemaReady = undefined
    throw error
  })

  await schemaReady
}

export async function loadPersistedState(): Promise<PersistedStateSnapshot> {
  const sql = sqlClient()
  if (sql) {
    await ensureSchema()
    const [row] = await sql`
      SELECT state, revision
      FROM whatsapp_state
      WHERE store_scope = ${STORE_SCOPE}
    ` as Array<{ state: WhatsAppState; revision: string | number }>

    return {
      data: row?.state ?? null,
      revision: row ? Number(row.revision) : undefined,
      source: 'postgres',
    }
  }

  try {
    const raw = await fs.readFile(LOCAL_DATA_FILE, 'utf8')
    return { data: JSON.parse(raw) as WhatsAppState, source: 'disk' }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { data: null, source: 'disk' }
    }
    throw error
  }
}

export async function savePersistedState(data: WhatsAppState, expectedRevision?: number): Promise<number | undefined> {
  const sql = sqlClient()
  if (sql) {
    await ensureSchema()
    const serialized = JSON.stringify(data)

    if (expectedRevision === undefined) {
      const rows = await sql`
        INSERT INTO whatsapp_state (store_scope, state)
        VALUES (${STORE_SCOPE}, ${serialized}::jsonb)
        ON CONFLICT (store_scope) DO NOTHING
        RETURNING revision
      ` as Array<{ revision: string | number }>

      if (!rows[0]) throw new PersistedStateConflictError()
      return Number(rows[0].revision)
    }

    const rows = await sql`
      UPDATE whatsapp_state
      SET state = ${serialized}::jsonb,
          revision = revision + 1,
          updated_at = NOW()
      WHERE store_scope = ${STORE_SCOPE}
        AND revision = ${expectedRevision}
      RETURNING revision
    ` as Array<{ revision: string | number }>

    if (!rows[0]) throw new PersistedStateConflictError()
    return Number(rows[0].revision)
  }

  const serialized = JSON.stringify(data, null, 2)
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true })
  const temporaryFile = `${LOCAL_DATA_FILE}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporaryFile, serialized, 'utf8')
  await fs.rename(temporaryFile, LOCAL_DATA_FILE)
  return undefined
}

export function isPersistedStateConflict(error: unknown) {
  return error instanceof PersistedStateConflictError
}

export function persistenceBackend(): 'postgres' | 'local-disk' {
  return databaseUrl() ? 'postgres' : 'local-disk'
}

async function readLocalSecrets(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(LOCAL_SECRETS_FILE, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
}

async function writeLocalSecrets(secrets: Record<string, string>) {
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true })
  const temporaryFile = `${LOCAL_SECRETS_FILE}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporaryFile, JSON.stringify(secrets, null, 2), { encoding: 'utf8', mode: 0o600 })
  await fs.rename(temporaryFile, LOCAL_SECRETS_FILE)
}

export async function loadPersistedSecret(secretName: string): Promise<string | undefined> {
  const sql = sqlClient()
  if (sql) {
    await ensureSchema()
    const [row] = await sql`
      SELECT ciphertext
      FROM whatsapp_secrets
      WHERE store_scope = ${STORE_SCOPE}
        AND secret_name = ${secretName}
    ` as Array<{ ciphertext: string }>
    return row?.ciphertext
  }

  return (await readLocalSecrets())[secretName]
}

export async function savePersistedSecret(secretName: string, ciphertext: string): Promise<void> {
  const sql = sqlClient()
  if (sql) {
    await ensureSchema()
    await sql`
      INSERT INTO whatsapp_secrets (store_scope, secret_name, ciphertext)
      VALUES (${STORE_SCOPE}, ${secretName}, ${ciphertext})
      ON CONFLICT (store_scope, secret_name)
      DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = NOW()
    `
    return
  }

  const secrets = await readLocalSecrets()
  secrets[secretName] = ciphertext
  await writeLocalSecrets(secrets)
}

export async function deletePersistedSecret(secretName: string): Promise<void> {
  const sql = sqlClient()
  if (sql) {
    await ensureSchema()
    await sql`
      DELETE FROM whatsapp_secrets
      WHERE store_scope = ${STORE_SCOPE}
        AND secret_name = ${secretName}
    `
    return
  }

  const secrets = await readLocalSecrets()
  delete secrets[secretName]
  await writeLocalSecrets(secrets)
}
