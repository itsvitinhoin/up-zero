import { NextRequest, NextResponse } from 'next/server'
import { addIntegrationLog } from '@/lib/whatsapp/store'
import { getMetaAccessToken, maskId, maskPhone, metaGraphGet, safeMetaError } from '@/lib/whatsapp/meta'

export const dynamic = 'force-dynamic'

interface PhoneNumber {
  id: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
  status?: string
}

interface PhoneNumberResponse {
  data?: PhoneNumber[]
}

export async function GET(req: NextRequest) {
  const wabaId = req.nextUrl.searchParams.get('wabaId')
  if (!wabaId) {
    return NextResponse.json({ data: [], error: 'wabaId is required.' }, { status: 400 })
  }

  const auth = getMetaAccessToken()
  if (!auth) {
    return NextResponse.json({ data: [], error: 'Meta OAuth or FACEBOOK_SYSTEM_USER_TOKEN is required.' }, { status: 400 })
  }

  const result = await metaGraphGet<PhoneNumberResponse>(
    `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status&limit=100`,
    auth.token,
  )

  if (!result.ok) {
    addIntegrationLog({
      type: 'ERROR',
      label: 'Phone numbers fetch failed',
      status: 'ERROR',
      detail: safeMetaError(result.error),
    })
    return NextResponse.json({ data: [], error: safeMetaError(result.error) }, { status: result.status })
  }

  return NextResponse.json({
    data: (result.data.data ?? []).map((phone) => ({
      id: phone.id,
      idMasked: maskId(phone.id),
      displayPhoneNumber: phone.display_phone_number ?? '',
      displayPhoneNumberMasked: maskPhone(phone.display_phone_number),
      verifiedName: phone.verified_name ?? '',
      qualityRating: phone.quality_rating ?? 'UNKNOWN',
      status: phone.status ?? 'UNKNOWN',
    })),
    authSource: auth.source,
  })
}
