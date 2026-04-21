import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSmartLists, upsertSmartList } from '@/lib/campaigns/store'
import type { SmartList } from '@/lib/campaigns/types'

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

export async function GET() {
  const storeId = await getRequestStoreId()
  const lists = getSmartLists(storeId)
  return NextResponse.json(lists)
}

export async function POST(req: NextRequest) {
  const storeId = await getRequestStoreId()
  const body = await req.json() as Partial<SmartList>

  const now = new Date()
  const list: SmartList = {
    id: `sl-${Date.now()}`,
    storeId,
    name: body.name ?? 'Nova Lista',
    description: body.description ?? '',
    type: body.type ?? 'DYNAMIC',
    status: 'ACTIVE',
    visibilityScope: body.visibilityScope ?? 'TEAM',
    isFavorite: false,
    rules: body.rules ?? { id: `g-${Date.now()}`, logic: 'ALL', rules: [], groups: [] },
    exclusions: body.exclusions ?? [],
    resultCount: body.resultCount ?? 0,
    createdBy: body.createdBy ?? 'admin',
    createdAt: now,
    updatedAt: now,
    lastCalculatedAt: null,
  }

  upsertSmartList(list)
  return NextResponse.json(list, { status: 201 })
}
