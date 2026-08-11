const LOCAL_ADMIN_TOKEN_PREFIX = 'upzero-local'
const LOCAL_ADMIN_TOKEN_ISSUER = 'upzero-local-admin'

export type LocalAdminTokenPayload = {
  sub: string
  id: string
  name: string
  email: string
  role: 'ADMIN'
  store_id: number
  iat: number
  exp: number
  iss: typeof LOCAL_ADMIN_TOKEN_ISSUER
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export function isLocalAdminToken(token: string): boolean {
  return token.startsWith(`${LOCAL_ADMIN_TOKEN_PREFIX}.`)
}

export async function secureTextEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ])
  const leftBytes = new Uint8Array(leftHash)
  const rightBytes = new Uint8Array(rightHash)
  let difference = 0

  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index]
  }

  return difference === 0
}

export async function createLocalAdminToken(
  payload: Omit<LocalAdminTokenPayload, 'iss'>,
  secret: string,
): Promise<string> {
  const payloadSegment = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ ...payload, iss: LOCAL_ADMIN_TOKEN_ISSUER })),
  )
  const signingInput = `${LOCAL_ADMIN_TOKEN_PREFIX}.${payloadSegment}`
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importSigningKey(secret),
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`
}

export async function verifyLocalAdminToken(
  token: string,
  secret: string,
): Promise<LocalAdminTokenPayload | null> {
  try {
    const [prefix, payloadSegment, signatureSegment, ...extra] = token.split('.')
    if (
      prefix !== LOCAL_ADMIN_TOKEN_PREFIX
      || !payloadSegment
      || !signatureSegment
      || extra.length > 0
      || !secret
    ) {
      return null
    }

    const signingInput = `${prefix}.${payloadSegment}`
    const validSignature = await crypto.subtle.verify(
      'HMAC',
      await importSigningKey(secret),
      base64UrlToBytes(signatureSegment),
      new TextEncoder().encode(signingInput),
    )
    if (!validSignature) return null

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadSegment)),
    ) as Partial<LocalAdminTokenPayload>
    const now = Math.floor(Date.now() / 1000)

    if (
      payload.iss !== LOCAL_ADMIN_TOKEN_ISSUER
      || payload.role !== 'ADMIN'
      || !payload.sub
      || !payload.email
      || !Number.isInteger(payload.store_id)
      || Number(payload.store_id) <= 0
      || !Number.isFinite(payload.exp)
      || Number(payload.exp) <= now
    ) {
      return null
    }

    return payload as LocalAdminTokenPayload
  } catch {
    return null
  }
}
