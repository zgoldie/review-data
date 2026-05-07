import { requireAuthenticatedUser } from '../_lib/auth.js'
import { ensureAppConnection, getActiveCredential } from '../_lib/myApp.js'
import { generateWebhookSecret, hashWebhookSecret, toSecretPreview } from '../_lib/secrets.js'
import { pgQuery } from '../_lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await requireAuthenticatedUser(req)
    await ensureAppConnection(user.id)

    const existing = await getActiveCredential(user.id)
    if (existing) {
      return res.status(409).json({
        error: 'Active webhook secret already exists. Use rotate endpoint to replace it.',
        secretPreview: existing.secret_prefix,
      })
    }

    const secret = generateWebhookSecret()
    const secretHash = hashWebhookSecret(secret)
    const secretPreview = toSecretPreview(secret)

    await pgQuery(
      `INSERT INTO webhook_credentials (user_id, secret_hash, secret_prefix, is_active)
       VALUES ($1::uuid, $2, $3, TRUE)`,
      [user.id, secretHash, secretPreview],
    )

    return res.status(201).json({
      ok: true,
      secret,
      secretPreview,
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ error: error.message || 'Failed to create webhook secret' })
  }
}
