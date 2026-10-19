import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function getDatabasePath(): string {
  const configured = process.env.OPENRUN_DB_PATH
  if (configured) {
    return path.resolve(configured)
  }
  return path.resolve(__dirname, '../../data/openrun.sqlite')
}

export function getMigrationsDir(): string {
  const configured = process.env.OPENRUN_MIGRATIONS_DIR
  if (configured) {
    return path.resolve(configured)
  }
  return path.resolve(__dirname, '../../src/db/migrations')
}

function latestSeedVersion(root: string): string | null {
  if (existsSync(path.join(root, 'manifest.json'))) {
    return root
  }
  if (!existsSync(root)) {
    return null
  }
  const versions = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(root, name, 'manifest.json')))
    .sort()
    .reverse()
  return versions.length > 0 ? path.join(root, versions[0]) : null
}

export function getMarketSeedRoot(): string {
  const configured = process.env.OPENRUN_MARKET_SEED_DIR
  return configured ? path.resolve(configured) : path.resolve(__dirname, '../../seed/markets')
}

export function getMarketSeedDir(): string {
  const root = getMarketSeedRoot()
  return latestSeedVersion(root) ?? root
}

export function getLinguistSeedRoot(): string {
  const configured = process.env.OPENRUN_LINGUIST_SEED_DIR
  return configured ? path.resolve(configured) : path.resolve(__dirname, '../../seed/languages')
}

export function getLinguistSeedDir(): string {
  const root = getLinguistSeedRoot()
  return latestSeedVersion(root) ?? root
}

export function getSpdxSeedRoot(): string {
  const configured = process.env.OPENRUN_SPDX_SEED_DIR
  return configured ? path.resolve(configured) : path.resolve(__dirname, '../../seed/spdx')
}

export function getSpdxSeedDir(): string {
  const root = getSpdxSeedRoot()
  return latestSeedVersion(root) ?? root
}

export function getContentfulSeedRoot(): string {
  const configured = process.env.OPENRUN_CONTENTFUL_SEED_DIR
  return configured ? path.resolve(configured) : path.resolve(__dirname, '../../seed/contentful')
}

export function getContentfulSeedDir(): string {
  const root = getContentfulSeedRoot()
  return latestSeedVersion(root) ?? root
}

export type AppDatabase = DatabaseSync

export function openDatabase(): AppDatabase {
  const databasePath = getDatabasePath()
  const parent = path.dirname(databasePath)

  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true })
  }

  const db = new DatabaseSync(databasePath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  return db
}
