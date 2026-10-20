import { getDatabasePath, openDatabase } from '../db/database.js'
import { runMigrations } from '../db/migrate.js'
import { seedPlatforms } from '../db/platforms-seed.js'

const db = openDatabase()
runMigrations(db)
const result = seedPlatforms(db)

console.log(`Platforms: ${result.total} total, ${result.removed} removed`)
console.log(`Database updated at ${getDatabasePath()}`)

db.close()
