import { db } from '../db/client.js'

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

function round(value) {
  return Number(value.toFixed(2))
}

function totalHours(row) {
  const parts = [row.build_hours, row.queue_hours, row.review_hours]
  if (parts.some((value) => typeof value !== 'number')) return null
  return parts[0] + parts[1] + parts[2]
}

function appKeyFromVersionId(appVersionId) {
  if (typeof appVersionId !== 'string') return ''
  const [appId] = appVersionId.split(':')
  return appId || appVersionId
}

function toBuckets(hoursList) {
  const total = hoursList.length
  const counts = new Map(BUCKETS.map((bucket) => [bucket.label, 0]))

  for (const hours of hoursList) {
    const bucket = BUCKETS.find((entry) => hours >= entry.min && hours < entry.max)
    if (bucket) {
      counts.set(bucket.label, counts.get(bucket.label) + 1)
    }
  }

  return BUCKETS.map((bucket) => {
    const count = counts.get(bucket.label)
    const pct = total > 0 ? (count / total) * 100 : 0
    return {
      bucket: bucket.label,
      pct: round(pct),
    }
  })
}

function getRecentCycles(days = 30) {
  return db
    .prepare(
      `SELECT user_id, app_version_id, final_state, completed_at, build_hours, queue_hours, review_hours
       FROM version_durations
       WHERE completed_at IS NOT NULL
         AND datetime(completed_at) >= datetime('now', ?)
       ORDER BY completed_at DESC`,
    )
    .all(`-${days} days`)
}

function selectLatestCyclePerVersion(rows) {
  const seen = new Set()
  const latest = []

  for (const row of rows) {
    const key = `${row.user_id}:${row.app_version_id}`
    if (!seen.has(key)) {
      seen.add(key)
      latest.push(row)
    }
  }

  return latest
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

export function getOverviewMetrics(days = 30) {
  const rows = getRecentCycles(days)
  const reviewHours = rows.map((row) => totalHours(row)).filter((value) => typeof value === 'number')
  return {
    distribution: toBuckets(reviewHours),
    stats: computeStats(rows, days),
  }
}

export function getBreakdownMetrics(days = 30) {
  const rows = selectLatestCyclePerVersion(getRecentCycles(days))
  const buildHours = rows.map((row) => row.build_hours).filter((value) => typeof value === 'number')
  const queueHours = rows.map((row) => row.queue_hours).filter((value) => typeof value === 'number')
  const reviewHours = rows.map((row) => row.review_hours).filter((value) => typeof value === 'number')

  return {
    build: toBuckets(buildHours),
    queue: toBuckets(queueHours),
    review: toBuckets(reviewHours),
    stats: {
      apps: new Set(rows.map((row) => appKeyFromVersionId(row.app_version_id))).size,
      reviews: rows.length,
      range: `last ${days} days`,
    },
  }
}

export function getTrendMetrics(months = 9) {
  const rows = db
    .prepare(
      `SELECT completed_at, build_hours, queue_hours, review_hours
       FROM version_durations
       WHERE completed_at IS NOT NULL
         AND build_hours IS NOT NULL
         AND queue_hours IS NOT NULL
         AND review_hours IS NOT NULL
         AND datetime(completed_at) >= datetime('now', ?)
       ORDER BY completed_at ASC`,
    )
    .all(`-${months * 31} days`)

  const monthMap = new Map()
  for (const row of rows) {
    const date = new Date(row.completed_at)
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    const endToEndHours = totalHours(row)
    if (typeof endToEndHours !== 'number') continue
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
