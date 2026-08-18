import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const CREDENTIAL_VERSION = 'v1'

function encryptionKey(): Buffer {
  const secret = process.env.AI_CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (!secret || secret.length < 24) {
    throw new Error('AI_CREDENTIAL_ENCRYPTION_KEY não está configurada com segurança no servidor.')
  }
  return createHash('sha256').update(secret).digest()
}

export function encryptCredential(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [CREDENTIAL_VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptCredential(value: string): string {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.')
  if (version !== CREDENTIAL_VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('A credencial de IA salva é inválida e precisa ser cadastrada novamente.')
  }

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
