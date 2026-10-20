import type { FC } from 'hono/jsx'
import { t } from '../i18n/index.js'
import type { Locale } from '../repositories/catalog.js'
import type { ProcessDetail, ProcessSummary } from '../repositories/processes.js'
import type { Theme } from './layout.js'

function withTheme(path: string, theme: Theme): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}theme=${theme}`
}

export const ProcessesPage: FC<{
  locale: Locale
  processes: ProcessSummary[]
  theme: Theme
}> = ({ locale, processes, theme }) => (
  <section>
    <div class="page-intro page-intro-grid">
      <div>
        <p class="kicker">{t(locale, 'processes.kicker')}</p>
        <h1>{t(locale, 'processes.title')}</h1>
        <p>{t(locale, 'processes.intro')}</p>
      </div>
      <div class="page-intro-note">
        <strong>{processes.length}</strong>
        <span>{t(locale, 'processes.note')}</span>
      </div>
    </div>
    <div class="category-grid">
      {processes.map((process) => (
        <a class="category-card" href={withTheme(`/${locale}/processes/${process.code}`, theme)}>
          <div class="category-card-top">
            <span class="category-count">{process.code}</span>
            <span class="category-arrow">↗</span>
          </div>
          <h3>{process.name}</h3>
          <p>
            {process.childCount} {t(locale, 'processes.childUnit')}
          </p>
        </a>
      ))}
    </div>
  </section>
)

export const ProcessDetailPage: FC<{
  locale: Locale
  detail: ProcessDetail
  theme: Theme
}> = ({ locale, detail, theme }) => {
  const { process, software } = detail

  return (
    <section>
      <div class="page-intro page-intro-grid">
        <div>
          <p class="kicker">
            <a href={withTheme(`/${locale}/processes`, theme)}>{t(locale, 'processes.title')}</a>
          </p>
          <h1>{process.name}</h1>
          <p>
            {process.code} · {t(locale, 'process.level')} {process.level}
          </p>
        </div>
        <div class="page-intro-note">
          <strong>{process.children.length}</strong>
          <span>{t(locale, 'processes.childUnit')}</span>
        </div>
      </div>

      {process.children.length > 0 ? (
        <div class="process-tree">
          {process.children.map((child) => (
            <article class="info-card process-group">
              <div class="process-group-head">
                <span class="status-pill">{child.code}</span>
                <h3>{child.name}</h3>
              </div>
              {child.children.length > 0 ? (
                <div class="filter-tag-list">
                  {child.children.map((leaf) => (
                    <a class="filter-tag" href={withTheme(`/${locale}/processes/${leaf.code}`, theme)}>
                      <span>{leaf.name}</span>
                      <small>{leaf.code}</small>
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      <section class="section-head compact">
        <h2>{t(locale, 'process.software')}</h2>
      </section>
      {software.length === 0 ? (
        <p class="empty-state">{t(locale, 'process.noSoftware')}</p>
      ) : (
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>{t(locale, 'process.softwareName')}</th>
                <th>{t(locale, 'process.fitLevel')}</th>
                <th>{t(locale, 'process.confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {software.map((item) => (
                <tr>
                  <td>
                    <a class="inline-link" href={withTheme(`/${locale}/software/${item.slug}`, theme)}>
                      {item.name}
                    </a>
                  </td>
                  <td>{item.fitLevel}</td>
                  <td>{Math.round(item.confidence * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
