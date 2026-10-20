import { legacySoftwareTypeMap } from '../data/software-type-crosswalk.js'
import type { AppDatabase } from '../db/database.js'

type CategoryRow = {
  id: number
  slug: string
  parent_id: number | null
  external_source: string
}

export function remapLegacySoftwareTypes(db: AppDatabase): { links: number; products: number } {
  const categories = db.prepare('SELECT id, slug, parent_id, external_source FROM categories').all() as CategoryRow[]
  const byId = new Map(categories.map((category) => [category.id, category]))
  const targetIds = new Map(
    categories
      .filter((category) => category.external_source === '' && category.parent_id !== null)
      .map((category) => [category.slug, category.id]),
  )
  const links = db.prepare('SELECT software_id, category_id FROM software_categories').all() as Array<{
    software_id: number
    category_id: number
  }>

  function rootSlug(category: CategoryRow): string {
    let current = category
    const seen = new Set<number>()
    while (current.parent_id !== null && !seen.has(current.id)) {
      seen.add(current.id)
      const parent = byId.get(current.parent_id)
      if (!parent) {
        break
      }
      current = parent
    }
    return current.slug
  }

  const insert = db.prepare('INSERT OR IGNORE INTO software_categories (software_id, category_id) VALUES (?, ?)')
  const touchedProducts = new Set<number>()
  let inserted = 0

  db.exec('BEGIN')
  try {
    for (const link of links) {
      const category = byId.get(link.category_id)
      if (!category || category.external_source !== 'contentful') {
        continue
      }

      const mapped = legacySoftwareTypeMap[category.slug] ?? legacySoftwareTypeMap[rootSlug(category)]
      if (!mapped) {
        continue
      }

      for (const typeSlug of mapped) {
        const targetId = targetIds.get(typeSlug)
        if (!targetId) {
          continue
        }
        const result = insert.run(link.software_id, targetId)
        if (result.changes > 0) {
          inserted += 1
          touchedProducts.add(link.software_id)
        }
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { links: inserted, products: touchedProducts.size }
}
