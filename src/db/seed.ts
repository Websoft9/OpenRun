import { categorySeeds } from '../data/categories.js'
import { difficultySeeds, reservedTagSeeds } from '../data/reference.js'
import type { AppDatabase } from './database.js'
import { loadLanguageAliases, loadLinguistLanguages, seedLanguages } from './linguist-seed.js'
import { loadMarkets, seedMarkets } from './markets-seed.js'
import { loadSpdxLicenseList, seedSpdxLicenses } from './spdx-seed.js'

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function seedReferenceData(db: AppDatabase): void {
  const upsertCategory = db.prepare(`
    INSERT INTO categories (slug, name_en, description_en)
    VALUES (@slug, @nameEn, @descriptionEn)
    ON CONFLICT(slug) DO UPDATE SET
      name_en = excluded.name_en,
      description_en = excluded.description_en,
      updated_at = CURRENT_TIMESTAMP
  `)

  const upsertCategoryTranslation = db.prepare(`
    INSERT INTO category_translations (category_id, locale, name, description, status)
    VALUES (?, 'zh', ?, ?, 'published')
    ON CONFLICT(category_id, locale) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `)

  const upsertDifficulty = db.prepare(`
    INSERT INTO difficulty_levels (value, name_en, name_zh)
    VALUES (@value, @nameEn, @nameZh)
    ON CONFLICT(value) DO UPDATE SET
      name_en = excluded.name_en,
      name_zh = excluded.name_zh
  `)

  const upsertReservedTag = db.prepare(`
    INSERT INTO reserved_tags (slug, name, description_en, description_zh)
    VALUES (@slug, @name, @descriptionEn, @descriptionZh)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      description_en = excluded.description_en,
      description_zh = excluded.description_zh
  `)

  db.exec('BEGIN')
  try {
    for (const category of categorySeeds) {
      upsertCategory.run({
        slug: category.slug,
        nameEn: category.nameEn,
        descriptionEn: category.descriptionEn,
      })
      const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(category.slug) as { id: number }
      upsertCategoryTranslation.run(row.id, category.nameZh, category.descriptionZh)
    }

    for (const difficulty of difficultySeeds) {
      upsertDifficulty.run(difficulty)
    }

    for (const tag of reservedTagSeeds) {
      upsertReservedTag.run(tag)
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  seedSpdxLicenses(db, loadSpdxLicenseList())
  seedLanguages(db, loadLinguistLanguages(), loadLanguageAliases())
  seedMarkets(db, loadMarkets())
}
