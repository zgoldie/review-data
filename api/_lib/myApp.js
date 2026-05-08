import { pgQuery } from './db.js'
import { generateWebhookToken } from './secrets.js'

export async function ensureAppConnection(userId) {
  const token = generateWebhookToken()
  const result = await pgQuery(
    `INSERT INTO app_connections (user_id)
     VALUES ($1::uuid)
     ON CONFLICT (user_id)
     DO UPDATE
       SET updated_at = NOW(),
           webhook_token = COALESCE(app_connections.webhook_token, $2)
     RETURNING id, user_id, webhook_token`,
    [userId, token],
  )
  return result.rows[0]
}

export async function getActiveCredential(userId) {
  const result = await pgQuery(
    `SELECT id, user_id, secret_prefix, is_active, created_at, rotated_at, revoked_at
     FROM webhook_credentials
     WHERE user_id = $1::uuid
       AND is_active = TRUE
       AND revoked_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  )
  return result.rows[0] || null
}
