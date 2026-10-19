import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getDatabasePath, openDatabase } from '../db/database.js'
import { runMigrations } from '../db/migrate.js'
import { seedReferenceData } from '../db/seed.js'
import { importCatalog, parseCatalogPayload } from '../repositories/catalog-import.js'

const fileArgument = process.argv[2]
if (!fileArgument) {
  console.error('Usage: npm run catalog:import -- <catalog.json>')
  process.exit(1)
}

let raw: unknown
try {
  raw = JSON.parse(readFileSync(path.resolve(fileArgument), 'utf8'))
} catch (error) {
  console.error(`Unable to read catalog file: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

let parsed: ReturnType<typeof parseCatalogPayload>
try {
  parsed = parseCatalogPayload(raw)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const db = openDatabase()
runMigrations(db)
seedReferenceData(db)

let result: ReturnType<typeof importCatalog>
try {
  result = importCatalog(db, parsed.products)
} catch (error) {
  console.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`)
  db.close()
  process.exit(1)
}

console.log(`Imported catalog into ${getDatabasePath()}`)
console.log(`Created: ${result.created}, updated: ${result.updated}`)
for (const warning of [...parsed.warnings, ...result.warnings]) {
  console.warn(`Warning: ${warning}`)
}

db.close()
