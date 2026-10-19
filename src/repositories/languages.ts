import type { AppDatabase } from '../db/database.js'

export type LanguageSummary = {
  name: string
  slug: string
  aliases: string[]
}

export function listLanguages(db: AppDatabase): LanguageSummary[] {
  const rows = db.prepare('SELECT name, slug, aliases_json FROM languages ORDER BY name').all() as Array<{
    name: string
    slug: string
    aliases_json: string
  }>

  return rows.map((row) => {
    let aliases: string[] = []
    try {
      const parsed = JSON.parse(row.aliases_json) as unknown
      if (Array.isArray(parsed)) {
        aliases = parsed.filter((item): item is string => typeof item === 'string')
      }
    } catch {
      aliases = []
    }
    return { name: row.name, slug: row.slug, aliases }
  })
}

export function languageExists(db: AppDatabase, name: string): boolean {
  if (name === 'Unknown') {
    return true
  }
  return Boolean(db.prepare('SELECT 1 AS ok FROM languages WHERE name = ?').get(name))
}
