import { getDatabasePath, openDatabase } from '../db/database.js'
import { runMigrations } from '../db/migrate.js'
import { seedReferenceData } from '../db/seed.js'
import { remapLegacySoftwareTypes } from '../repositories/software-types.js'

const db = openDatabase()
runMigrations(db)
seedReferenceData(db)
const result = remapLegacySoftwareTypes(db)

console.log(`Software type crosswalk applied to ${getDatabasePath()}`)
console.log(`Added ${result.links} software type links across ${result.products} products`)

db.close()
