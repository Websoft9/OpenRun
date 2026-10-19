import type { AppDatabase } from '../db/database.js'
import { slugify } from '../db/seed.js'
import { contentHash } from '../lib/content-hash.js'

export type CatalogTranslationInput = {
  name?: string
  summary?: string
  features?: string[]
  useCases?: string[]
  alternatives?: string[]
  whyChoose?: string
  status?: 'draft' | 'reviewed' | 'published'
}

export type CatalogImportProduct = {
  slug?: string
  name: string
  homepage?: string
  repository: string
  license?: string
  primaryLanguage?: string
  stars?: number
  monthlyViews?: number
  lastUpdatedAt?: string
  latestRelease?: string
  deploymentDifficulty?: 'easy' | 'moderate' | 'advanced'
  status?: 'draft' | 'reviewed' | 'published'
  isFeatured?: boolean
  supportsServer?: boolean
  supportsDesktop?: boolean
  supportsCli?: boolean
  supportsSaas?: boolean
  hasUi?: boolean
  hasAi?: boolean
  hasFreeTier?: boolean
  hasPublicPricing?: boolean
  selfServiceSetup?: boolean
  categories?: string[]
  tags?: string[]
  summaryEn?: string
  summaryZh?: string
  featuresEn?: string[]
  featuresZh?: string[]
  useCasesEn?: string[]
  useCasesZh?: string[]
  alternativesEn?: string[]
  alternativesZh?: string[]
  whyChooseEn?: string
  whyChooseZh?: string
  translations?: Record<string, CatalogTranslationInput>
  sourceUrl?: string
  fetchedAt?: string
  reviewedAt?: string
  publishedAt?: string
}

export type CatalogImportResult = {
  created: number
  updated: number
  warnings: string[]
}

type ExistingSoftware = {
  id: number
  slug: string
  repository: string
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
}

function normalizeRepository(value: string): string {
  return value
    .trim()
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

function parseTranslations(value: unknown): Record<string, CatalogTranslationInput> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const result: Record<string, CatalogTranslationInput> = {}
  for (const [locale, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') {
      continue
    }
    const record = raw as Record<string, unknown>
    const status =
      record.status === 'published' || record.status === 'reviewed' || record.status === 'draft'
        ? record.status
        : undefined
    result[locale] = {
      name: typeof record.name === 'string' ? record.name.trim() : undefined,
      summary: typeof record.summary === 'string' ? record.summary : undefined,
      features: asStringArray(record.features),
      useCases: asStringArray(record.useCases),
      alternatives: asStringArray(record.alternatives),
      whyChoose: typeof record.whyChoose === 'string' ? record.whyChoose : undefined,
      status,
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export function parseCatalogPayload(raw: unknown): { products: CatalogImportProduct[]; warnings: string[] } {
  const warnings: string[] = []
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { products?: unknown }).products)
      ? ((raw as { products: unknown[] }).products)
      : null

  if (!items) {
    throw new Error('Catalog payload must be an array or an object with a products array')
  }

  const products: CatalogImportProduct[] = []
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      warnings.push(`Skipped item ${index}: not an object`)
      return
    }

    const record = item as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const repository = typeof record.repository === 'string' ? record.repository.trim() : ''

    if (!name || !repository) {
      warnings.push(`Skipped item ${index}: name and repository are required`)
      return
    }

    const status = record.status === 'reviewed' || record.status === 'published' ? record.status : 'draft'
    const deploymentDifficulty =
      record.deploymentDifficulty === 'easy' || record.deploymentDifficulty === 'advanced'
        ? record.deploymentDifficulty
        : 'moderate'

    products.push({
      slug: typeof record.slug === 'string' ? record.slug : undefined,
      name,
      homepage: typeof record.homepage === 'string' ? record.homepage : undefined,
      repository,
      license: typeof record.license === 'string' ? record.license : undefined,
      primaryLanguage: typeof record.primaryLanguage === 'string' ? record.primaryLanguage : undefined,
      stars: asNumber(record.stars),
      monthlyViews: asNumber(record.monthlyViews),
      lastUpdatedAt: typeof record.lastUpdatedAt === 'string' ? record.lastUpdatedAt : undefined,
      latestRelease: typeof record.latestRelease === 'string' ? record.latestRelease : undefined,
      deploymentDifficulty,
      status,
      isFeatured: record.isFeatured === true,
      supportsServer: record.supportsServer === true,
      supportsDesktop: record.supportsDesktop === true,
      supportsCli: record.supportsCli === true,
      supportsSaas: record.supportsSaas === true,
      hasUi: record.hasUi !== false,
      hasAi: record.hasAi === true,
      hasFreeTier: record.hasFreeTier === true,
      hasPublicPricing: record.hasPublicPricing === true,
      selfServiceSetup: record.selfServiceSetup !== false,
      categories: asStringArray(record.categories),
      tags: asStringArray(record.tags),
      summaryEn: typeof record.summaryEn === 'string' ? record.summaryEn : undefined,
      summaryZh: typeof record.summaryZh === 'string' ? record.summaryZh : undefined,
      featuresEn: asStringArray(record.featuresEn),
      featuresZh: asStringArray(record.featuresZh),
      useCasesEn: asStringArray(record.useCasesEn),
      useCasesZh: asStringArray(record.useCasesZh),
      alternativesEn: asStringArray(record.alternativesEn),
      alternativesZh: asStringArray(record.alternativesZh),
      whyChooseEn: typeof record.whyChooseEn === 'string' ? record.whyChooseEn : undefined,
      whyChooseZh: typeof record.whyChooseZh === 'string' ? record.whyChooseZh : undefined,
      translations: parseTranslations(record.translations),
      sourceUrl: typeof record.sourceUrl === 'string' ? record.sourceUrl : undefined,
      fetchedAt: typeof record.fetchedAt === 'string' ? record.fetchedAt : undefined,
      reviewedAt: typeof record.reviewedAt === 'string' ? record.reviewedAt : undefined,
      publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : undefined,
    })
  })

  return { products, warnings }
}

function uniqueSlug(db: AppDatabase, desired: string, existingId: number | null): string {
  const base = desired || 'software'
  let candidate = base
  let suffix = 2
  for (;;) {
    const row = db.prepare('SELECT id FROM software WHERE slug = ?').get(candidate) as { id: number } | undefined
    if (!row || row.id === existingId) {
      return candidate
    }
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

function findExisting(
  db: AppDatabase,
  slug: string,
  repository: string,
  dedupeByRepository: boolean,
): ExistingSoftware | null {
  const normalized = normalizeRepository(repository)
  const rows = db.prepare('SELECT id, slug, repository FROM software').all() as ExistingSoftware[]
  return (
    rows.find(
      (row) =>
        row.slug === slug ||
        (dedupeByRepository && normalizeRepository(row.repository) === normalized),
    ) ?? null
  )
}

export function importCatalog(
  db: AppDatabase,
  products: CatalogImportProduct[],
  options: { dedupeByRepository?: boolean } = {},
): CatalogImportResult {
  const dedupeByRepository = options.dedupeByRepository !== false
  const result: CatalogImportResult = { created: 0, updated: 0, warnings: [] }
  const now = new Date().toISOString()

  const categoryRows = db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: number; slug: string }>
  const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]))

  const insertSoftware = db.prepare(`
    INSERT INTO software (
      slug, name, homepage, repository, license, primary_language, stars, monthly_views,
      last_updated_at, latest_release, deployment_difficulty, status, is_featured,
      supports_server, supports_desktop, supports_cli, supports_saas,
      has_ui, has_ai, has_free_tier, has_public_pricing, self_service_setup
    ) VALUES (
      @slug, @name, @homepage, @repository, @license, @primaryLanguage, @stars, @monthlyViews,
      @lastUpdatedAt, @latestRelease, @deploymentDifficulty, @status, @isFeatured,
      @supportsServer, @supportsDesktop, @supportsCli, @supportsSaas,
      @hasUi, @hasAi, @hasFreeTier, @hasPublicPricing, @selfServiceSetup
    )
  `)

  const updateSoftware = db.prepare(`
    UPDATE software SET
      name = @name,
      homepage = @homepage,
      repository = @repository,
      license = @license,
      primary_language = @primaryLanguage,
      stars = @stars,
      monthly_views = @monthlyViews,
      last_updated_at = @lastUpdatedAt,
      latest_release = @latestRelease,
      deployment_difficulty = @deploymentDifficulty,
      status = @status,
      is_featured = @isFeatured,
      supports_server = @supportsServer,
      supports_desktop = @supportsDesktop,
      supports_cli = @supportsCli,
      supports_saas = @supportsSaas,
      has_ui = @hasUi,
      has_ai = @hasAi,
      has_free_tier = @hasFreeTier,
      has_public_pricing = @hasPublicPricing,
      self_service_setup = @selfServiceSetup,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `)

  const upsertAnalysis = db.prepare(`
    INSERT INTO analyses (
      software_id, summary_en, features_en, use_cases_en, alternatives_en, why_choose_en
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(software_id) DO UPDATE SET
      summary_en = excluded.summary_en,
      features_en = excluded.features_en,
      use_cases_en = excluded.use_cases_en,
      alternatives_en = excluded.alternatives_en,
      why_choose_en = excluded.why_choose_en
  `)

  const upsertSoftwareTranslation = db.prepare(`
    INSERT INTO software_translations (software_id, locale, name, summary, status, source_hash)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(software_id, locale) DO UPDATE SET
      name = excluded.name,
      summary = excluded.summary,
      status = excluded.status,
      source_hash = excluded.source_hash,
      updated_at = CURRENT_TIMESTAMP
  `)

  const upsertAnalysisTranslation = db.prepare(`
    INSERT INTO software_analysis_translations (
      software_id, locale, features_json, use_cases_json, alternatives_json, why_choose, status, source_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(software_id, locale) DO UPDATE SET
      features_json = excluded.features_json,
      use_cases_json = excluded.use_cases_json,
      alternatives_json = excluded.alternatives_json,
      why_choose = excluded.why_choose,
      status = excluded.status,
      source_hash = excluded.source_hash,
      updated_at = CURRENT_TIMESTAMP
  `)

  const upsertProvenance = db.prepare(`
    INSERT INTO provenance (software_id, source_url, fetched_at, reviewed_at, published_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(software_id) DO UPDATE SET
      source_url = excluded.source_url,
      fetched_at = excluded.fetched_at,
      reviewed_at = CASE WHEN excluded.reviewed_at <> '' THEN excluded.reviewed_at ELSE provenance.reviewed_at END,
      published_at = CASE WHEN excluded.published_at <> '' THEN excluded.published_at ELSE provenance.published_at END
  `)

  const upsertSearchIndex = db.prepare(`
    INSERT INTO search_index (software_id, keyword_blob) VALUES (?, ?)
    ON CONFLICT(software_id) DO UPDATE SET keyword_blob = excluded.keyword_blob
  `)

  db.exec('BEGIN')
  try {
    for (const product of products) {
      if (product.status === 'published' && !product.summaryEn) {
        result.warnings.push(`Skipped ${product.name}: published products need summaryEn`)
        continue
      }

      if (product.status === 'published') {
        const license = product.license || 'NOASSERTION'
        const licenseRow = db.prepare('SELECT is_osi_approved FROM licenses WHERE spdx_id = ?').get(license) as
          | { is_osi_approved: number }
          | undefined
        if (!licenseRow || !licenseRow.is_osi_approved) {
          result.warnings.push(`Skipped ${product.name}: published products need a registered OSI-approved license`)
          continue
        }
        if (!(product.categories ?? []).length) {
          result.warnings.push(`Skipped ${product.name}: published products need at least one category`)
          continue
        }
      }

      const desiredSlug = slugify(product.slug || product.name) || `software-${Date.now()}`
      const existing = findExisting(db, desiredSlug, product.repository, dedupeByRepository)
      const slug = uniqueSlug(db, desiredSlug, existing?.id ?? null)

      const values = {
        slug,
        name: product.name,
        homepage: product.homepage || product.repository,
        repository: product.repository,
        license: product.license || 'NOASSERTION',
        primaryLanguage: product.primaryLanguage || 'Unknown',
        stars: product.stars ?? 0,
        monthlyViews: product.monthlyViews ?? 0,
        lastUpdatedAt: product.lastUpdatedAt || now,
        latestRelease: product.latestRelease || '',
        deploymentDifficulty: product.deploymentDifficulty ?? 'moderate',
        status: product.status ?? 'draft',
        isFeatured: product.isFeatured ? 1 : 0,
        supportsServer: product.supportsServer ? 1 : 0,
        supportsDesktop: product.supportsDesktop ? 1 : 0,
        supportsCli: product.supportsCli ? 1 : 0,
        supportsSaas: product.supportsSaas ? 1 : 0,
        hasUi: product.hasUi === false ? 0 : 1,
        hasAi: product.hasAi ? 1 : 0,
        hasFreeTier: product.hasFreeTier ? 1 : 0,
        hasPublicPricing: product.hasPublicPricing ? 1 : 0,
        selfServiceSetup: product.selfServiceSetup === false ? 0 : 1,
      }

      let softwareId: number
      if (existing) {
        const { slug: _existingSlug, ...updateValues } = values
        updateSoftware.run({ ...updateValues, id: existing.id })
        softwareId = existing.id
        result.updated += 1
      } else {
        insertSoftware.run(values)
        const row = db.prepare('SELECT id FROM software WHERE slug = ?').get(slug) as { id: number }
        softwareId = row.id
        result.created += 1
      }

      db.prepare(`
        INSERT OR IGNORE INTO software_markets (software_id, market_code)
        SELECT ?, 'GLOBAL'
        WHERE NOT EXISTS (SELECT 1 FROM software_markets WHERE software_id = ?)
      `).run(softwareId, softwareId)

      db.prepare('DELETE FROM software_categories WHERE software_id = ?').run(softwareId)
      for (const categorySlug of product.categories ?? []) {
        const categoryId = categoryIds.get(categorySlug)
        if (!categoryId) {
          result.warnings.push(`${product.name}: unknown category ${categorySlug}`)
          continue
        }
        db.prepare('INSERT OR IGNORE INTO software_categories (software_id, category_id) VALUES (?, ?)').run(
          softwareId,
          categoryId,
        )
      }

      db.prepare('DELETE FROM software_tags WHERE software_id = ?').run(softwareId)
      for (const tagName of product.tags ?? []) {
        const tagSlug = slugify(tagName)
        db.prepare(`
          INSERT INTO tags (slug, name) VALUES (?, ?)
          ON CONFLICT(slug) DO UPDATE SET name = excluded.name
        `).run(tagSlug, tagName)
        const tagRow = db.prepare('SELECT id FROM tags WHERE slug = ?').get(tagSlug) as { id: number }
        db.prepare('INSERT OR IGNORE INTO software_tags (software_id, tag_id) VALUES (?, ?)').run(softwareId, tagRow.id)
      }

      upsertAnalysis.run(
        softwareId,
        product.summaryEn ?? '',
        JSON.stringify(product.featuresEn ?? []),
        JSON.stringify(product.useCasesEn ?? []),
        JSON.stringify(product.alternativesEn ?? []),
        product.whyChooseEn ?? '',
      )

      const translations: Record<string, CatalogTranslationInput> = { ...(product.translations ?? {}) }
      if (!translations.zh && (product.summaryZh || product.featuresZh?.length || product.useCasesZh?.length || product.alternativesZh?.length || product.whyChooseZh)) {
        translations.zh = {
          summary: product.summaryZh,
          features: product.featuresZh,
          useCases: product.useCasesZh,
          alternatives: product.alternativesZh,
          whyChoose: product.whyChooseZh,
          status: product.status,
        }
      }

      const sourceHash = contentHash(
        product.summaryEn ?? '',
        product.featuresEn ?? [],
        product.useCasesEn ?? [],
        product.alternativesEn ?? [],
        product.whyChooseEn ?? '',
      )
      for (const [locale, translation] of Object.entries(translations)) {
        if (locale === 'en') {
          continue
        }
        const status = translation.status ?? product.status ?? 'draft'
        upsertSoftwareTranslation.run(
          softwareId,
          locale,
          translation.name ?? '',
          translation.summary ?? '',
          status,
          sourceHash,
        )
        upsertAnalysisTranslation.run(
          softwareId,
          locale,
          JSON.stringify(translation.features ?? []),
          JSON.stringify(translation.useCases ?? []),
          JSON.stringify(translation.alternatives ?? []),
          translation.whyChoose ?? '',
          status,
          sourceHash,
        )
      }

      const publishedAt = product.publishedAt || (product.status === 'published' ? now : '')
      const reviewedAt = product.reviewedAt || (product.status === 'published' ? now : '')
      upsertProvenance.run(
        softwareId,
        product.sourceUrl || product.repository,
        product.fetchedAt || now,
        reviewedAt,
        publishedAt,
      )

      const translatedText = Object.values(translations).flatMap((translation) => [
        translation.name ?? '',
        translation.summary ?? '',
        ...(translation.features ?? []),
        ...(translation.useCases ?? []),
        ...(translation.alternatives ?? []),
        translation.whyChoose ?? '',
      ])
      const keywordBlob = [
        product.name,
        product.summaryEn ?? '',
        ...translatedText,
        (product.tags ?? []).join(' '),
        (product.categories ?? []).join(' '),
        product.primaryLanguage ?? '',
        product.license ?? '',
      ].join(' ')

      upsertSearchIndex.run(softwareId, keywordBlob.toLowerCase())
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return result
}
