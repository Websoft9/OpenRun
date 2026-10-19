import { setDefaultResultOrder } from 'node:dns'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getDatabasePath, getMarketSeedRoot, openDatabase } from '../db/database.js'
import { seedMarkets, type MarketList, type MarketSeed } from '../db/markets-seed.js'
import { runMigrations } from '../db/migrate.js'

setDefaultResultOrder('ipv4first')

type WorldBankCountry = {
  id?: string
  iso2Code?: string
  name?: string
  region?: { id?: string; value?: string }
}

const source = process.env.WORLD_BANK_COUNTRY_URL || 'https://api.worldbank.org/v2/country?format=json&per_page=400'

async function fetchCountries(): Promise<WorldBankCountry[]> {
  const response = await fetch(source, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'OpenRun-Market-Sync',
    },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    throw new Error(`World Bank request failed: ${response.status} ${source}`)
  }
  const payload = (await response.json()) as [unknown, WorldBankCountry[]]
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    throw new Error(`Invalid World Bank response from ${source}`)
  }
  return payload[1]
}

const countries = await fetchCountries()
const regionNames = new Map<string, string>()
for (const country of countries) {
  const regionId = country.region?.id
  const regionName = country.region?.value?.trim()
  if (regionId && regionName && regionName !== 'Aggregates') {
    regionNames.set(regionId, regionName)
  }
}

const markets: MarketSeed[] = [
  { code: 'GLOBAL', name: 'Global', type: 'global', parentCode: null, iso3: '', source: 'openrun' },
]

for (const [code, name] of [...regionNames.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
  markets.push({ code, name, type: 'region', parentCode: 'GLOBAL', iso3: '', source: 'worldbank' })
}

const seenCountries = new Set<string>()
for (const country of countries) {
  const code = country.iso2Code?.trim()
  const name = country.name?.trim()
  const regionId = country.region?.id
  const regionName = country.region?.value?.trim()
  if (!code || !name || !regionId || !regionName || regionName === 'Aggregates') {
    continue
  }
  if (seenCountries.has(code)) {
    continue
  }
  seenCountries.add(code)
  markets.push({
    code,
    name,
    type: 'country',
    parentCode: regionId,
    iso3: country.id?.trim() || '',
    source: 'worldbank',
  })
}

const date = new Date().toISOString().slice(0, 10)
const outputDir = path.resolve(process.env.OPENRUN_MARKET_SEED_DIR || path.join(getMarketSeedRoot(), date))
mkdirSync(outputDir, { recursive: true })

const list: MarketList = {
  source,
  fetchedAt: new Date().toISOString(),
  markets,
}
writeFileSync(path.join(outputDir, 'markets.json'), `${JSON.stringify(list, null, 2)}\n`)
writeFileSync(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(
    {
      source,
      fetchedAt: list.fetchedAt,
      global: 1,
      regions: regionNames.size,
      countries: seenCountries.size,
    },
    null,
    2,
  )}\n`,
)

const db = openDatabase()
runMigrations(db)
const result = seedMarkets(db, list)

console.log(`World Bank markets -> ${outputDir}`)
console.log(
  `Markets: ${result.global} global, ${result.regions} regions, ${result.countries} countries (${result.removed} removed)`,
)
console.log(`Database updated at ${getDatabasePath()}`)

db.close()
