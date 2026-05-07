import { createHash, randomBytes } from 'node:crypto'

export function hashWebhookSecret(secret) {
  return createHash('sha256').update(secret, 'utf8').digest('hex')
}

export function generateWebhookSecret() {
  return `asc_${randomBytes(24).toString('base64url')}`
}

export function toSecretPreview(secret) {
  return `${secret.slice(0, 8)}...`
}
