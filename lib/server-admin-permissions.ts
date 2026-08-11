import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

type PermissionCheckPayload = {
  has_permission?: boolean
}

function resolveBackendBaseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_RUST_URL || process.env.NEXT_PUBLIC_API_URL || '').trim()
  return base ? base.replace(/\/$/, '') : null
}

export async function hasAdminPermission(permissionCode: string): Promise<boolean> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value?.trim()

  if (!adminToken) {
    return false
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return true
  }

  try {
    const permissionUrl = new URL('/permissions/check', base)
    permissionUrl.searchParams.set('code', permissionCode)

    const response = await fetch(permissionUrl, {
      headers: {
        cookie: `adminAuthToken=${adminToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return false
    }

    const payload = (await response.json()) as PermissionCheckPayload
    return payload?.has_permission === true
  } catch {
    return false
  }
}

export async function ensureAdminPermission(
  permissionCode: string,
  deniedRedirect = '/no-access',
): Promise<void> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value?.trim()

  if (!adminToken) {
    redirect('/login')
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return
  }

  const permissionUrl = new URL('/permissions/check', base)
  permissionUrl.searchParams.set('code', permissionCode)

  let response: Response
  try {
    response = await fetch(permissionUrl, {
      headers: {
        cookie: `adminAuthToken=${adminToken}`,
      },
      cache: 'no-store',
    })
  } catch {
    redirect(deniedRedirect)
  }

  if (response.status === 401) {
    redirect('/login')
  }

  if (!response.ok) {
    redirect(deniedRedirect)
  }

  let payload: PermissionCheckPayload
  try {
    payload = (await response.json()) as PermissionCheckPayload
  } catch {
    redirect(deniedRedirect)
  }

  if (payload?.has_permission !== true) {
    redirect(deniedRedirect)
  }
}

export async function ensureAnyAdminPermission(
  permissionCodes: string[],
  deniedRedirect = '/no-access',
): Promise<void> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('adminAuthToken')?.value?.trim()

  if (!adminToken) {
    redirect('/login')
  }

  const base = resolveBackendBaseUrl()
  if (!base) {
    return
  }

  const normalizedCodes = permissionCodes
    .map((code) => String(code || '').trim())
    .filter(Boolean)

  if (normalizedCodes.length === 0) {
    return
  }

  for (const permissionCode of normalizedCodes) {
    const permissionUrl = new URL('/permissions/check', base)
    permissionUrl.searchParams.set('code', permissionCode)

    let response: Response
    try {
      response = await fetch(permissionUrl, {
        headers: {
          cookie: `adminAuthToken=${adminToken}`,
        },
        cache: 'no-store',
      })
    } catch {
      continue
    }

    if (response.status === 401) {
      redirect('/login')
    }

    if (!response.ok) {
      continue
    }

    let payload: PermissionCheckPayload
    try {
      payload = (await response.json()) as PermissionCheckPayload
    } catch {
      continue
    }

    if (payload?.has_permission === true) {
      return
    }
  }

  redirect(deniedRedirect)
}
