import { getDatabasePath, getLinguistSeedDir, openDatabase } from '../db/database.js'
import { loadLanguageAliases, loadLinguistLanguages, seedLanguages } from '../db/linguist-seed.js'
import { runMigrations } from '../db/migrate.js'

const db = openDatabase()
runMigrations(db)

const dir = getLinguistSeedDir()
const list = loadLinguistLanguages(dir)
const result = seedLanguages(db, list, loadLanguageAliases(dir))

console.log(`GitHub Linguist snapshot loaded from ${dir}`)
console.log(`Languages: ${result.total} total, ${result.removed} non-Linguist rows removed`)
console.log(`Database updated at ${getDatabasePath()}`)

db.close()
