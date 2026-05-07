import { Pool } from 'pg'

function getConnectionString() {
  return process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || ''
}

function getPool() {
  const globalForPg = globalThis
  if (!globalForPg.__reviewDataPgPool) {
    const connectionString = getConnectionString()
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
