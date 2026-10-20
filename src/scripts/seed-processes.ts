import { getDatabasePath, openDatabase } from '../db/database.js'
import { runMigrations } from '../db/migrate.js'
import { seedProcessFramework } from '../db/process-framework-seed.js'

const db = openDatabase()
runMigrations(db)
const result = seedProcessFramework(db)

console.log(
  `Process framework ${result.framework} ${result.version}: ${result.total} nodes (L1 ${result.l1}, L2 ${result.l2}, L3 ${result.l3}), ${result.removed} removed`,
)
console.log(`Database updated at ${getDatabasePath()}`)

db.close()
