import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AppDatabase } from './database.js'
import { getMarketSeedDir } from './database.js'

export type MarketType = 'global' | 'region' | 'country'

export type MarketSeed = {
  code: string
  name: string
  type: MarketType
  parentCode: string | null
  iso3: string
  source: string
}

export type MarketList = {
  source: string
  fetchedAt?: string
  markets: MarketSeed[]
}

export type MarketSeedResult = {
  global: number
  regions: number
  countries: number
  removed: number
}

export function loadMarkets(dir = getMarketSeedDir()): MarketList {
  const filePath = path.join(dir, 'markets.json')
  if (!existsSync(filePath)) {
    throw new Error(`Market list not found at ${filePath}`)
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as MarketList
  if (!Array.isArray(parsed.markets)) {
    throw new Error(`Invalid market list at ${filePath}`)
  }
  return parsed
}

const typeOrder: Record<MarketType, number> = { global: 0, region: 1, country: 2 }

export function seedMarkets(db: AppDatabase, list: MarketList): MarketSeedResult {
  const upsert = db.prepare(`
    INSERT INTO markets (code, name, type, parent_code, iso3, source)
    VALUES (@code, @name, @type, @parentCode, @iso3, @source)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      parent_code = excluded.parent_code,
      iso3 = excluded.iso3,
      source = excluded.source
  `)

  const known = new Set(list.markets.map((market) => market.code))
  const sorted = [...list.markets].sort((left, right) => {
    const order = typeOrder[left.type] - typeOrder[right.type]
    return order !== 0 ? order : left.code.localeCompare(right.code)
  })
  let removed = 0

  db.exec('BEGIN')
  try {
    for (const market of sorted) {
      upsert.run({
        code: market.code,
        name: market.name,
        type: market.type,
        parentCode: market.parentCode,
        iso3: market.iso3,
        source: market.source,
      })
    }

    const existing = db
      .prepare('SELECT code, type FROM markets ORDER BY CASE type WHEN \'country\' THEN 0 WHEN \'region\' THEN 1 ELSE 2 END')
      .all() as Array<{ code: string; type: MarketType }>
    const remove = db.prepare('DELETE FROM markets WHERE code = ?')
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

  return {
    global: list.markets.filter((market) => market.type === 'global').length,
    regions: list.markets.filter((market) => market.type === 'region').length,
    countries: list.markets.filter((market) => market.type === 'country').length,
    removed,
  }
}
