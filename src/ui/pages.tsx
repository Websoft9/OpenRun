import type { FC } from 'hono/jsx'
import { formatCompactNumber, formatDate, t, type MessageKey } from '../i18n/index.js'
import type { CategorySummary, DeliveryModel, Locale, ProductCard, ProductDetail, TagSummary } from '../repositories/catalog.js'
import type { ProcessSummary } from '../repositories/processes.js'
import type { Theme } from './layout.js'

const difficultyKeys: Record<ProductCard['deploymentDifficulty'], MessageKey> = {
  easy: 'difficulty.easy',
  moderate: 'difficulty.moderate',
  advanced: 'difficulty.advanced',
}

const deliveryKeys: Record<DeliveryModel, MessageKey> = {
  server: 'delivery.server',
  desktop: 'delivery.desktop',
  cli: 'delivery.cli',
  saas: 'delivery.saas',
}

type SearchState = {
  query?: string
  category?: string
  tag?: string
  delivery?: DeliveryModel
  hasUi?: boolean
  hasAi?: boolean
  hasFreeTier?: boolean
  hasPublicPricing?: boolean
  selfServiceSetup?: boolean
}

function withTheme(path: string, theme: Theme): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}theme=${theme}`
}

function searchHref(locale: Locale, theme: Theme, state: SearchState): string {
  const params = new URLSearchParams()
  params.set('theme', theme)
  if (state.query) {
    params.set('q', state.query)
  }
  if (state.category) {
    params.set('category', state.category)
  }
  if (state.tag) {
    params.set('tag', state.tag)
  }
  if (state.delivery) {
    params.set('delivery', state.delivery)
  }
  if (state.hasUi !== undefined) {
    params.set('ui', state.hasUi ? '1' : '0')
  }
  if (state.hasAi) {
    params.set('ai', '1')
  }
  if (state.hasFreeTier) {
    params.set('free', '1')
  }
  if (state.hasPublicPricing) {
    params.set('pricing', '1')
  }
  if (state.selfServiceSetup) {
    params.set('self_service', '1')
  }
  return `/${locale}/search?${params.toString()}`
}

export const CatalogFilterBar: FC<{
  locale: Locale
  theme: Theme
  actionPath: string
  clearPath: string
  selectedDelivery?: DeliveryModel
  selectedUi?: boolean
  resultCount: number
}> = ({ locale, theme, actionPath, clearPath, selectedDelivery, selectedUi, resultCount }) => (
  <form class="catalog-filter-bar" method="get" action={actionPath}>
    <input type="hidden" name="theme" value={theme} />
    <div class="catalog-filter-head">
      <strong>{t(locale, 'catalog.filterTitle')}</strong>
      <span>{t(locale, 'catalog.showing', { count: resultCount })}</span>
    </div>
    <div class="catalog-filter-fields">
      <label>
        <span>{t(locale, 'search.deliveryLabel')}</span>
        <select name="delivery">
          <option value="">{t(locale, 'search.deliveryAny')}</option>
          {(['server', 'desktop', 'cli', 'saas'] as DeliveryModel[]).map((model) => (
            <option value={model} selected={selectedDelivery === model}>{t(locale, deliveryKeys[model])}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{t(locale, 'search.interfaceLabel')}</span>
        <select name="ui">
          <option value="">{t(locale, 'search.uiAny')}</option>
          <option value="1" selected={selectedUi === true}>{t(locale, 'search.uiYes')}</option>
          <option value="0" selected={selectedUi === false}>{t(locale, 'search.uiNo')}</option>
        </select>
      </label>
      <div class="catalog-filter-actions">
        <button type="submit">{t(locale, 'search.apply')}</button>
        <a class="ghost-button" href={clearPath}>{t(locale, 'catalog.clear')}</a>
      </div>
    </div>
  </form>
)

function productInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function avatarTone(seed: string): string {
  let hash = 0
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360
  }
  const hue = hash % 360
  return `linear-gradient(135deg, hsl(${hue} 78% 58%), hsl(${(hue + 42) % 360} 82% 66%))`
}

export const ProductGrid: FC<{ locale: Locale; products: ProductCard[]; theme: Theme }> = ({ locale, products, theme }) => (
  <div class="product-grid">
    {products.map((product) => (
      <article class="product-card">
        <div class="product-card-top">
          <div class="product-avatar" style={{ background: avatarTone(product.slug) }}>
            {productInitials(product.name)}
          </div>
          <div class="product-card-heading">
            <div class="eyebrow-row">
              {product.categories.map((category) => (
                <a class="eyebrow" href={withTheme(`/${locale}/categories/${category.slug}`, theme)}>{category.name}</a>
              ))}
            </div>
            <h3>
              <a href={withTheme(`/${locale}/software/${product.slug}`, theme)}>{product.name}</a>
            </h3>
          </div>
          {product.isFeatured ? <span class="pill accent">{t(locale, 'common.featured')}</span> : null}
        </div>
        <p>{product.summary}</p>
        <div class="requirement-row">
          {product.deliveryModels.map((model) => (
            <span class="requirement-badge">{t(locale, deliveryKeys[model])}</span>
          ))}
          <span class={`requirement-badge ${product.hasUi ? '' : 'muted'}`}>
            {t(locale, product.hasUi ? 'attribute.ui' : 'attribute.noUi')}
          </span>
          {product.hasAi ? <span class="requirement-badge">{t(locale, 'attribute.ai')}</span> : null}
          {product.hasFreeTier ? <span class="requirement-badge">{t(locale, 'attribute.freeTier')}</span> : null}
          {product.hasPublicPricing ? <span class="requirement-badge">{t(locale, 'attribute.publicPricing')}</span> : null}
          {product.selfServiceSetup ? <span class="requirement-badge">{t(locale, 'attribute.selfService')}</span> : null}
        </div>
        <div class="meta-grid">
          <span>{t(locale, 'common.stars', { count: formatCompactNumber(product.stars, locale) })}</span>
          <span>{product.primaryLanguage}</span>
          <span>{product.license}</span>
          <span>{t(locale, difficultyKeys[product.deploymentDifficulty])}</span>
        </div>
        <div class="product-card-footer">
          <div class="tag-row">
            {product.tags.slice(0, 3).map((tag) => (
              <span class="pill">{tag}</span>
            ))}
          </div>
          <a class="card-link" href={withTheme(`/${locale}/software/${product.slug}`, theme)}>
            {t(locale, 'common.viewDetails')}
          </a>
        </div>
      </article>
    ))}
  </div>
)

export const HomePage: FC<{
  locale: Locale
  stats: { products: number; categories: number; processDomains: number; tags: number }
  categories: CategorySummary[]
  processDomains: ProcessSummary[]
  featuredProducts: ProductCard[]
  recentProducts: ProductCard[]
  theme: Theme
}> = ({ locale, stats, categories, processDomains, featuredProducts, recentProducts, theme }) => {
  const tr = (key: MessageKey, params?: Record<string, string | number>) => t(locale, key, params)
  const statValues = [stats.products, stats.processDomains, stats.categories]
  const statLabels = [
    tr('home.stat.products'),
    tr('home.stat.processDomains'),
    tr('home.stat.categories'),
  ]
  const signals = [
    ['home.signal.technology.title', 'home.signal.technology.description'],
    ['home.signal.useCase.title', 'home.signal.useCase.description'],
    ['home.signal.sources.title', 'home.signal.sources.description'],
  ] satisfies Array<[MessageKey, MessageKey]>

  return (
    <>
      <section class="hero">
        <div class="hero-copy">
          <p class="kicker">{tr('home.kicker')}</p>
          <h1>{tr('home.heroTitle')}</h1>
          <p class="hero-description">{tr('home.heroDescription')}</p>
          <form class="search-inline" method="get" action={`/${locale}/search`}>
            <input type="hidden" name="theme" value={theme} />
            <input type="search" name="q" placeholder={tr('home.searchPlaceholder')} />
            <button type="submit">{tr('home.searchButton')}</button>
          </form>
          <div class="hero-chip-row">
            <span class="hero-chip">{tr('home.chip.postgresql')}</span>
            <span class="hero-chip">{tr('home.chip.monitoring')}</span>
            <span class="hero-chip">{tr('home.chip.wiki')}</span>
            <span class="hero-chip">{tr('home.chip.cicd')}</span>
            <span class="hero-chip">{tr('home.chip.selfHosted')}</span>
          </div>
        </div>
        <div class="hero-side">
          <div class="hero-side-card hero-side-card-primary">
            <span class="hero-side-label">{tr('home.overview')}</span>
            <div class="stat-panel">
              {statLabels.map((label, index) => (
                <div class="stat-card">
                  <strong>{statValues[index]}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div class="hero-side-card">
            <span class="hero-side-label">{tr('home.includedSignals')}</span>
            <ul class="hero-list">
              <li>{tr('home.signal.bilingual')}</li>
              <li>{tr('home.signal.filters')}</li>
              <li>{tr('home.signal.traceable')}</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="trust-strip">
        <p>{tr('home.trusted')}</p>
        <div class="trust-row">
          <span>{tr('home.trust.platform')}</span>
          <span>{tr('home.trust.devops')}</span>
          <span>{tr('home.trust.engineeringOps')}</span>
          <span>{tr('home.trust.founders')}</span>
          <span>{tr('home.trust.itManagers')}</span>
          <span>{tr('home.trust.architects')}</span>
        </div>
      </section>

      <section class="section-head">
        <h2>{tr('home.processes')}</h2>
        <a href={withTheme(`/${locale}/processes`, theme)}>{tr('home.viewAll')}</a>
      </section>
      <section class="category-grid">
        {processDomains.map((process) => (
          <a class="category-card" href={withTheme(`/${locale}/processes/${process.code}`, theme)}>
            <div class="category-card-top">
              <span class="category-count">{process.code}</span>
              <span class="category-arrow">↗</span>
            </div>
            <h3>{process.name}</h3>
            <p>{process.childCount} {tr('processes.childUnit')}</p>
          </a>
        ))}
      </section>

      <section class="section-head">
        <h2>{tr('home.categories')}</h2>
        <a href={withTheme(`/${locale}/categories`, theme)}>{tr('home.viewAll')}</a>
      </section>
      <section class="category-grid">
        {categories.map((category) => (
          <a class="category-card" href={withTheme(`/${locale}/categories/${category.slug}`, theme)}>
            <div class="category-card-top">
              <span class="category-count">{category.productCount}</span>
              <span class="category-arrow">↗</span>
            </div>
            <h3>{category.name}</h3>
            <p>{category.description}</p>
          </a>
        ))}
      </section>

      <section class="signals-grid-wrap">
        <div class="section-head compact">
          <h2>{tr('home.signalTitle')}</h2>
        </div>
        <div class="signals-grid">
          {signals.map(([titleKey, descriptionKey], index) => (
            <article class="signal-card">
              <span class="signal-card-step">0{index + 1}</span>
              <h3>{tr(titleKey)}</h3>
              <p>{tr(descriptionKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section class="section-head">
        <h2>{tr('home.featured')}</h2>
      </section>
      <ProductGrid locale={locale} products={featuredProducts} theme={theme} />

      <section class="section-head">
        <h2>{tr('home.recent')}</h2>
      </section>
      <ProductGrid locale={locale} products={recentProducts} theme={theme} />
    </>
  )
}

export const CategoriesPage: FC<{ locale: Locale; categories: CategorySummary[]; theme: Theme }> = ({ locale, categories, theme }) => (
  <section>
    <div class="page-intro page-intro-grid">
      <div>
        <p class="kicker">{t(locale, 'categories.kicker')}</p>
        <h1>{t(locale, 'categories.title')}</h1>
        <p>{t(locale, 'categories.intro')}</p>
      </div>
      <div class="page-intro-note">
        <strong>{categories.length}</strong>
        <span>{t(locale, 'categories.note')}</span>
      </div>
    </div>
    <div class="category-grid">
      {categories.map((category) => (
        <a class="category-card" href={withTheme(`/${locale}/categories/${category.slug}`, theme)}>
          <div class="category-card-top">
            <span class="category-count">{category.productCount}</span>
            <span class="category-arrow">↗</span>
          </div>
          <h3>{category.name}</h3>
          <p>{category.description}</p>
        </a>
      ))}
    </div>
  </section>
)

export const CategoryDetailPage: FC<{
  locale: Locale
  category: CategorySummary
  children?: CategorySummary[]
  products: ProductCard[]
  selectedDelivery?: DeliveryModel
  selectedUi?: boolean
  theme: Theme
}> = ({ locale, category, children, products, selectedDelivery, selectedUi, theme }) => (
  <section>
    <div class="page-intro page-intro-grid">
      <div>
        <p class="kicker">{t(locale, 'category.kicker')}</p>
        <h1>{category.name}</h1>
        <p>{category.description}</p>
      </div>
      <div class="page-intro-note">
        <strong>{products.length}</strong>
        <span>{t(locale, 'category.unit')}</span>
      </div>
    </div>
    {children && children.length > 0 ? (
      <div class="subcategory-strip">
        <span class="subcategory-label">{t(locale, 'category.subcategories')}</span>
        <div class="filter-tag-list">
          {children.map((child) => (
            <a class="filter-tag" href={withTheme(`/${locale}/categories/${child.slug}`, theme)}>
              <span>{child.name}</span>
              <small>{child.productCount}</small>
            </a>
          ))}
        </div>
      </div>
    ) : null}
    <CatalogFilterBar
      locale={locale}
      theme={theme}
      actionPath={`/${locale}/categories/${category.slug}`}
      clearPath={withTheme(`/${locale}/categories/${category.slug}`, theme)}
      selectedDelivery={selectedDelivery}
      selectedUi={selectedUi}
      resultCount={products.length}
    />
    <ProductGrid locale={locale} products={products} theme={theme} />
  </section>
)

export const SearchPage: FC<{
  locale: Locale
  categories: CategorySummary[]
  tags: TagSummary[]
  selectedCategory?: string
  selectedTag?: string
  query?: string
  selectedDelivery?: DeliveryModel
  selectedUi?: boolean
  selectedAi?: boolean
  selectedFreeTier?: boolean
  selectedPublicPricing?: boolean
  selectedSelfService?: boolean
  products: ProductCard[]
  theme: Theme
}> = ({
  locale,
  categories,
  tags,
  selectedCategory,
  selectedTag,
  query,
  selectedDelivery,
  selectedUi,
  selectedAi,
  selectedFreeTier,
  selectedPublicPricing,
  selectedSelfService,
  products,
  theme,
}) => {
  const tr = (key: MessageKey, params?: Record<string, string | number>) => t(locale, key, params)
  const searchState: SearchState = {
    query,
    category: selectedCategory,
    delivery: selectedDelivery,
    hasUi: selectedUi,
    hasAi: selectedAi,
    hasFreeTier: selectedFreeTier,
    hasPublicPricing: selectedPublicPricing,
    selfServiceSetup: selectedSelfService,
  }

  return (
    <section>
      <div class="page-intro search-intro">
        <div>
          <p class="kicker">{tr('search.kicker')}</p>
          <h1>{tr('search.title')}</h1>
          <p>{tr('search.intro')}</p>
        </div>
      </div>
      <div class="search-layout">
        <aside class="search-sidebar">
          <form class="search-panel search-panel-vertical" method="get" action={`/${locale}/search`}>
            <input type="hidden" name="theme" value={theme} />
            {selectedTag ? <input type="hidden" name="tag" value={selectedTag} /> : null}
            <label>
              <span>{tr('search.keywordLabel')}</span>
              <input type="search" name="q" value={query ?? ''} />
            </label>
            <label>
              <span>{tr('search.categoryLabel')}</span>
              <select name="category">
                <option value="">{tr('search.allCategories')}</option>
                {categories.map((category) => (
                  <option value={category.slug} selected={selectedCategory === category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{tr('search.deliveryLabel')}</span>
              <select name="delivery">
                <option value="">{tr('search.deliveryAny')}</option>
                {(['server', 'desktop', 'cli', 'saas'] as DeliveryModel[]).map((model) => (
                  <option value={model} selected={selectedDelivery === model}>{tr(deliveryKeys[model])}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{tr('search.interfaceLabel')}</span>
              <select name="ui">
                <option value="">{tr('search.uiAny')}</option>
                <option value="1" selected={selectedUi === true}>{tr('search.uiYes')}</option>
                <option value="0" selected={selectedUi === false}>{tr('search.uiNo')}</option>
              </select>
            </label>
            <div class="filter-checkboxes">
              <label class="checkbox-row">
                <input type="checkbox" name="ai" value="1" checked={selectedAi === true} />
                <span>{tr('search.ai')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="free" value="1" checked={selectedFreeTier === true} />
                <span>{tr('search.freeTier')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="pricing" value="1" checked={selectedPublicPricing === true} />
                <span>{tr('search.publicPricing')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="self_service" value="1" checked={selectedSelfService === true} />
                <span>{tr('search.selfService')}</span>
              </label>
            </div>
            <button type="submit">{tr('search.apply')}</button>
          </form>

          <div class="filter-card">
            <div class="filter-card-head">
              <h3>{tr('search.popularTags')}</h3>
            </div>
            <div class="filter-tag-list">
              <a class={`filter-tag ${!selectedTag ? 'active' : ''}`} href={searchHref(locale, theme, searchState)}>
                {tr('search.allTags')}
              </a>
              {tags.slice(0, 12).map((tag) => (
                <a
                  class={`filter-tag ${selectedTag === tag.slug ? 'active' : ''}`}
                  href={searchHref(locale, theme, { ...searchState, tag: tag.slug })}
                >
                  <span>{tag.name}</span>
                  <small>{tag.productCount}</small>
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div class="search-results">
          <div class="results-head">
            <strong>{products.length}</strong>
            <span>{tr('search.resultsLabel')}</span>
          </div>
          {products.length === 0 ? <p class="empty-state">{tr('search.empty')}</p> : <ProductGrid locale={locale} products={products} theme={theme} />}
        </div>
      </div>
    </section>
  )
}

export const AboutPage: FC<{
  locale: Locale
  stats: { products: number; categories: number; processDomains: number; tags: number }
  theme: Theme
}> = ({ locale, stats, theme }) => {
  const principles: MessageKey[] = [
    'about.principle.open',
    'about.principle.facts',
    'about.principle.bilingual',
    'about.principle.traceable',
  ]
  const statItems = [
    [stats.products, 'home.stat.products'],
    [stats.processDomains, 'home.stat.processDomains'],
    [stats.categories, 'home.stat.categories'],
  ] satisfies Array<[number, MessageKey]>

  return (
    <section class="about-page">
      <div class="about-hero">
        <div>
          <p class="kicker">{t(locale, 'about.kicker')}</p>
          <h1>{t(locale, 'about.title')}</h1>
          <p class="lead">{t(locale, 'about.intro')}</p>
        </div>
        <div class="about-stat-panel">
          {statItems.map(([value, labelKey]) => (
            <div class="about-stat">
              <strong>{value}</strong>
              <span>{t(locale, labelKey)}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="about-grid">
        <article class="about-card about-card-wide">
          <h2>{t(locale, 'about.missionTitle')}</h2>
          <p>{t(locale, 'about.missionBody')}</p>
        </article>

        <article class="about-card">
          <h2>{t(locale, 'about.principlesTitle')}</h2>
          <ul class="about-principle-list">
            {principles.map((key, index) => (
              <li>
                <span class="about-principle-index">0{index + 1}</span>
                <p>{t(locale, key)}</p>
              </li>
            ))}
          </ul>
        </article>

        <article class="about-card about-card-cta">
          <h2>{t(locale, 'about.ctaTitle')}</h2>
          <p>{t(locale, 'about.ctaBody')}</p>
          <div class="about-actions">
            <a class="footer-button" href={withTheme(`/${locale}/search`, theme)}>{t(locale, 'about.browse')}</a>
            <a class="ghost-button" href={withTheme(`/${locale}/submit`, theme)}>{t(locale, 'about.submit')}</a>
          </div>
        </article>
      </div>
    </section>
  )
}

export const DetailPage: FC<{ locale: Locale; product: ProductDetail; theme: Theme }> = ({ locale, product, theme }) => (
  <section>
    <div class="detail-hero">
      <div class="detail-hero-main">
        <div class="detail-product-lockup">
          <div class="detail-avatar" style={{ background: avatarTone(product.slug) }}>
            {productInitials(product.name)}
          </div>
          <div>
        <div class="eyebrow-row">
          {product.categories.map((category) => (
            <a class="eyebrow" href={withTheme(`/${locale}/categories/${category.slug}`, theme)}>{category.name}</a>
          ))}
        </div>
        <h1>{product.name}</h1>
        <p class="lead">{product.summary}</p>
          </div>
        </div>
        <div class="detail-badges">
          <span class="pill accent">{t(locale, difficultyKeys[product.deploymentDifficulty])}</span>
          <span class="pill">{product.primaryLanguage}</span>
          <span class="pill">{product.license}</span>
          <span class="pill">{product.latestRelease}</span>
        </div>
      </div>
      <div class="detail-hero-side">
        <div class="metric-tile">
          <strong>{formatCompactNumber(product.stars, locale)}</strong>
          <span>{t(locale, 'detail.githubStars')}</span>
        </div>
        <div class="metric-tile">
          <strong>{formatDate(product.lastUpdatedAt, locale)}</strong>
          <span>{t(locale, 'detail.lastUpdated')}</span>
        </div>
      </div>
    </div>

    <div class="detail-layout">
    <div class="detail-main">
      <div class="content-block">
        <h2>{t(locale, 'detail.keyFeatures')}</h2>
        <ul>
          {product.features.map((feature) => (
            <li>{feature}</li>
          ))}
        </ul>
      </div>

      <div class="content-block">
        <h2>{t(locale, 'detail.useCases')}</h2>
        <ul>
          {product.useCases.map((useCase) => (
            <li>{useCase}</li>
          ))}
        </ul>
      </div>

      <div class="content-block">
        <h2>{t(locale, 'detail.whyChoose')}</h2>
        <p>{product.whyChoose}</p>
      </div>

      <div class="content-block">
        <h2>{t(locale, 'detail.alternatives')}</h2>
        <div class="tag-row">
          {product.alternatives.map((item) => (
            <span class="pill">{item}</span>
          ))}
        </div>
      </div>
    </div>

    <aside class="detail-sidebar">
      <div class="info-card">
        <h3>{t(locale, 'detail.projectFacts')}</h3>
        <dl>
          <div><dt>{t(locale, 'detail.stars')}</dt><dd>{formatCompactNumber(product.stars, locale)}</dd></div>
          <div><dt>{t(locale, 'detail.language')}</dt><dd>{product.primaryLanguage}</dd></div>
          <div><dt>{t(locale, 'detail.license')}</dt><dd>{product.license}</dd></div>
          <div><dt>{t(locale, 'detail.deployment')}</dt><dd>{t(locale, difficultyKeys[product.deploymentDifficulty])}</dd></div>
          <div><dt>{t(locale, 'detail.markets')}</dt><dd>{product.markets.join(', ') || '—'}</dd></div>
          <div><dt>{t(locale, 'detail.platforms')}</dt><dd>{product.platforms.join(', ') || '—'}</dd></div>
          <div><dt>{t(locale, 'detail.industries')}</dt><dd>{product.industries.join(', ') || '—'}</dd></div>
          <div><dt>{t(locale, 'detail.release')}</dt><dd>{product.latestRelease}</dd></div>
          <div><dt>{t(locale, 'detail.updated')}</dt><dd>{formatDate(product.lastUpdatedAt, locale)}</dd></div>
        </dl>
      </div>
      <div class="info-card">
        <h3>{t(locale, 'detail.requirements')}</h3>
        <dl>
          <div>
            <dt>{t(locale, 'search.deliveryLabel')}</dt>
            <dd>{product.deliveryModels.map((model) => t(locale, deliveryKeys[model])).join(', ') || '—'}</dd>
          </div>
          <div><dt>{t(locale, 'search.interfaceLabel')}</dt><dd>{t(locale, product.hasUi ? 'common.yes' : 'common.no')}</dd></div>
          <div><dt>{t(locale, 'attribute.ai')}</dt><dd>{t(locale, product.hasAi ? 'common.yes' : 'common.no')}</dd></div>
          <div><dt>{t(locale, 'attribute.freeTier')}</dt><dd>{t(locale, product.hasFreeTier ? 'common.yes' : 'common.no')}</dd></div>
          <div><dt>{t(locale, 'attribute.publicPricing')}</dt><dd>{t(locale, product.hasPublicPricing ? 'common.yes' : 'common.no')}</dd></div>
          <div><dt>{t(locale, 'attribute.selfService')}</dt><dd>{t(locale, product.selfServiceSetup ? 'common.yes' : 'common.no')}</dd></div>
        </dl>
      </div>
      <div class="info-card">
        <h3>{t(locale, 'detail.linksAndSources')}</h3>
        <p><a href={product.homepage}>{t(locale, 'detail.homepage')}</a></p>
        <p><a href={product.repository}>{t(locale, 'detail.repository')}</a></p>
        <p><a href={product.sourceUrl}>{t(locale, 'detail.sourceReference')}</a></p>
        <p>{t(locale, 'detail.published')}: {formatDate(product.publishedAt, locale)}</p>
      </div>
    </aside>
    </div>
  </section>
)
