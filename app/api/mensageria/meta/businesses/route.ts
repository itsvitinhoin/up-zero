import { NextResponse } from 'next/server'
import { addIntegrationLog } from '@/lib/whatsapp/store'
import { getMetaAccessToken, maskId, metaGraphGet, safeMetaError } from '@/lib/whatsapp/meta'

export const dynamic = 'force-dynamic'

interface Business {
  id: string
  name: string
}

interface BusinessResponse {
  data?: Business[]
}

export async function GET() {
  const auth = getMetaAccessToken()
  if (!auth) {
    return NextResponse.json({ data: [], error: 'Meta OAuth or FACEBOOK_SYSTEM_USER_TOKEN is required.' }, { status: 400 })
  }

  const result = await metaGraphGet<BusinessResponse>('/me/businesses?fields=id,name&limit=100', auth.token)
  if (!result.ok) {
    addIntegrationLog({
      type: 'ERROR',
      label: 'Businesses fetch failed',
      status: 'ERROR',
      detail: safeMetaError(result.error),
    })
    return NextResponse.json({ data: [], error: safeMetaError(result.error) }, { status: result.status })
  }

  return NextResponse.json({
    data: (result.data.data ?? []).map((business) => ({
      ...business,
      idMasked: maskId(business.id),
    })),
    authSource: auth.source,
  })
}
