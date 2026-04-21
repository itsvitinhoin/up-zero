import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  deleteConnection,
  getConnection,
  getConnections,
  upsertConnection,
} from '@/lib/whatsapp/store'
import { getProvider } from '@/lib/whatsapp/provider'
import type { WaConnection } from '@/lib/whatsapp/types'

export const dynamic = 'force-dynamic'

// ─── Tenant resolution ────────────────────────────────────────────────────────
// Decode the admin JWT locally (no network call) to get the storeId for the
// current request. Falls back to env STORE_ID for single-tenant deployments.

function decodeJwtStoreId(token: string): number | null {
  try {
    const b64 = token.split('.')[1]
      .replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(Math.ceil(token.split('.')[1].length / 4) * 4, '=')
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString()) as Record<string, unknown>
    const raw = payload.store_id ?? payload.storeId ?? payload.store ?? payload.storeID
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

async function getRequestStoreId(): Promise<number | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('adminAuthToken')?.value
  if (token) {
    const fromJwt = decodeJwtStoreId(token)
    if (fromJwt) return fromJwt
  }
  const fromEnv = Number(process.env.STORE_ID)
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : null
}

// ─── GET — list connections for this tenant ───────────────────────────────────

export async function GET() {
  const storeId = await getRequestStoreId()
  const list = getConnections(storeId ?? undefined)

  console.log(
    `[connections/GET] storeId=${storeId ?? 'none'} → returning ${list.length} connection(s):`,
    list.map((c) => ({ id: c.id, phoneNumberId: c.phoneNumberId, status: c.status })),
  )

  return NextResponse.json(list)
}

// ─── POST — create new connection ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<WaConnection>
  const storeId = await getRequestStoreId()

  console.log('[connections/POST] incoming payload:', {
    name: body.name,
    provider: body.provider,
    phoneNumberId: body.phoneNumberId,
    businessAccountId: body.businessAccountId,
    businessId: body.businessId,
    storeId,
  })

  const id = `conn-${Date.now()}`
  // Auto-mark CONNECTED when Embedded Signup provided a phone_number_id
  const hasPhoneId = !!body.phoneNumberId?.trim()

  const connection: WaConnection = {
    id,
    name: body.name ?? 'Nova Conexão',
    provider: body.provider ?? 'MOCK',
    phoneNumber: body.phoneNumber ?? '',
    phoneNumberId: body.phoneNumberId ?? '',
    accessToken: body.accessToken ?? '',
    businessAccountId: body.businessAccountId ?? '',
    businessId: body.businessId,
    webhookVerifyToken: body.webhookVerifyToken ?? '',
    storeId: storeId ?? undefined,
    onboardingType: body.onboardingType,
    platformType: body.platformType,
    // migration_required means phone is still on another BSP — not yet CONNECTED
    status: hasPhoneId && body.onboardingType !== 'migration_required' ? 'CONNECTED' : 'DISCONNECTED',
    connectedAt: hasPhoneId && body.onboardingType !== 'migration_required' ? new Date() : null,
    lastMessageAt: null,
    messagesSentToday: 0,
    messagesTotal: 0,
  }

  try {
    upsertConnection(connection)
  } catch (e) {
    console.error('[connections/POST] failed to persist:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  console.log('[connections/POST] persisted:', {
    id: connection.id,
    status: connection.status,
    storeId: connection.storeId,
  })

  return NextResponse.json(connection, { status: 201 })
}

// ─── PATCH — update existing connection ──────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: string } & Partial<WaConnection>
  const storeId = await getRequestStoreId()

  console.log('[connections/PATCH] incoming patch:', {
    id: body.id,
    phoneNumberId: body.phoneNumberId,
    businessAccountId: body.businessAccountId,
    businessId: body.businessId,
    storeId,
  })

  const existing = getConnection(body.id)
  if (!existing) {
    console.error('[connections/PATCH] connection not found:', body.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Tenant guard: reject if the connection belongs to a different store
  if (storeId && existing.storeId && existing.storeId !== storeId) {
    console.error('[connections/PATCH] tenant mismatch:', {
      requestStoreId: storeId,
      connectionStoreId: existing.storeId,
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated: WaConnection = {
    ...existing,
    ...body,
    // Preserve the storeId from the original connection (or set from session)
    storeId: existing.storeId ?? storeId ?? undefined,
  }

  // Auto-mark CONNECTED when phone_number_id is (re-)set via Embedded Signup
  if (body.phoneNumberId?.trim() && !body.status) {
    updated.status = 'CONNECTED'
    updated.connectedAt = updated.connectedAt ?? new Date()
  }

  try {
    upsertConnection(updated)
  } catch (e) {
    console.error('[connections/PATCH] failed to persist:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  console.log('[connections/PATCH] updated:', {
    id: updated.id,
    status: updated.status,
    storeId: updated.storeId,
  })

  return NextResponse.json(updated)
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  const storeId = await getRequestStoreId()

  const existing = getConnection(id)
  if (existing && storeId && existing.storeId && existing.storeId !== storeId) {
    console.error('[connections/DELETE] tenant mismatch:', { requestStoreId: storeId, connectionStoreId: existing.storeId })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  deleteConnection(id)
  console.log('[connections/DELETE] deleted:', id)
  return NextResponse.json({ ok: true })
}

// ─── PUT — test connection ────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  const connection = getConnection(id)
  if (!connection) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })

  const provider = getProvider(connection.provider)
  const result = await provider.testConnection(connection)

  if (result.ok) {
    upsertConnection({ ...connection, status: 'CONNECTED', connectedAt: new Date() })
  } else {
    upsertConnection({ ...connection, status: 'ERROR' })
  }

  return NextResponse.json(result)
}
