import { neon } from '@neondatabase/serverless'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { initialState, PushError, type PushState } from './types'

export function storageReady() { return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL) || process.env.NODE_ENV !== 'production' }
function sql() { const url = process.env.DATABASE_URL || process.env.POSTGRES_URL; return url ? neon(url) : null }
function file(storeId: number) { return path.join(process.env.PUSH_DATA_DIR || path.join(process.cwd(), '.data', 'push'), `${storeId}.json`) }
export async function readState(storeId: number): Promise<PushState> {
  const db = sql()
  if (db) {
    const rows = await db`SELECT state FROM push_state WHERE store_id=${storeId}`
    return rows[0]?.state as PushState || initialState()
  }
  if (!storageReady()) throw new PushError(503, 'A persistência do canal Push ainda não está configurada.')
  try { return JSON.parse(await readFile(file(storeId), 'utf8')) as PushState }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return initialState(); throw error }
}
// Mutations are pure; compare-and-swap retries cannot repeat external sends.
export async function mutateState<T>(storeId: number, mutate: (state: PushState) => T): Promise<T> {
  const db = sql()
  if (db) {
    await db`INSERT INTO push_state(store_id,state) VALUES(${storeId},${JSON.stringify(initialState())}::jsonb) ON CONFLICT DO NOTHING`
    for (let attempt = 0; attempt < 8; attempt++) {
      const rows = await db`SELECT state,revision FROM push_state WHERE store_id=${storeId}`
      const state = rows[0].state as PushState, result = mutate(state)
      const updated = await db`UPDATE push_state SET state=${JSON.stringify(state)}::jsonb, revision=revision+1, updated_at=now() WHERE store_id=${storeId} AND revision=${rows[0].revision} RETURNING store_id`
      if (updated.length) return result
    }
    throw new PushError(409, 'Os dados foram atualizados por outra operação. Tente novamente.')
  }
  if (!storageReady()) throw new PushError(503, 'Configure o banco de dados do Push antes de salvar.')
  const target = file(storeId), lock = `${target}.lock`
  await mkdir(path.dirname(target), { recursive: true })
  let acquired = false
  for (let i = 0; i < 40; i++) {
    try { await mkdir(lock); acquired = true; break }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; await new Promise(resolve => setTimeout(resolve, 50)) }
  }
  if (!acquired) throw new PushError(409, 'Outra atualização do Push está em andamento.')
  try {
    const state = await readState(storeId), result = mutate(state), temporary = `${target}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600 })
    await rename(temporary, target)
    return result
  } finally { await rm(lock, { recursive: true, force: true }) }
}
