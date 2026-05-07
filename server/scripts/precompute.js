import { db, initDb, withTransaction } from '../db/client.js'
import { getBreakdownMetrics, getOverviewMetrics, getTrendMetrics } from '../metrics/queries.js'

function insertBucketRows(metricName, distribution, rangeLabel) {
  const insert = db.prepare(
    `INSERT INTO summary_bucket_stats (metric_name, bucket_label, pct, sample_size, range_label)
     VALUES (?, ?, ?, ?, ?)`,
  )

  for (const bucket of distribution) {
    insert.run(metricName, bucket.bucket, bucket.pct, distribution.length, rangeLabel)
  }
}

function main() {
  initDb()
  const overview = getOverviewMetrics(30)
  const breakdown = getBreakdownMetrics(30)
  const trends = getTrendMetrics(9)

  withTransaction(() => {
    db.exec('DELETE FROM summary_bucket_stats; DELETE FROM summary_trends;')

    insertBucketRows('overview_review', overview.distribution, overview.stats.range)
    insertBucketRows('breakdown_build', breakdown.build, breakdown.stats.range)
    insertBucketRows('breakdown_queue', breakdown.queue, breakdown.stats.range)
    insertBucketRows('breakdown_review', breakdown.review, breakdown.stats.range)

    const insertTrend = db.prepare(
      `INSERT INTO summary_trends (month_label, p02, p25, p50, p75, p98, sample_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )

    for (const month of trends) {
      insertTrend.run(
        month.month,
        month.p10,
        month.p25,
        month.p50,
        month.p75,
        month.p100,
        trends.length,
      )
    }
  })

  console.log(`Precomputed ${overview.distribution.length + breakdown.build.length * 3} bucket rows and ${trends.length} trend rows.`)
}

main()
