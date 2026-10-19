import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AppDatabase } from './database.js'
import { getMigrationsDir } from './database.js'

type MigrationRow = {
  name: string
}

export type MigrationResult = {
  applied: string[]
  skipped: string[]
}

export function runMigrations(db: AppDatabase, migrationsDir = getMigrationsDir()): MigrationResult {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  const appliedRows = db.prepare('SELECT name FROM schema_migrations ORDER BY name').all() as MigrationRow[]
  const applied = new Set(appliedRows.map((row) => row.name))
  const result: MigrationResult = { applied: [], skipped: [] }

  for (const file of files) {
    if (applied.has(file)) {
      result.skipped.push(file)
      continue
    }

    const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file)
      db.exec('COMMIT')
      result.applied.push(file)
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(`Migration failed: ${file}`, { cause: error })
    }
  }

  return result
}
