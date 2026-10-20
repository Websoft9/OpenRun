import { serve } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import type { Context, Next } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { openDatabase } from './db/database.js'
import { runMigrations } from './db/migrate.js'
import { resolveLocale, t } from './i18n/index.js'
import { auth, ensureAuthMigrations } from './lib/auth.js'
import { sessionMiddleware } from './lib/session.js'
import { hashIp, safeEqual } from './lib/security.js'
import { checkRateLimit } from './lib/rate-limit.js'
import {
  getCategoryBySlug,
  getProductBySlug,
  getStats,
  getTagCloud,
  listAllCategories,
  listCategories,
  listChildCategories,
  listFeaturedProducts,
  listProducts,
  listRecentProducts,
  type Locale,
} from './repositories/catalog.js'
import {
  getSoftwareForAdmin,
  listAdminSoftware,
  listReviewQueue,
  saveSoftwareReview,
  type SoftwareReviewInput,
} from './repositories/admin.js'
import { getIndustryByCode, listIndustries } from './repositories/industries.js'
import { listLanguages } from './repositories/languages.js'
import { listMarkets } from './repositories/markets.js'
import { listPlatforms } from './repositories/platforms.js'
import { getProcessByCode, getProcessStats, listProcesses } from './repositories/processes.js'
import {
  createSubmission,
  getSubmissionByToken,
  listSubmissions,
  publishSoftware,
  SubmissionError,
  transitionSubmission,
  type SubmissionAction,
  type SubmissionStatus,
} from './repositories/submissions.js'
import type { SessionUser } from './repositories/users.js'
import { ApiExplorePage, type ApiExplorerQuery } from './ui/api.js'
import { AccountPage, AuthPage } from './ui/auth.js'
import { Layout, type Theme } from './ui/layout.js'
import { AboutPage, CategoriesPage, CategoryDetailPage, DetailPage, HomePage, SearchPage } from './ui/pages.js'
import { ProcessDetailPage, ProcessesPage } from './ui/processes.js'
import { IndustriesPage, IndustryDetailPage } from './ui/industries.js'
import { InsightsPage } from './ui/insights.js'
import { SubmitPage, SubmissionStatusPage } from './ui/submission.js'
import { AdminDashboardPage, AdminSoftwarePage } from './ui/admin.js'

declare module 'hono' {
  interface ContextVariableMap {
    adminActor: string
  }
}

const app = new Hono()

app.use(
  '/static/*',
  serveStatic({
    root: './public',
    rewriteRequestPath: (requestPath) => requestPath.replace(/^\/static/, ''),
  }),
)

app.use('/api/home', cors({ origin: '*' }))
app.use('/api/categories', cors({ origin: '*' }))
app.use('/api/software', cors({ origin: '*' }))
app.use('/api/software/*', cors({ origin: '*' }))

const db = openDatabase()
runMigrations(db)
await ensureAuthMigrations()

app.all('/api/auth/*', (c) => auth.handler(c.req.raw))
app.use('*', sessionMiddleware)

function normalizeTheme(value: string | undefined): Theme {
  return value === 'dark' ? 'dark' : 'light'
}

function currentUser(c: Context): SessionUser | null {
  const session = c.get('session')
  if (!session?.user) {
    return null
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  }
}

function safeNextPath(locale: Locale, value: string | undefined): string {
  if (value && (value === `/${locale}` || value.startsWith(`/${locale}/`))) {
    return value
  }
  return `/${locale}/account`
}

function appendTheme(path: string, theme: Theme): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}theme=${theme}`
}

function authErrorKey(code: string | undefined): Parameters<typeof t>[1] {
  if (code === 'invalid_credentials') return 'auth.error.invalid_credentials'
  if (code === 'email_taken') return 'auth.error.email_taken'
  if (code === 'password_short') return 'auth.error.password_short'
  if (code === 'required') return 'auth.error.required'
  if (code === 'rate_limited') return 'auth.error.rate_limited'
  if (code === 'invalid_input') return 'auth.error.invalid_input'
  return 'auth.error.server_error'
}

function betterAuthErrorCode(value: string | undefined): string {
  switch ((value ?? '').toUpperCase()) {
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'email_taken'
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD':
      return 'invalid_credentials'
    case 'PASSWORD_TOO_SHORT':
      return 'password_short'
    case 'INVALID_EMAIL':
      return 'invalid_input'
    default:
      return 'server_error'
  }
}

async function authErrorFromResponse(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { code?: string; message?: string }
    return betterAuthErrorCode(payload.code ?? payload.message)
  } catch {
    return 'server_error'
  }
}

function redirectWithAuthResponse(response: Response, location: string): Response {
  const headers = new Headers()
  const cookies = response.headers.getSetCookie?.() ?? []
  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie)
  }
  headers.set('Location', location)
  return new Response(null, { status: 303, headers })
}

function authRedirect(locale: Locale, mode: 'login' | 'register', code: string, theme: Theme, next?: string): string {
  const params = new URLSearchParams({ error: code, theme })
  if (next) {
    params.set('next', next)
  }
  return `/${locale}/${mode}?${params.toString()}`
}

const renderer = jsxRenderer(({ children }, c) => {
  const locale = resolveLocale(c.req.param('locale'))
  const categories = listCategories(db, locale)
  const theme = normalizeTheme(c.req.query('theme'))
  const title = c.get('title') ?? 'OpenWise'
  const description = c.get('description') ?? 'Open source software directory'
  const user = currentUser(c)

  return (
    <Layout
      locale={locale}
      title={title}
      description={description}
      activeUrl={c.req.url}
      categories={categories}
      theme={theme}
      user={user}
    >
      {children}
    </Layout>
  )
})

app.use('/:locale', renderer)
app.use('/:locale/*', renderer)

function normalizeLocale(value: string | undefined): Locale {
  return resolveLocale(value)
}

function parseBooleanFilter(value: string | undefined): boolean | undefined {
  if (value === '1') {
    return true
  }
  if (value === '0') {
    return false
  }
  return undefined
}

function parseDeliveryFilter(value: string | undefined): 'server' | 'desktop' | 'cli' | 'saas' | undefined {
  return value === 'server' || value === 'desktop' || value === 'cli' || value === 'saas' ? value : undefined
}

function setPageMeta(c: Context, _locale: Locale, title: string, description: string): void {
  c.set('title', `${title} | OpenWise`)
  c.set('description', description)
}

function getFormValue(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }
  return ''
}

function getTagValues(body: Record<string, unknown>): string[] {
  const value = body.tags
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function getFormList(body: Record<string, unknown>, key: string): string[] {
  const value = body[key]
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return typeof value === 'string' && value.trim() ? [value.trim()] : []
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function clientIp(c: Context): string {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = c.req.header('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    return c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || 'unknown'
  }

  try {
    return getConnInfo(c).remote.address || 'unknown'
  } catch {
    return 'unknown'
  }
}

function isCrossSiteRequest(c: Context): boolean {
  if (c.req.header('sec-fetch-site') === 'cross-site') {
    return true
  }
  const origin = c.req.header('origin')
  if (!origin) {
    return false
  }
  try {
    return new URL(origin).host !== new URL(c.req.url).host
  } catch {
    return true
  }
}

function isFormRequest(c: Context): boolean {
  const contentType = c.req.header('content-type') ?? ''
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')
}

async function parseRequestBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = await c.req.json()
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  }
  const body = await c.req.parseBody()
  return body as Record<string, unknown>
}

function softwareSlugForId(id: number | null): string | undefined {
  if (!id) {
    return undefined
  }
  const row = db.prepare('SELECT slug FROM software WHERE id = ?').get(id) as { slug: string } | undefined
  return row?.slug
}

function submissionResponse(token: string) {
  const submission = getSubmissionByToken(db, token)
  if (!submission) {
    return null
  }
  return {
    token: submission.token,
    repository: submission.repositoryUrl,
    homepage: submission.homepage,
    suggestedCategory: submission.suggestedCategory,
    status: submission.status,
    statusReason: submission.statusReason,
    license: submission.licenseSpdx,
    softwareSlug: softwareSlugForId(submission.softwareId),
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  }
}

function adminNotice(locale: Locale, code: string | undefined): string | undefined {
  if (!code) {
    return undefined
  }
  if (code === 'saved') {
    return t(locale, 'admin.saved')
  }
  if (code === 'published') {
    return t(locale, 'admin.published')
  }
  const statusNotices: Record<string, Parameters<typeof t>[1]> = {
    accepted: 'status.accepted',
    rejected: 'status.rejected',
    needs_info: 'status.needs_info',
    duplicate: 'status.duplicate',
    triage: 'status.triage',
  }
  if (statusNotices[code]) {
    return t(locale, statusNotices[code])
  }
  return code
}

function adminError(locale: Locale, code: string | undefined): string | undefined {
  if (!code) {
    return undefined
  }
  if (code === 'publish_blocked') {
    return t(locale, 'admin.publishBlocked')
  }
  return code
}

const adminAuth = async (c: Context, next: Next) => {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    return c.text('Admin is not configured. Set ADMIN_TOKEN to enable the review queue.', 503)
  }

  const header = c.req.header('authorization') ?? ''
  let supplied = ''
  let actor = 'admin'

  if (header.startsWith('Bearer ')) {
    supplied = header.slice('Bearer '.length).trim()
  } else if (header.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8')
      const separator = decoded.indexOf(':')
      actor = decoded.slice(0, separator) || 'admin'
      supplied = decoded.slice(separator + 1)
    } catch {
      supplied = ''
    }
  }

  if (!supplied || !safeEqual(supplied, expected)) {
    c.header('WWW-Authenticate', 'Basic realm="OpenWise Admin"')
    return c.text('Unauthorized', 401)
  }

  c.set('adminActor', actor)
  await next()
}

app.use('/api/admin/*', adminAuth)
app.use('/:locale/admin', adminAuth)
app.use('/:locale/admin/*', adminAuth)

app.get('/', (c) => c.redirect('/en'))

app.get('/api/categories', (c) => {
  const locale = normalizeLocale(c.req.query('lang') ?? 'en')
  return c.json({ items: listCategories(db, locale) })
})

app.get('/api/software', (c) => {
  const locale = normalizeLocale(c.req.query('lang') ?? 'en')
  const items = listProducts(db, locale, {
    q: c.req.query('q') ?? undefined,
    category: c.req.query('category') ?? undefined,
    tag: c.req.query('tag') ?? undefined,
    industry: c.req.query('industry') ?? undefined,
    delivery: parseDeliveryFilter(c.req.query('delivery')),
    hasUi: parseBooleanFilter(c.req.query('ui')),
    hasAi: parseBooleanFilter(c.req.query('ai')),
    hasFreeTier: parseBooleanFilter(c.req.query('free')),
    hasPublicPricing: parseBooleanFilter(c.req.query('pricing')),
    selfServiceSetup: parseBooleanFilter(c.req.query('self_service')),
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
  })
  return c.json({ items })
})

app.get('/api/software/:slug', (c) => {
  const locale = normalizeLocale(c.req.query('lang') ?? 'en')
  const item = getProductBySlug(db, c.req.param('slug'), locale)
  if (!item) {
    return c.json({ error: 'Not found' }, 404)
  }
  return c.json({ item })
})

app.get('/api/home', (c) => {
  const locale = normalizeLocale(c.req.query('lang') ?? 'en')
  return c.json({
    stats: getStats(db),
    categories: listCategories(db, locale),
    featured: listFeaturedProducts(db, locale),
    recent: listRecentProducts(db, locale),
    tags: getTagCloud(db, locale),
  })
})

app.get('/api/processes', (c) => {
  const locale = normalizeLocale(c.req.query('lang') ?? 'en')
  const level = c.req.query('level') ? Number(c.req.query('level')) : undefined
  const items = listProcesses(db, locale, {
    level: Number.isFinite(level) ? level : undefined,
    parent: c.req.query('parent') ?? undefined,
    q: c.req.query('q') ?? undefined,
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
  })
  return c.json({ stats: getProcessStats(db), items })
})

app.get('/api/processes/:code', (c) => {
  const locale = normalizeLocale(c.req.query('lang') ?? 'en')
  const item = getProcessByCode(db, c.req.param('code'), locale)
  if (!item) {
    return c.json({ error: 'Not found' }, 404)
  }
  return c.json({ item })
})

app.post(
  '/api/submissions',
  bodyLimit({
    maxSize: 32 * 1024,
    onError: (c) => c.json({ error: 'payload_too_large', message: 'Submission is too large' }, 413),
  }),
  async (c) => {
    const form = isFormRequest(c)
    let body: Record<string, unknown>
    try {
      body = await parseRequestBody(c)
    } catch {
      return form ? c.redirect('/en/submit?error=invalid_input', 303) : c.json({ error: 'invalid_input' }, 400)
    }

    const locale = normalizeLocale(getFormValue(body, 'locale') || c.req.query('lang') || 'en')
    const theme = normalizeTheme(c.req.query('theme'))

    if (getFormValue(body, 'website')) {
      return form ? c.redirect(`/${locale}?theme=${theme}`, 303) : c.json({ ok: true }, 202)
    }

    const ipHash = hashIp(clientIp(c))
    const limit = checkRateLimit(ipHash)
    if (!limit.allowed) {
      if (form) {
        return c.redirect(`/${locale}/submit?error=rate_limited&theme=${theme}`, 303)
      }
      return c.json({ error: 'rate_limited', message: 'Too many submissions' }, 429)
    }

    try {
      const result = await createSubmission(db, {
        repository: getFormValue(body, 'repository'),
        homepage: getFormValue(body, 'homepage'),
        suggestedCategory: getFormValue(body, 'suggestedCategory') || getFormValue(body, 'category'),
        note: getFormValue(body, 'note'),
        contact: getFormValue(body, 'contact'),
        source: getFormValue(body, 'source') || 'web',
        ipHash,
      })

      const statusUrl = `/${locale}/submissions/${result.submission.token}?theme=${theme}`
      if (form) {
        return c.redirect(statusUrl, 303)
      }

      return c.json(
        {
          duplicate: result.duplicate,
          statusUrl,
          submission: submissionResponse(result.submission.token),
        },
        result.duplicate ? 200 : 201,
      )
    } catch (error) {
      if (error instanceof SubmissionError) {
        if (form) {
          return c.redirect(`/${locale}/submit?error=${encodeURIComponent(error.code)}&theme=${theme}`, 303)
        }
        return c.json({ error: error.code, message: error.message }, error.statusCode as 400)
      }
      console.error('Submission failed', error)
      if (form) {
        return c.redirect(`/${locale}/submit?error=server_error&theme=${theme}`, 303)
      }
      return c.json({ error: 'server_error' }, 500)
    }
  },
)

app.get('/api/submissions/:token', (c) => {
  const item = submissionResponse(c.req.param('token'))
  if (!item) {
    return c.json({ error: 'Not found' }, 404)
  }
  return c.json({ item })
})

app.get('/:locale/submit', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  setPageMeta(c, locale, t(locale, 'meta.submit.title'), t(locale, 'meta.submit.description'))
  return c.render(
    <SubmitPage
      locale={locale}
      categories={listCategories(db, locale)}
      theme={theme}
      error={c.req.query('error')}
    />,
  )
})

app.get('/:locale/submissions/:token', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const submission = getSubmissionByToken(db, c.req.param('token'))
  if (!submission) {
    return c.notFound()
  }
  setPageMeta(c, locale, t(locale, 'meta.submission.title'), t(locale, 'meta.submission.description'))
  return c.render(
    <SubmissionStatusPage
      locale={locale}
      submission={submission}
      softwareSlug={softwareSlugForId(submission.softwareId)}
      theme={theme}
    />,
  )
})

app.get('/api/admin/submissions', (c) => {
  const status = c.req.query('status') as SubmissionStatus | undefined
  return c.json({ items: listSubmissions(db, status) })
})

app.get('/api/admin/software', (c) => {
  return c.json({ items: listAdminSoftware(db) })
})

app.post('/api/admin/submissions/:id', async (c) => {
  if (isCrossSiteRequest(c)) {
    return c.json({ error: 'cross_site_request' }, 403)
  }
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'invalid_id' }, 400)
  }

  const form = isFormRequest(c)
  let body: Record<string, unknown>
  try {
    body = await parseRequestBody(c)
  } catch {
    return c.json({ error: 'invalid_input' }, 400)
  }

  const locale = normalizeLocale(getFormValue(body, 'locale') || c.req.query('lang') || 'en')
  const action = getFormValue(body, 'action') as SubmissionAction
  const actor = (c.get('adminActor') as string | undefined) || 'admin'

  if (!['accept', 'reject', 'needs_info', 'triage', 'duplicate'].includes(action)) {
    return c.json({ error: 'invalid_action' }, 400)
  }

  try {
    const result = transitionSubmission(db, id, action, actor, getFormValue(body, 'reason'))
    if (form) {
      const notice = action === 'accept' ? 'accepted' : action
      return c.redirect(`/${locale}/admin?notice=${notice}`, 303)
    }
    return c.json({ item: result.submission, softwareSlug: result.softwareSlug })
  } catch (error) {
    if (error instanceof SubmissionError) {
      if (form) {
        return c.redirect(`/${locale}/admin?error=${encodeURIComponent(error.code)}`, 303)
      }
      return c.json({ error: error.code, message: error.message }, error.statusCode as 400)
    }
    console.error('Submission transition failed', error)
    return c.json({ error: 'server_error' }, 500)
  }
})

app.get('/:locale/admin', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const submissions = listSubmissions(db)
  const softwareSlugs: Record<number, string> = {}
  for (const submission of submissions) {
    const slug = softwareSlugForId(submission.softwareId)
    if (slug) {
      softwareSlugs[submission.id] = slug
    }
  }

  setPageMeta(c, locale, t(locale, 'meta.admin.title'), t(locale, 'meta.admin.description'))
  return c.render(
    <AdminDashboardPage
      locale={locale}
      submissions={submissions}
      reviewQueue={listReviewQueue(db)}
      softwareSlugs={softwareSlugs}
      theme={theme}
      notice={adminNotice(locale, c.req.query('notice'))}
      error={adminError(locale, c.req.query('error'))}
    />,
  )
})

app.get('/:locale/admin/software/:slug', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const software = getSoftwareForAdmin(db, c.req.param('slug'))
  if (!software) {
    return c.notFound()
  }
  setPageMeta(c, locale, software.name, t(locale, 'meta.admin.description'))
  return c.render(
    <AdminSoftwarePage
      locale={locale}
      software={software}
      categories={listAllCategories(db, locale)}
      languages={listLanguages(db)}
      markets={listMarkets(db)}
      platforms={listPlatforms(db)}
      industries={listIndustries(db, locale)}
      theme={theme}
      notice={adminNotice(locale, c.req.query('notice'))}
      error={adminError(locale, c.req.query('error'))}
    />,
  )
})

app.post('/api/admin/software/:slug', async (c) => {
  if (isCrossSiteRequest(c)) {
    return c.json({ error: 'cross_site_request' }, 403)
  }
  const locale = normalizeLocale(c.req.query('lang') || 'en')
  const form = isFormRequest(c)
  let body: Record<string, unknown>
  try {
    body = await parseRequestBody(c)
  } catch {
    return c.json({ error: 'invalid_input' }, 400)
  }

  const action = getFormValue(body, 'action') || 'save'
  const summaryEn = getFormValue(body, 'summaryEn')
  const summaryZh = getFormValue(body, 'summaryZh')
  const categorySlugs = getFormList(body, 'categories').length
    ? getFormList(body, 'categories')
    : getFormList(body, 'categorySlugs')
  const markets = getFormList(body, 'markets')
  const platforms = getFormList(body, 'platforms')
  const industries = getFormList(body, 'industries')
  const license = getFormValue(body, 'license')
  const difficulty = getFormValue(body, 'deploymentDifficulty')
  const deploymentDifficulty =
    difficulty === 'easy' || difficulty === 'advanced' ? difficulty : 'moderate'

  if (action === 'publish') {
    if (!summaryEn.trim() || !summaryZh.trim()) {
      if (form) {
        return c.redirect(`/${locale}/admin/software/${c.req.param('slug')}?error=publish_blocked`, 303)
      }
      return c.json({ error: 'publish_blocked' }, 422)
    }
    const licenseRow = license.trim()
      ? (db.prepare('SELECT is_osi_approved FROM licenses WHERE spdx_id = ?').get(license.trim()) as
          | { is_osi_approved: number }
          | undefined)
      : undefined
    if (!categorySlugs.length || !licenseRow || !licenseRow.is_osi_approved) {
      if (form) {
        return c.redirect(`/${locale}/admin/software/${c.req.param('slug')}?error=publish_blocked`, 303)
      }
      return c.json({ error: 'publish_blocked' }, 422)
    }
  }

  const input: SoftwareReviewInput = {
    name: getFormValue(body, 'name'),
    homepage: getFormValue(body, 'homepage'),
    repository: getFormValue(body, 'repository'),
    license,
    primaryLanguage: getFormValue(body, 'primaryLanguage'),
    stars: Number(getFormValue(body, 'stars') || 0),
    latestRelease: getFormValue(body, 'latestRelease'),
    deploymentDifficulty,
    isFeatured: ['1', 'on', 'true'].includes(getFormValue(body, 'isFeatured')),
    supportsServer: ['1', 'on', 'true'].includes(getFormValue(body, 'supportsServer')),
    supportsDesktop: ['1', 'on', 'true'].includes(getFormValue(body, 'supportsDesktop')),
    supportsCli: ['1', 'on', 'true'].includes(getFormValue(body, 'supportsCli')),
    supportsSaas: ['1', 'on', 'true'].includes(getFormValue(body, 'supportsSaas')),
    hasUi: ['1', 'on', 'true'].includes(getFormValue(body, 'hasUi')),
    hasAi: ['1', 'on', 'true'].includes(getFormValue(body, 'hasAi')),
    hasFreeTier: ['1', 'on', 'true'].includes(getFormValue(body, 'hasFreeTier')),
    hasPublicPricing: ['1', 'on', 'true'].includes(getFormValue(body, 'hasPublicPricing')),
    selfServiceSetup: ['1', 'on', 'true'].includes(getFormValue(body, 'selfServiceSetup')),
    categorySlugs,
    tags: getTagValues(body),
    markets: markets.length > 0 ? markets : ['GLOBAL'],
    platforms,
    industries: industries.length > 0 ? industries : ['CROSS_INDUSTRY'],
    summaryEn,
    summaryZh,
    featuresEn: lines(getFormValue(body, 'featuresEn')),
    featuresZh: lines(getFormValue(body, 'featuresZh')),
    useCasesEn: lines(getFormValue(body, 'useCasesEn')),
    useCasesZh: lines(getFormValue(body, 'useCasesZh')),
    alternativesEn: lines(getFormValue(body, 'alternativesEn')),
    alternativesZh: lines(getFormValue(body, 'alternativesZh')),
    whyChooseEn: getFormValue(body, 'whyChooseEn'),
    whyChooseZh: getFormValue(body, 'whyChooseZh'),
    status: action === 'save' ? 'draft' : 'reviewed',
  }

  try {
    const saved = saveSoftwareReview(db, c.req.param('slug'), input)
    if (action === 'publish') {
      publishSoftware(db, saved.slug)
    }

    const item = action === 'publish' ? (getSoftwareForAdmin(db, saved.slug) ?? saved) : saved

    if (form) {
      const target =
        action === 'publish'
          ? `/${locale}/admin?notice=published`
          : `/${locale}/admin/software/${saved.slug}?notice=saved`
      return c.redirect(target, 303)
    }
    return c.json({ item, published: action === 'publish' })
  } catch (error) {
    if (error instanceof SubmissionError) {
      if (form) {
        return c.redirect(
          `/${locale}/admin/software/${c.req.param('slug')}?error=${encodeURIComponent(error.code)}`,
          303,
        )
      }
      return c.json({ error: error.code, message: error.message }, error.statusCode as 400)
    }
    console.error('Software review failed', error)
    return c.json({ error: 'server_error' }, 500)
  }
})

app.get('/:locale', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  setPageMeta(c, locale, t(locale, 'meta.home.title'), t(locale, 'meta.home.description'))

  return c.render(
    <HomePage
      locale={locale}
      stats={getStats(db)}
      categories={listCategories(db, locale)}
      processDomains={listProcesses(db, locale, { level: 1 })}
      featuredProducts={listFeaturedProducts(db, locale)}
      recentProducts={listRecentProducts(db, locale)}
      theme={theme}
    />,
  )
})

app.get('/:locale/processes', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  setPageMeta(c, locale, t(locale, 'meta.processes.title'), t(locale, 'meta.processes.description'))
  return c.render(
    <ProcessesPage
      locale={locale}
      processes={listProcesses(db, locale, { level: 1 })}
      theme={theme}
    />,
  )
})

app.get('/:locale/processes/:code', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const detail = getProcessByCode(db, c.req.param('code'), locale)
  if (!detail) {
    return c.notFound()
  }
  setPageMeta(c, locale, detail.process.name, t(locale, 'meta.processes.description'))
  return c.render(<ProcessDetailPage locale={locale} detail={detail} theme={theme} />)
})

app.get('/:locale/industries', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  setPageMeta(c, locale, t(locale, 'meta.industries.title'), t(locale, 'meta.industries.description'))
  return c.render(
    <IndustriesPage
      locale={locale}
      industries={listIndustries(db, locale)}
      theme={theme}
    />,
  )
})

app.get('/:locale/industries/:code', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const delivery = parseDeliveryFilter(c.req.query('delivery'))
  const hasUi = parseBooleanFilter(c.req.query('ui'))
  const detail = getIndustryByCode(db, c.req.param('code'), locale, { delivery, hasUi })
  if (!detail) {
    return c.notFound()
  }
  setPageMeta(c, locale, detail.industry.name, t(locale, 'meta.industries.description'))
  return c.render(
    <IndustryDetailPage
      locale={locale}
      industry={detail.industry}
      products={detail.software}
      selectedDelivery={delivery}
      selectedUi={hasUi}
      theme={theme}
    />,
  )
})

app.get('/:locale/insights', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  setPageMeta(c, locale, t(locale, 'meta.insights.title'), t(locale, 'meta.insights.description'))
  return c.render(<InsightsPage locale={locale} theme={theme} />)
})

app.get('/:locale/categories', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  setPageMeta(c, locale, t(locale, 'meta.categories.title'), t(locale, 'meta.categories.description'))
  return c.render(<CategoriesPage locale={locale} categories={listCategories(db, locale)} theme={theme} />)
})

app.get('/:locale/categories/:slug', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const delivery = parseDeliveryFilter(c.req.query('delivery'))
  const hasUi = parseBooleanFilter(c.req.query('ui'))
  const category = getCategoryBySlug(db, c.req.param('slug'), locale)
  if (!category) {
    return c.notFound()
  }
  setPageMeta(c, locale, category.name, category.description)
  return c.render(
    <CategoryDetailPage
      locale={locale}
      category={category}
      children={listChildCategories(db, category.slug, locale)}
      products={listProducts(db, locale, { category: category.slug, delivery, hasUi, limit: 50 })}
      selectedDelivery={delivery}
      selectedUi={hasUi}
      theme={theme}
    />,
  )
})

app.get('/:locale/search', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const q = c.req.query('q') ?? undefined
  const category = c.req.query('category') ?? undefined
  const tag = c.req.query('tag') ?? undefined
  const delivery = parseDeliveryFilter(c.req.query('delivery'))
  const hasUi = parseBooleanFilter(c.req.query('ui'))
  const hasAi = parseBooleanFilter(c.req.query('ai'))
  const hasFreeTier = parseBooleanFilter(c.req.query('free'))
  const hasPublicPricing = parseBooleanFilter(c.req.query('pricing'))
  const selfServiceSetup = parseBooleanFilter(c.req.query('self_service'))
  setPageMeta(c, locale, t(locale, 'meta.search.title'), t(locale, 'meta.search.description'))
  return c.render(
    <SearchPage
      locale={locale}
      categories={listCategories(db, locale)}
      tags={getTagCloud(db, locale)}
      selectedCategory={category}
      selectedTag={tag}
      query={q}
      selectedDelivery={delivery}
      selectedUi={hasUi}
      selectedAi={hasAi}
      selectedFreeTier={hasFreeTier}
      selectedPublicPricing={hasPublicPricing}
      selectedSelfService={selfServiceSetup}
      products={listProducts(db, locale, { q, category, tag, delivery, hasUi, hasAi, hasFreeTier, hasPublicPricing, selfServiceSetup, limit: 50 })}
      theme={theme}
    />,
  )
})

app.get('/:locale/about', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  setPageMeta(c, locale, t(locale, 'meta.about.title'), t(locale, 'meta.about.description'))
  return c.render(<AboutPage locale={locale} stats={getStats(db)} theme={theme} />)
})

app.get('/:locale/login', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  if (currentUser(c)) {
    return c.redirect(appendTheme(`/${locale}/account`, theme))
  }
  setPageMeta(c, locale, t(locale, 'meta.login.title'), t(locale, 'meta.login.description'))
  const errorCode = c.req.query('error')
  return c.render(
    <AuthPage
      locale={locale}
      theme={theme}
      mode="login"
      error={errorCode ? t(locale, authErrorKey(errorCode)) : undefined}
      next={c.req.query('next')}
    />,
  )
})

app.post('/:locale/login', async (c) => {
  if (isCrossSiteRequest(c)) {
    return c.text('Forbidden', 403)
  }
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const ip = clientIp(c)
  if (!checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000).allowed) {
    return c.redirect(appendTheme(`/${locale}/login?error=rate_limited`, theme))
  }

  let body: Record<string, unknown>
  try {
    body = await parseRequestBody(c)
  } catch {
    return c.redirect(appendTheme(`/${locale}/login?error=invalid_input`, theme))
  }

  const next = safeNextPath(locale, getFormValue(body, 'next'))
  try {
    const response = await auth.api.signInEmail({
      body: {
        email: getFormValue(body, 'email'),
        password: getFormValue(body, 'password'),
      },
      headers: c.req.raw.headers,
      asResponse: true,
    })
    if (!response.ok) {
      return c.redirect(authRedirect(locale, 'login', await authErrorFromResponse(response), theme, getFormValue(body, 'next')))
    }
    return redirectWithAuthResponse(response, appendTheme(next, theme))
  } catch (error) {
    console.error('Sign in failed', error)
    return c.redirect(authRedirect(locale, 'login', 'server_error', theme, getFormValue(body, 'next')))
  }
})

app.get('/:locale/register', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  if (currentUser(c)) {
    return c.redirect(appendTheme(`/${locale}/account`, theme))
  }
  setPageMeta(c, locale, t(locale, 'meta.register.title'), t(locale, 'meta.register.description'))
  return c.render(
    <AuthPage
      locale={locale}
      theme={theme}
      mode="register"
      error={c.req.query('error') ? t(locale, authErrorKey(c.req.query('error'))) : undefined}
      next={c.req.query('next')}
    />,
  )
})

app.post('/:locale/register', async (c) => {
  if (isCrossSiteRequest(c)) {
    return c.text('Forbidden', 403)
  }
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const ip = clientIp(c)
  if (!checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000).allowed) {
    return c.redirect(appendTheme(`/${locale}/register?error=rate_limited`, theme))
  }

  let body: Record<string, unknown>
  try {
    body = await parseRequestBody(c)
  } catch {
    return c.redirect(appendTheme(`/${locale}/register?error=invalid_input`, theme))
  }

  const next = safeNextPath(locale, getFormValue(body, 'next'))
  try {
    const response = await auth.api.signUpEmail({
      body: {
        email: getFormValue(body, 'email'),
        name: getFormValue(body, 'name'),
        password: getFormValue(body, 'password'),
      },
      headers: c.req.raw.headers,
      asResponse: true,
    })
    if (!response.ok) {
      return c.redirect(authRedirect(locale, 'register', await authErrorFromResponse(response), theme, getFormValue(body, 'next')))
    }
    return redirectWithAuthResponse(response, appendTheme(next, theme))
  } catch (error) {
    console.error('Registration failed', error)
    return c.redirect(authRedirect(locale, 'register', 'server_error', theme, getFormValue(body, 'next')))
  }
})

app.get('/:locale/account', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const user = currentUser(c)
  if (!user) {
    return c.redirect(appendTheme(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`, theme))
  }
  setPageMeta(c, locale, t(locale, 'meta.account.title'), t(locale, 'meta.account.description'))
  return c.render(<AccountPage locale={locale} theme={theme} user={user} />)
})

app.post('/:locale/logout', async (c) => {
  if (isCrossSiteRequest(c)) {
    return c.text('Forbidden', 403)
  }
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))

  try {
    const response = await auth.api.signOut({
      headers: c.req.raw.headers,
      asResponse: true,
    })
    return redirectWithAuthResponse(response, appendTheme(`/${locale}`, theme))
  } catch (error) {
    console.error('Sign out failed', error)
    return c.redirect(appendTheme(`/${locale}`, theme))
  }
})

app.get('/:locale/api', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const q = c.req.query('q') ?? undefined
  const category = c.req.query('category') ?? undefined
  const tag = c.req.query('tag') ?? undefined
  const delivery = parseDeliveryFilter(c.req.query('delivery'))
  const hasUi = parseBooleanFilter(c.req.query('ui'))
  const hasAi = parseBooleanFilter(c.req.query('ai'))
  const hasFreeTier = parseBooleanFilter(c.req.query('free'))
  const hasPublicPricing = parseBooleanFilter(c.req.query('pricing'))
  const selfServiceSetup = parseBooleanFilter(c.req.query('self_service'))
  const requestedLimit = Number(c.req.query('limit') ?? '10')
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 10
  const query: ApiExplorerQuery = {
    q,
    category,
    tag,
    delivery,
    hasUi,
    hasAi,
    hasFreeTier,
    hasPublicPricing,
    selfServiceSetup,
    limit,
  }

  const params = new URLSearchParams({ lang: locale })
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  if (tag) params.set('tag', tag)
  if (delivery) params.set('delivery', delivery)
  if (hasUi !== undefined) params.set('ui', hasUi ? '1' : '0')
  if (hasAi) params.set('ai', '1')
  if (hasFreeTier) params.set('free', '1')
  if (hasPublicPricing) params.set('pricing', '1')
  if (selfServiceSetup) params.set('self_service', '1')
  params.set('limit', String(limit))

  const apiUrl = `/api/software?${params.toString()}`
  const slug = c.req.query('slug')?.trim() || undefined
  const detail = slug ? getProductBySlug(db, slug, locale) : null
  const detailApiUrl = slug ? `/api/software/${encodeURIComponent(slug)}?lang=${locale}` : undefined

  setPageMeta(c, locale, t(locale, 'meta.api.title'), t(locale, 'meta.api.description'))
  return c.render(
    <ApiExplorePage
      locale={locale}
      theme={theme}
      categories={listCategories(db, locale)}
      tags={getTagCloud(db, locale)}
      query={query}
      apiUrl={apiUrl}
      items={listProducts(db, locale, {
        q,
        category,
        tag,
        delivery,
        hasUi,
        hasAi,
        hasFreeTier,
        hasPublicPricing,
        selfServiceSetup,
        limit,
      })}
      slug={slug}
      detail={detail}
      detailApiUrl={detailApiUrl}
    />,
  )
})

app.get('/:locale/software/:slug', (c) => {
  const locale = normalizeLocale(c.req.param('locale'))
  const theme = normalizeTheme(c.req.query('theme'))
  const product = getProductBySlug(db, c.req.param('slug'), locale)
  if (!product) {
    return c.notFound()
  }
  setPageMeta(c, locale, product.name, product.summary)
  return c.render(<DetailPage locale={locale} product={product} theme={theme} />)
})

app.notFound((c) => {
  const locale = normalizeLocale(c.req.path.split('/')[1] ?? 'en')
  return c.html(
    <Layout
      locale={locale}
      title={`${t(locale, 'meta.notFound.title')} | OpenWise`}
      description={t(locale, 'meta.notFound.description')}
      activeUrl={c.req.url}
      categories={listCategories(db, locale)}
      theme={normalizeTheme(c.req.query('theme'))}
      user={currentUser(c)}
    >
      <section class="empty-state-wrap">
        <h1>{t(locale, 'notFound.title')}</h1>
        <p>{t(locale, 'notFound.description')}</p>
      </section>
    </Layout>,
    404,
  )
})

const port = Number(process.env.PORT ?? 9000)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`OpenWise listening on http://localhost:${info.port}`)
})
