import type { AppDatabase } from '../db/database.js'
import type { MarketType } from '../db/markets-seed.js'

export type MarketSummary = {
  code: string
  name: string
  type: MarketType
  parentCode: string | null
}

export function listMarkets(db: AppDatabase, types: MarketType[] = ['global', 'region']): MarketSummary[] {
  const placeholders = types.map(() => '?').join(', ')
  const rows = db
    .prepare(`
      SELECT code, name, type, parent_code
      FROM markets
      WHERE type IN (${placeholders})
      ORDER BY CASE type WHEN 'global' THEN 0 ELSE 1 END, name
    `)
    .all(...types) as Array<{ code: string; name: string; type: MarketType; parent_code: string | null }>

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    type: row.type,
    parentCode: row.parent_code,
  }))
}

export function marketExists(db: AppDatabase, code: string): boolean {
  return Boolean(db.prepare('SELECT 1 AS ok FROM markets WHERE code = ?').get(code))
}
