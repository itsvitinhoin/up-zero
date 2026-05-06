import fs from 'fs'
import path from 'path'
import type {
  WaAutomationRule,
  WaConnection,
  WaIntegrationLog,
  WaMessageLog,
  WaMetaReviewState,
  WaSettings,
  WaTemplate,
  WaWebhookEvent,
} from './types'

export interface PersistedData {
  connections: WaConnection[]
  rules: WaAutomationRule[]
  templates: WaTemplate[]
  logs: WaMessageLog[]
  settings: WaSettings
  webhookEvents?: WaWebhookEvent[]
  integrationLogs?: WaIntegrationLog[]
  metaReview?: WaMetaReviewState
  seeded?: boolean
}

// On serverless platforms (Vercel, Lambda) the deploy root is read-only;
// only /tmp is writable. Fall back automatically so saves never crash.
const _defaultDataDir =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
    ? '/tmp/.data'
    : path.join(process.cwd(), '.data')

const DATA_DIR = process.env.WA_DATA_DIR ?? _defaultDataDir
const DATA_FILE = path.join(DATA_DIR, 'whatsapp.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function rehydrateDates(parsed: PersistedData): PersistedData {
  parsed.connections = (parsed.connections ?? []).map((c) => ({
    ...c,
    connectedAt: c.connectedAt ? new Date(c.connectedAt) : null,
    lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt) : null,
  }))
  parsed.rules = (parsed.rules ?? []).map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  }))
  parsed.templates = (parsed.templates ?? []).map((t) => ({
    ...t,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
  }))
  parsed.logs = (parsed.logs ?? []).map((l) => ({
    ...l,
    sentAt: new Date(l.sentAt),
    deliveredAt: l.deliveredAt ? new Date(l.deliveredAt) : undefined,
  }))
  parsed.webhookEvents = (parsed.webhookEvents ?? []).map((evt) => ({
    ...evt,
    receivedAt: new Date(evt.receivedAt),
  }))
  parsed.integrationLogs = (parsed.integrationLogs ?? []).map((log) => ({
    ...log,
    createdAt: new Date(log.createdAt),
  }))
  if (parsed.metaReview?.oauth) {
    parsed.metaReview.oauth = {
      ...parsed.metaReview.oauth,
      connectedAt: new Date(parsed.metaReview.oauth.connectedAt),
      expiresAt: parsed.metaReview.oauth.expiresAt ? new Date(parsed.metaReview.oauth.expiresAt) : null,
    }
  }
  return parsed
}

export function loadFromDisk(): PersistedData | null {
  try {
    ensureDir()
    if (!fs.existsSync(DATA_FILE)) return null
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return rehydrateDates(JSON.parse(raw) as PersistedData)
  } catch (e) {
    console.error('[WA] Failed to load persisted data:', e)
    return null
  }
}

export function saveToDisk(data: PersistedData): void {
  ensureDir()
  // Atomic write: write to a temp file then rename so readers never see a partial file
  const tmp = `${DATA_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, DATA_FILE)
}
