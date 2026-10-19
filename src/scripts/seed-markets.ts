import { getDatabasePath, getMarketSeedDir, openDatabase } from '../db/database.js'
import { loadMarkets, seedMarkets } from '../db/markets-seed.js'
import { runMigrations } from '../db/migrate.js'

const db = openDatabase()
runMigrations(db)

const dir = getMarketSeedDir()
const list = loadMarkets(dir)
const result = seedMarkets(db, list)

console.log(`Market snapshot loaded from ${dir}`)
console.log(
  `Markets: ${result.global} global, ${result.regions} regions, ${result.countries} countries (${result.removed} removed)`,
)
console.log(`Database updated at ${getDatabasePath()}`)

db.close()
