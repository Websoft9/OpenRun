import { openDatabase } from '../src/db/database.js'
import { contentHash } from '../src/lib/content-hash.js'

const db = openDatabase()
const errors: string[] = []
const warnings: string[] = []

type SoftwareRow = {
  software_id: number
  slug: string
  locale: string
  summary: string
  source_hash: string
  summary_en: string
  features_en: string
  use_cases_en: string
  alternatives_en: string
  why_choose_en: string
}

const softwareRows = db
  .prepare(`
    SELECT
      st.software_id, s.slug, st.locale, st.summary, st.source_hash,
      st.status, a.summary_en, a.features_en, a.use_cases_en,
      a.alternatives_en, a.why_choose_en
    FROM software_translations st
    JOIN software s ON s.id = st.software_id
    JOIN analyses a ON a.software_id = s.id
  `)
  .all() as Array<SoftwareRow & { status: string }>

for (const row of softwareRows) {
  if (row.status === 'published' && !row.summary.trim()) {
    errors.push(`${row.slug} [${row.locale}]: published translation has an empty summary`)
  }
  const expected = contentHash(
    row.summary_en,
    JSON.parse(row.features_en),
    JSON.parse(row.use_cases_en),
    JSON.parse(row.alternatives_en),
    row.why_choose_en,
  )
  if (!row.source_hash) {
    warnings.push(`${row.slug} [${row.locale}]: translation has no source_hash`)
  } else if (row.source_hash !== expected) {
    warnings.push(`${row.slug} [${row.locale}]: translation is stale against English source`)
  }
}

type AnalysisRow = {
  software_id: number
  slug: string
  locale: string
  features_json: string
  use_cases_json: string
  alternatives_json: string
  status: string
}

const analysisRows = db
  .prepare(`
    SELECT sat.software_id, s.slug, sat.locale, sat.features_json,
           sat.use_cases_json, sat.alternatives_json, sat.status
    FROM software_analysis_translations sat
    JOIN software s ON s.id = sat.software_id
  `)
  .all() as AnalysisRow[]

for (const row of analysisRows) {
  if (row.status !== 'published') {
    continue
  }
  for (const [field, value] of Object.entries({
    features: row.features_json,
    useCases: row.use_cases_json,
    alternatives: row.alternatives_json,
  })) {
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        errors.push(`${row.slug} [${row.locale}]: ${field} is not an array`)
      }
    } catch {
      errors.push(`${row.slug} [${row.locale}]: ${field} is invalid JSON`)
    }
  }
}

const emptyCategories = db
  .prepare("SELECT COUNT(*) AS count FROM category_translations WHERE status = 'published' AND trim(name) = ''")
  .get() as { count: number }
const emptyTags = db
  .prepare("SELECT COUNT(*) AS count FROM tag_translations WHERE status = 'published' AND trim(name) = ''")
  .get() as { count: number }
const missingEnglish = db
  .prepare("SELECT COUNT(*) AS count FROM software s JOIN analyses a ON a.software_id = s.id WHERE s.status = 'published' AND trim(a.summary_en) = ''")
  .get() as { count: number }

if (emptyCategories.count > 0) {
  errors.push(`${emptyCategories.count} published category translations have empty names`)
}
if (emptyTags.count > 0) {
  errors.push(`${emptyTags.count} published tag translations have empty names`)
}
if (missingEnglish.count > 0) {
  errors.push(`${missingEnglish.count} published software records have no English summary`)
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`)
}
for (const error of errors) {
  console.error(`error: ${error}`)
}

if (errors.length > 0) {
  process.exit(1)
}

console.log(
  `Translations OK (${softwareRows.length} software, ${analysisRows.length} analysis, ${emptyCategories.count === 0 ? 'categories' : 'categories with issues'}, tags checked)`,
)

db.close()
