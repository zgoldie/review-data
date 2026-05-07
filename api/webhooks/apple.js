import { pgQuery } from '../_lib/db.js'
import { recomputeDurationsForVersion } from '../_lib/durations.js'
import { hashWebhookSecret } from '../_lib/secrets.js'

const VALID_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'READY_FOR_REVIEW',
  'IN_REVIEW',
  'READY_FOR_SALE',
  'REJECTED',
])

async function resolveUserId(req, payload) {
  const providedSecret = req.headers['x-webhook-secret'] || payload.secret
  if (typeof providedSecret !== 'string' || !providedSecret) {
    const error = new Error('Missing webhook secret')
    error.statusCode = 401
    throw error
  }

  const secretHash = hashWebhookSecret(providedSecret)
  const result = await pgQuery(
    `SELECT user_id
     FROM webhook_credentials
     WHERE secret_hash = $1
       AND is_active = TRUE
       AND revoked_at IS NULL
     LIMIT 1`,
    [secretHash],
  )

  const userId = result.rows[0]?.user_id
  if (!userId) {
    const error = new Error('Invalid webhook secret')
    error.statusCode = 401
    throw error
  }

  return userId
}

function normalizePayload(payload) {
  return {
    event_id: payload.event_id || payload.eventId || payload.id,
    app_version_id: payload.app_version_id || payload.appVersionId || payload.appVersion?.id,
    old_state: payload.old_state || payload.oldState || payload.previous_state || null,
    new_state: payload.new_state || payload.newState || payload.state,
    timestamp: payload.timestamp || payload.event_timestamp || payload.occurredAt || payload.createdDate,
    raw: payload,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const normalized = normalizePayload(req.body || {})
    const userId = await resolveUserId(req, normalized.raw)

    if (!normalized.event_id || !normalized.app_version_id || !normalized.new_state || !normalized.timestamp) {
      return res.status(400).json({ error: 'Missing required fields: event_id, app_version_id, new_state, timestamp' })
    }

    if (!VALID_STATES.has(normalized.new_state)) {
      return res.status(400).json({ error: `Invalid new_state: ${normalized.new_state}` })
    }

    const eventTimestamp = new Date(normalized.timestamp)
    if (Number.isNaN(eventTimestamp.getTime())) {
      return res.status(400).json({ error: 'timestamp must be a valid ISO date string' })
    }

    const insertResult = await pgQuery(
      `INSERT INTO raw_events (
        event_id, user_id, app_version_id, old_state, new_state, event_timestamp, payload_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (event_id) DO NOTHING`,
      [
        normalized.event_id,
        userId,
        normalized.app_version_id,
        normalized.old_state,
        normalized.new_state,
        eventTimestamp.toISOString(),
        JSON.stringify(normalized.raw),
      ],
    )

    const inserted = insertResult.rowCount > 0
    if (inserted) {
      await recomputeDurationsForVersion(userId, normalized.app_version_id)
    }

    return res.status(inserted ? 201 : 200).json({
      ok: true,
      inserted,
      event_id: normalized.event_id,
      user_id: userId,
      app_version_id: normalized.app_version_id,
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ error: 'Webhook ingest failed', detail: error.message })
  }
}
