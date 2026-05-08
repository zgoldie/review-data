import { requireAuthenticatedUser } from '../../_lib/auth.js'
import { getTrendMetrics } from '../../_lib/metrics.js'

function parseMonths(input) {
  const value = Number(input ?? 9)
  if (!Number.isFinite(value)) {
    const error = new Error('months must be a number')
    error.statusCode = 400
    throw error
  }
  return Math.max(1, Math.min(24, Math.trunc(value)))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await requireAuthenticatedUser(req)
    const months = parseMonths(req.query.months)
    const trends = await getTrendMetrics(months, user.id)
    return res.status(200).json({ trends })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ error: 'Failed to load my-app trend metrics', detail: error.message })
  }
}
