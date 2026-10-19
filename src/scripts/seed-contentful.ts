import { loadContentfulSeed } from '../db/contentful-seed.js'
import { getContentfulSeedDir, getDatabasePath, openDatabase } from '../db/database.js'
import { runMigrations } from '../db/migrate.js'
import { importContentfulDataset } from '../repositories/contentful-import.js'

const db = openDatabase()
runMigrations(db)

console.log(`Loading Contentful seed snapshot from ${getContentfulSeedDir()}`)
const dataset = loadContentfulSeed()

const result = importContentfulDataset(db, dataset)

console.log(`Contentful seed applied to ${getDatabasePath()}`)
console.log(
  `Categories: ${result.topLevelCategories} top-level / ${result.categories} total; products: ${result.products} (${result.published} published, ${result.drafts} drafts)`,
)
console.log(`Created: ${result.created}, updated: ${result.updated}, tag translations: ${result.tagTranslations}`)
for (const warning of result.warnings) {
  console.warn(`Warning: ${warning}`)
}

db.close()
