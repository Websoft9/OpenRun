import type { FC } from 'hono/jsx'
import { formatDate, t, type MessageKey } from '../i18n/index.js'
import type { CategorySummary, Locale } from '../repositories/catalog.js'
import type { Submission, SubmissionStatus } from '../repositories/submissions.js'
import type { Theme } from './layout.js'

const ISSUE_TEMPLATE_URL = 'https://github.com/Websoft9/OpenRun/issues/new?template=submit-app.yml'

const statusKeys: Record<SubmissionStatus, MessageKey> = {
  submitted: 'status.submitted',
  triage: 'status.triage',
  needs_info: 'status.needs_info',
  accepted: 'status.accepted',
  ingested: 'status.ingested',
  reviewed: 'status.reviewed',
  published: 'status.published',
  rejected: 'status.rejected',
  duplicate: 'status.duplicate',
}

const errorKeys: Record<string, MessageKey> = {
  invalid_repository: 'submit.error.invalid_repository',
  unsupported_protocol: 'submit.error.unsupported_protocol',
  private_host: 'submit.error.private_host',
  invalid_repository_path: 'submit.error.invalid_repository_path',
  invalid_homepage: 'submit.error.invalid_homepage',
  unknown_category: 'submit.error.unknown_category',
  invalid_note: 'submit.error.invalid_note',
  invalid_contact: 'submit.error.invalid_contact',
  rate_limited: 'submit.error.rate_limited',
  invalid_input: 'submit.error.invalid_input',
  server_error: 'submit.error.server_error',
}

function errorMessage(locale: Locale, code: string | undefined): string | null {
  if (!code) {
    return null
  }
  const key = errorKeys[code] ?? 'submit.error.server_error'
  return t(locale, key)
}

export const SubmitPage: FC<{
  locale: Locale
  categories: CategorySummary[]
  theme: Theme
  error?: string
}> = ({ locale, categories, theme, error }) => {
  const message = errorMessage(locale, error)

  return (
    <section class="contribute-layout">
      <div class="page-intro">
        <p class="kicker">{t(locale, 'submit.kicker')}</p>
        <h1>{t(locale, 'submit.title')}</h1>
        <p>{t(locale, 'submit.intro')}</p>
      </div>

      {message ? <div class="notice notice-error">{message}</div> : null}

      <div class="contribute-grid">
        <form class="form-card" method="post" action="/api/submissions">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="source" value="web" />
          <div class="honeypot" aria-hidden="true">
            <label>
              <span>{t(locale, 'submit.honeypot')}</span>
              <input type="text" name="website" tabindex={-1} autocomplete="off" />
            </label>
          </div>

          <label class="form-row">
            <span>{t(locale, 'submit.repositoryLabel')}</span>
            <input
              type="url"
              name="repository"
              required
              placeholder={t(locale, 'submit.repositoryPlaceholder')}
              autocomplete="url"
            />
            <small>{t(locale, 'submit.repositoryHint')}</small>
          </label>

          <div class="form-grid">
            <label class="form-row">
              <span>{t(locale, 'submit.homepageLabel')}</span>
              <input type="url" name="homepage" placeholder="https://example.com" autocomplete="url" />
            </label>
            <label class="form-row">
              <span>{t(locale, 'submit.categoryLabel')}</span>
              <select name="suggestedCategory">
                <option value="">{t(locale, 'submit.categoryPlaceholder')}</option>
                {categories.map((category) => (
                  <option value={category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label class="form-row">
            <span>{t(locale, 'submit.noteLabel')}</span>
            <textarea name="note" rows={5} maxlength={4000} placeholder={t(locale, 'submit.notePlaceholder')}></textarea>
          </label>

          <label class="form-row">
            <span>{t(locale, 'submit.contactLabel')}</span>
            <input type="text" name="contact" maxlength={320} placeholder="GitHub handle or email" />
            <small>{t(locale, 'submit.contactHint')}</small>
          </label>

          <button type="submit">{t(locale, 'submit.button')}</button>
          <p class="form-privacy">{t(locale, 'submit.privacy')}</p>
        </form>

        <aside class="contribute-aside">
          <div class="info-card">
            <h3>{t(locale, 'submit.requirementsTitle')}</h3>
            <ul class="check-list">
              <li>{t(locale, 'submit.requirement.public')}</li>
              <li>{t(locale, 'submit.requirement.license')}</li>
              <li>{t(locale, 'submit.requirement.selfHosted')}</li>
              <li>{t(locale, 'submit.requirement.duplicate')}</li>
            </ul>
          </div>
          <div class="info-card">
            <h3>{t(locale, 'submit.issueTitle')}</h3>
            <p>{t(locale, 'submit.issueBody')}</p>
            <a class="ghost-button" href={ISSUE_TEMPLATE_URL} rel="noreferrer">
              {t(locale, 'submit.issueLink')}
            </a>
          </div>
          <div class="info-card">
            <h3>{t(locale, 'submit.flowTitle')}</h3>
            <ol class="flow-list">
              <li>{t(locale, 'submit.flow.submit')}</li>
              <li>{t(locale, 'submit.flow.triage')}</li>
              <li>{t(locale, 'submit.flow.review')}</li>
              <li>{t(locale, 'submit.flow.publish')}</li>
            </ol>
          </div>
        </aside>
      </div>
    </section>
  )
}

export const SubmissionStatusPage: FC<{
  locale: Locale
  submission: Submission
  softwareSlug?: string
  theme: Theme
}> = ({ locale, submission, softwareSlug, theme }) => (
  <section class="status-layout">
    <div class="page-intro">
      <p class="kicker">{t(locale, 'submit.status.kicker')}</p>
      <h1>{t(locale, 'submit.status.title')}</h1>
      <p>{t(locale, 'submit.success.body')}</p>
    </div>

    <div class="status-card">
      <div class="status-card-head">
        <div>
          <span class="status-label">{t(locale, 'submit.status.status')}</span>
          <span class={`status-pill status-${submission.status}`}>{t(locale, statusKeys[submission.status])}</span>
        </div>
        <span class="status-token">{submission.token}</span>
      </div>

      <dl class="status-facts">
        <div>
          <dt>{t(locale, 'submit.status.project')}</dt>
          <dd><a href={submission.repositoryUrl}>{submission.repositoryUrl}</a></dd>
        </div>
        <div>
          <dt>{t(locale, 'submit.status.category')}</dt>
          <dd>{submission.suggestedCategory || t(locale, 'submit.status.notSet')}</dd>
        </div>
        <div>
          <dt>{t(locale, 'submit.status.license')}</dt>
          <dd>{submission.licenseSpdx || t(locale, 'submit.status.notSet')}</dd>
        </div>
        <div>
          <dt>{t(locale, 'submit.status.submittedAt')}</dt>
          <dd>{formatDate(submission.createdAt, locale)}</dd>
        </div>
      </dl>

      {submission.statusReason ? (
        <div class="notice">
          <strong>{t(locale, 'submit.status.reason')}:</strong> {submission.statusReason}
        </div>
      ) : null}

      {submission.status === 'duplicate' && softwareSlug ? (
        <p>
          {t(locale, 'submit.status.duplicateOf')}{' '}
          <a class="inline-link" href={`/${locale}/software/${softwareSlug}?theme=${theme}`}>{softwareSlug}</a>
        </p>
      ) : null}

      {submission.status === 'published' && softwareSlug ? (
        <p>
          <a class="inline-link" href={`/${locale}/software/${softwareSlug}?theme=${theme}`}>
            {t(locale, 'submit.status.viewListing')}
          </a>
        </p>
      ) : null}

      <div class="status-actions">
        <a class="ghost-button" href={`/${locale}?theme=${theme}`}>{t(locale, 'submit.back')}</a>
        <a class="ghost-button" href={`/${locale}/submit?theme=${theme}`}>{t(locale, 'submit.submitAnother')}</a>
      </div>
    </div>
  </section>
)
