import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const DB_DIR = path.resolve(process.cwd(), 'server', 'db', 'data')
const DB_PATH = path.join(DB_DIR, 'review_times.sqlite')
const SCHEMA_PATH = path.resolve(process.cwd(), 'server', 'db', 'schema.sql')

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

export const db = new Database(DB_PATH)

export function initDb() {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8')
  db.exec(schemaSql)
}

export function withTransaction(handler) {
  const tx = db.transaction(handler)
  return tx()
}
