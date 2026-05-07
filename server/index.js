import cors from 'cors'
import express from 'express'
import { initDb } from './db/client.js'
import { getBreakdownMetrics, getOverviewMetrics, getTrendMetrics } from './metrics/queries.js'
import { registerAppleWebhookRoute } from './webhooks/appleWebhook.js'

initDb()

const app = express()
const port = Number(process.env.PORT || 8787)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

registerAppleWebhookRoute(app)

app.get('/api/metrics/overview', (req, res) => {
  const rangeDays = Number(req.query.rangeDays || 30)
  res.json(getOverviewMetrics(rangeDays))
})

app.get('/api/metrics/breakdown', (req, res) => {
  const rangeDays = Number(req.query.rangeDays || 30)
  res.json(getBreakdownMetrics(rangeDays))
})

app.get('/api/metrics/trends', (req, res) => {
  const months = Number(req.query.months || 9)
  res.json({ trends: getTrendMetrics(months) })
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
