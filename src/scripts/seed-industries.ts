import { getDatabasePath, openDatabase } from '../db/database.js'
import { seedIndustries } from '../db/industries-seed.js'
import { runMigrations } from '../db/migrate.js'

const db = openDatabase()
runMigrations(db)
const result = seedIndustries(db)

console.log(`Industries: ${result.total} total, ${result.removed} removed`)
console.log(`Database updated at ${getDatabasePath()}`)

db.close()
