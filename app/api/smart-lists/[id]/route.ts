import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  archiveSmartList,
  deleteSmartList,
  getSmartList,
  toggleSmartListFavorite,
  upsertSmartList,
} from '@/lib/campaigns/store'

export const dynamic = 'force-dynamic'

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

async function getRequestStoreId(): Promise<number> {
  const cookieStore = await cookies()
  const token = cookieStore.get('adminAuthToken')?.value
  if (token) {
    const fromJwt = decodeJwtStoreId(token)
    if (fromJwt) return fromJwt
  }
  const fromEnv = Number(process.env.STORE_ID)
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : 1
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const storeId = await getRequestStoreId()
  const list = getSmartList(id, storeId)
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(list)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const storeId = await getRequestStoreId()
  const existing = getSmartList(id, storeId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as Record<string, unknown>

  // Special actions
  if (body.action === 'toggle_favorite') {
    const updated = toggleSmartListFavorite(id, storeId)
    return NextResponse.json(updated)
  }
  if (body.action === 'archive') {
    const updated = archiveSmartList(id, storeId)
    return NextResponse.json(updated)
  }

  const updated = { ...existing, ...body, id, storeId, updatedAt: new Date() }
  upsertSmartList(updated)
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const storeId = await getRequestStoreId()
  const existing = getSmartList(id, storeId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  deleteSmartList(id, storeId)
  return NextResponse.json({ ok: true })
}
