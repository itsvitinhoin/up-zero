import { cookies } from 'next/headers'
import { assertOrigin, body, COOKIE, errorResponse, getMasterSession, login, logout, privateHeaders } from '../../../lib/server'

export async function GET() {
  try { return Response.json(await getMasterSession(), { headers: privateHeaders }) } catch (error) { return errorResponse(error) }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request)
    const result = await login(await body(request))
    ;(await cookies()).set(COOKIE, result.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 8 * 3600 })
    return Response.json(result.session, { headers: privateHeaders })
  } catch (error) { return errorResponse(error) }
}
export async function DELETE(request: Request) {
  try {
    assertOrigin(request)
    await logout()
    ;(await cookies()).delete(COOKIE)
    return Response.json({ success: true }, { headers: privateHeaders })
  } catch (error) { return errorResponse(error) }
}
