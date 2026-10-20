import type { FC } from 'hono/jsx'
import { t, type MessageKey } from '../i18n/index.js'
import type { DeliveryModel, Locale, ProductCard } from '../repositories/catalog.js'
import type { IndustrySummary } from '../repositories/industries.js'
import type { Theme } from './layout.js'
import { CatalogFilterBar, ProductGrid } from './pages.js'

function withTheme(path: string, theme: Theme): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}theme=${theme}`
}

function levelLabel(locale: Locale, level: string): string {
  const key: MessageKey = level === 'special' ? 'industry.level.special' : 'industry.level.section'
  return t(locale, key)
}

export const IndustriesPage: FC<{
  locale: Locale
  industries: IndustrySummary[]
  theme: Theme
}> = ({ locale, industries, theme }) => (
  <section>
    <div class="page-intro page-intro-grid">
      <div>
        <p class="kicker">{t(locale, 'industries.kicker')}</p>
        <h1>{t(locale, 'industries.title')}</h1>
        <p>{t(locale, 'industries.intro')}</p>
      </div>
      <div class="page-intro-note">
        <strong>{industries.length}</strong>
        <span>{t(locale, 'industries.note')}</span>
      </div>
    </div>
    <div class="category-grid">
      {industries.map((industry) => (
        <a class="category-card" href={withTheme(`/${locale}/industries/${industry.code}`, theme)}>
          <div class="category-card-top">
            <span class="category-count">{industry.productCount}</span>
            <span class="category-arrow">↗</span>
          </div>
          <h3>{industry.name}</h3>
          <p>
            {industry.code} · {levelLabel(locale, industry.level)}
          </p>
          <p>{t(locale, 'industries.softwareUnit', { count: industry.productCount })}</p>
        </a>
      ))}
    </div>
  </section>
)

export const IndustryDetailPage: FC<{
  locale: Locale
  industry: IndustrySummary
  products: ProductCard[]
  selectedDelivery?: DeliveryModel
  selectedUi?: boolean
  theme: Theme
}> = ({ locale, industry, products, selectedDelivery, selectedUi, theme }) => (
  <section>
    <div class="page-intro page-intro-grid">
      <div>
        <p class="kicker">
          <a href={withTheme(`/${locale}/industries`, theme)}>{t(locale, 'industry.kicker')}</a>
        </p>
        <h1>{industry.name}</h1>
        <p>
          {industry.code} · {levelLabel(locale, industry.level)}
        </p>
      </div>
      <div class="page-intro-note">
        <strong>{products.length}</strong>
        <span>{t(locale, 'industry.unit')}</span>
      </div>
    </div>
    <CatalogFilterBar
      locale={locale}
      theme={theme}
      actionPath={`/${locale}/industries/${industry.code}`}
      clearPath={withTheme(`/${locale}/industries/${industry.code}`, theme)}
      selectedDelivery={selectedDelivery}
      selectedUi={selectedUi}
      resultCount={products.length}
    />
    {products.length === 0 ? (
      <p class="empty-state">{t(locale, 'industry.noSoftware')}</p>
    ) : (
      <ProductGrid locale={locale} products={products} theme={theme} />
    )}
  </section>
)
