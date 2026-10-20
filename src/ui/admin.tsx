import type { FC } from 'hono/jsx'
import { formatDate, t } from '../i18n/index.js'
import type { CategorySummary, Locale } from '../repositories/catalog.js'
import type { LanguageSummary } from '../repositories/languages.js'
import type { IndustrySummary } from '../repositories/industries.js'
import type { MarketSummary } from '../repositories/markets.js'
import type { PlatformSummary } from '../repositories/platforms.js'
import type { SoftwareAdmin } from '../repositories/admin.js'
import type { Submission } from '../repositories/submissions.js'
import type { Theme } from './layout.js'

const statusKeys = {
  submitted: 'status.submitted',
  triage: 'status.triage',
  needs_info: 'status.needs_info',
  accepted: 'status.accepted',
  ingested: 'status.ingested',
  reviewed: 'status.reviewed',
  published: 'status.published',
  rejected: 'status.rejected',
  duplicate: 'status.duplicate',
  draft: 'status.draft',
} as const

const openStatuses = new Set(['submitted', 'triage', 'needs_info'])

export const AdminDashboardPage: FC<{
  locale: Locale
  submissions: Submission[]
  reviewQueue: SoftwareAdmin[]
  softwareSlugs: Record<number, string>
  theme: Theme
  notice?: string
  error?: string
}> = ({ locale, submissions, reviewQueue, softwareSlugs, theme, notice, error }) => (
  <section>
    <div class="page-intro page-intro-grid">
      <div>
        <p class="kicker">{t(locale, 'admin.kicker')}</p>
        <h1>{t(locale, 'admin.title')}</h1>
        <p>{t(locale, 'admin.intro')}</p>
      </div>
      <div class="page-intro-note">
        <strong>{submissions.filter((item) => openStatuses.has(item.status)).length}</strong>
        <span>{t(locale, 'admin.pending')}</span>
      </div>
    </div>

    {notice ? <div class="notice notice-success">{notice}</div> : null}
    {error ? <div class="notice notice-error">{error}</div> : null}

    <div class="admin-section">
      <div class="section-head compact">
        <h2>{t(locale, 'admin.submissions')}</h2>
        <span class="admin-hint">{t(locale, 'admin.submissionsHint')}</span>
      </div>
      {submissions.length === 0 ? (
        <p class="empty-state">{t(locale, 'admin.noSubmissions')}</p>
      ) : (
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>{t(locale, 'admin.id')}</th>
                <th>{t(locale, 'admin.repository')}</th>
                <th>{t(locale, 'admin.category')}</th>
                <th>{t(locale, 'admin.status')}</th>
                <th>{t(locale, 'admin.created')}</th>
                <th>{t(locale, 'admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => {
                const softwareSlug = softwareSlugs[submission.id]
                const open = openStatuses.has(submission.status)
                return (
                  <tr>
                    <td>{submission.id}</td>
                    <td>
                      <a class="inline-link" href={submission.repositoryUrl}>{submission.repositoryUrl}</a>
                      {submission.statusReason ? <div class="admin-reason">{submission.statusReason}</div> : null}
                    </td>
                    <td>{submission.suggestedCategory || '—'}</td>
                    <td>
                      <span class={`status-pill status-${submission.status}`}>
                        {t(locale, statusKeys[submission.status])}
                      </span>
                    </td>
                    <td>{formatDate(submission.createdAt, locale)}</td>
                    <td>
                      {open ? (
                        <form class="admin-action-form" method="post" action={`/api/admin/submissions/${submission.id}`}>
                          <input type="hidden" name="redirect" value="1" />
                          <input type="text" name="reason" placeholder={t(locale, 'admin.reasonPlaceholder')} />
                          <button class="mini-button" type="submit" name="action" value="accept">
                            {t(locale, 'admin.accept')}
                          </button>
                          <button class="mini-button secondary" type="submit" name="action" value="needs_info">
                            {t(locale, 'admin.needsInfo')}
                          </button>
                          <button class="mini-button secondary" type="submit" name="action" value="duplicate">
                            {t(locale, 'admin.duplicate')}
                          </button>
                          <button class="mini-button danger" type="submit" name="action" value="reject">
                            {t(locale, 'admin.reject')}
                          </button>
                        </form>
                      ) : softwareSlug ? (
                        <a class="ghost-button compact-button" href={`/${locale}/admin/software/${softwareSlug}?theme=${theme}`}>
                          {t(locale, 'admin.edit')}
                        </a>
                      ) : (
                        <span class="admin-muted">{t(locale, 'admin.noActions')}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    <div class="admin-section">
      <div class="section-head compact">
        <h2>{t(locale, 'admin.reviewQueue')}</h2>
        <span class="admin-hint">{t(locale, 'admin.reviewQueueHint')}</span>
      </div>
      {reviewQueue.length === 0 ? (
        <p class="empty-state">{t(locale, 'admin.noDrafts')}</p>
      ) : (
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>{t(locale, 'admin.name')}</th>
                <th>{t(locale, 'admin.status')}</th>
                <th>{t(locale, 'admin.categories')}</th>
                <th>{t(locale, 'admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.map((software) => (
                <tr>
                  <td>
                    <strong>{software.name}</strong>
                    <div class="admin-muted">{software.slug}</div>
                  </td>
                  <td>
                    <span class={`status-pill status-${software.status}`}>
                      {t(locale, statusKeys[software.status])}
                    </span>
                  </td>
                  <td>{software.categories.join(', ') || '—'}</td>
                  <td>
                    <a class="ghost-button compact-button" href={`/${locale}/admin/software/${software.slug}?theme=${theme}`}>
                      {t(locale, 'admin.edit')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </section>
)

export const AdminSoftwarePage: FC<{
  locale: Locale
  software: SoftwareAdmin
  categories: CategorySummary[]
  languages: LanguageSummary[]
  markets: MarketSummary[]
  platforms: PlatformSummary[]
  industries: IndustrySummary[]
  theme: Theme
  notice?: string
  error?: string
}> = ({ locale, software, categories, languages, markets, platforms, industries, theme, notice, error }) => {
  const difficultyOptions: Array<SoftwareAdmin['deploymentDifficulty']> = ['easy', 'moderate', 'advanced']
  const difficultyKeys = {
    easy: 'difficulty.easy',
    moderate: 'difficulty.moderate',
    advanced: 'difficulty.advanced',
  } as const

  return (
    <section>
      <div class="page-intro page-intro-grid">
        <div>
          <p class="kicker">{t(locale, 'admin.editKicker')}</p>
          <h1>{software.name}</h1>
          <p>
            {software.slug} ·{' '}
            <span class={`status-pill status-${software.status}`}>{t(locale, statusKeys[software.status])}</span>
          </p>
        </div>
        <div class="page-intro-note">
          <strong>{software.stars}</strong>
          <span>{t(locale, 'admin.stars')}</span>
        </div>
      </div>

      {notice ? <div class="notice notice-success">{notice}</div> : null}
      {error ? <div class="notice notice-error">{error}</div> : null}

      <form class="admin-form" method="post" action={`/api/admin/software/${software.slug}`}>
        <input type="hidden" name="redirect" value="1" />

        <div class="admin-section">
          <h2>{t(locale, 'admin.facts')}</h2>
          <div class="form-grid">
            <label class="form-row">
              <span>{t(locale, 'admin.name')}</span>
              <input type="text" name="name" value={software.name} required />
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.homepage')}</span>
              <input type="url" name="homepage" value={software.homepage} required />
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.repository')}</span>
              <input type="url" name="repository" value={software.repository} required />
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.license')}</span>
              <input type="text" name="license" value={software.license} />
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.language')}</span>
              <input
                type="text"
                name="primaryLanguage"
                value={software.primaryLanguage}
                list="language-options"
                autocomplete="off"
              />
              <datalist id="language-options">
                {languages.map((language) => (
                  <option value={language.name}></option>
                ))}
              </datalist>
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.stars')}</span>
              <input type="number" name="stars" min="0" value={software.stars} />
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.release')}</span>
              <input type="text" name="latestRelease" value={software.latestRelease} />
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.difficulty')}</span>
              <select name="deploymentDifficulty">
                {difficultyOptions.map((value) => (
                  <option value={value} selected={software.deploymentDifficulty === value}>
                    {t(locale, difficultyKeys[value])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" name="isFeatured" value="1" checked={software.isFeatured} />
            <span>{t(locale, 'admin.featured')}</span>
          </label>
          <label class="form-row">
            <span>{t(locale, 'admin.tags')}</span>
            <input type="text" name="tags" value={software.tags.join(', ')} placeholder="docker, privacy" />
            <small>{t(locale, 'admin.tagsHint')}</small>
          </label>
          <fieldset class="checkbox-fieldset">
            <legend>{t(locale, 'admin.categories')}</legend>
            <div class="checkbox-grid">
              {categories.map((category) => (
                <label class="checkbox-row">
                  <input
                    type="checkbox"
                    name="categories"
                    value={category.slug}
                    checked={software.categories.includes(category.slug)}
                  />
                  <span>{category.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset class="checkbox-fieldset">
            <legend>{t(locale, 'admin.markets')}</legend>
            <div class="checkbox-grid">
              {markets.map((market) => (
                <label class="checkbox-row">
                  <input
                    type="checkbox"
                    name="markets"
                    value={market.code}
                    checked={software.markets.includes(market.code)}
                  />
                  <span>{market.name}</span>
                </label>
              ))}
            </div>
            <small class="form-privacy">{t(locale, 'admin.marketsHint')}</small>
          </fieldset>
          <fieldset class="checkbox-fieldset">
            <legend>{t(locale, 'admin.platforms')}</legend>
            <div class="checkbox-grid">
              {platforms.map((platform) => (
                <label class="checkbox-row">
                  <input
                    type="checkbox"
                    name="platforms"
                    value={platform.code}
                    checked={software.platforms.includes(platform.code)}
                  />
                  <span>{platform.label}</span>
                </label>
              ))}
            </div>
            <small class="form-privacy">{t(locale, 'admin.platformsHint')}</small>
          </fieldset>
          <fieldset class="checkbox-fieldset">
            <legend>{t(locale, 'admin.industries')}</legend>
            <div class="checkbox-grid">
              {industries.map((industry) => (
                <label class="checkbox-row">
                  <input
                    type="checkbox"
                    name="industries"
                    value={industry.code}
                    checked={software.industries.includes(industry.code)}
                  />
                  <span>{industry.name}</span>
                </label>
              ))}
            </div>
            <small class="form-privacy">{t(locale, 'admin.industriesHint')}</small>
          </fieldset>
          <fieldset class="checkbox-fieldset">
            <legend>{t(locale, 'detail.requirements')}</legend>
            <div class="checkbox-grid">
              <label class="checkbox-row">
                <input type="checkbox" name="supportsServer" value="1" checked={software.supportsServer} />
                <span>{t(locale, 'delivery.server')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="supportsDesktop" value="1" checked={software.supportsDesktop} />
                <span>{t(locale, 'delivery.desktop')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="supportsCli" value="1" checked={software.supportsCli} />
                <span>{t(locale, 'delivery.cli')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="supportsSaas" value="1" checked={software.supportsSaas} />
                <span>{t(locale, 'delivery.saas')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="hasUi" value="1" checked={software.hasUi} />
                <span>{t(locale, 'attribute.ui')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="hasAi" value="1" checked={software.hasAi} />
                <span>{t(locale, 'attribute.ai')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="hasFreeTier" value="1" checked={software.hasFreeTier} />
                <span>{t(locale, 'attribute.freeTier')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="hasPublicPricing" value="1" checked={software.hasPublicPricing} />
                <span>{t(locale, 'attribute.publicPricing')}</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" name="selfServiceSetup" value="1" checked={software.selfServiceSetup} />
                <span>{t(locale, 'attribute.selfService')}</span>
              </label>
            </div>
          </fieldset>
        </div>

        <div class="admin-section">
          <h2>{t(locale, 'admin.analysis')}</h2>
          <div class="form-grid">
            <label class="form-row">
              <span>{t(locale, 'admin.summaryEn')}</span>
              <textarea name="summaryEn" rows={4}>{software.summaryEn}</textarea>
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.summaryZh')}</span>
              <textarea name="summaryZh" rows={4}>{software.summaryZh}</textarea>
            </label>
          </div>

          <div class="form-grid">
            <label class="form-row">
              <span>{t(locale, 'admin.featuresEn')}</span>
              <textarea name="featuresEn" rows={5}>{software.featuresEn.join('\n')}</textarea>
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.featuresZh')}</span>
              <textarea name="featuresZh" rows={5}>{software.featuresZh.join('\n')}</textarea>
            </label>
          </div>

          <div class="form-grid">
            <label class="form-row">
              <span>{t(locale, 'admin.useCasesEn')}</span>
              <textarea name="useCasesEn" rows={4}>{software.useCasesEn.join('\n')}</textarea>
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.useCasesZh')}</span>
              <textarea name="useCasesZh" rows={4}>{software.useCasesZh.join('\n')}</textarea>
            </label>
          </div>

          <div class="form-grid">
            <label class="form-row">
              <span>{t(locale, 'admin.alternativesEn')}</span>
              <textarea name="alternativesEn" rows={3}>{software.alternativesEn.join('\n')}</textarea>
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.alternativesZh')}</span>
              <textarea name="alternativesZh" rows={3}>{software.alternativesZh.join('\n')}</textarea>
            </label>
          </div>

          <div class="form-grid">
            <label class="form-row">
              <span>{t(locale, 'admin.whyChooseEn')}</span>
              <textarea name="whyChooseEn" rows={3}>{software.whyChooseEn}</textarea>
            </label>
            <label class="form-row">
              <span>{t(locale, 'admin.whyChooseZh')}</span>
              <textarea name="whyChooseZh" rows={3}>{software.whyChooseZh}</textarea>
            </label>
          </div>

          <p class="admin-muted">
            {t(locale, 'admin.source')}: {software.sourceUrl || '—'} · {t(locale, 'admin.fetched')}:{' '}
            {software.fetchedAt ? formatDate(software.fetchedAt, locale) : '—'}
          </p>
        </div>

        <div class="admin-actions-bar">
          <a class="ghost-button" href={`/${locale}/admin?theme=${theme}`}>{t(locale, 'admin.back')}</a>
          <button class="mini-button secondary" type="submit" name="action" value="save">
            {t(locale, 'admin.saveDraft')}
          </button>
          <button class="mini-button secondary" type="submit" name="action" value="review">
            {t(locale, 'admin.saveReviewed')}
          </button>
          <button class="mini-button" type="submit" name="action" value="publish">
            {t(locale, 'admin.publish')}
          </button>
        </div>
      </form>
    </section>
  )
}
