import { NextResponse } from 'next/server'
import { META_PERMISSIONS_NOT_REQUESTED_NOW, META_REQUIRED_PERMISSIONS } from '@/lib/whatsapp/types'
import { addLog, updateIntegration } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'


export async function GET() {
  const permission = await checkUserPermission('messaging.manage_settings').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar configurações de mensageria' }, { status: 403 })
  }

  await updateIntegration({ oauthStatus: 'started', status: 'started' })
  await addLog({
    type: 'oauth_started',
    status: 'info',
    description: 'Meta OAuth flow started.',
    safePayload: {
      requestedPermissions: META_REQUIRED_PERMISSIONS,
      notRequestedNow: META_PERMISSIONS_NOT_REQUESTED_NOW,
    },
    recommendedAction: 'Complete Meta Login and grant all requested permissions.',
  })

  return NextResponse.json({
    appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? null,
    configId: process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID ?? null,
    requestedPermissions: META_REQUIRED_PERMISSIONS,
    notRequestedNow: META_PERMISSIONS_NOT_REQUESTED_NOW,
  })
}
