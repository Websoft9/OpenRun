import { productSeeds } from '../data/demo-products.js'
import { contentHash } from '../lib/content-hash.js'
import type { AppDatabase } from './database.js'
import { seedReferenceData, slugify } from './seed.js'

const tagTranslations: Record<string, string> = {
  'api-first': 'API 优先',
  alerts: '告警',
  automation: '自动化',
  ci: '持续集成',
  connector: '连接器',
  content: '内容',
  dashboard: '仪表盘',
  email: '邮件',
  events: '事件',
  forms: '表单',
  git: 'Git',
  headless: '无头',
  identity: '身份',
  notes: '笔记',
  observability: '可观测性',
  policy: '策略',
  privacy: '隐私',
  rotation: '轮换',
  search: '搜索',
  secrets: '密钥',
  sql: 'SQL',
  support: '支持',
  'team-collaboration': '团队协作',
  wiki: 'Wiki',
}

export function seedDemoData(db: AppDatabase): number {
  seedReferenceData(db)

  const upsertSoftware = db.prepare(`
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
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      homepage = excluded.homepage,
      repository = excluded.repository,
      license = excluded.license,
      primary_language = excluded.primary_language,
      stars = excluded.stars,
      monthly_views = excluded.monthly_views,
      last_updated_at = excluded.last_updated_at,
      latest_release = excluded.latest_release,
      deployment_difficulty = excluded.deployment_difficulty,
      status = excluded.status,
      is_featured = excluded.is_featured,
      supports_server = excluded.supports_server,
      supports_desktop = excluded.supports_desktop,
      supports_cli = excluded.supports_cli,
      supports_saas = excluded.supports_saas,
      has_ui = excluded.has_ui,
      has_ai = excluded.has_ai,
      has_free_tier = excluded.has_free_tier,
      has_public_pricing = excluded.has_public_pricing,
      self_service_setup = excluded.self_service_setup,
      updated_at = CURRENT_TIMESTAMP
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
    VALUES (?, 'zh', ?, ?, 'published', ?)
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
    ) VALUES (?, 'zh', ?, ?, ?, ?, 'published', ?)
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
      reviewed_at = excluded.reviewed_at,
      published_at = excluded.published_at
  `)

  const upsertSearchIndex = db.prepare(`
    INSERT INTO search_index (software_id, keyword_blob) VALUES (?, ?)
    ON CONFLICT(software_id) DO UPDATE SET keyword_blob = excluded.keyword_blob
  `)

  const insertCategoryLink = db.prepare(`
    INSERT OR IGNORE INTO software_categories (software_id, category_id) VALUES (?, ?)
  `)

  const upsertTag = db.prepare(`
    INSERT INTO tags (slug, name) VALUES (?, ?)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name
  `)

  const insertTagLink = db.prepare(`
    INSERT OR IGNORE INTO software_tags (software_id, tag_id) VALUES (?, ?)
  `)

  const upsertTagTranslation = db.prepare(`
    INSERT INTO tag_translations (tag_id, locale, name, status)
    VALUES (?, 'zh', ?, 'published')
    ON CONFLICT(tag_id, locale) DO UPDATE SET
      name = excluded.name,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `)

  const categoryRows = db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: number; slug: string }>
  const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]))

  db.exec('BEGIN')
  try {
    for (const product of productSeeds) {
      upsertSoftware.run({
        slug: product.slug,
        name: product.name,
        homepage: product.homepage,
        repository: product.repository,
        license: product.license,
        primaryLanguage: product.primaryLanguage,
        stars: product.stars,
        monthlyViews: product.monthlyViews,
        lastUpdatedAt: product.lastUpdatedAt,
        latestRelease: product.latestRelease,
        deploymentDifficulty: product.deploymentDifficulty,
        status: product.status,
        isFeatured: product.isFeatured ? 1 : 0,
        supportsServer: product.supportsServer ? 1 : 0,
        supportsDesktop: product.supportsDesktop ? 1 : 0,
        supportsCli: product.supportsCli ? 1 : 0,
        supportsSaas: product.supportsSaas ? 1 : 0,
        hasUi: product.hasUi ? 1 : 0,
        hasAi: product.hasAi ? 1 : 0,
        hasFreeTier: product.hasFreeTier ? 1 : 0,
        hasPublicPricing: product.hasPublicPricing ? 1 : 0,
        selfServiceSetup: product.selfServiceSetup ? 1 : 0,
      })

      const softwareRow = db.prepare('SELECT id FROM software WHERE slug = ?').get(product.slug) as { id: number }
      const softwareId = softwareRow.id

      db.prepare(`
        INSERT OR IGNORE INTO software_markets (software_id, market_code)
        SELECT ?, 'GLOBAL'
        WHERE NOT EXISTS (SELECT 1 FROM software_markets WHERE software_id = ?)
      `).run(softwareId, softwareId)

      db.prepare('DELETE FROM software_categories WHERE software_id = ?').run(softwareId)
      for (const categorySlug of product.categories) {
        const categoryId = categoryIds.get(categorySlug)
        if (categoryId) {
          insertCategoryLink.run(softwareId, categoryId)
        }
      }

      db.prepare('DELETE FROM software_tags WHERE software_id = ?').run(softwareId)
      for (const tagName of product.tags) {
        const tagSlug = slugify(tagName)
        upsertTag.run(tagSlug, tagName)
        const tagRow = db.prepare('SELECT id FROM tags WHERE slug = ?').get(tagSlug) as { id: number }
        insertTagLink.run(softwareId, tagRow.id)
        const translatedTag = tagTranslations[tagSlug]
        if (translatedTag) {
          upsertTagTranslation.run(tagRow.id, translatedTag)
        }
      }

      upsertAnalysis.run(
        softwareId,
        product.summaryEn,
        JSON.stringify(product.featuresEn),
        JSON.stringify(product.useCasesEn),
        JSON.stringify(product.alternativesEn),
        product.whyChooseEn,
      )

      const sourceHash = contentHash(
        product.summaryEn,
        product.featuresEn,
        product.useCasesEn,
        product.alternativesEn,
        product.whyChooseEn,
      )
      upsertSoftwareTranslation.run(softwareId, '', product.summaryZh, sourceHash)
      upsertAnalysisTranslation.run(
        softwareId,
        JSON.stringify(product.featuresZh),
        JSON.stringify(product.useCasesZh),
        JSON.stringify(product.alternativesZh),
        product.whyChooseZh,
        sourceHash,
      )

      upsertProvenance.run(
        softwareId,
        product.sourceUrl,
        product.lastUpdatedAt,
        product.lastUpdatedAt,
        product.lastUpdatedAt,
      )

      const keywordBlob = [
        product.name,
        product.summaryEn,
        product.summaryZh,
        product.tags.join(' '),
        product.categories.join(' '),
        product.primaryLanguage,
        product.license,
      ].join(' ')

      upsertSearchIndex.run(softwareId, keywordBlob.toLowerCase())
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return productSeeds.length
}
