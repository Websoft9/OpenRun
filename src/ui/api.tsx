import type { FC } from 'hono/jsx'
import { t, type MessageKey } from '../i18n/index.js'
import type { CategorySummary, DeliveryModel, Locale, ProductCard, ProductDetail, TagSummary } from '../repositories/catalog.js'
import type { Theme } from './layout.js'

const deliveryKeys: Record<DeliveryModel, MessageKey> = {
  server: 'delivery.server',
  desktop: 'delivery.desktop',
  cli: 'delivery.cli',
  saas: 'delivery.saas',
}

export type ApiExplorerQuery = {
  q?: string
  category?: string
  tag?: string
  delivery?: DeliveryModel
  hasUi?: boolean
  hasAi?: boolean
  hasFreeTier?: boolean
  hasPublicPricing?: boolean
  selfServiceSetup?: boolean
  limit: number
}

export const ApiExplorePage: FC<{
  locale: Locale
  theme: Theme
  categories: CategorySummary[]
  tags: TagSummary[]
  query: ApiExplorerQuery
  apiUrl: string
  items: ProductCard[]
  slug?: string
  detail?: ProductDetail | null
  detailApiUrl?: string
}> = ({ locale, theme, categories, tags, query, apiUrl, items, slug, detail, detailApiUrl }) => {
  const tr = (key: Parameters<typeof t>[1], params?: Parameters<typeof t>[2]) => t(locale, key, params)

  return (
    <section class="api-page">
      <div class="page-intro">
        <p class="kicker">{tr('api.kicker')}</p>
        <h1>{tr('api.title')}</h1>
        <p>{tr('api.intro')}</p>
        <span class="requirement-badge">{tr('api.readOnly')}</span>
      </div>

      <div class="api-layout">
        <div class="api-panel">
          <div class="section-head compact">
            <h2>{tr('api.endpoints')}</h2>
          </div>
          <div class="api-endpoint-list">
            <a class="api-endpoint" href={apiUrl} target="_blank" rel="noreferrer">
              <span class="api-method">GET</span>
              <code>/api/software</code>
              <span>{tr('api.softwareEndpoint')}</span>
            </a>
            <a class="api-endpoint" href={`/api/software/atlas-cms?lang=${locale}`} target="_blank" rel="noreferrer">
              <span class="api-method">GET</span>
              <code>/api/software/:slug</code>
              <span>{tr('api.detailEndpoint')}</span>
            </a>
            <a class="api-endpoint" href={`/api/categories?lang=${locale}`} target="_blank" rel="noreferrer">
              <span class="api-method">GET</span>
              <code>/api/categories</code>
              <span>{tr('api.categoriesEndpoint')}</span>
            </a>
            <a class="api-endpoint" href={`/api/home?lang=${locale}`} target="_blank" rel="noreferrer">
              <span class="api-method">GET</span>
              <code>/api/home</code>
              <span>{tr('api.homeEndpoint')}</span>
            </a>
          </div>
        </div>

        <form class="api-panel api-form" method="get" action={`/${locale}/api`}>
          <input type="hidden" name="theme" value={theme} />
          <div class="section-head compact">
            <h2>{tr('api.queryTitle')}</h2>
          </div>
          <p>{tr('api.queryHint')}</p>
          <div class="api-form-grid">
            <label>
              <span>{tr('search.keywordLabel')}</span>
              <input type="search" name="q" value={query.q ?? ''} />
            </label>
            <label>
              <span>{tr('search.categoryLabel')}</span>
              <select name="category">
                <option value="">{tr('search.allCategories')}</option>
                {categories.map((category) => (
                  <option value={category.slug} selected={query.category === category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{tr('search.popularTags')}</span>
              <select name="tag">
                <option value="">{tr('search.allTags')}</option>
                {tags.map((tag) => (
                  <option value={tag.slug} selected={query.tag === tag.slug}>{tag.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{tr('search.deliveryLabel')}</span>
              <select name="delivery">
                <option value="">{tr('search.deliveryAny')}</option>
                {(['server', 'desktop', 'cli', 'saas'] as DeliveryModel[]).map((model) => (
                  <option value={model} selected={query.delivery === model}>
                    {t(locale, deliveryKeys[model])}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{tr('search.interfaceLabel')}</span>
              <select name="ui">
                <option value="">{tr('search.uiAny')}</option>
                <option value="1" selected={query.hasUi === true}>{tr('search.uiYes')}</option>
                <option value="0" selected={query.hasUi === false}>{tr('search.uiNo')}</option>
              </select>
            </label>
            <label>
              <span>{tr('api.limit')}</span>
              <input type="number" name="limit" min="1" max="50" value={query.limit} />
            </label>
          </div>
          <div class="filter-checkboxes">
            <label class="checkbox-row">
              <input type="checkbox" name="ai" value="1" checked={query.hasAi === true} />
              <span>{tr('search.ai')}</span>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="free" value="1" checked={query.hasFreeTier === true} />
              <span>{tr('search.freeTier')}</span>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="pricing" value="1" checked={query.hasPublicPricing === true} />
              <span>{tr('search.publicPricing')}</span>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="self_service" value="1" checked={query.selfServiceSetup === true} />
              <span>{tr('search.selfService')}</span>
            </label>
          </div>
          <button type="submit">{tr('api.run')}</button>
        </form>
      </div>

      <div class="api-panel api-response-panel">
        <div class="api-response-head">
          <div>
            <span class="footer-label">{tr('api.requestUrl')}</span>
            <code class="api-url">{apiUrl}</code>
          </div>
          <a class="ghost-link" href={apiUrl} target="_blank" rel="noreferrer">JSON ↗</a>
        </div>
        <span class="footer-label">{tr('api.response')}</span>
        <pre class="api-code">{JSON.stringify(items, null, 2)}</pre>
      </div>

      <div class="api-panel">
        <div class="section-head compact">
          <h2>{tr('api.detailTitle')}</h2>
        </div>
        <p>{tr('api.detailHint')}</p>
        <form class="api-inline-form" method="get" action={`/${locale}/api`}>
          <input type="hidden" name="theme" value={theme} />
          <label>
            <span>{tr('api.slug')}</span>
            <input type="text" name="slug" value={slug ?? ''} placeholder="atlas-cms" />
          </label>
          <button type="submit">{tr('api.runDetail')}</button>
        </form>
        {slug ? (
          detail ? (
            <>
              <div class="api-response-head">
                <div>
                  <span class="footer-label">{tr('api.requestUrl')}</span>
                  <code class="api-url">{detailApiUrl}</code>
                </div>
                <a class="ghost-link" href={detailApiUrl} target="_blank" rel="noreferrer">JSON ↗</a>
              </div>
              <pre class="api-code">{JSON.stringify(detail, null, 2)}</pre>
            </>
          ) : (
            <p class="empty-state">{tr('api.notFound')}</p>
          )
        ) : null}
      </div>
    </section>
  )
}
