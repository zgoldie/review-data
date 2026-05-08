import { pgQuery } from '../_lib/db.js'
import { recomputeDurationsForVersion } from '../_lib/durations.js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { decryptWebhookSecret } from '../_lib/secrets.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

const VALID_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'READY_FOR_REVIEW',
  'IN_REVIEW',
  'READY_FOR_SALE',
  'REJECTED',
])

async function resolveWebhookCredentials(req) {
  const hookToken = typeof req.query?.hook === 'string' ? req.query.hook : ''
  if (!hookToken) {
    const error = new Error('Missing webhook hook token')
    error.statusCode = 401
    throw error
  }

  const result = await pgQuery(
    `SELECT wc.user_id, wc.secret_encrypted, wc.secret_value
     FROM webhook_credentials wc
     JOIN app_connections ac ON ac.user_id = wc.user_id
     WHERE ac.webhook_token = $1
       AND wc.is_active = TRUE
       AND wc.revoked_at IS NULL
     LIMIT 1`,
    [hookToken],
  )

  const credentials = result.rows[0]
  if (!credentials?.user_id || (!credentials?.secret_encrypted && !credentials?.secret_value)) {
    const error = new Error('Invalid webhook hook token')
    error.statusCode = 401
    throw error
  }

  return credentials
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

function parseAppleSignature(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const normalized = trimmed.toLowerCase()
  if (normalized.startsWith('hmacsha256=')) return trimmed.slice('hmacsha256='.length).trim()
  if (normalized.startsWith('sha256=')) return trimmed.slice('sha256='.length).trim()
  return trimmed.replace(/^"|"$/g, '').trim()
}

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function verifyAppleSignature(req, rawPayload, signingSecret) {
  const signatureHeader = req.headers['x-apple-signature']
  const providedSignature = parseAppleSignature(signatureHeader)
  if (!providedSignature) {
    const error = new Error('Missing x-apple-signature header')
    error.statusCode = 401
    throw error
  }

  const digestBuffer = createHmac('sha256', signingSecret).update(rawPayload).digest()
  const expectedHex = digestBuffer.toString('hex')
  const expectedBase64 = digestBuffer.toString('base64')

  const looksLikeHex = /^[0-9a-fA-F]+$/.test(providedSignature)
  const providedBuffer = looksLikeHex ? Buffer.from(providedSignature, 'hex') : Buffer.from(providedSignature, 'base64')
  const expectedBuffer = looksLikeHex ? Buffer.from(expectedHex, 'hex') : Buffer.from(expectedBase64, 'base64')

  if (
    providedBuffer.length === 0 ||
    expectedBuffer.length === 0 ||
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    const error = new Error('Invalid x-apple-signature')
    error.statusCode = 401
    throw error
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rawPayload = await readRawBody(req)
    let payload = {}
    try {
      payload = rawPayload.length ? JSON.parse(rawPayload.toString('utf8')) : {}
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' })
    }

    if (payload?.data?.type === 'webhookPingCreated') {
      return res.status(200).json({ ok: true, ping: true })
    }

    const credentials = await resolveWebhookCredentials(req)
    const signingSecret = credentials.secret_encrypted ? decryptWebhookSecret(credentials.secret_encrypted) : credentials.secret_value
    verifyAppleSignature(req, rawPayload, signingSecret)

    const normalized = normalizePayload(payload)
    const userId = credentials.user_id

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
