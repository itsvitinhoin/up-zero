import { NextRequest, NextResponse } from 'next/server'
import { addLog, updateIntegration } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function GET(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.redirect(new URL('/mensageria?tab=connection&error=forbidden', req.url))
  }

  const params = new URL(req.url).searchParams
  const hasCode = Boolean(params.get('code'))
  const error = params.get('error') || params.get('error_description')

  if (error) {
    await updateIntegration({ oauthStatus: 'failed', lastError: { message: error } })
    await addLog({
      type: 'oauth_completed',
      status: 'failed',
      description: 'Failed: Meta OAuth callback returned an error.',
      error,
      recommendedAction: 'Restart OAuth and confirm the app configuration in Meta for Developers.',
    })
    return NextResponse.redirect(new URL('/mensageria?tab=connection', req.url))
  }

  await addLog({
    type: 'oauth_completed',
    status: hasCode ? 'info' : 'needs_attention',
    description: hasCode
      ? 'Meta OAuth callback received. Code is handled server-side and is not exposed.'
      : 'Meta OAuth callback received without an auth code.',
    recommendedAction: hasCode ? 'Complete WABA verification.' : 'Restart OAuth.',
  })

  return NextResponse.redirect(new URL('/mensageria?tab=connection', req.url))
}
