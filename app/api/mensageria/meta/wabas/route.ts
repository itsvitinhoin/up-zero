import { NextRequest, NextResponse } from 'next/server'
import { addIntegrationLog } from '@/lib/whatsapp/store'
import { getMetaAccessToken, maskId, metaGraphGet, safeMetaError } from '@/lib/whatsapp/meta'

export const dynamic = 'force-dynamic'

interface Waba {
  id: string
  name?: string
  currency?: string
  owner_business_info?: { id?: string; name?: string }
}

interface WabaResponse {
  data?: Waba[]
}

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) {
    return NextResponse.json({ data: [], error: 'businessId is required.' }, { status: 400 })
  }

  const auth = getMetaAccessToken()
  if (!auth) {
    return NextResponse.json({ data: [], error: 'Meta OAuth or FACEBOOK_SYSTEM_USER_TOKEN is required.' }, { status: 400 })
  }

  const result = await metaGraphGet<WabaResponse>(
    `/${businessId}/client_whatsapp_business_accounts?fields=id,name,currency,owner_business_info&limit=100`,
    auth.token,
  )

  if (!result.ok) {
    addIntegrationLog({
      type: 'ERROR',
      label: 'WABA fetch failed',
      status: 'ERROR',
      detail: safeMetaError(result.error),
    })
    return NextResponse.json({ data: [], error: safeMetaError(result.error) }, { status: result.status })
  }

  return NextResponse.json({
    data: (result.data.data ?? []).map((waba) => ({
      id: waba.id,
      idMasked: maskId(waba.id),
      name: waba.name ?? 'Unnamed WABA',
      currency: waba.currency,
      ownerBusinessIdMasked: maskId(waba.owner_business_info?.id),
      ownerBusinessName: waba.owner_business_info?.name,
    })),
    authSource: auth.source,
  })
}
