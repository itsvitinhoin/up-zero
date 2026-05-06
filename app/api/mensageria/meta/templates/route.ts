import { NextRequest, NextResponse } from 'next/server'
import { addIntegrationLog } from '@/lib/whatsapp/store'
import { getMetaAccessToken, metaGraphGet, safeMetaError } from '@/lib/whatsapp/meta'
import type { WaTemplateComponent } from '@/lib/whatsapp/types'

export const dynamic = 'force-dynamic'

interface MetaTemplate {
  id: string
  name: string
  language: string
  category: string
  status: string
  components?: WaTemplateComponent[]
}

interface TemplateResponse {
  data?: MetaTemplate[]
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

  const result = await metaGraphGet<TemplateResponse>(
    `/${wabaId}/message_templates?fields=id,name,language,category,status,components&limit=100`,
    auth.token,
  )

  if (!result.ok) {
    addIntegrationLog({
      type: 'ERROR',
      label: 'Message templates fetch failed',
      status: 'ERROR',
      detail: safeMetaError(result.error),
    })
    return NextResponse.json({ data: [], error: safeMetaError(result.error) }, { status: result.status })
  }

  addIntegrationLog({
    type: 'TEMPLATES_FETCHED',
    label: 'Templates fetched',
    status: 'READY',
    detail: `${result.data.data?.length ?? 0} WhatsApp message template(s) fetched from Meta.`,
  })

  return NextResponse.json({
    data: (result.data.data ?? []).map((template) => ({
      id: template.id,
      name: template.name,
      language: template.language,
      category: template.category,
      status: template.status,
      components: template.components ?? [],
    })),
    authSource: auth.source,
  })
}
