import { db } from '../db/client.js'
import { recomputeDurationsForVersion } from '../derive/durations.js'

const VALID_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'READY_FOR_REVIEW',
  'IN_REVIEW',
  'READY_FOR_SALE',
  'REJECTED',
])

function parseSecretMap() {
  const mapRaw = process.env.WEBHOOK_SECRET_MAP || ''
  const pairs = mapRaw.split(',').map((part) => part.trim()).filter(Boolean)
  const entries = pairs.map((pair) => pair.split(':')).filter((pair) => pair.length === 2)
  return new Map(entries.map(([secret, userId]) => [secret.trim(), userId.trim()]))
}

function resolveUserId(req, payload) {
  const userIdFromPayload = payload.user_id || payload.userId
  if (userIdFromPayload) return userIdFromPayload

  const secret = req.headers['x-webhook-secret'] || payload.secret
  const secretMap = parseSecretMap()
  if (typeof secret === 'string' && secretMap.has(secret)) {
    return secretMap.get(secret)
  }

  return 'demo-user'
}

function normalizePayload(req) {
  const payload = req.body || {}
  return {
    event_id: payload.event_id || payload.eventId || payload.id,
    app_version_id: payload.app_version_id || payload.appVersionId || payload.appVersion?.id,
    old_state: payload.old_state || payload.oldState || payload.previous_state || null,
    new_state: payload.new_state || payload.newState || payload.state,
    timestamp: payload.timestamp || payload.event_timestamp || payload.occurredAt || payload.createdDate,
    raw: payload,
  }
}

export function registerAppleWebhookRoute(app) {
  app.post('/api/webhooks/apple', (req, res) => {
    const normalized = normalizePayload(req)
    const userId = resolveUserId(req, normalized.raw)

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

    const insert = db.prepare(
      `INSERT OR IGNORE INTO raw_events (
        event_id, user_id, app_version_id, old_state, new_state, event_timestamp, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )

    const result = insert.run(
      normalized.event_id,
      userId,
      normalized.app_version_id,
      normalized.old_state,
      normalized.new_state,
      eventTimestamp.toISOString(),
      JSON.stringify(normalized.raw),
    )

    const inserted = result.changes > 0
    if (inserted) {
      recomputeDurationsForVersion(userId, normalized.app_version_id)
    }

    return res.status(inserted ? 201 : 200).json({
      ok: true,
      inserted,
      event_id: normalized.event_id,
      user_id: userId,
      app_version_id: normalized.app_version_id,
    })
  })
}
