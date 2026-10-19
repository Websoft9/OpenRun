import { getDatabasePath, openDatabase } from '../db/database.js'
import { runMigrations } from '../db/migrate.js'
import { seedDemoData } from '../db/seed-demo.js'

const db = openDatabase()
runMigrations(db)
const count = seedDemoData(db)

console.log(`Seeded ${count} demo software records into ${getDatabasePath()}`)
console.log('Demo data is for local development and tests only; use catalog:import for production data.')

db.close()
