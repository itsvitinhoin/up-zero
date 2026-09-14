import fs from 'node:fs/promises'
import path from 'node:path'
import { billingSql } from './repository'
import { listJobs } from '../ai-studio/storage'
import { phoneUsage, studioUsage, usageMonth, type UsageView } from './usage'
import type { WhatsAppState } from '../whatsapp/types'
class MissingStoreMapping extends Error {}
async function loadPhones(storeId: number) {
  // Legacy messaging is deployment-scoped. Never use its process-global cache/default scope across stores.
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    const sql = billingSql()
    const rows = await sql`SELECT state->'phoneNumbers' AS phones, state->'removedPhoneNumberIds' AS removed FROM whatsapp_state WHERE store_scope=${String(storeId)}`
    if (!rows[0]) throw new MissingStoreMapping()
    return phoneUsage({phoneNumbers:rows[0].phones || [], removedPhoneNumberIds:rows[0].removed || []})
  }
  const scope = process.env.STORE_ID || process.env.LOCAL_ADMIN_STORE_ID
  if (scope !== String(storeId)) throw new MissingStoreMapping()
  const data = JSON.parse(await fs.readFile(path.join(process.env.WA_DATA_DIR || path.join(process.cwd(), '.data'), 'whatsapp.json'), 'utf8')) as WhatsAppState
  return phoneUsage(data)
}
export async function getBillingUsage(storeId: number): Promise<UsageView> {
  const month = usageMonth()
  const [phones, studio] = await Promise.allSettled([loadPhones(storeId), listJobs(storeId).then(jobs => studioUsage(jobs,storeId,month))])
  return {
    month, updatedAt:new Date().toISOString(),
    whatsapp:phones.status === 'fulfilled' ? phones.value : {available:false,numbers:[],count:0,amount:0,error:phones.reason instanceof MissingStoreMapping ? 'Não há um cadastro de WhatsApp vinculado a esta loja. Confirme o vínculo da integração com o suporte.' : 'Não foi possível consultar números vinculados a esta loja.'},
    studio:studio.status === 'fulfilled' ? studio.value : {available:false,jobs:[],count:0,amount:0,error:'O histórico do Estúdio IA está indisponível no momento.'},
  }
}
