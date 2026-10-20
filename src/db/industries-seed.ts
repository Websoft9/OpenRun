import { industrySeeds, type IndustrySeed } from '../data/industries.js'
import type { AppDatabase } from './database.js'

export type IndustrySeedResult = {
  total: number
  removed: number
}

export function seedIndustries(
  db: AppDatabase,
  seeds: IndustrySeed[] = industrySeeds,
): IndustrySeedResult {
  const upsert = db.prepare(`
    INSERT INTO industries (code, name, name_zh, level, parent_code, source)
    VALUES (@code, @name, @nameZh, @level, @parentCode, @source)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      name_zh = excluded.name_zh,
      level = excluded.level,
      parent_code = excluded.parent_code,
      source = excluded.source
  `)

  const known = new Set(seeds.map((seed) => seed.code))
  let removed = 0

  db.exec('BEGIN')
  try {
    for (const seed of seeds) {
      upsert.run(seed)
    }

    const existing = db.prepare('SELECT code FROM industries').all() as Array<{ code: string }>
    const remove = db.prepare('DELETE FROM industries WHERE code = ?')
    for (const row of existing) {
      if (!known.has(row.code)) {
        remove.run(row.code)
        removed += 1
      }
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { total: seeds.length, removed }
}
