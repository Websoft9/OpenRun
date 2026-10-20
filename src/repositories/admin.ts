import type { AppDatabase } from '../db/database.js'
import { slugify } from '../db/seed.js'
import { contentHash } from '../lib/content-hash.js'
import { languageExists } from './languages.js'
import { marketExists } from './markets.js'
import { industryExists } from './industries.js'
import { platformExists } from './platforms.js'
import { SubmissionError } from './submissions.js'

export type SoftwareAdmin = {
  id: number
  slug: string
  name: string
  homepage: string
  repository: string
  license: string
  primaryLanguage: string
  stars: number
  monthlyViews: number
  lastUpdatedAt: string
  latestRelease: string
  deploymentDifficulty: 'easy' | 'moderate' | 'advanced'
  status: 'draft' | 'reviewed' | 'published'
  isFeatured: boolean
  supportsServer: boolean
  supportsDesktop: boolean
  supportsCli: boolean
  supportsSaas: boolean
  hasUi: boolean
  hasAi: boolean
  hasFreeTier: boolean
  hasPublicPricing: boolean
  selfServiceSetup: boolean
  categories: string[]
  tags: string[]
  markets: string[]
  platforms: string[]
  industries: string[]
  summaryEn: string
  summaryZh: string
  featuresEn: string[]
  featuresZh: string[]
  useCasesEn: string[]
  useCasesZh: string[]
  alternativesEn: string[]
  alternativesZh: string[]
  whyChooseEn: string
  whyChooseZh: string
  sourceUrl: string
  fetchedAt: string
  reviewedAt: string
  publishedAt: string
}

type SoftwareAdminRow = {
  id: number
  slug: string
  name: string
  homepage: string
  repository: string
  license: string
  primary_language: string
  stars: number
  monthly_views: number
  last_updated_at: string
  latest_release: string
  deployment_difficulty: 'easy' | 'moderate' | 'advanced'
  status: 'draft' | 'reviewed' | 'published'
  is_featured: number
  supports_server: number
  supports_desktop: number
  supports_cli: number
  supports_saas: number
  has_ui: number
  has_ai: number
  has_free_tier: number
  has_public_pricing: number
  self_service_setup: number
  category_slugs: string | null
  tags: string | null
  markets: string | null
  platforms: string | null
  industries: string | null
  summary_en: string | null
  summary_zh: string | null
  features_en: string | null
  features_zh: string | null
  use_cases_en: string | null
  use_cases_zh: string | null
  alternatives_en: string | null
  alternatives_zh: string | null
  why_choose_en: string | null
  why_choose_zh: string | null
  source_url: string | null
  fetched_at: string | null
  reviewed_at: string | null
  published_at: string | null
}

export type SoftwareReviewInput = {
  name: string
  homepage: string
  repository: string
  license: string
  primaryLanguage: string
  stars: number
  latestRelease: string
  deploymentDifficulty: 'easy' | 'moderate' | 'advanced'
  isFeatured: boolean
  supportsServer: boolean
  supportsDesktop: boolean
  supportsCli: boolean
  supportsSaas: boolean
  hasUi: boolean
  hasAi: boolean
  hasFreeTier: boolean
  hasPublicPricing: boolean
  selfServiceSetup: boolean
  categorySlugs: string[]
  tags: string[]
  markets: string[]
  platforms: string[]
  industries: string[]
  summaryEn: string
  summaryZh: string
  featuresEn: string[]
  featuresZh: string[]
  useCasesEn: string[]
  useCasesZh: string[]
  alternativesEn: string[]
  alternativesZh: string[]
  whyChooseEn: string
  whyChooseZh: string
  status: 'draft' | 'reviewed'
}

const adminQuery = `
  SELECT
    s.id, s.slug, s.name, s.homepage, s.repository, s.license, s.primary_language,
    s.stars, s.monthly_views, s.last_updated_at, s.latest_release,
    s.deployment_difficulty, s.status, s.is_featured,
    s.supports_server, s.supports_desktop, s.supports_cli, s.supports_saas,
    s.has_ui, s.has_ai, s.has_free_tier, s.has_public_pricing, s.self_service_setup,
    a.summary_en, COALESCE(tr.summary, '') AS summary_zh,
    a.features_en, COALESCE(atr.features_json, '[]') AS features_zh,
    a.use_cases_en, COALESCE(atr.use_cases_json, '[]') AS use_cases_zh,
    a.alternatives_en, COALESCE(atr.alternatives_json, '[]') AS alternatives_zh,
    a.why_choose_en, COALESCE(atr.why_choose, '') AS why_choose_zh,
    p.source_url, p.fetched_at, p.reviewed_at, p.published_at,
    GROUP_CONCAT(DISTINCT c.slug) AS category_slugs,
    GROUP_CONCAT(DISTINCT t.name) AS tags,
    GROUP_CONCAT(DISTINCT smk.market_code) AS markets,
    GROUP_CONCAT(DISTINCT sp.platform_code) AS platforms,
    GROUP_CONCAT(DISTINCT si.industry_code) AS industries
  FROM software s
  LEFT JOIN analyses a ON a.software_id = s.id
  LEFT JOIN software_translations tr ON tr.software_id = s.id AND tr.locale = 'zh'
  LEFT JOIN software_analysis_translations atr ON atr.software_id = s.id AND atr.locale = 'zh'
  LEFT JOIN provenance p ON p.software_id = s.id
  LEFT JOIN software_categories sc ON sc.software_id = s.id
  LEFT JOIN categories c ON c.id = sc.category_id
  LEFT JOIN software_tags st ON st.software_id = s.id
  LEFT JOIN tags t ON t.id = st.tag_id
  LEFT JOIN software_markets smk ON smk.software_id = s.id
  LEFT JOIN software_platforms sp ON sp.software_id = s.id
  LEFT JOIN software_industries si ON si.software_id = s.id
`

function parseList(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : []
}

function parseJsonList(value: string | null): string[] {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function mapAdmin(row: SoftwareAdminRow): SoftwareAdmin {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    homepage: row.homepage,
    repository: row.repository,
    license: row.license,
    primaryLanguage: row.primary_language,
    stars: row.stars,
    monthlyViews: row.monthly_views,
    lastUpdatedAt: row.last_updated_at,
    latestRelease: row.latest_release,
    deploymentDifficulty: row.deployment_difficulty,
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    supportsServer: Boolean(row.supports_server),
    supportsDesktop: Boolean(row.supports_desktop),
    supportsCli: Boolean(row.supports_cli),
    supportsSaas: Boolean(row.supports_saas),
    hasUi: Boolean(row.has_ui),
    hasAi: Boolean(row.has_ai),
    hasFreeTier: Boolean(row.has_free_tier),
    hasPublicPricing: Boolean(row.has_public_pricing),
    selfServiceSetup: Boolean(row.self_service_setup),
    categories: parseList(row.category_slugs),
    tags: parseList(row.tags),
    markets: parseList(row.markets),
    platforms: parseList(row.platforms),
    industries: parseList(row.industries),
    summaryEn: row.summary_en ?? '',
    summaryZh: row.summary_zh ?? '',
    featuresEn: parseJsonList(row.features_en),
    featuresZh: parseJsonList(row.features_zh),
    useCasesEn: parseJsonList(row.use_cases_en),
    useCasesZh: parseJsonList(row.use_cases_zh),
    alternativesEn: parseJsonList(row.alternatives_en),
    alternativesZh: parseJsonList(row.alternatives_zh),
    whyChooseEn: row.why_choose_en ?? '',
    whyChooseZh: row.why_choose_zh ?? '',
    sourceUrl: row.source_url ?? '',
    fetchedAt: row.fetched_at ?? '',
    reviewedAt: row.reviewed_at ?? '',
    publishedAt: row.published_at ?? '',
  }
}

export function getSoftwareForAdmin(db: AppDatabase, slug: string): SoftwareAdmin | null {
  const row = db.prepare(`${adminQuery} WHERE s.slug = ? GROUP BY s.id`).get(slug) as SoftwareAdminRow | undefined
  return row ? mapAdmin(row) : null
}

export function listReviewQueue(db: AppDatabase): SoftwareAdmin[] {
  const rows = db
    .prepare(`${adminQuery} WHERE s.status <> 'published' GROUP BY s.id ORDER BY s.updated_at DESC`)
    .all() as SoftwareAdminRow[]
  return rows.map(mapAdmin)
}

export function listAdminSoftware(db: AppDatabase, limit = 100): SoftwareAdmin[] {
  const rows = db
    .prepare(`${adminQuery} GROUP BY s.id ORDER BY s.updated_at DESC LIMIT ?`)
    .all(limit) as SoftwareAdminRow[]
  return rows.map(mapAdmin)
}

function assertKnownCategories(db: AppDatabase, slugs: string[]): void {
  const row = db.prepare('SELECT slug FROM categories').all() as Array<{ slug: string }>
  const known = new Set(row.map((item) => item.slug))
  for (const slug of slugs) {
    if (!known.has(slug)) {
      throw new SubmissionError('unknown_category', `Unknown category: ${slug}`)
    }
  }
}

export function saveSoftwareReview(db: AppDatabase, slug: string, input: SoftwareReviewInput): SoftwareAdmin {
  const existing = db.prepare('SELECT id, slug, status FROM software WHERE slug = ?').get(slug) as
    | { id: number; slug: string; status: 'draft' | 'reviewed' | 'published' }
    | undefined
  if (!existing) {
    throw new SubmissionError('not_found', 'Software not found', 404)
  }

  if (!input.name.trim() || !input.homepage.trim() || !input.repository.trim()) {
    throw new SubmissionError('invalid_input', 'Name, homepage, and repository are required')
  }
  if (!Number.isFinite(input.stars) || input.stars < 0) {
    throw new SubmissionError('invalid_input', 'Stars must be a non-negative number')
  }
  if (!languageExists(db, input.primaryLanguage.trim() || 'Unknown')) {
    throw new SubmissionError('unknown_language', 'Primary language must be a canonical GitHub Linguist name')
  }
  for (const market of input.markets) {
    if (!marketExists(db, market)) {
      throw new SubmissionError('unknown_market', `Unknown market: ${market}`)
    }
  }
  for (const platform of input.platforms) {
    if (!platformExists(db, platform)) {
      throw new SubmissionError('unknown_platform', `Unknown platform: ${platform}`)
    }
  }
  for (const industry of input.industries) {
    if (!industryExists(db, industry)) {
      throw new SubmissionError('unknown_industry', `Unknown industry: ${industry}`)
    }
  }
  assertKnownCategories(db, input.categorySlugs)

  db.exec('BEGIN')
  try {
    db.prepare(`
      UPDATE software SET
        name = ?, homepage = ?, repository = ?, license = ?, primary_language = ?,
        stars = ?, latest_release = ?, deployment_difficulty = ?, is_featured = ?,
        supports_server = ?, supports_desktop = ?, supports_cli = ?, supports_saas = ?,
        has_ui = ?, has_ai = ?, has_free_tier = ?, has_public_pricing = ?, self_service_setup = ?,
        status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      input.name.trim(),
      input.homepage.trim(),
      input.repository.trim(),
      input.license.trim() || 'NOASSERTION',
      input.primaryLanguage.trim() || 'Unknown',
      Math.round(input.stars),
      input.latestRelease.trim(),
      input.deploymentDifficulty,
      input.isFeatured ? 1 : 0,
      input.supportsServer ? 1 : 0,
      input.supportsDesktop ? 1 : 0,
      input.supportsCli ? 1 : 0,
      input.supportsSaas ? 1 : 0,
      input.hasUi ? 1 : 0,
      input.hasAi ? 1 : 0,
      input.hasFreeTier ? 1 : 0,
      input.hasPublicPricing ? 1 : 0,
      input.selfServiceSetup ? 1 : 0,
      existing.status === 'published' ? 'published' : input.status,
      existing.id,
    )

    db.prepare('DELETE FROM software_categories WHERE software_id = ?').run(existing.id)
    for (const categorySlug of input.categorySlugs) {
      const category = db.prepare('SELECT id FROM categories WHERE slug = ?').get(categorySlug) as { id: number }
      db.prepare('INSERT OR IGNORE INTO software_categories (software_id, category_id) VALUES (?, ?)').run(
        existing.id,
        category.id,
      )
    }

    db.prepare('DELETE FROM software_tags WHERE software_id = ?').run(existing.id)
    for (const tagName of input.tags) {
      const tagSlug = slugify(tagName)
      if (!tagSlug) {
        continue
      }
      db.prepare(`
        INSERT INTO tags (slug, name) VALUES (?, ?)
        ON CONFLICT(slug) DO UPDATE SET name = excluded.name
      `).run(tagSlug, tagName.trim())
      const tag = db.prepare('SELECT id FROM tags WHERE slug = ?').get(tagSlug) as { id: number }
      db.prepare('INSERT OR IGNORE INTO software_tags (software_id, tag_id) VALUES (?, ?)').run(existing.id, tag.id)
    }

    db.prepare('DELETE FROM software_markets WHERE software_id = ?').run(existing.id)
    for (const market of input.markets) {
      db.prepare('INSERT OR IGNORE INTO software_markets (software_id, market_code) VALUES (?, ?)').run(
        existing.id,
        market,
      )
    }

    db.prepare('DELETE FROM software_platforms WHERE software_id = ?').run(existing.id)
    for (const platform of input.platforms) {
      db.prepare(
        "INSERT OR IGNORE INTO software_platforms (software_id, platform_code, support_level) VALUES (?, ?, 'supported')",
      ).run(existing.id, platform)
    }

    db.prepare('DELETE FROM software_industries WHERE software_id = ?').run(existing.id)
    for (const industry of input.industries) {
      db.prepare('INSERT OR IGNORE INTO software_industries (software_id, industry_code) VALUES (?, ?)').run(
        existing.id,
        industry,
      )
    }


    db.prepare(`
      INSERT INTO analyses (
        software_id, summary_en, features_en, use_cases_en, alternatives_en, why_choose_en
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(software_id) DO UPDATE SET
        summary_en = excluded.summary_en,
        features_en = excluded.features_en,
        use_cases_en = excluded.use_cases_en,
        alternatives_en = excluded.alternatives_en,
        why_choose_en = excluded.why_choose_en
    `).run(
      existing.id,
      input.summaryEn,
      JSON.stringify(input.featuresEn),
      JSON.stringify(input.useCasesEn),
      JSON.stringify(input.alternativesEn),
      input.whyChooseEn,
    )

    const sourceHash = contentHash(
      input.summaryEn,
      input.featuresEn,
      input.useCasesEn,
      input.alternativesEn,
      input.whyChooseEn,
    )
    const translationStatus = existing.status === 'published' ? 'published' : input.status
    db.prepare(`
      INSERT INTO software_translations (software_id, locale, name, summary, status, source_hash)
      VALUES (?, 'zh', '', ?, ?, ?)
      ON CONFLICT(software_id, locale) DO UPDATE SET
        name = excluded.name,
        summary = excluded.summary,
        status = excluded.status,
        source_hash = excluded.source_hash,
        updated_at = CURRENT_TIMESTAMP
    `).run(existing.id, input.summaryZh, translationStatus, sourceHash)
    db.prepare(`
      INSERT INTO software_analysis_translations (
        software_id, locale, features_json, use_cases_json, alternatives_json, why_choose, status, source_hash
      ) VALUES (?, 'zh', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(software_id, locale) DO UPDATE SET
        features_json = excluded.features_json,
        use_cases_json = excluded.use_cases_json,
        alternatives_json = excluded.alternatives_json,
        why_choose = excluded.why_choose,
        status = excluded.status,
        source_hash = excluded.source_hash,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      existing.id,
      JSON.stringify(input.featuresZh),
      JSON.stringify(input.useCasesZh),
      JSON.stringify(input.alternativesZh),
      input.whyChooseZh,
      translationStatus,
      sourceHash,
    )

    const keywordBlob = [
      input.name,
      input.summaryEn,
      input.summaryZh,
      input.tags.join(' '),
      input.categorySlugs.join(' '),
      input.primaryLanguage,
      input.license,
    ].join(' ')
    db.prepare(`
      INSERT INTO search_index (software_id, keyword_blob) VALUES (?, ?)
      ON CONFLICT(software_id) DO UPDATE SET keyword_blob = excluded.keyword_blob
    `).run(existing.id, keywordBlob.toLowerCase())

    if (input.status === 'reviewed') {
      db.prepare(`
        UPDATE provenance SET reviewed_at = CASE WHEN reviewed_at = '' THEN ? ELSE reviewed_at END
        WHERE software_id = ?
      `).run(new Date().toISOString(), existing.id)
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  const saved = getSoftwareForAdmin(db, slug)
  if (!saved) {
    throw new SubmissionError('not_found', 'Software not found after save', 404)
  }
  return saved
}
