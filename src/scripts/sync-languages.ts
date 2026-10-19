import { setDefaultResultOrder } from 'node:dns'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { getDatabasePath, getLinguistSeedRoot, openDatabase } from '../db/database.js'
import { loadLanguageAliases, seedLanguages, type LinguistLanguageList } from '../db/linguist-seed.js'
import { runMigrations } from '../db/migrate.js'

setDefaultResultOrder('ipv4first')

const repository = 'github-linguist/linguist'
const languageFile = 'lib/linguist/languages.yml'
const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT
const headers: Record<string, string> = {
  Accept: 'application/vnd.github.raw+json',
  'User-Agent': 'OpenRun-Linguist-Sync',
  'X-GitHub-Api-Version': '2022-11-28',
}
if (token) {
  headers.Authorization = `Bearer ${token}`
}

async function get(url: string): Promise<Response> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${url}`)
  }
  return response
}

const contentResponse = await get(
  `https://api.github.com/repos/${repository}/contents/${languageFile}?ref=main`,
)
const yamlText = await contentResponse.text()
const parsed = parse(yamlText) as Record<string, { aliases?: unknown }>
if (!parsed || typeof parsed !== 'object') {
  throw new Error('Unable to parse GitHub Linguist languages.yml')
}

const languages = Object.entries(parsed)
  .map(([name, value]) => ({
    name,
    aliases: Array.isArray(value?.aliases)
      ? value.aliases.filter((alias): alias is string => typeof alias === 'string')
      : [],
  }))
  .sort((left, right) => left.name.localeCompare(right.name))

let commit = ''
let commitDate = ''
try {
  const commitResponse = await get(
    `https://api.github.com/repos/${repository}/commits?path=${encodeURIComponent(languageFile)}&per_page=1`,
  )
  const commits = (await commitResponse.json()) as Array<{
    sha?: string
    commit?: { committer?: { date?: string } }
  }>
  commit = commits[0]?.sha ?? ''
  commitDate = commits[0]?.commit?.committer?.date ?? ''
} catch {
  // Commit metadata is useful for provenance but not required to sync.
}

const version = commitDate ? commitDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
const outputDir = path.resolve(process.env.OPENRUN_LINGUIST_SEED_DIR || path.join(getLinguistSeedRoot(), version))
mkdirSync(outputDir, { recursive: true })

const list: LinguistLanguageList = {
  source: `https://github.com/${repository}`,
  commit,
  fetchedAt: new Date().toISOString(),
  languages,
}
writeFileSync(path.join(outputDir, 'languages.json'), `${JSON.stringify(list, null, 2)}\n`)
writeFileSync(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(
    {
      source: list.source,
      file: languageFile,
      commit,
      commitDate,
      fetchedAt: list.fetchedAt,
      languages: languages.length,
    },
    null,
    2,
  )}\n`,
)

const db = openDatabase()
runMigrations(db)
const result = seedLanguages(db, list, loadLanguageAliases(outputDir))

console.log(`GitHub Linguist -> ${outputDir}`)
console.log(`Languages: ${result.total} total, ${result.removed} non-Linguist rows removed`)
console.log(`Database updated at ${getDatabasePath()}`)

db.close()
