import type { AppDatabase } from '../db/database.js'

export type PlatformSummary = {
  code: string
  label: string
  osCode: string
  archCode: string
}

export function listPlatforms(db: AppDatabase): PlatformSummary[] {
  const rows = db
    .prepare(`
      SELECT code, os_code, os_name, arch_code, arch_name, variant
      FROM platforms
      ORDER BY os_name, arch_name
    `)
    .all() as Array<{
    code: string
    os_code: string
    os_name: string
    arch_code: string
    arch_name: string
    variant: string
  }>

  return rows.map((row) => ({
    code: row.code,
    label: `${row.os_name} / ${row.arch_name}${row.variant ? ` (${row.variant})` : ''}`,
    osCode: row.os_code,
    archCode: row.arch_code,
  }))
}

export function platformExists(db: AppDatabase, code: string): boolean {
  return Boolean(db.prepare('SELECT 1 AS ok FROM platforms WHERE code = ?').get(code))
}
