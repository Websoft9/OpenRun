import { setDefaultResultOrder } from 'node:dns'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getDatabasePath, openDatabase } from '../db/database.js'
import { runMigrations } from '../db/migrate.js'
import { seedSpdxLicenses, type SpdxLicenseList } from '../db/spdx-seed.js'

setDefaultResultOrder('ipv4first')

const source = process.env.SPDX_LICENSE_LIST_URL || 'https://spdx.org/licenses/licenses.json'

async function fetchLicenseList(): Promise<SpdxLicenseList> {
  const response = await fetch(source, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'OpenRun-SPDX-Sync',
    },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    throw new Error(`SPDX request failed: ${response.status} ${source}`)
  }
  const payload = (await response.json()) as SpdxLicenseList
  if (!payload.licenseListVersion || !Array.isArray(payload.licenses)) {
    throw new Error(`Invalid SPDX license list from ${source}`)
  }
  return payload
}

const list = await fetchLicenseList()
const outputDir = path.resolve(
  process.env.OPENRUN_SPDX_SEED_DIR || path.join('seed/spdx', list.licenseListVersion),
)
mkdirSync(outputDir, { recursive: true })
writeFileSync(path.join(outputDir, 'licenses.json'), `${JSON.stringify(list, null, 2)}\n`)
writeFileSync(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(
    {
      licenseListVersion: list.licenseListVersion,
      releaseDate: list.releaseDate ?? '',
      source,
    },
    null,
    2,
  )}\n`,
)

const db = openDatabase()
runMigrations(db)
const result = seedSpdxLicenses(db, list)

console.log(`SPDX License List ${result.version} -> ${outputDir}`)
console.log(`Licenses: ${result.total} total, ${result.osiApproved} OSI approved, ${result.removed} non-SPDX rows removed`)
console.log(`Database updated at ${getDatabasePath()}`)

db.close()
