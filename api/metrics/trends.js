import { getTrendMetrics } from '../_lib/metrics.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const months = Number(req.query.months || 9)
    const trends = await getTrendMetrics(months)
    return res.status(200).json({ trends })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load trend metrics', detail: error.message })
  }
}
