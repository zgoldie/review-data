import { requireAuthenticatedUser } from '../_lib/auth.js'
import { ensureAppConnection, getActiveCredential } from '../_lib/myApp.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await requireAuthenticatedUser(req)
    const connection = await ensureAppConnection(user.id)
    const credential = await getActiveCredential(user.id)

    return res.status(200).json({
      ok: true,
      userId: user.id,
      connected: Boolean(connection),
      secretConfigured: Boolean(credential),
      secretPreview: credential?.secret_prefix || null,
      createdAt: credential?.created_at || null,
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ error: error.message || 'Failed to load setup status' })
  }
}
