import type { AppDatabase } from '../db/database.js'
import { seedReferenceData, slugify } from '../db/seed.js'
import { importCatalog, type CatalogImportProduct, type CatalogTranslationInput } from './catalog-import.js'

export type ContentfulEntry = {
  sys: {
    id: string
    type: string
    createdAt?: string
    updatedAt?: string
    publishedAt?: string
    firstPublishedAt?: string
    contentType?: { sys?: { id?: string } }
  }
  fields: Record<string, Record<string, unknown>>
}

type ContentfulEntriesResponse = {
  total: number
  skip: number
  limit: number
  items: ContentfulEntry[]
}

export type ContentfulDataset = {
  spaceId: string
  environment: string
  entriesByType: Map<string, ContentfulEntry[]>
  entriesById: Map<string, ContentfulEntry>
}

export type ContentfulImportResult = {
  categories: number
  topLevelCategories: number
  products: number
  published: number
  drafts: number
  created: number
  updated: number
  warnings: string[]
  tagTranslations: number
}

const CONTENT_TYPES = [
  'product',
  'catalog',
  'license',
  'seo',
  'media',
  'delivery',
  'price',
  'language',
  'aboutAppPersonnel',
  'baseFeature',
] as const

const OSI_LICENSE_ALIASES: Record<string, { spdxId: string; name: string; osi: boolean; copyleft: boolean }> = {
  apache2: { spdxId: 'Apache-2.0', name: 'Apache License 2.0', osi: true, copyleft: false },
  MIT: { spdxId: 'MIT', name: 'MIT License', osi: true, copyleft: false },
  'AGPL-3.0': { spdxId: 'AGPL-3.0', name: 'GNU Affero General Public License v3.0', osi: true, copyleft: true },
  'GPL-3.0': { spdxId: 'GPL-3.0', name: 'GNU General Public License v3.0', osi: true, copyleft: true },
  'GPL-2.0': { spdxId: 'GPL-2.0', name: 'GNU General Public License v2.0', osi: true, copyleft: true },
  'MPL-2.0': { spdxId: 'MPL-2.0', name: 'Mozilla Public License 2.0', osi: true, copyleft: true },
  'LGPL-3.0': { spdxId: 'LGPL-3.0', name: 'GNU Lesser General Public License v3.0', osi: true, copyleft: true },
  'LGPL-2.1': { spdxId: 'LGPL-2.1', name: 'GNU Lesser General Public License v2.1', osi: true, copyleft: true },
  bsd3Clause: { spdxId: 'BSD-3-Clause', name: 'BSD 3-Clause License', osi: true, copyleft: false },
  BSD2Clause: { spdxId: 'BSD-2-Clause', name: 'BSD 2-Clause License', osi: true, copyleft: false },
  'OSL-3.0': { spdxId: 'OSL-3.0', name: 'Open Software License 3.0', osi: true, copyleft: true },
  PostgreSQL: { spdxId: 'PostgreSQL', name: 'PostgreSQL License', osi: true, copyleft: false },
  'PHP-3.01': { spdxId: 'PHP-3.01', name: 'PHP License 3.01', osi: true, copyleft: false },
  'EPL-2.0': { spdxId: 'EPL-2.0', name: 'Eclipse Public License 2.0', osi: true, copyleft: true },
  'eclipse-public-license-10': { spdxId: 'EPL-1.0', name: 'Eclipse Public License 1.0', osi: true, copyleft: true },
  Zlib: { spdxId: 'Zlib', name: 'zlib License', osi: true, copyleft: false },
  'MulanPSL-2.0': { spdxId: 'MulanPSL-2.0', name: 'Mulan Permissive Software License v2', osi: true, copyleft: false },
  'SSPL-v1': { spdxId: 'SSPL-1.0', name: 'Server Side Public License v1', osi: false, copyleft: true },
  'elv2-sspl': { spdxId: 'Elastic-2.0 OR SSPL-1.0', name: 'Elastic License 2.0 or SSPL 1.0', osi: false, copyleft: true },
  'business-sl11': { spdxId: 'BUSL-1.1', name: 'Business Source License 1.1', osi: false, copyleft: false },
  'sustainable-use-license-1.0': { spdxId: 'Sustainable-Use-1.0', name: 'Sustainable Use License 1.0', osi: false, copyleft: false },
  redis: { spdxId: 'RSALv2 OR SSPL-1.0', name: 'Redis Source Available License or SSPL', osi: false, copyleft: true },
  'oracle-free': { spdxId: 'Oracle-Free-Use', name: 'Oracle Free Use Terms and Conditions', osi: false, copyleft: false },
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, token: string): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'OpenRun-Contentful-Migration',
        },
        signal: AbortSignal.timeout(30000),
      })
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '0')
        await sleep(Math.max(retryAfter * 1000, 500 * (attempt + 1)))
        continue
      }
      if (!response.ok) {
        throw new Error(`Contentful request failed: ${response.status} ${url}`)
      }
      return response
    } catch (error) {
      lastError = error
      await sleep(500 * (attempt + 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Contentful request failed')
}

export async function fetchContentfulDataset(options: {
  token: string
  spaceId: string
  environment: string
}): Promise<ContentfulDataset> {
  const base = `https://api.contentful.com/spaces/${options.spaceId}/environments/${options.environment}`
  const entriesByType = new Map<string, ContentfulEntry[]>()
  const entriesById = new Map<string, ContentfulEntry>()

  for (const contentType of CONTENT_TYPES) {
    const items: ContentfulEntry[] = []
    let skip = 0
    let total = 0
    do {
      const response = await fetchWithRetry(
        `${base}/entries?content_type=${encodeURIComponent(contentType)}&limit=1000&skip=${skip}`,
        options.token,
      )
      const payload = (await response.json()) as ContentfulEntriesResponse
      total = payload.total
      for (const item of payload.items ?? []) {
        items.push(item)
        entriesById.set(item.sys.id, item)
      }
      skip += payload.items?.length ?? 0
    } while (skip < total)
    entriesByType.set(contentType, items)
  }

  return { spaceId: options.spaceId, environment: options.environment, entriesByType, entriesById }
}

function field(entry: ContentfulEntry, key: string): Record<string, unknown> | undefined {
  return entry.fields[key]
}

function valueFor(fieldValue: Record<string, unknown> | undefined, locale: string): unknown {
  if (!fieldValue) {
    return undefined
  }
  return fieldValue[locale]
}

function stringFor(entry: ContentfulEntry, key: string, locale: string): string {
  const raw = valueFor(field(entry, key), locale)
  return typeof raw === 'string' ? raw.trim() : ''
}

function firstString(entry: ContentfulEntry, key: string, locales: string[]): string {
  for (const locale of locales) {
    const value = stringFor(entry, key, locale)
    if (value) {
      return value
    }
  }
  return ''
}

function stringArrayFor(entry: ContentfulEntry, key: string, locale: string): string[] {
  const raw = valueFor(field(entry, key), locale)
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item): item is string => item !== '')
}

function firstStringArray(entry: ContentfulEntry, key: string, locales: string[]): string[] {
  for (const locale of locales) {
    const values = stringArrayFor(entry, key, locale)
    if (values.length > 0) {
      return values
    }
  }
  return []
}

function linkIds(entry: ContentfulEntry, key: string, locale: string): string[] {
  const raw = valueFor(field(entry, key), locale)
  if (!raw) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => {
        const sys = item.sys as Record<string, unknown> | undefined
        return typeof sys?.id === 'string' ? sys.id : ''
      })
      .filter(Boolean)
  }
  if (typeof raw === 'object') {
    const sys = (raw as Record<string, unknown>).sys as Record<string, unknown> | undefined
    return typeof sys?.id === 'string' ? [sys.id] : []
  }
  return []
}

function firstLinkIds(entry: ContentfulEntry, key: string, locales: string[]): string[] {
  for (const locale of locales) {
    const ids = linkIds(entry, key, locale)
    if (ids.length > 0) {
      return ids
    }
  }
  return []
}

function firstLinkId(entry: ContentfulEntry, key: string, locales: string[]): string | null {
  return firstLinkIds(entry, key, locales)[0] ?? null
}

function isValidUrl(value: string | undefined): value is string {
  if (!value) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function cleanUrl(value: string | undefined): string {
  return isValidUrl(value) ? value : ''
}

function extractBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^([-*•]|\d+\.)\s+/.test(line))
    .map((line) => line.replace(/^([-*•]|\d+\.)\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 8)
}

function textValue(entry: ContentfulEntry | undefined, key: string, locales = ['en-US', 'zh-CN']): string {
  if (!entry) {
    return ''
  }
  return firstString(entry, key, locales)
}

function normalizeLicense(
  db: AppDatabase,
  licenseEntry: ContentfulEntry | undefined,
): { key: string; name: string; osi: boolean } {
  if (!licenseEntry) {
    return { key: 'NOASSERTION', name: 'No license declared', osi: false }
  }

  const rawKey = textValue(licenseEntry, 'key', ['en-US', 'zh-CN'])
  const rawName = textValue(licenseEntry, 'name', ['en-US', 'zh-CN'])
  const alias = OSI_LICENSE_ALIASES[rawKey] ?? OSI_LICENSE_ALIASES[rawName]
  const candidate = alias?.spdxId ?? rawKey ?? rawName

  if (candidate) {
    const row = db
      .prepare('SELECT name, is_osi_approved FROM licenses WHERE spdx_id = ?')
      .get(candidate) as { name: string; is_osi_approved: number } | undefined
    if (row) {
      return { key: candidate, name: row.name, osi: Boolean(row.is_osi_approved) }
    }
  }

  if (alias) {
    return { key: alias.spdxId, name: alias.name, osi: alias.osi }
  }

  return {
    key: rawKey || rawName || 'NOASSERTION',
    name: rawName || rawKey || 'No license declared',
    osi: false,
  }
}

type CatalogImport = {
  entry: ContentfulEntry
  slug: string
  titleEn: string
  titleZh: string
  descriptionEn: string
  descriptionZh: string
  parentExternalId: string | null
  parentExternalIds: string[]
  position: number
}

function buildCatalogMap(dataset: ContentfulDataset): {
  productRoot: ContentfulEntry
  imports: CatalogImport[]
  byExternalId: Map<string, CatalogImport>
} {
  const catalogs = dataset.entriesByType.get('catalog') ?? []
  const byId = new Map(catalogs.map((entry) => [entry.sys.id, entry]))
  const productRoot = catalogs.find((entry) => textValue(entry, 'key') === 'product')
  if (!productRoot) {
    throw new Error('Contentful catalog root "product" was not found')
  }

  const parentIds = new Map<string, string[]>()
  const englishParents = new Map<string, string[]>()
  const chineseParents = new Map<string, string[]>()
  for (const entry of catalogs) {
    const en = linkIds(entry, 'catalog', 'en-US')
    const zh = linkIds(entry, 'catalog', 'zh-CN')
    englishParents.set(entry.sys.id, en)
    chineseParents.set(entry.sys.id, zh)
    parentIds.set(entry.sys.id, [...new Set([...en, ...zh])])
  }

  const underProduct = new Map<string, boolean>()
  const checkUnderProduct = (id: string, stack = new Set<string>()): boolean => {
    const cached = underProduct.get(id)
    if (cached !== undefined) {
      return cached
    }
    if (id === productRoot.sys.id) {
      underProduct.set(id, true)
      return true
    }
    if (stack.has(id)) {
      return false
    }
    stack.add(id)
    const parents = parentIds.get(id) ?? []
    const result = parents.some((parentId) => checkUnderProduct(parentId, stack))
    stack.delete(id)
    underProduct.set(id, result)
    return result
  }

  const imports: CatalogImport[] = []
  const byExternalId = new Map<string, CatalogImport>()
  for (const entry of catalogs) {
    if (entry.sys.id === productRoot.sys.id || !checkUnderProduct(entry.sys.id)) {
      continue
    }

    const enParents = englishParents.get(entry.sys.id) ?? []
    const zhParents = chineseParents.get(entry.sys.id) ?? []
    const productParentsEn = enParents.filter((id) => id !== productRoot.sys.id && checkUnderProduct(id))
    const productParentsZh = zhParents.filter((id) => id !== productRoot.sys.id && checkUnderProduct(id))
    const primaryParent = enParents.includes(productRoot.sys.id)
      ? null
      : productParentsEn[0] ?? (zhParents.includes(productRoot.sys.id) ? null : (productParentsZh[0] ?? null))
    const titleEn = firstString(entry, 'title', ['en-US', 'zh-CN'])
    const titleZh = stringFor(entry, 'title', 'zh-CN') || titleEn
    const item: CatalogImport = {
      entry,
      slug: slugify(textValue(entry, 'key') || titleEn || entry.sys.id),
      titleEn: titleEn || textValue(entry, 'key') || entry.sys.id,
      titleZh,
      descriptionEn: firstString(entry, 'description', ['en-US', 'zh-CN']) || firstString(entry, 'overview', ['en-US', 'zh-CN']),
      descriptionZh: stringFor(entry, 'description', 'zh-CN') || stringFor(entry, 'overview', 'zh-CN'),
      parentExternalId: primaryParent,
      parentExternalIds: [...new Set([...productParentsEn, ...productParentsZh])],
      position: typeof valueFor(field(entry, 'position'), 'en-US') === 'number'
        ? (valueFor(field(entry, 'position'), 'en-US') as number)
        : 0,
    }
    if (!item.slug) {
      continue
    }
    imports.push(item)
    byExternalId.set(entry.sys.id, item)
  }

  imports.sort((left, right) => left.position - right.position || left.titleEn.localeCompare(right.titleEn))
  return { productRoot, imports, byExternalId }
}

function ensureUniqueCategorySlug(db: AppDatabase, desired: string, externalId: string): string {
  let candidate = desired || 'category'
  let suffix = 2
  for (;;) {
    const row = db.prepare('SELECT external_source, external_id FROM categories WHERE slug = ?').get(candidate) as
      | { external_source: string; external_id: string }
      | undefined
    if (!row || (row.external_source === 'contentful' && row.external_id === externalId) || !row.external_id) {
      return candidate
    }
    candidate = `${desired}-${suffix}`
    suffix += 1
  }
}

function upsertCatalogCategories(
  db: AppDatabase,
  catalogMap: ReturnType<typeof buildCatalogMap>,
): Map<string, string> {
  const slugByExternalId = new Map<string, string>()
  const upsertCategory = db.prepare(`
    INSERT INTO categories (slug, name_en, description_en, parent_id, position, external_source, external_id)
    VALUES (@slug, @nameEn, @descriptionEn, NULL, @position, 'contentful', @externalId)
    ON CONFLICT(slug) DO UPDATE SET
      name_en = excluded.name_en,
      description_en = excluded.description_en,
      position = excluded.position,
      external_source = 'contentful',
      external_id = excluded.external_id,
      updated_at = CURRENT_TIMESTAMP
  `)
  const upsertTranslation = db.prepare(`
    INSERT INTO category_translations (category_id, locale, name, description, status)
    VALUES (?, 'zh', ?, ?, 'published')
    ON CONFLICT(category_id, locale) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `)

  db.exec('BEGIN')
  try {
    for (const item of catalogMap.imports) {
      const slug = ensureUniqueCategorySlug(db, item.slug, item.entry.sys.id)
      item.slug = slug
      upsertCategory.run({
        slug,
        nameEn: item.titleEn,
        descriptionEn: item.descriptionEn,
        position: item.position,
        externalId: item.entry.sys.id,
      })
      const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as { id: number }
      upsertTranslation.run(row.id, item.titleZh, item.descriptionZh || item.descriptionEn)
      slugByExternalId.set(item.entry.sys.id, slug)
    }

    const updateParent = db.prepare('UPDATE categories SET parent_id = ? WHERE external_source = ? AND external_id = ?')
    const insertParent = db.prepare(`
      INSERT OR IGNORE INTO category_parents (category_id, parent_id, position) VALUES (?, ?, ?)
    `)
    db.prepare("DELETE FROM category_parents WHERE category_id IN (SELECT id FROM categories WHERE external_source = 'contentful')").run()

    for (const item of catalogMap.imports) {
      const row = db.prepare('SELECT id FROM categories WHERE external_source = ? AND external_id = ?').get(
        'contentful',
        item.entry.sys.id,
      ) as { id: number } | undefined
      if (!row) {
        continue
      }
      const parentId = item.parentExternalId
        ? (db.prepare('SELECT id FROM categories WHERE external_source = ? AND external_id = ?').get(
            'contentful',
            item.parentExternalId,
          ) as { id: number } | undefined)?.id
        : undefined
      updateParent.run(parentId ?? null, 'contentful', item.entry.sys.id)
      for (const parentExternalId of item.parentExternalIds) {
        const parent = db.prepare('SELECT id FROM categories WHERE external_source = ? AND external_id = ?').get(
          'contentful',
          parentExternalId,
        ) as { id: number } | undefined
        if (parent) {
          insertParent.run(row.id, parent.id, item.position)
        }
      }
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return slugByExternalId
}

function buildLanguageResolver(db: AppDatabase): (raw: string) => string {
  const rows = db.prepare('SELECT name, slug, aliases_json FROM languages').all() as Array<{
    name: string
    slug: string
    aliases_json: string
  }>
  const index = new Map<string, string>()
  for (const row of rows) {
    index.set(row.name.toLowerCase(), row.name)
    index.set(row.slug.toLowerCase(), row.name)
    try {
      const aliases = JSON.parse(row.aliases_json) as unknown
      if (Array.isArray(aliases)) {
        for (const alias of aliases) {
          if (typeof alias === 'string' && alias.trim()) {
            index.set(alias.trim().toLowerCase(), row.name)
          }
        }
      }
    } catch {
      // Ignore malformed alias data and keep the canonical name lookup.
    }
  }

  return (raw: string) => {
    const value = raw.trim()
    if (!value) {
      return 'Unknown'
    }
    return index.get(value.toLowerCase()) ?? value
  }
}

function buildProductImport(
  db: AppDatabase,
  dataset: ContentfulDataset,
  product: ContentfulEntry,
  catalogMap: ReturnType<typeof buildCatalogMap>,
  catalogSlugs: Map<string, string>,
  tagTranslations: Map<string, string>,
  normalizeLanguageName: (raw: string) => string,
): { product: CatalogImportProduct; extra: { id: string; logoUrl: string; screenshots: string[]; metadata: string } } | null {
  const key = firstString(product, 'key', ['en-US'])
  if (!key) {
    return null
  }

  const nameEn =
    firstString(product, 'trademark', ['en-US', 'zh-CN']) ||
    firstString(product, 'title', ['en-US', 'zh-CN']) ||
    key
  const nameZh = stringFor(product, 'trademark', 'zh-CN') || stringFor(product, 'title', 'zh-CN')

  const summaryEn =
    firstString(product, 'summary', ['en-US', 'zh-CN']) ||
    firstString(product, 'overview', ['en-US', 'zh-CN']) ||
    firstString(product, 'description', ['en-US', 'zh-CN'])
  const summaryZh =
    stringFor(product, 'summary', 'zh-CN') ||
    stringFor(product, 'overview', 'zh-CN') ||
    stringFor(product, 'description', 'zh-CN')

  const overviewEn = firstString(product, 'overview', ['en-US', 'zh-CN']) || summaryEn
  const overviewZh = stringFor(product, 'overview', 'zh-CN')

  let featuresEn = firstStringArray(product, 'highlights', ['en-US', 'zh-CN'])
  let featuresZh = firstStringArray(product, 'highlights', ['zh-CN'])
  if (featuresEn.length === 0) {
    const componentIds = firstLinkIds(product, 'component', ['en-US', 'zh-CN'])
    for (const id of componentIds) {
      const component = dataset.entriesById.get(id)
      const title = textValue(component, 'title')
      const subtitle = textValue(component, 'subtitle')
      if (title) {
        featuresEn.push(subtitle ? `${title}: ${subtitle}` : title)
      }
    }
  }
  if (featuresEn.length === 0) {
    featuresEn = extractBullets(firstString(product, 'description', ['en-US', 'zh-CN']))
  }
  if (featuresZh.length === 0 && featuresEn.length > 0) {
    featuresZh = stringArrayFor(product, 'highlights', 'zh-CN')
  }

  const userTypeIds = firstLinkIds(product, 'userType', ['en-US', 'zh-CN'])
  const useCasesEn = userTypeIds
    .map((id) => textValue(dataset.entriesById.get(id), 'title', ['en-US', 'zh-CN']))
    .filter(Boolean)
  const useCasesZh = userTypeIds
    .map((id) => textValue(dataset.entriesById.get(id), 'title', ['zh-CN', 'en-US']))
    .filter(Boolean)

  const relatedIds = firstLinkIds(product, 'relatedApps', ['en-US', 'zh-CN'])
  const alternativesEn = relatedIds
    .map((id) => {
      const related = dataset.entriesById.get(id)
      return related
        ? firstString(related, 'trademark', ['en-US', 'zh-CN']) || firstString(related, 'title', ['en-US', 'zh-CN'])
        : ''
    })
    .filter(Boolean)
  const alternativesZh = relatedIds
    .map((id) => {
      const related = dataset.entriesById.get(id)
      return related ? stringFor(related, 'trademark', 'zh-CN') || stringFor(related, 'title', 'zh-CN') : ''
    })
    .filter(Boolean)

  const catalogIds = firstLinkIds(product, 'catalog', ['en-US', 'zh-CN'])
  const categorySlugs = [...new Set(catalogIds.map((id) => catalogSlugs.get(id)).filter((slug): slug is string => Boolean(slug)))]

  const tagNames = new Map<string, { name: string; zh: string }>()
  for (const id of firstLinkIds(product, 'tags', ['en-US', 'zh-CN'])) {
    const tag = dataset.entriesById.get(id)
    if (!tag) {
      continue
    }
    const name = firstString(tag, 'keyword', ['en-US', 'zh-CN']) || firstString(tag, 'name', ['en-US', 'zh-CN'])
    const zh = stringFor(tag, 'name', 'zh-CN') || stringFor(tag, 'keyword', 'zh-CN')
    if (name) {
      const slug = slugify(name)
      if (slug) {
        tagNames.set(slug, { name, zh })
      }
    }
  }
  for (const keyword of firstStringArray(product, 'keywords', ['en-US', 'zh-CN'])) {
    const slug = slugify(keyword)
    if (slug && !tagNames.has(slug)) {
      tagNames.set(slug, { name: keyword, zh: '' })
    }
  }
  for (const [slug, value] of tagNames) {
    if (value.zh) {
      tagTranslations.set(slug, value.zh)
    }
  }

  const licenseId = firstLinkId(product, 'license', ['en-US', 'zh-CN'])
  const license = normalizeLicense(db, licenseId ? dataset.entriesById.get(licenseId) : undefined)

  const deliveryIds = firstLinkIds(product, 'productType', ['en-US', 'zh-CN'])
  const deliveryKeys = deliveryIds
    .map((id) => textValue(dataset.entriesById.get(id), 'key', ['en-US']))
    .filter(Boolean)
  const supportsSaas = deliveryKeys.includes('saas')
  const supportsDesktop = deliveryKeys.includes('desktop')
  const supportsServer = deliveryKeys.length === 0 || deliveryKeys.includes('image') || deliveryKeys.includes('template')

  const planIds = firstLinkIds(product, 'plans', ['en-US', 'zh-CN'])
  const planKeys = planIds
    .map((id) => textValue(dataset.entriesById.get(id), 'key', ['en-US']))
    .filter(Boolean)
  const hasFreeTier = planKeys.includes('free')
  const hasPublicPricing = planIds.length > 0 || firstLinkIds(product, 'priceModel', ['en-US', 'zh-CN']).length > 0

  const topCategorySlugs = new Set<string>()
  for (const slug of categorySlugs) {
    let current = slug
    const seen = new Set<string>()
    while (current && !seen.has(current)) {
      seen.add(current)
      const row = db.prepare('SELECT parent_id FROM categories WHERE slug = ?').get(current) as
        | { parent_id: number | null }
        | undefined
      if (!row || row.parent_id === null) {
        break
      }
      const parent = db.prepare('SELECT slug FROM categories WHERE id = ?').get(row.parent_id) as { slug: string }
      current = parent.slug
    }
    if (current) {
      topCategorySlugs.add(current)
    }
  }
  const hasAi = topCategorySlugs.has('ai') || [...tagNames.keys()].some((slug) => /(^|-)ai($|-)|llm|agent|machine-learning/.test(slug))

  const distribution = valueFor(field(product, 'distribution'), 'en-US')
  let latestRelease = ''
  if (Array.isArray(distribution)) {
    for (const item of distribution) {
      const values = item && typeof item === 'object' ? (item as Record<string, unknown>).value : undefined
      if (Array.isArray(values)) {
        const releases = values.filter((value): value is string => typeof value === 'string' && value !== 'latest')
        if (releases.length > 0) {
          latestRelease = releases[0]
          break
        }
      }
    }
  }

  const vcpu = Number(valueFor(field(product, 'vcpu'), 'en-US') ?? 0)
  const memory = Number(valueFor(field(product, 'memory'), 'en-US') ?? 0)
  const deploymentDifficulty =
    vcpu === 0 && memory === 0
      ? 'moderate'
      : vcpu >= 8 || memory >= 16
        ? 'advanced'
        : vcpu > 2 || memory > 4
          ? 'moderate'
          : 'easy'

  const websiteUrl = cleanUrl(firstString(product, 'websiteurl', ['en-US', 'zh-CN']))
  const githubUrl = cleanUrl(firstString(product, 'githubUrl', ['en-US', 'zh-CN']))
  const homepage = websiteUrl || githubUrl || 'https://www.websoft9.com'
  const repository = githubUrl || websiteUrl || homepage

  const screenshots = new Set<string>()
  for (const locale of ['en-US', 'zh-CN']) {
    const raw = valueFor(field(product, 'screenshots'), locale)
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' && isValidUrl(item)) {
          screenshots.add(item)
        } else if (item && typeof item === 'object' && isValidUrl((item as Record<string, unknown>).value as string)) {
          screenshots.add((item as Record<string, unknown>).value as string)
        }
      }
    }
  }

  const logoId = firstLinkId(product, 'logo', ['en-US', 'zh-CN'])
  const logoUrl = cleanUrl(logoId ? textValue(dataset.entriesById.get(logoId), 'imageurl', ['en-US']) : '')

  const production = valueFor(field(product, 'production'), 'en-US') === true
  const canPublish = production && license.osi && categorySlugs.length > 0 && Boolean(summaryEn)
  const status = canPublish ? 'published' : 'draft'

  const translations: Record<string, CatalogTranslationInput> = {}
  if (nameZh || summaryZh || featuresZh.length || useCasesZh.length || alternativesZh.length || overviewZh) {
    translations.zh = {
      name: nameZh || nameEn,
      summary: summaryZh || summaryEn,
      features: featuresZh.length ? featuresZh : featuresEn,
      useCases: useCasesZh.length ? useCasesZh : useCasesEn,
      alternatives: alternativesZh.length ? alternativesZh : alternativesEn,
      whyChoose: overviewZh || overviewEn,
      status,
    }
  }

  const metadata = {
    contentful: {
      spaceId: dataset.spaceId,
      environment: dataset.environment,
      id: product.sys.id,
      createdAt: product.sys.createdAt ?? '',
      updatedAt: product.sys.updatedAt ?? '',
      publishedAt: product.sys.publishedAt ?? '',
    },
    marketingTitle: {
      en: firstString(product, 'title', ['en-US', 'zh-CN']),
      zh: stringFor(product, 'title', 'zh-CN'),
    },
    trademark: {
      en: firstString(product, 'trademark', ['en-US', 'zh-CN']),
      zh: stringFor(product, 'trademark', 'zh-CN'),
    },
    os: firstStringArray(product, 'os', ['en-US']),
    supportLanguage: firstStringArray(product, 'supportLanguage', ['en-US']),
    keywords: firstStringArray(product, 'keywords', ['en-US', 'zh-CN']),
    hot: valueFor(field(product, 'hot'), 'en-US') ?? null,
    review: valueFor(field(product, 'review'), 'en-US') ?? null,
    distribution: valueFor(field(product, 'distribution'), 'en-US') ?? null,
    delivery: deliveryKeys,
    priceModel: firstLinkIds(product, 'priceModel', ['en-US', 'zh-CN']).map((id) => textValue(dataset.entriesById.get(id), 'key')),
    plans: planKeys,
    production,
    appStore: valueFor(field(product, 'appStore'), 'en-US') === true,
    vcpu: vcpu || null,
    memory: memory || null,
    storage: Number(valueFor(field(product, 'storage'), 'en-US') ?? 0) || null,
    logoUrl,
    screenshots: [...screenshots],
  }

  const importedProduct: CatalogImportProduct = {
    slug: slugify(key) || key,
    name: nameEn,
    homepage,
    repository,
    license: license.key,
    primaryLanguage: normalizeLanguageName(
      (() => {
        const programId = firstLinkId(product, 'program', ['en-US', 'zh-CN'])
        return textValue(
          programId ? dataset.entriesById.get(programId) : undefined,
          'name',
          ['en-US', 'zh-CN'],
        )
      })(),
    ),
    stars: 0,
    monthlyViews: Number(valueFor(field(product, 'hot'), 'en-US') ?? 0),
    lastUpdatedAt: product.sys.updatedAt ?? new Date().toISOString(),
    latestRelease,
    deploymentDifficulty,
    status,
    isFeatured: valueFor(field(product, 'featured'), 'en-US') === true,
    supportsServer,
    supportsDesktop,
    supportsCli: false,
    supportsSaas,
    hasUi: true,
    hasAi,
    hasFreeTier,
    hasPublicPricing,
    selfServiceSetup: valueFor(field(product, 'appStore'), 'en-US') === true,
    categories: categorySlugs,
    tags: [...tagNames.values()].map((value) => value.name),
    summaryEn,
    featuresEn,
    useCasesEn,
    alternativesEn,
    whyChooseEn: overviewEn,
    translations,
    sourceUrl: githubUrl || websiteUrl || `https://app.contentful.com/spaces/${dataset.spaceId}/environments/${dataset.environment}/entries/${product.sys.id}`,
    fetchedAt: new Date().toISOString(),
    reviewedAt: production ? (product.sys.publishedAt ?? '') : '',
    publishedAt: status === 'published' ? (product.sys.publishedAt ?? new Date().toISOString()) : '',
  }

  return {
    product: importedProduct,
    extra: {
      id: product.sys.id,
      logoUrl,
      screenshots: [...screenshots],
      metadata: JSON.stringify(metadata),
    },
  }
}

export function importContentfulDataset(
  db: AppDatabase,
  dataset: ContentfulDataset,
): ContentfulImportResult {
  seedReferenceData(db)

  const catalogMap = buildCatalogMap(dataset)
  const catalogSlugs = upsertCatalogCategories(db, catalogMap)
  const normalizeLanguageName = buildLanguageResolver(db)
  const topLevelCategories = catalogMap.imports.filter((item) => item.parentExternalId === null).length

  const tagTranslations = new Map<string, string>()
  const products: CatalogImportProduct[] = []
  const warnings: string[] = []
  const extraBySlug = new Map<string, { id: string; logoUrl: string; screenshots: string[]; metadata: string }>()

  for (const product of dataset.entriesByType.get('product') ?? []) {
    const built = buildProductImport(
      db,
      dataset,
      product,
      catalogMap,
      catalogSlugs,
      tagTranslations,
      normalizeLanguageName,
    )
    if (!built) {
      warnings.push(`Skipped Contentful product ${product.sys.id}: missing key`)
      continue
    }
    products.push(built.product)
    extraBySlug.set(built.product.slug ?? product.sys.id, built.extra)
  }

  const importResult = importCatalog(db, products, { dedupeByRepository: false })

  const updateSoftware = db.prepare(`
    UPDATE software SET
      external_source = 'contentful',
      external_id = ?,
      logo_url = ?,
      screenshots_json = ?,
      metadata_json = ?
    WHERE slug = ?
  `)

  db.exec('BEGIN')
  try {
    for (const [slug, extra] of extraBySlug) {
      updateSoftware.run(extra.id, extra.logoUrl, JSON.stringify(extra.screenshots), extra.metadata, slug)
    }
    const upsertTagTranslation = db.prepare(`
      INSERT INTO tag_translations (tag_id, locale, name, status)
      VALUES (?, 'zh', ?, 'published')
      ON CONFLICT(tag_id, locale) DO UPDATE SET
        name = excluded.name,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `)
    for (const [slug, name] of tagTranslations) {
      const row = db.prepare('SELECT id FROM tags WHERE slug = ?').get(slug) as { id: number } | undefined
      if (row) {
        upsertTagTranslation.run(row.id, name)
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  const published = db
    .prepare("SELECT COUNT(*) AS count FROM software WHERE external_source = 'contentful' AND status = 'published'")
    .get() as { count: number }
  const externalCount = db
    .prepare("SELECT COUNT(*) AS count FROM software WHERE external_source = 'contentful'")
    .get() as { count: number }

  return {
    categories: catalogMap.imports.length,
    topLevelCategories,
    products: externalCount.count,
    published: published.count,
    drafts: externalCount.count - published.count,
    created: importResult.created,
    updated: importResult.updated,
    warnings: [...warnings, ...importResult.warnings],
    tagTranslations: tagTranslations.size,
  }
}
