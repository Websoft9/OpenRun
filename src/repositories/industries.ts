import type { AppDatabase } from '../db/database.js'
import type { Locale } from '../i18n/index.js'
import { listProducts, type ProductCard } from './catalog.js'

export type IndustrySummary = {
  code: string
  name: string
  level: string
  parentCode: string | null
  productCount: number
}

export type IndustryDetail = {
  industry: IndustrySummary
  software: ProductCard[]
}

type IndustryRow = {
  code: string
  name: string
  name_zh: string
  level: string
  parent_code: string | null
  product_count: number
}

const industryQuery = `
  SELECT
    i.code,
    i.name,
    i.name_zh,
    i.level,
    i.parent_code,
    (
      SELECT COUNT(DISTINCT si.software_id)
      FROM software_industries si
      JOIN software s ON s.id = si.software_id AND s.status = 'published'
      WHERE si.industry_code = i.code
    ) AS product_count
  FROM industries i
`

function mapIndustry(row: IndustryRow, locale: Locale): IndustrySummary {
  return {
    code: row.code,
    name: locale === 'zh' && row.name_zh ? row.name_zh : row.name,
    level: row.level,
    parentCode: row.parent_code,
    productCount: row.product_count,
  }
}

export function listIndustries(db: AppDatabase, locale: Locale = 'en'): IndustrySummary[] {
  const rows = db
    .prepare(`
      ${industryQuery}
      ORDER BY
        CASE WHEN i.code = 'CROSS_INDUSTRY' THEN 0 ELSE 1 END,
        i.level,
        i.code
    `)
    .all() as IndustryRow[]

  return rows.map((row) => mapIndustry(row, locale))
}

export function getIndustryByCode(
  db: AppDatabase,
  code: string,
  locale: Locale = 'en',
  filters: Parameters<typeof listProducts>[2] = {},
): IndustryDetail | null {
  const row = db.prepare(`${industryQuery} WHERE i.code = ?`).get(code) as IndustryRow | undefined
  if (!row) {
    return null
  }

  const industry = mapIndustry(row, locale)
  return {
    industry,
    software: listProducts(db, locale, { ...filters, industry: industry.code, limit: 100 }),
  }
}

export function industryExists(db: AppDatabase, code: string): boolean {
  return Boolean(db.prepare('SELECT 1 AS ok FROM industries WHERE code = ?').get(code))
}
