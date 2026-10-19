import { getDatabasePath, getSpdxSeedDir, openDatabase } from '../db/database.js'
import { runMigrations } from '../db/migrate.js'
import { loadSpdxLicenseList, seedSpdxLicenses } from '../db/spdx-seed.js'

const db = openDatabase()
runMigrations(db)

const list = loadSpdxLicenseList()
const result = seedSpdxLicenses(db, list)

console.log(`SPDX License List ${result.version} loaded from ${getSpdxSeedDir()}`)
console.log(`Licenses: ${result.total} total, ${result.osiApproved} OSI approved, ${result.removed} non-SPDX rows removed`)
console.log(`Database updated at ${getDatabasePath()}`)

db.close()
