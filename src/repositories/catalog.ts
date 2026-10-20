import type { AppDatabase } from '../db/database.js'
import type { Locale } from '../i18n/index.js'

export type { Locale } from '../i18n/index.js'

export type DeliveryModel = 'server' | 'desktop' | 'cli' | 'saas'

type ProductListRow = {
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
  summary: string
  category_slugs: string
  category_names: string
  tags: string
  markets: string
  platforms: string
  industries: string
}

type ProductDetailRow = ProductListRow & {
  features: string
  use_cases: string
  alternatives: string
  why_choose: string
  source_url: string
  fetched_at: string
  reviewed_at: string
  published_at: string
}

type CategoryRow = {
  slug: string
  name: string
  description: string
  product_count: number
}

export type ProductCard = {
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
  isFeatured: boolean
  deliveryModels: DeliveryModel[]
  hasUi: boolean
  hasAi: boolean
  hasFreeTier: boolean
  hasPublicPricing: boolean
  selfServiceSetup: boolean
  summary: string
  categories: Array<{ slug: string; name: string }>
  tags: string[]
  markets: string[]
  platforms: string[]
  industries: string[]
}

export type ProductDetail = ProductCard & {
  features: string[]
  useCases: string[]
  alternatives: string[]
  whyChoose: string
  sourceUrl: string
  fetchedAt: string
  reviewedAt: string
  publishedAt: string
}

export type CategorySummary = {
  slug: string
  name: string
  description: string
  productCount: number
  parentSlug?: string | null
  position?: number
}

export type TagSummary = {
  slug: string
  name: string
  productCount: number
}

export type SearchFilters = {
  q?: string
  category?: string
  tag?: string
  industry?: string
  delivery?: DeliveryModel
  hasUi?: boolean
  hasAi?: boolean
  hasFreeTier?: boolean
  hasPublicPricing?: boolean
  selfServiceSetup?: boolean
  limit?: number
}

const baseListQuery = `
  SELECT
    s.id,
    s.slug,
    COALESCE(NULLIF(st.name, ''), s.name) AS name,
    s.homepage,
    s.repository,
    s.license,
    s.primary_language,
    s.stars,
    s.monthly_views,
    s.last_updated_at,
    s.latest_release,
    s.deployment_difficulty,
    s.is_featured,
    s.supports_server,
    s.supports_desktop,
    s.supports_cli,
    s.supports_saas,
    s.has_ui,
    s.has_ai,
    s.has_free_tier,
    s.has_public_pricing,
    s.self_service_setup,
    COALESCE(NULLIF(st.summary, ''), a.summary_en) AS summary,
    GROUP_CONCAT(DISTINCT c.slug) AS category_slugs,
    GROUP_CONCAT(DISTINCT COALESCE(NULLIF(ct.name, ''), c.name_en)) AS category_names,
    GROUP_CONCAT(DISTINCT COALESCE(NULLIF(tt.name, ''), t.name)) AS tags,
    GROUP_CONCAT(DISTINCT mk.name) AS markets,
    GROUP_CONCAT(DISTINCT pl.os_name || ' / ' || pl.arch_name) AS platforms,
    GROUP_CONCAT(DISTINCT si.industry_code || '|' || i.name || '|' || i.name_zh) AS industries
  FROM software s
  JOIN analyses a ON a.software_id = s.id
  LEFT JOIN software_categories sc ON sc.software_id = s.id
  LEFT JOIN categories c ON c.id = sc.category_id AND c.external_source = ''
  LEFT JOIN software_translations st
    ON st.software_id = s.id AND st.locale = ? AND st.status = 'published'
  LEFT JOIN category_translations ct
    ON ct.category_id = c.id AND ct.locale = ? AND ct.status = 'published'
  LEFT JOIN software_tags stg ON stg.software_id = s.id
  LEFT JOIN tags t ON t.id = stg.tag_id
  LEFT JOIN tag_translations tt
    ON tt.tag_id = t.id AND tt.locale = ? AND tt.status = 'published'
  LEFT JOIN software_markets smk ON smk.software_id = s.id
  LEFT JOIN markets mk ON mk.code = smk.market_code
  LEFT JOIN software_platforms spl ON spl.software_id = s.id
  LEFT JOIN platforms pl ON pl.code = spl.platform_code
  LEFT JOIN software_industries si ON si.software_id = s.id
  LEFT JOIN industries i ON i.code = si.industry_code
  WHERE s.status = 'published'
`

const baseListGroup = `
  GROUP BY s.id
`

const detailQuery = `
  SELECT
    s.id,
    s.slug,
    COALESCE(NULLIF(st.name, ''), s.name) AS name,
    s.homepage,
    s.repository,
    s.license,
    s.primary_language,
    s.stars,
    s.monthly_views,
    s.last_updated_at,
    s.latest_release,
    s.deployment_difficulty,
    s.is_featured,
    s.supports_server,
    s.supports_desktop,
    s.supports_cli,
    s.supports_saas,
    s.has_ui,
    s.has_ai,
    s.has_free_tier,
    s.has_public_pricing,
    s.self_service_setup,
    COALESCE(NULLIF(st.summary, ''), a.summary_en) AS summary,
    CASE WHEN sat.features_json IS NOT NULL AND sat.features_json NOT IN ('', '[]') THEN sat.features_json ELSE a.features_en END AS features,
    CASE WHEN sat.use_cases_json IS NOT NULL AND sat.use_cases_json NOT IN ('', '[]') THEN sat.use_cases_json ELSE a.use_cases_en END AS use_cases,
    CASE WHEN sat.alternatives_json IS NOT NULL AND sat.alternatives_json NOT IN ('', '[]') THEN sat.alternatives_json ELSE a.alternatives_en END AS alternatives,
    COALESCE(NULLIF(sat.why_choose, ''), a.why_choose_en) AS why_choose,
    p.source_url,
    p.fetched_at,
    p.reviewed_at,
    p.published_at,
    GROUP_CONCAT(DISTINCT c.slug) AS category_slugs,
    GROUP_CONCAT(DISTINCT COALESCE(NULLIF(ct.name, ''), c.name_en)) AS category_names,
    GROUP_CONCAT(DISTINCT COALESCE(NULLIF(tt.name, ''), t.name)) AS tags,
    GROUP_CONCAT(DISTINCT mk.name) AS markets,
    GROUP_CONCAT(DISTINCT pl.os_name || ' / ' || pl.arch_name) AS platforms,
    GROUP_CONCAT(DISTINCT si.industry_code || '|' || i.name || '|' || i.name_zh) AS industries
  FROM software s
  JOIN analyses a ON a.software_id = s.id
  JOIN provenance p ON p.software_id = s.id
  LEFT JOIN software_categories sc ON sc.software_id = s.id
  LEFT JOIN categories c ON c.id = sc.category_id AND c.external_source = ''
  LEFT JOIN software_translations st
    ON st.software_id = s.id AND st.locale = ? AND st.status = 'published'
  LEFT JOIN software_analysis_translations sat
    ON sat.software_id = s.id AND sat.locale = ? AND sat.status = 'published'
  LEFT JOIN category_translations ct
    ON ct.category_id = c.id AND ct.locale = ? AND ct.status = 'published'
  LEFT JOIN software_tags stg ON stg.software_id = s.id
  LEFT JOIN tags t ON t.id = stg.tag_id
  LEFT JOIN tag_translations tt
    ON tt.tag_id = t.id AND tt.locale = ? AND tt.status = 'published'
  LEFT JOIN software_markets smk ON smk.software_id = s.id
  LEFT JOIN markets mk ON mk.code = smk.market_code
  LEFT JOIN software_platforms spl ON spl.software_id = s.id
  LEFT JOIN platforms pl ON pl.code = spl.platform_code
  LEFT JOIN software_industries si ON si.software_id = s.id
  LEFT JOIN industries i ON i.code = si.industry_code
  WHERE s.status = 'published' AND s.slug = ?
  GROUP BY s.id
`

function parseGroup(value: string | null | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : []
}

function parseLocalizedNameBlob(value: string | null | undefined, locale: Locale): string[] {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((item) => item.split('|'))
    .map(([code, name, nameZh]) => (locale === 'zh' && nameZh ? nameZh : name ?? code))
    .filter(Boolean)
}

function parseIndustries(value: string | null | undefined, locale: Locale): string[] {
  return parseLocalizedNameBlob(value, locale)
}

function toCategories(row: ProductListRow | ProductDetailRow): Array<{ slug: string; name: string }> {
  const slugs = parseGroup(row.category_slugs)
  const names = parseGroup(row.category_names)
  return slugs.map((slug, index) => ({ slug, name: names[index] ?? slug }))
}

function toDeliveryModels(row: ProductListRow): DeliveryModel[] {
  const models: DeliveryModel[] = []
  if (row.supports_server) models.push('server')
  if (row.supports_desktop) models.push('desktop')
  if (row.supports_cli) models.push('cli')
  if (row.supports_saas) models.push('saas')
  return models
}

function mapCard(row: ProductListRow, locale: Locale): ProductCard {
  return {
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
    isFeatured: Boolean(row.is_featured),
    deliveryModels: toDeliveryModels(row),
    hasUi: Boolean(row.has_ui),
    hasAi: Boolean(row.has_ai),
    hasFreeTier: Boolean(row.has_free_tier),
    hasPublicPricing: Boolean(row.has_public_pricing),
    selfServiceSetup: Boolean(row.self_service_setup),
    summary: row.summary,
    categories: toCategories(row),
    tags: parseGroup(row.tags),
    markets: parseGroup(row.markets),
    platforms: parseGroup(row.platforms),
    industries: parseIndustries(row.industries, locale),
  }
}

function mapDetail(row: ProductDetailRow, locale: Locale): ProductDetail {
  return {
    ...mapCard(row, locale),
    features: JSON.parse(row.features),
    useCases: JSON.parse(row.use_cases),
    alternatives: JSON.parse(row.alternatives),
    whyChoose: row.why_choose,
    sourceUrl: row.source_url,
    fetchedAt: row.fetched_at,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
  }
}

type CategoryDbRow = {
  id: number
  slug: string
  parent_id: number | null
  position: number
  external_source: string
  name: string
  description: string
}

type CategoryTree = {
  rows: CategoryDbRow[]
  byId: Map<number, CategoryDbRow>
  children: Map<number, number[]>
  directProducts: Map<number, Set<number>>
}

function loadCategoryTree(db: AppDatabase, locale: Locale): CategoryTree {
  const rows = db
    .prepare(`
      SELECT
        c.id,
        c.slug,
        c.parent_id,
        c.position,
        c.external_source,
        COALESCE(NULLIF(ct.name, ''), c.name_en) AS name,
        COALESCE(NULLIF(ct.description, ''), c.description_en) AS description
      FROM categories c
      LEFT JOIN category_translations ct
        ON ct.category_id = c.id AND ct.locale = ? AND ct.status = 'published'
      ORDER BY c.position ASC, name ASC
    `)
    .all(locale) as CategoryDbRow[]

  const productRows = db
    .prepare(`
      SELECT sc.category_id, sc.software_id
      FROM software_categories sc
      JOIN software s ON s.id = sc.software_id AND s.status = 'published'
    `)
    .all() as Array<{ category_id: number; software_id: number }>

  const byId = new Map(rows.map((row) => [row.id, row]))
  const children = new Map<number, number[]>()
  const directProducts = new Map<number, Set<number>>()

  for (const row of rows) {
    if (row.parent_id !== null) {
      const list = children.get(row.parent_id) ?? []
      list.push(row.id)
      children.set(row.parent_id, list)
    }
  }

  for (const row of productRows) {
    const set = directProducts.get(row.category_id) ?? new Set<number>()
    set.add(row.software_id)
    directProducts.set(row.category_id, set)
  }

  return { rows, byId, children, directProducts }
}

function collectProducts(categoryId: number, tree: CategoryTree, memo: Map<number, Set<number>>): Set<number> {
  const cached = memo.get(categoryId)
  if (cached) {
    return cached
  }

  const result = new Set<number>(tree.directProducts.get(categoryId) ?? [])
  for (const child of tree.children.get(categoryId) ?? []) {
    for (const productId of collectProducts(child, tree, memo)) {
      result.add(productId)
    }
  }
  memo.set(categoryId, result)
  return result
}

function toCategorySummary(row: CategoryDbRow, tree: CategoryTree, memo: Map<number, Set<number>>): CategorySummary {
  const parent = row.parent_id !== null ? tree.byId.get(row.parent_id) : undefined
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    productCount: collectProducts(row.id, tree, memo).size,
    parentSlug: parent?.slug ?? null,
    position: row.position,
  }
}

export function listCategories(db: AppDatabase, locale: Locale): CategorySummary[] {
  const tree = loadCategoryTree(db, locale)
  const memo = new Map<number, Set<number>>()
  return tree.rows
    .filter((row) => row.external_source === '' && row.parent_id !== null)
    .sort((left, right) => {
      const leftParent = left.parent_id !== null ? tree.byId.get(left.parent_id) : undefined
      const rightParent = right.parent_id !== null ? tree.byId.get(right.parent_id) : undefined
      return (
        (leftParent?.position ?? 0) - (rightParent?.position ?? 0) ||
        left.position - right.position ||
        left.name.localeCompare(right.name)
      )
    })
    .map((row) => toCategorySummary(row, tree, memo))
}

export function listAllCategories(db: AppDatabase, locale: Locale): CategorySummary[] {
  const tree = loadCategoryTree(db, locale)
  const memo = new Map<number, Set<number>>()
  return tree.rows.map((row) => toCategorySummary(row, tree, memo))
}

export function listChildCategories(db: AppDatabase, parentSlug: string, locale: Locale): CategorySummary[] {
  const tree = loadCategoryTree(db, locale)
  const parent = tree.rows.find((row) => row.slug === parentSlug)
  if (!parent) {
    return []
  }
  const memo = new Map<number, Set<number>>()
  return (tree.children.get(parent.id) ?? [])
    .map((id) => tree.byId.get(id))
    .filter((row): row is CategoryDbRow => Boolean(row))
    .map((row) => toCategorySummary(row, tree, memo))
    .filter((category) => category.productCount > 0)
}

function getCategoryIdsWithDescendants(db: AppDatabase, slug: string): number[] {
  const rows = db.prepare('SELECT id, slug, parent_id FROM categories').all() as Array<{
    id: number
    slug: string
    parent_id: number | null
  }>
  const root = rows.find((row) => row.slug === slug)
  if (!root) {
    return []
  }

  const children = new Map<number, number[]>()
  for (const row of rows) {
    if (row.parent_id !== null) {
      const list = children.get(row.parent_id) ?? []
      list.push(row.id)
      children.set(row.parent_id, list)
    }
  }

  const result: number[] = []
  const queue = [root.id]
  const seen = new Set<number>()
  while (queue.length > 0) {
    const id = queue.shift() as number
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(id)
    for (const child of children.get(id) ?? []) {
      queue.push(child)
    }
  }
  return result
}

export function listFeaturedProducts(db: AppDatabase, locale: Locale, limit = 6): ProductCard[] {
  const rows = db
    .prepare(`${baseListQuery} AND s.is_featured = 1 ${baseListGroup} ORDER BY s.stars DESC LIMIT ?`)
    .all(locale, locale, locale, limit) as ProductListRow[]
  return rows.map((row) => mapCard(row, locale))
}

export function listRecentProducts(db: AppDatabase, locale: Locale, limit = 8): ProductCard[] {
  const rows = db
    .prepare(`${baseListQuery} ${baseListGroup} ORDER BY s.last_updated_at DESC LIMIT ?`)
    .all(locale, locale, locale, limit) as ProductListRow[]
  return rows.map((row) => mapCard(row, locale))
}

export function listProducts(db: AppDatabase, locale: Locale, filters: SearchFilters = {}): ProductCard[] {
  const conditions: string[] = []
  const params: Array<string | number> = []

  if (filters.q) {
    conditions.push('s.id IN (SELECT software_id FROM search_index WHERE keyword_blob LIKE ?)')
    params.push(`%${filters.q.toLowerCase()}%`)
  }

  if (filters.category) {
    const categoryIds = getCategoryIdsWithDescendants(db, filters.category)
    if (categoryIds.length === 0) {
      conditions.push('1 = 0')
    } else {
      const placeholders = categoryIds.map(() => '?').join(', ')
      conditions.push(
        `s.id IN (SELECT software_id FROM software_categories WHERE category_id IN (${placeholders}))`,
      )
      params.push(...categoryIds)
    }
  }

  if (filters.tag) {
    conditions.push('s.id IN (SELECT st.software_id FROM software_tags st JOIN tags t2 ON t2.id = st.tag_id WHERE t2.slug = ?)')
    params.push(filters.tag)
  }

  if (filters.industry) {
    conditions.push('s.id IN (SELECT software_id FROM software_industries WHERE industry_code = ?)')
    params.push(filters.industry)
  }

  if (filters.delivery) {
    const columns: Record<DeliveryModel, string> = {
      server: 'supports_server',
      desktop: 'supports_desktop',
      cli: 'supports_cli',
      saas: 'supports_saas',
    }
    conditions.push(`s.${columns[filters.delivery]} = 1`)
  }

  if (filters.hasUi !== undefined) {
    conditions.push('s.has_ui = ?')
    params.push(filters.hasUi ? 1 : 0)
  }

  if (filters.hasAi !== undefined) {
    conditions.push('s.has_ai = ?')
    params.push(filters.hasAi ? 1 : 0)
  }

  if (filters.hasFreeTier !== undefined) {
    conditions.push('s.has_free_tier = ?')
    params.push(filters.hasFreeTier ? 1 : 0)
  }

  if (filters.hasPublicPricing !== undefined) {
    conditions.push('s.has_public_pricing = ?')
    params.push(filters.hasPublicPricing ? 1 : 0)
  }

  if (filters.selfServiceSetup !== undefined) {
    conditions.push('s.self_service_setup = ?')
    params.push(filters.selfServiceSetup ? 1 : 0)
  }

  const where = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 24

  const rows = db
    .prepare(`${baseListQuery}${where} ${baseListGroup} ORDER BY s.stars DESC, s.name ASC LIMIT ?`)
    .all(locale, locale, locale, ...params, limit) as ProductListRow[]

  return rows.map((row) => mapCard(row, locale))
}

export function getCategoryBySlug(db: AppDatabase, slug: string, locale: Locale): CategorySummary | null {
  const tree = loadCategoryTree(db, locale)
  const row = tree.rows.find((item) => item.slug === slug)
  if (!row) {
    return null
  }
  return toCategorySummary(row, tree, new Map<number, Set<number>>())
}

export function getProductBySlug(db: AppDatabase, slug: string, locale: Locale): ProductDetail | null {
  const row = db.prepare(detailQuery).get(locale, locale, locale, locale, slug) as ProductDetailRow | undefined
  if (!row) {
    return null
  }
  return mapDetail(row, locale)
}

export function getTagCloud(db: AppDatabase, locale: Locale): TagSummary[] {
  const rows = db.prepare(`
    SELECT
      t.slug,
      COALESCE(NULLIF(tt.name, ''), t.name) AS name,
      COUNT(st.software_id) AS product_count
    FROM tags t
    LEFT JOIN tag_translations tt
      ON tt.tag_id = t.id AND tt.locale = ? AND tt.status = 'published'
    JOIN software_tags st ON st.tag_id = t.id
    JOIN software s ON s.id = st.software_id AND s.status = 'published'
    GROUP BY t.id
    ORDER BY product_count DESC, name ASC
  `).all(locale) as Array<{ slug: string; name: string; product_count: number }>

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    productCount: row.product_count,
  }))
}

export function getStats(db: AppDatabase): { products: number; categories: number; processDomains: number; tags: number } {
  const products = db.prepare("SELECT COUNT(*) AS count FROM software WHERE status = 'published'").get() as { count: number }
  const categories = db
    .prepare("SELECT COUNT(*) AS count FROM categories WHERE external_source = '' AND parent_id IS NOT NULL")
    .get() as { count: number }
  const processDomains = db.prepare('SELECT COUNT(*) AS count FROM process_nodes WHERE level = 1').get() as { count: number }
  const tags = db.prepare('SELECT COUNT(*) AS count FROM tags').get() as { count: number }
  return {
    products: products.count,
    categories: categories.count,
    processDomains: processDomains.count,
    tags: tags.count,
  }
}
