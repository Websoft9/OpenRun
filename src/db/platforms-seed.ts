import { platformSeeds, type PlatformSeed } from '../data/platforms.js'
import type { AppDatabase } from './database.js'

export type PlatformSeedResult = {
  total: number
  removed: number
}

export function seedPlatforms(
  db: AppDatabase,
  seeds: PlatformSeed[] = platformSeeds,
): PlatformSeedResult {
  const upsert = db.prepare(`
    INSERT INTO platforms (code, os_code, os_name, arch_code, arch_name, variant, aliases_json, source)
    VALUES (@code, @osCode, @osName, @archCode, @archName, @variant, @aliasesJson, 'openrun')
    ON CONFLICT(code) DO UPDATE SET
      os_code = excluded.os_code,
      os_name = excluded.os_name,
      arch_code = excluded.arch_code,
      arch_name = excluded.arch_name,
      variant = excluded.variant,
      aliases_json = excluded.aliases_json,
      source = excluded.source
  `)

  const known = new Set(seeds.map((seed) => seed.code))
  let removed = 0

  db.exec('BEGIN')
  try {
    for (const seed of seeds) {
      upsert.run({
        code: seed.code,
        osCode: seed.osCode,
        osName: seed.osName,
        archCode: seed.archCode,
        archName: seed.archName,
        variant: seed.variant,
        aliasesJson: JSON.stringify(seed.aliases),
      })
    }

    const existing = db.prepare('SELECT code FROM platforms').all() as Array<{ code: string }>
    const remove = db.prepare('DELETE FROM platforms WHERE code = ?')
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
