import { pgQuery, withPgTransaction } from './db.js'

const TERMINAL_STATES = new Set(['READY_FOR_SALE', 'REJECTED'])

function parseTs(value) {
  const ts = new Date(value)
  return Number.isNaN(ts.getTime()) ? null : ts
}

function toIsoOrNull(value) {
  const parsed = parseTs(value)
  return parsed ? parsed.toISOString() : null
}

function diffHours(startIso, endIso) {
  const start = parseTs(startIso)
  const end = parseTs(endIso)
  if (!start || !end) return null
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  return diff >= 0 ? Number(diff.toFixed(2)) : null
}

function buildCycles(events) {
  const cycles = []
  let current = null

  for (const event of events) {
    const state = event.new_state
    const eventTime = toIsoOrNull(event.event_timestamp)
    if (!eventTime) continue

    if (state === 'PREPARE_FOR_SUBMISSION') {
      current = {
        prepare_for_submission_at: eventTime,
        ready_for_review_at: null,
        in_review_at: null,
        terminal_at: null,
        final_state: null,
      }
      continue
    }

    if (!current) {
      current = {
        prepare_for_submission_at: null,
        ready_for_review_at: null,
        in_review_at: null,
        terminal_at: null,
        final_state: null,
      }
    }

    if (state === 'READY_FOR_REVIEW' && !current.ready_for_review_at) {
      current.ready_for_review_at = eventTime
      continue
    }

    if (state === 'IN_REVIEW' && !current.in_review_at) {
      current.in_review_at = eventTime
      continue
    }

    if (TERMINAL_STATES.has(state) && !current.terminal_at) {
      current.terminal_at = eventTime
      current.final_state = state
      cycles.push(current)
      current = null
    }
  }

  return cycles.map((cycle, index) => ({
    ...cycle,
    cycle_index: index + 1,
    build_hours: diffHours(cycle.prepare_for_submission_at, cycle.ready_for_review_at),
    queue_hours: diffHours(cycle.ready_for_review_at, cycle.in_review_at),
    review_hours: diffHours(cycle.in_review_at, cycle.terminal_at),
    completed_at: cycle.terminal_at,
  }))
}

export async function recomputeDurationsForVersion(userId, appVersionId) {
  const eventsResult = await pgQuery(
    `SELECT event_timestamp, new_state
     FROM raw_events
     WHERE user_id = $1 AND app_version_id = $2
     ORDER BY event_timestamp ASC`,
    [userId, appVersionId],
  )
  const cycles = buildCycles(eventsResult.rows)

  await withPgTransaction(async (client) => {
    await client.query('DELETE FROM version_durations WHERE user_id = $1 AND app_version_id = $2', [userId, appVersionId])

    for (const cycle of cycles) {
      await client.query(
        `INSERT INTO version_durations (
          user_id,
          app_version_id,
          cycle_index,
          prepare_for_submission_at,
          ready_for_review_at,
          in_review_at,
          terminal_at,
          final_state,
          build_hours,
          queue_hours,
          review_hours,
          completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          userId,
          appVersionId,
          cycle.cycle_index,
          cycle.prepare_for_submission_at,
          cycle.ready_for_review_at,
          cycle.in_review_at,
          cycle.terminal_at,
          cycle.final_state,
          cycle.build_hours,
          cycle.queue_hours,
          cycle.review_hours,
          cycle.completed_at,
        ],
      )
    }
  })

  return cycles.length
}
