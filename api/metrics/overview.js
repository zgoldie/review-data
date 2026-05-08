import { getOverviewMetrics } from '../_lib/metrics.js'

function parseRangeDays(input) {
  const value = Number(input ?? 30)
  if (!Number.isFinite(value)) {
    const error = new Error('rangeDays must be a number')
    error.statusCode = 400
    throw error
  }
  return Math.max(1, Math.min(365, Math.trunc(value)))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rangeDays = parseRangeDays(req.query.rangeDays)
    const payload = await getOverviewMetrics(rangeDays)
    return res.status(200).json(payload)
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ error: 'Failed to load overview metrics', detail: error.message })
  }
}
