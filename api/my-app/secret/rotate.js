import { requireAuthenticatedUser } from '../../_lib/auth.js'
import { ensureAppConnection } from '../../_lib/myApp.js'
import { encryptWebhookSecret, generateWebhookSecret, hashWebhookSecret, toSecretPreview } from '../../_lib/secrets.js'
import { withPgTransaction } from '../../_lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await requireAuthenticatedUser(req)
    await ensureAppConnection(user.id)

    const secret = generateWebhookSecret()
    const secretEncrypted = encryptWebhookSecret(secret)
    const secretHash = hashWebhookSecret(secret)
    const secretPreview = toSecretPreview(secret)

    await withPgTransaction(async (client) => {
      await client.query(
        `UPDATE webhook_credentials
         SET is_active = FALSE, revoked_at = NOW(), rotated_at = NOW()
         WHERE user_id = $1::uuid
           AND is_active = TRUE
           AND revoked_at IS NULL`,
        [user.id],
      )

      await client.query(
        `INSERT INTO webhook_credentials (user_id, secret_encrypted, secret_hash, secret_prefix, is_active)
         VALUES ($1::uuid, $2, $3, $4, TRUE)`,
        [user.id, secretEncrypted, secretHash, secretPreview],
      )
    })

    return res.status(201).json({
      ok: true,
      secret,
      secretPreview,
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ error: error.message || 'Failed to rotate webhook secret' })
  }
}
