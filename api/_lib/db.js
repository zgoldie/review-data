import { Pool } from 'pg'

function getConnectionString() {
  return process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || ''
}

function normalizeConnectionString(rawConnectionString) {
  try {
    const parsed = new URL(rawConnectionString)
    const sslMode = parsed.searchParams.get('sslmode')
    if (!sslMode || sslMode === 'require') {
      parsed.searchParams.set('sslmode', 'no-verify')
    }
    return parsed.toString()
  } catch {
    return rawConnectionString
  }
}

function getPool() {
  const globalForPg = globalThis
  if (!globalForPg.__reviewDataPgPool) {
    const connectionString = normalizeConnectionString(getConnectionString())
    if (!connectionString) {
      throw new Error('Missing Postgres connection URL. Set POSTGRES_URL (or equivalent) in environment variables.')
    }
    globalForPg.__reviewDataPgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  }
  return globalForPg.__reviewDataPgPool
}

export async function pgQuery(text, params = []) {
  return getPool().query(text, params)
}

export async function withPgTransaction(work) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
