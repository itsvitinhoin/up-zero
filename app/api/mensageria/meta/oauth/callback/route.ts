import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { addIntegrationLog, updateMetaReviewState } from '@/lib/whatsapp/store'
import { getMetaOAuthRedirectUri, META_GRAPH_BASE, metaGraphGet } from '@/lib/whatsapp/meta'

export const dynamic = 'force-dynamic'

interface TokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: { message?: string }
}

interface ProfileResponse {
  id: string
  name: string
  email?: string
}

function redirectToReview(req: NextRequest, status: 'connected' | 'error') {
  const url = new URL('/mensageria', req.nextUrl.origin)
  url.searchParams.set('tab', 'meta-review')
  url.searchParams.set('meta_oauth', status)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const expectedState = cookieStore.get('meta_oauth_state')?.value
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error_description') ?? req.nextUrl.searchParams.get('error')

  if (error || !code || !state || !expectedState || state !== expectedState) {
    addIntegrationLog({
      type: 'ERROR',
      label: 'Meta OAuth failed',
      status: 'ERROR',
      detail: error || 'Missing code or invalid OAuth state.',
    })
    const res = redirectToReview(req, 'error')
    res.cookies.delete('meta_oauth_state')
    return res
  }

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) {
    addIntegrationLog({
      type: 'ERROR',
      label: 'Meta OAuth configuration missing',
      status: 'ERROR',
      detail: 'FACEBOOK_APP_SECRET and NEXT_PUBLIC_FACEBOOK_APP_ID are required for OAuth callback.',
    })
    const res = redirectToReview(req, 'error')
    res.cookies.delete('meta_oauth_state')
    return res
  }

  const redirectUri = getMetaOAuthRedirectUri(req.nextUrl.origin)
  const tokenParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  })

  const tokenRes = await fetch(`${META_GRAPH_BASE}/oauth/access_token`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams,
  })
  const tokenData = await tokenRes.json().catch(() => ({})) as TokenResponse

  if (!tokenRes.ok || !tokenData.access_token) {
    addIntegrationLog({
      type: 'ERROR',
      label: 'Meta OAuth token exchange failed',
      status: 'ERROR',
      detail: tokenData.error?.message ?? `HTTP ${tokenRes.status}`,
    })
    const res = redirectToReview(req, 'error')
    res.cookies.delete('meta_oauth_state')
    return res
  }

  const profileRes = await metaGraphGet<ProfileResponse>('/me?fields=id,name,email', tokenData.access_token)
  if (!profileRes.ok) {
    addIntegrationLog({
      type: 'ERROR',
      label: 'Meta profile fetch failed',
      status: 'ERROR',
      detail: profileRes.error.message,
    })
    const res = redirectToReview(req, 'error')
    res.cookies.delete('meta_oauth_state')
    return res
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null

  updateMetaReviewState({
    oauth: {
      profile: {
        id: profileRes.data.id,
        name: profileRes.data.name,
        email: profileRes.data.email,
      },
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresAt,
      connectedAt: new Date(),
    },
  })

  addIntegrationLog({
    type: 'OAUTH_CONNECTED',
    label: 'OAuth connected',
    status: 'READY',
    detail: `Meta user connected: ${profileRes.data.name}${profileRes.data.email ? ` (${profileRes.data.email})` : ''}.`,
  })

  const res = redirectToReview(req, 'connected')
  res.cookies.delete('meta_oauth_state')
  return res
}
