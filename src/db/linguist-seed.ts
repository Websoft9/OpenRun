import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AppDatabase } from './database.js'
import { getLinguistSeedDir } from './database.js'

export type LinguistLanguage = {
  name: string
  aliases: string[]
}

export type LinguistLanguageList = {
  source: string
  commit?: string
  fetchedAt?: string
  languages: LinguistLanguage[]
}

export type LanguageSeedResult = {
  total: number
  removed: number
}

export function languageSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\+/g, '-plus')
      .replace(/#/g, '-sharp')
      .replace(/\./g, '-')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'language'
  )
}

export function loadLinguistLanguages(dir = getLinguistSeedDir()): LinguistLanguageList {
  const filePath = path.join(dir, 'languages.json')
  if (!existsSync(filePath)) {
    throw new Error(`Linguist language list not found at ${filePath}`)
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as LinguistLanguageList
  if (!Array.isArray(parsed.languages)) {
    throw new Error(`Invalid Linguist language list at ${filePath}`)
  }
  return parsed
}

export function loadLanguageAliases(dir = getLinguistSeedDir()): Record<string, string> {
  const candidates = [path.join(dir, 'aliases.json'), path.join(path.dirname(dir), 'aliases.json')]
  const filePath = candidates.find((candidate) => existsSync(candidate))
  if (!filePath) {
    return {}
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>
  const aliases: Record<string, string> = {}
  for (const [raw, canonical] of Object.entries(parsed)) {
    if (typeof canonical === 'string' && canonical.trim()) {
      aliases[raw.trim().toLowerCase()] = canonical.trim()
    }
  }
  return aliases
}

function uniqueSlug(db: AppDatabase, desired: string, name: string): string {
  let candidate = desired
  let suffix = 2
  for (;;) {
    const row = db.prepare('SELECT name FROM languages WHERE slug = ?').get(candidate) as
      | { name: string }
      | undefined
    if (!row || row.name === name) {
      return candidate
    }
    candidate = `${desired}-${suffix}`
    suffix += 1
  }
}

export function seedLanguages(
  db: AppDatabase,
  list: LinguistLanguageList,
  aliases: Record<string, string> = {},
): LanguageSeedResult {
  const aliasesByLanguage = new Map<string, Set<string>>()
  for (const language of list.languages) {
    aliasesByLanguage.set(language.name, new Set(language.aliases ?? []))
  }
  for (const [raw, canonical] of Object.entries(aliases)) {
    const set = aliasesByLanguage.get(canonical)
    if (set) {
      set.add(raw)
    }
  }

  const upsert = db.prepare(`
    INSERT INTO languages (name, slug, aliases_json)
    VALUES (@name, @slug, @aliasesJson)
    ON CONFLICT(name) DO UPDATE SET
      slug = excluded.slug,
      aliases_json = excluded.aliases_json
  `)

  const known = new Set(list.languages.map((language) => language.name))
  let removed = 0

  db.exec('BEGIN')
  try {
    for (const language of list.languages) {
      const slug = uniqueSlug(db, languageSlug(language.name), language.name)
      const aliasesJson = JSON.stringify([...(aliasesByLanguage.get(language.name) ?? [])].sort())
      upsert.run({ name: language.name, slug, aliasesJson })
    }

    const existing = db.prepare('SELECT name FROM languages').all() as Array<{ name: string }>
    const remove = db.prepare('DELETE FROM languages WHERE name = ?')
    for (const row of existing) {
      if (!known.has(row.name)) {
        remove.run(row.name)
        removed += 1
      }
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { total: list.languages.length, removed }
}
