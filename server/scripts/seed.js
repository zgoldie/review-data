import { db, initDb, withTransaction } from '../db/client.js'
import { recomputeDurationsForVersion } from '../derive/durations.js'

function createRng(seed) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

function sampleReviewHours(rand) {
  const roll = rand()
  if (roll < 0.88) return 0.5 + rand() * 1.5
  if (roll < 0.98) return 2 + rand() * 4
  return 6 + rand() * 6
}

function sampleBuildHours(rand) {
  const roll = rand()
  if (roll < 0.89) return 0.25 + rand() * 1.75
  if (roll < 0.98) return 2 + rand() * 2
  return 4 + rand() * 4
}

function sampleQueueHours(rand) {
  const roll = rand()
  if (roll < 0.12) return 2 + rand() * 10
  if (roll < 0.5) return 12 + rand() * 18
  if (roll < 0.78) return 30 + rand() * 18
  if (roll < 0.9) return 48 + rand() * 24
  if (roll < 0.97) return 72 + rand() * 48
  return 120 + rand() * 96
}

function isoOffset(referenceDate, offsetHours) {
  const ms = referenceDate.getTime() + offsetHours * 60 * 60 * 1000
  return new Date(ms).toISOString()
}

function createEvent(eventId, userId, appVersionId, oldState, newState, timestamp) {
  return {
    event_id: eventId,
    user_id: userId,
    app_version_id: appVersionId,
    old_state: oldState,
    new_state: newState,
    event_timestamp: timestamp,
    payload_json: JSON.stringify({
      event_id: eventId,
      user_id: userId,
      app_version_id: appVersionId,
      old_state: oldState,
      new_state: newState,
      timestamp,
    }),
  }
}

function buildEventStream() {
  const rand = createRng(42)
  const events = []
  let eventCounter = 1

  const users = Array.from({ length: 28 }, (_, index) => `user-${index + 1}`)
  const appIds = Array.from({ length: 140 }, (_, index) => `app-${index + 1}`)
  const appVersionCounters = new Map(appIds.map((appId) => [appId, 0]))
  const appVersions = Array.from({ length: 482 }, (_, index) => {
    const appId = appIds[index % appIds.length]
    const nextVersion = appVersionCounters.get(appId) + 1
    appVersionCounters.set(appId, nextVersion)
    return `${appId}:v${nextVersion}`
  })
  const now = new Date()

  for (const appVersionId of appVersions) {
    const userId = users[Math.floor(rand() * users.length)]
    const completedAt = new Date(now.getTime() - rand() * 270 * 24 * 60 * 60 * 1000)
    const buildHours = sampleBuildHours(rand)
    const queueHours = sampleQueueHours(rand)
    const reviewHours = sampleReviewHours(rand)
    const isRejected = rand() < 0.08

    const inReviewAt = isoOffset(completedAt, -reviewHours)
    const readyAt = isoOffset(new Date(inReviewAt), -queueHours)
    const prepareAt = isoOffset(new Date(readyAt), -buildHours)
    const finalState = isRejected ? 'REJECTED' : 'READY_FOR_SALE'

    events.push(
      createEvent(`evt-${eventCounter++}`, userId, appVersionId, null, 'PREPARE_FOR_SUBMISSION', prepareAt),
      createEvent(`evt-${eventCounter++}`, userId, appVersionId, 'PREPARE_FOR_SUBMISSION', 'READY_FOR_REVIEW', readyAt),
      createEvent(`evt-${eventCounter++}`, userId, appVersionId, 'READY_FOR_REVIEW', 'IN_REVIEW', inReviewAt),
      createEvent(`evt-${eventCounter++}`, userId, appVersionId, 'IN_REVIEW', finalState, completedAt.toISOString()),
    )

    if (isRejected && rand() < 0.35) {
      const retryPrepare = isoOffset(completedAt, 2 + rand() * 18)
      const retryBuildHours = sampleBuildHours(rand)
      const retryQueueHours = sampleQueueHours(rand)
      const retryReviewHours = sampleReviewHours(rand)

      const retryReady = isoOffset(new Date(retryPrepare), retryBuildHours)
      const retryInReview = isoOffset(new Date(retryReady), retryQueueHours)
      const retryDone = isoOffset(new Date(retryInReview), retryReviewHours)

      events.push(
        createEvent(`evt-${eventCounter++}`, userId, appVersionId, 'REJECTED', 'PREPARE_FOR_SUBMISSION', retryPrepare),
        createEvent(`evt-${eventCounter++}`, userId, appVersionId, 'PREPARE_FOR_SUBMISSION', 'READY_FOR_REVIEW', retryReady),
        createEvent(`evt-${eventCounter++}`, userId, appVersionId, 'READY_FOR_REVIEW', 'IN_REVIEW', retryInReview),
        createEvent(`evt-${eventCounter++}`, userId, appVersionId, 'IN_REVIEW', 'READY_FOR_SALE', retryDone),
      )
    }
  }

  return events
}

function main() {
  initDb()
  const events = buildEventStream()

  withTransaction(() => {
    db.exec('DELETE FROM raw_events; DELETE FROM version_durations; DELETE FROM summary_bucket_stats; DELETE FROM summary_trends;')

    const insert = db.prepare(
      `INSERT INTO raw_events (
        event_id, user_id, app_version_id, old_state, new_state, event_timestamp, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )

    for (const event of events) {
      insert.run(
        event.event_id,
        event.user_id,
        event.app_version_id,
        event.old_state,
        event.new_state,
        event.event_timestamp,
        event.payload_json,
      )
    }
  })

  const pairs = db.prepare('SELECT DISTINCT user_id, app_version_id FROM raw_events').all()
  for (const pair of pairs) {
    recomputeDurationsForVersion(pair.user_id, pair.app_version_id)
  }

  console.log(`Seeded ${events.length} events across ${pairs.length} app versions.`)
}

main()
