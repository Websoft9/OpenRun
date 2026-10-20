import type { FC, PropsWithChildren } from 'hono/jsx'
import { localeOptions, t, type Locale } from '../i18n/index.js'
import type { CategorySummary } from '../repositories/catalog.js'

export type Theme = 'light' | 'dark'

type LayoutProps = PropsWithChildren<{
  locale: Locale
  title: string
  description: string
  activeUrl: string
  categories: CategorySummary[]
  theme: Theme
  user?: { name: string; email: string } | null
}>

function withTheme(path: string, theme: Theme): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}theme=${theme}`
}

function themeSwitchPath(activeUrl: string, theme: Theme): string {
  const url = new URL(activeUrl)
  url.searchParams.set('theme', theme)
  return `${url.pathname}${url.search}`
}

function localeSwitchPath(activeUrl: string, nextLocale: Locale, theme: Theme): string {
  const url = new URL(activeUrl)
  const segments = url.pathname.split('/')
  segments[1] = nextLocale
  url.pathname = segments.join('/') || `/${nextLocale}`
  url.searchParams.set('theme', theme)
  return `${url.pathname}${url.search}`
}

const SearchIcon: FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.2 4.2" />
  </svg>
)

const SunIcon: FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="3.6" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
  </svg>
)

const MoonIcon: FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.7 8.7 0 1 0 20 15.2Z" />
  </svg>
)

const ChevronIcon: FC = () => (
  <svg class="chevron-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m7 10 5 5 5-5" />
  </svg>
)

const LanguageSwitcher: FC<{
  locale: Locale
  activeUrl: string
  theme: Theme
  variant?: 'header' | 'footer'
}> = ({ locale, activeUrl, theme, variant = 'header' }) => {
  const current = localeOptions.find((option) => option.code === locale) ?? localeOptions[0]

  return (
    <details class={`language-menu language-menu-${variant}`}>
      <summary
        class="language-menu-trigger"
        aria-label={`${t(locale, 'language.label')}: ${current.label}`}
        title={`${t(locale, 'language.label')}: ${current.label}`}
      >
        <span class="language-flag" aria-hidden="true">{current.flag}</span>
        <span class="language-current-label">{current.label}</span>
        <ChevronIcon />
      </summary>
      <div class="language-menu-panel">
        {localeOptions.map((option) => (
          <a
            class={option.code === locale ? 'active' : ''}
            href={localeSwitchPath(activeUrl, option.code, theme)}
            hreflang={option.code}
            lang={option.code}
            aria-current={option.code === locale ? 'page' : undefined}
          >
            <span class="language-option-label">
              <span class="language-flag" aria-hidden="true">{option.flag}</span>
              <span>{option.label}</span>
            </span>
            <small>{option.code.toUpperCase()}</small>
          </a>
        ))}
      </div>
    </details>
  )
}

const FooterNavColumns: FC<{
  locale: Locale
  categories: CategorySummary[]
  theme: Theme
}> = ({ locale, categories, theme }) => (
  <>
    <div class="footer-column">
      <span class="footer-label">{t(locale, 'footer.directory')}</span>
      <div class="footer-links">
        <a href={withTheme(`/${locale}`, theme)}>{t(locale, 'nav.home')}</a>
        <a href={withTheme(`/${locale}/search`, theme)}>{t(locale, 'nav.search')}</a>
        <a href={withTheme(`/${locale}/processes`, theme)}>{t(locale, 'nav.process')}</a>
        <a href={withTheme(`/${locale}/categories`, theme)}>{t(locale, 'nav.software')}</a>
        <a href={withTheme(`/${locale}/industries`, theme)}>{t(locale, 'nav.industry')}</a>
        <a href={withTheme(`/${locale}/insights`, theme)}>{t(locale, 'nav.insights')}</a>
        <a href={withTheme(`/${locale}/submit`, theme)}>{t(locale, 'footer.submit')}</a>
        <a href={withTheme(`/${locale}/about`, theme)}>{t(locale, 'footer.about')}</a>
      </div>
    </div>

    <div class="footer-column">
      <span class="footer-label">{t(locale, 'footer.developers')}</span>
      <div class="footer-links">
        <a href={withTheme(`/${locale}/api`, theme)}>{t(locale, 'footer.apiExplore')}</a>
      </div>
    </div>

    <div class="footer-column">
      <span class="footer-label">{t(locale, 'footer.popularCategories')}</span>
      <div class="footer-links">
        {categories.slice(0, 4).map((category) => (
          <a href={withTheme(`/${locale}/categories/${category.slug}`, theme)}>{category.name}</a>
        ))}
      </div>
    </div>

    <div class="footer-column">
      <span class="footer-label">{t(locale, 'footer.exploreBy')}</span>
      <div class="footer-links">
        <a href={withTheme(`/${locale}/search?tag=privacy`, theme)}>{t(locale, 'footer.privacyTools')}</a>
        <a href={withTheme(`/${locale}/search?category=data`, theme)}>{t(locale, 'footer.dataPlatforms')}</a>
        <a href={withTheme(`/${locale}/search?category=infrastructure`, theme)}>{t(locale, 'footer.infrastructure')}</a>
      </div>
    </div>

  </>
)

export const Layout: FC<LayoutProps> = ({ locale, title, description, activeUrl, categories, theme, user, children }) => {
  const tr = (key: Parameters<typeof t>[1], params?: Parameters<typeof t>[2]) => t(locale, key, params)
  const activePath = new URL(activeUrl).pathname
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const year = new Date().getFullYear()

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="stylesheet" href="/static/app.css" />
      </head>
      <body data-theme={theme}>
        <div class="page-chrome">
          <div class="page-glow page-glow-left"></div>
          <div class="page-glow page-glow-right"></div>
        </div>
        <div class="page-shell">
          <header class="site-header">
            <div class="brand-cluster">
              <div class="brand-lockup">
                <a class="brand" href={`/${locale}`}>
                  <span class="brand-mark">OW</span>
                  <span>OpenWise</span>
                </a>
              </div>
            </div>
            <nav class="top-nav">
              <a
                href={withTheme(`/${locale}/processes`, theme)}
                class={activePath.startsWith(`/${locale}/processes`) ? 'active' : ''}
              >
                {tr('nav.process')}
              </a>
              <a
                href={withTheme(`/${locale}/categories`, theme)}
                class={activePath.includes('/categories') || activePath.includes('/software/') ? 'active' : ''}
              >
                {tr('nav.software')}
              </a>
              <a
                href={withTheme(`/${locale}/industries`, theme)}
                class={activePath.includes('/industries') ? 'active' : ''}
              >
                {tr('nav.industry')}
              </a>
              <a
                href={withTheme(`/${locale}/insights`, theme)}
                class={activePath.includes('/insights') ? 'active' : ''}
              >
                {tr('nav.insights')}
              </a>
            </nav>
            <div class="header-actions">
              <div class="header-icon-group">
                <a
                  class="icon-button"
                  href={withTheme(`/${locale}/search`, theme)}
                  aria-label={tr('search.open')}
                  title={tr('search.open')}
                >
                  <SearchIcon />
                </a>
                <a
                  class="icon-button theme-toggle"
                  href={themeSwitchPath(activeUrl, nextTheme)}
                  aria-label={tr(nextTheme === 'dark' ? 'theme.toggleDark' : 'theme.toggleLight')}
                  title={tr(nextTheme === 'dark' ? 'theme.toggleDark' : 'theme.toggleLight')}
                >
                  {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </a>
                <LanguageSwitcher locale={locale} activeUrl={activeUrl} theme={theme} />
              </div>
              <div class="header-cta-group">
                <a class="header-cta header-submit" href={withTheme(`/${locale}/submit`, theme)}>
                  {tr('nav.submit')}
                </a>
                <a class="header-cta header-login" href={withTheme(user ? `/${locale}/account` : `/${locale}/login`, theme)}>
                  {user ? tr('nav.account') : tr('nav.login')}
                </a>
              </div>
            </div>
          </header>
          <main>{children}</main>
          <footer class="site-footer">
            <div class="footer-top">
              <div class="footer-brand">
                <a class="footer-brand-link" href={withTheme(`/${locale}`, theme)}>
                  <span class="brand-mark">OW</span>
                  <strong>OpenWise</strong>
                </a>
                <p>{tr('footer.description')}</p>
                <a class="footer-button" href={withTheme(`/${locale}/search`, theme)}>{tr('footer.browseDirectory')}</a>
              </div>

              <nav class="footer-nav footer-nav-desktop" aria-label={tr('footer.aria')}>
                <FooterNavColumns locale={locale} categories={categories} theme={theme} />
              </nav>

              <details class="footer-menu-mobile">
                <summary>
                  <span>{tr('footer.menu')}</span>
                  <ChevronIcon />
                </summary>
                <div class="footer-mobile-panel">
                  <FooterNavColumns locale={locale} categories={categories} theme={theme} />
                </div>
              </details>
            </div>

            <div class="footer-bottom">
              <p class="footer-copyright">
                {tr('footer.copyright', { year })}
              </p>
              <div class="footer-meta">
                <span>{tr('footer.openSourceDirectory')}</span>
                <a href={withTheme(`/${locale}/about`, theme)}>{tr('footer.about')}</a>
                <a href={themeSwitchPath(activeUrl, nextTheme)}>{theme === 'dark' ? tr('footer.lightMode') : tr('footer.darkMode')}</a>
                <LanguageSwitcher locale={locale} activeUrl={activeUrl} theme={theme} variant="footer" />
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
