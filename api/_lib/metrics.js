import { pgQuery } from './db.js'

const BUCKETS = [
  { label: '0-12', min: 0, max: 12 },
  { label: '12-24', min: 12, max: 24 },
  { label: '24-36', min: 24, max: 36 },
  { label: '36-48', min: 36, max: 48 },
  { label: '48-60', min: 48, max: 60 },
  { label: '60-72', min: 60, max: 72 },
  { label: '72-84', min: 72, max: 84 },
  { label: '84-96', min: 84, max: 96 },
  { label: '96-108', min: 96, max: 108 },
  { label: '108-120', min: 108, max: 120 },
  { label: '120+', min: 120, max: Number.POSITIVE_INFINITY },
]

function round(value) {
  return Number(value.toFixed(2))
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  if (sorted.length === 1) return sorted[0]
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

function appKeyFromVersionId(appVersionId) {
  if (typeof appVersionId !== 'string') return ''
  const [appId] = appVersionId.split(':')
  return appId || appVersionId
}

function totalHours(row) {
  const parts = [row.build_hours, row.queue_hours, row.review_hours]
  if (parts.some((value) => typeof value !== 'number')) return null
  return parts[0] + parts[1] + parts[2]
}

function toBuckets(hoursList) {
  const total = hoursList.length
  const counts = new Map(BUCKETS.map((bucket) => [bucket.label, 0]))
  for (const hours of hoursList) {
    const bucket = BUCKETS.find((entry) => hours >= entry.min && hours < entry.max)
    if (bucket) counts.set(bucket.label, counts.get(bucket.label) + 1)
  }
  return BUCKETS.map((bucket) => ({
    bucket: bucket.label,
    pct: total > 0 ? round((counts.get(bucket.label) / total) * 100) : 0,
  }))
}

async function getRecentCycles(days = 30) {
  const result = await pgQuery(
    `SELECT user_id, app_version_id, final_state, completed_at, build_hours, queue_hours, review_hours
     FROM version_durations
     WHERE completed_at IS NOT NULL
       AND completed_at >= NOW() - ($1::text || ' days')::interval
     ORDER BY completed_at DESC`,
    [days],
  )
  return result.rows.map((row) => ({
    ...row,
    build_hours: row.build_hours == null ? null : Number(row.build_hours),
    queue_hours: row.queue_hours == null ? null : Number(row.queue_hours),
    review_hours: row.review_hours == null ? null : Number(row.review_hours),
  }))
}

function computeStats(rows, days) {
  const endToEndRows = rows
    .map((row) => ({ ...row, total_hours: totalHours(row) }))
    .filter((row) => typeof row.total_hours === 'number')

  const reviewsCount = endToEndRows.length
  const under24 = endToEndRows.filter((row) => row.total_hours <= 24).length
  const under48 = endToEndRows.filter((row) => row.total_hours <= 48).length
  const rejected = rows.filter((row) => row.final_state === 'REJECTED').length

  return {
    apps: new Set(rows.map((row) => appKeyFromVersionId(row.app_version_id))).size,
    reviews: reviewsCount,
    range: `last ${days} days`,
    under24hrs: reviewsCount ? round((under24 / reviewsCount) * 100) : 0,
    under48hrs: reviewsCount ? round((under48 / reviewsCount) * 100) : 0,
    rejected: rows.length ? round((rejected / rows.length) * 100) : 0,
  }
}

export async function getOverviewMetrics(days = 30) {
  const rows = await getRecentCycles(days)
  const reviewHours = rows.map((row) => totalHours(row)).filter((value) => typeof value === 'number')
  return {
    distribution: toBuckets(reviewHours),
    stats: computeStats(rows, days),
  }
}

export async function getTrendMetrics(months = 9) {
  const result = await pgQuery(
    `SELECT completed_at, build_hours, queue_hours, review_hours
     FROM version_durations
     WHERE completed_at IS NOT NULL
       AND build_hours IS NOT NULL
       AND queue_hours IS NOT NULL
       AND review_hours IS NOT NULL
       AND completed_at >= NOW() - ($1::text || ' months')::interval
     ORDER BY completed_at ASC`,
    [months],
  )

  const monthMap = new Map()
  for (const row of result.rows) {
    const endToEndHours = totalHours({
      build_hours: Number(row.build_hours),
      queue_hours: Number(row.queue_hours),
      review_hours: Number(row.review_hours),
    })
    if (typeof endToEndHours !== 'number') continue
    const date = new Date(row.completed_at)
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    if (!monthMap.has(month)) monthMap.set(month, [])
    monthMap.get(month).push(endToEndHours)
  }

  return [...monthMap.entries()].map(([month, values]) => {
    const sorted = values.slice().sort((a, b) => a - b)
    return {
      month,
      p0: round(percentile(sorted, 0)),
      p10: round(percentile(sorted, 0.1)),
      p25: round(percentile(sorted, 0.25)),
      p50: round(percentile(sorted, 0.5)),
      p75: round(percentile(sorted, 0.75)),
      p90: round(percentile(sorted, 0.9)),
      p100: round(percentile(sorted, 1)),
    }
  })
}
