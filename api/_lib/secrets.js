import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ENCRYPTION_ALGO = 'aes-256-gcm'

function getEncryptionKey() {
  const keyB64 = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY || ''
  if (!keyB64) {
    throw new Error('Missing WEBHOOK_SECRET_ENCRYPTION_KEY')
  }

  let key
  try {
    key = Buffer.from(keyB64, 'base64')
  } catch {
    throw new Error('Invalid WEBHOOK_SECRET_ENCRYPTION_KEY encoding')
  }

  if (key.length !== 32) {
    throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY must decode to 32 bytes (base64)')
  }

  return key
}

export function hashWebhookSecret(secret) {
  return createHash('sha256').update(secret, 'utf8').digest('hex')
}

export function generateWebhookSecret() {
  return `asc_${randomBytes(24).toString('base64url')}`
}

export function generateWebhookToken() {
  return `hook_${randomBytes(18).toString('base64url')}`
}

export function toSecretPreview(secret) {
  return `${secret.slice(0, 8)}...`
}

export function encryptWebhookSecret(secret) {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ENCRYPTION_ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `v1:${iv.toString('base64url')}:${ciphertext.toString('base64url')}:${authTag.toString('base64url')}`
}

export function decryptWebhookSecret(secretEncrypted) {
  if (typeof secretEncrypted !== 'string' || !secretEncrypted) {
    throw new Error('Encrypted secret is missing')
  }

  const [version, ivPart, ciphertextPart, authTagPart] = secretEncrypted.split(':')
  if (version !== 'v1' || !ivPart || !ciphertextPart || !authTagPart) {
    throw new Error('Encrypted secret format is invalid')
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(ivPart, 'base64url')
  const ciphertext = Buffer.from(ciphertextPart, 'base64url')
  const authTag = Buffer.from(authTagPart, 'base64url')
  const decipher = createDecipheriv(ENCRYPTION_ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
