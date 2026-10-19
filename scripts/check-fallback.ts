import { openDatabase } from '../src/db/database.js'
import { getProductBySlug } from '../src/repositories/catalog.js'

const db = openDatabase()
const english = getProductBySlug(db, 'atlas-cms', 'en')
const chinese = getProductBySlug(db, 'atlas-cms', 'zh')

if (!english || !chinese) {
  console.error('fallback check failed: atlas-cms is missing')
  process.exit(1)
}

if (chinese.summary !== english.summary) {
  console.error('fallback check failed: unpublished zh translation did not fall back to English')
  process.exit(1)
}

console.log('Translation fallback OK')
db.close()
