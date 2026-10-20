import type { FC } from 'hono/jsx'
import { t, type MessageKey } from '../i18n/index.js'
import type { Locale } from '../repositories/catalog.js'
import type { Theme } from './layout.js'

function withTheme(path: string, theme: Theme): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}theme=${theme}`
}

const insightCards: Array<[MessageKey, MessageKey]> = [
  ['insights.card.coverage.title', 'insights.card.coverage.body'],
  ['insights.card.deployment.title', 'insights.card.deployment.body'],
  ['insights.card.process.title', 'insights.card.process.body'],
]

export const InsightsPage: FC<{ locale: Locale; theme: Theme }> = ({ locale, theme }) => (
  <section>
    <div class="page-intro page-intro-grid">
      <div>
        <p class="kicker">{t(locale, 'insights.kicker')}</p>
        <h1>{t(locale, 'insights.title')}</h1>
        <p>{t(locale, 'insights.intro')}</p>
      </div>
      <div class="page-intro-note">
        <strong>01</strong>
        <span>{t(locale, 'insights.note')}</span>
      </div>
    </div>

    <section class="section-head compact">
      <h2>{t(locale, 'insights.previewTitle')}</h2>
    </section>
    <div class="signals-grid">
      {insightCards.map(([titleKey, bodyKey], index) => (
        <article class="signal-card">
          <span class="signal-card-step">0{index + 1}</span>
          <h3>{t(locale, titleKey)}</h3>
          <p>{t(locale, bodyKey)}</p>
        </article>
      ))}
    </div>

    <p class="empty-state insights-empty">
      {t(locale, 'insights.comingSoon')}{' '}
      <a class="inline-link" href={withTheme(`/${locale}/processes`, theme)}>{t(locale, 'nav.process')}</a>
      {' · '}
      <a class="inline-link" href={withTheme(`/${locale}/categories`, theme)}>{t(locale, 'nav.software')}</a>
    </p>
  </section>
)
