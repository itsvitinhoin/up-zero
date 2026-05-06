import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getMetaOAuthRedirectUri, META_GRAPH_VERSION, META_REVIEW_SCOPES } from '@/lib/whatsapp/meta'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
  if (!appId) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_FACEBOOK_APP_ID is not configured.' }, { status: 500 })
  }

  const redirectUri = getMetaOAuthRedirectUri(req.nextUrl.origin)
  const state = randomBytes(24).toString('hex')
  const authUrl = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`)
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', META_REVIEW_SCOPES.join(','))

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 10 * 60,
  })
  return res
}
