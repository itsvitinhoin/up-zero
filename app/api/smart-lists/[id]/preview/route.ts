import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSmartList, updateSmartListResultCount } from '@/lib/campaigns/store'
import { previewSmartList } from '@/lib/campaigns/engine'
import { adminMockCustomers, adminMockOrders } from '@/lib/admin-mock-data'

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const storeId = await getRequestStoreId()

  // Accept either a saved list id or inline rules in the body
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  let list = getSmartList(id, storeId)

  // If body.rules is provided, use that (for live preview before save)
  if (!list && body.rules) {
    const { SmartList: _SL, ...rest } = {} as Record<string, unknown>
    list = {
      id,
      storeId,
      name: 'preview',
      description: '',
      type: 'DYNAMIC',
      status: 'ACTIVE',
      visibilityScope: 'TEAM',
      isFavorite: false,
      rules: body.rules as import('@/lib/campaigns/types').FilterGroup,
      exclusions: (body.exclusions ?? []) as import('@/lib/campaigns/types').FilterRule[],
      resultCount: 0,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastCalculatedAt: null,
    }
  }

  if (body.rules && list) {
    list = {
      ...list,
      rules: body.rules as import('@/lib/campaigns/types').FilterGroup,
      exclusions: (body.exclusions ?? list.exclusions) as import('@/lib/campaigns/types').FilterRule[],
    }
  }

  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Try real backend first, fall back to mock data
  let customers = adminMockCustomers
  const ordersByCustomer: Record<string, import('@/lib/types').Order[]> = {}

  const rustBase = (process.env.NEXT_PUBLIC_RUST_URL ?? '').trim().replace(/\/$/, '')
  if (rustBase) {
    try {
      const res = await fetch(`${rustBase}/stores/${storeId}/clients?limit=500`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000),
      })
      if (res.ok) {
        const data = await res.json() as { clients?: unknown[]; data?: unknown[] }
        const raw = data.clients ?? data.data ?? []
        if (raw.length > 0) customers = raw as typeof customers
      }
    } catch {
      // use mock fallback
    }
  }

  // Build ordersByCustomer from mock orders
  for (const order of adminMockOrders) {
    const cid = order.customerId
    if (!ordersByCustomer[cid]) ordersByCustomer[cid] = []
    ordersByCustomer[cid].push(order)
  }

  const result = previewSmartList(list, customers, ordersByCustomer)

  // Persist result count if this is a saved list
  if (getSmartList(id, storeId)) {
    updateSmartListResultCount(id, storeId, result.count)
  }

  return NextResponse.json(result)
}
