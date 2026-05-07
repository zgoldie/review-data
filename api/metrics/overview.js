import { getOverviewMetrics } from '../_lib/metrics.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rangeDays = Number(req.query.rangeDays || 30)
    const payload = await getOverviewMetrics(rangeDays)
    return res.status(200).json(payload)
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load overview metrics', detail: error.message })
  }
}
