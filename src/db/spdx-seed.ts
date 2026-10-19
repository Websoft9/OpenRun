import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { getSpdxSeedDir } from './database.js'
import type { AppDatabase } from './database.js'

export type SpdxLicense = {
  licenseId: string
  name: string
  isOsiApproved?: boolean
  isDeprecatedLicenseId?: boolean
  reference?: string
}

export type SpdxLicenseList = {
  licenseListVersion: string
  releaseDate?: string
  licenses: SpdxLicense[]
}

export type SpdxSeedResult = {
  version: string
  total: number
  osiApproved: number
  removed: number
}

export function loadSpdxLicenseList(dir = getSpdxSeedDir()): SpdxLicenseList {
  const filePath = path.join(dir, 'licenses.json')
  if (!existsSync(filePath)) {
    throw new Error(`SPDX license list not found at ${filePath}`)
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as SpdxLicenseList
  if (!Array.isArray(parsed.licenses)) {
    throw new Error(`Invalid SPDX license list at ${filePath}`)
  }
  return parsed
}

export function seedSpdxLicenses(db: AppDatabase, list: SpdxLicenseList): SpdxSeedResult {
  const upsert = db.prepare(`
    INSERT INTO licenses (spdx_id, name, is_osi_approved, reference_url)
    VALUES (@spdxId, @name, @isOsiApproved, @referenceUrl)
    ON CONFLICT(spdx_id) DO UPDATE SET
      name = excluded.name,
      is_osi_approved = excluded.is_osi_approved,
      reference_url = excluded.reference_url
  `)

  const known = new Set(list.licenses.map((license) => license.licenseId))
  let removed = 0

  db.exec('BEGIN')
  try {
    for (const license of list.licenses) {
      upsert.run({
        spdxId: license.licenseId,
        name: license.name,
        isOsiApproved: license.isOsiApproved ? 1 : 0,
        referenceUrl: license.reference || `https://spdx.org/licenses/${encodeURIComponent(license.licenseId)}.html`,
      })
    }

    const existing = db.prepare('SELECT spdx_id FROM licenses').all() as Array<{ spdx_id: string }>
    const remove = db.prepare('DELETE FROM licenses WHERE spdx_id = ?')
    for (const row of existing) {
      if (!known.has(row.spdx_id)) {
        remove.run(row.spdx_id)
        removed += 1
      }
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return {
    version: list.licenseListVersion,
    total: list.licenses.length,
    osiApproved: list.licenses.filter((license) => license.isOsiApproved).length,
    removed,
  }
}
