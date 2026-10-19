import { randomBytes } from 'node:crypto'
import type { AppDatabase } from '../db/database.js'
import { slugify } from '../db/seed.js'
import { fetchGithubMetadata, type GithubMetadata } from '../lib/github.js'
import { normalizeRepositoryUrl, type NormalizedRepository } from '../lib/security.js'

export const submissionStatuses = [
  'submitted',
  'triage',
  'needs_info',
  'accepted',
  'ingested',
  'reviewed',
  'published',
  'rejected',
  'duplicate',
] as const

export type SubmissionStatus = (typeof submissionStatuses)[number]
export type SubmissionAction = 'accept' | 'reject' | 'needs_info' | 'triage' | 'duplicate'

export type Submission = {
  id: number
  token: string
  repositoryUrl: string
  normalizedRepository: string
  homepage: string
  suggestedCategory: string | null
  note: string
  submitterContact: string
  source: string
  status: SubmissionStatus
  statusReason: string
  licenseSpdx: string | null
  metadata: GithubMetadata | null
  softwareId: number | null
  createdAt: string
  updatedAt: string
  reviewedAt: string
}

type SubmissionRow = {
  id: number
  token: string
  repository_url: string
  normalized_repository: string
  homepage: string
  suggested_category: string | null
  note: string
  submitter_contact: string
  source: string
  status: SubmissionStatus
  status_reason: string
  license_spdx: string | null
  metadata_json: string
  software_id: number | null
  created_at: string
  updated_at: string
  reviewed_at: string
}

export type CreateSubmissionInput = {
  repository: string
  homepage?: string
  suggestedCategory?: string
  note?: string
  contact?: string
  source?: string
  ipHash?: string
}

export type CreateSubmissionResult = {
  submission: Submission
  duplicate: boolean
}

export type TransitionResult = {
  submission: Submission
  softwareSlug?: string
}

export class SubmissionError extends Error {
  readonly code: string
  readonly statusCode: number

  constructor(code: string, message: string, statusCode = 400) {
    super(message)
    this.name = 'SubmissionError'
    this.code = code
    this.statusCode = statusCode
  }
}

const allowedTransitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  submitted: ['triage', 'needs_info', 'accepted', 'rejected', 'duplicate'],
  triage: ['needs_info', 'accepted', 'rejected', 'duplicate'],
  needs_info: ['triage', 'accepted', 'rejected', 'duplicate'],
  accepted: ['ingested', 'reviewed', 'published', 'rejected'],
  ingested: ['reviewed', 'published', 'rejected'],
  reviewed: ['published', 'rejected'],
  published: [],
  rejected: [],
  duplicate: [],
}

const actionTarget: Record<SubmissionAction, SubmissionStatus> = {
  accept: 'accepted',
  reject: 'rejected',
  needs_info: 'needs_info',
  triage: 'triage',
  duplicate: 'duplicate',
}

function toSubmission(row: SubmissionRow): Submission {
  let metadata: GithubMetadata | null = null
  if (row.metadata_json) {
    try {
      metadata = JSON.parse(row.metadata_json) as GithubMetadata
    } catch {
      metadata = null
    }
  }

  return {
    id: row.id,
    token: row.token,
    repositoryUrl: row.repository_url,
    normalizedRepository: row.normalized_repository,
    homepage: row.homepage,
    suggestedCategory: row.suggested_category,
    note: row.note,
    submitterContact: row.submitter_contact,
    source: row.source,
    status: row.status,
    statusReason: row.status_reason,
    licenseSpdx: row.license_spdx,
    metadata,
    softwareId: row.software_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
  }
}

function normalizeHomepage(raw: string | undefined): string {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return ''
  }

  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    throw new SubmissionError('invalid_homepage', 'Homepage must be a valid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SubmissionError('invalid_homepage', 'Homepage must use http or https')
  }
  if (url.username || url.password) {
    throw new SubmissionError('invalid_homepage', 'Homepage must not contain credentials')
  }
  return url.toString()
}

function categoryExists(db: AppDatabase, slug: string): boolean {
  return Boolean(db.prepare('SELECT 1 AS ok FROM categories WHERE slug = ?').get(slug))
}

function findOpenSubmission(db: AppDatabase, normalizedRepository: string): SubmissionRow | null {
  return (
    (db
      .prepare(`
        SELECT * FROM submissions
        WHERE normalized_repository = ?
          AND status IN ('submitted', 'triage', 'needs_info', 'accepted', 'ingested', 'reviewed')
        LIMIT 1
      `)
      .get(normalizedRepository) as SubmissionRow | undefined) ?? null
  )
}

type SoftwareLookupRow = { id: number; slug: string; repository: string }

function findSoftwareByRepository(db: AppDatabase, normalizedRepository: string): SoftwareLookupRow | null {
  const rows = db.prepare('SELECT id, slug, repository FROM software').all() as SoftwareLookupRow[]
  for (const row of rows) {
    const parsed = normalizeRepositoryUrl(row.repository)
    if (parsed.ok && parsed.value.normalized === normalizedRepository) {
      return row
    }
  }
  return null
}

function uniqueSlug(db: AppDatabase, desired: string, existingId: number | null = null): string {
  const base = desired || 'software'
  let candidate = base
  let suffix = 2
  for (;;) {
    const row = db.prepare('SELECT id FROM software WHERE slug = ?').get(candidate) as { id: number } | undefined
    if (!row || row.id === existingId) {
      return candidate
    }
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

function titleize(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

function decideInitialStatus(
  db: AppDatabase,
  enrichmentEnabled: boolean,
  repository: NormalizedRepository,
  enrichment: Awaited<ReturnType<typeof fetchGithubMetadata>>,
): { status: SubmissionStatus; reason: string; licenseSpdx: string | null; metadata: GithubMetadata | null } {
  if (!enrichmentEnabled) {
    return { status: 'submitted', reason: '', licenseSpdx: null, metadata: null }
  }

  if (!enrichment) {
    return {
      status: 'triage',
      reason: 'Automatic validation is only available for GitHub repositories.',
      licenseSpdx: null,
      metadata: null,
    }
  }

  if (!enrichment.ok) {
    if (enrichment.error === 'not_found') {
      return {
        status: 'needs_info',
        reason: 'Repository is not public or could not be read.',
        licenseSpdx: null,
        metadata: null,
      }
    }
    if (enrichment.error === 'rate_limited') {
      return {
        status: 'triage',
        reason: 'GitHub rate limit reached; metadata needs manual review.',
        licenseSpdx: null,
        metadata: null,
      }
    }
    return {
      status: 'triage',
      reason: 'GitHub metadata could not be fetched.',
      licenseSpdx: null,
      metadata: null,
    }
  }

  const metadata = enrichment.metadata
  if (metadata.archived) {
    return { status: 'needs_info', reason: 'Repository is archived.', licenseSpdx: metadata.licenseSpdx, metadata }
  }

  if (!metadata.licenseSpdx || metadata.licenseSpdx === 'NOASSERTION') {
    return {
      status: 'needs_info',
      reason: 'No open source license was detected.',
      licenseSpdx: metadata.licenseSpdx,
      metadata,
    }
  }

  const license = db
    .prepare('SELECT is_osi_approved FROM licenses WHERE spdx_id = ?')
    .get(metadata.licenseSpdx) as { is_osi_approved: number } | undefined

  if (!license) {
    return {
      status: 'triage',
      reason: `License ${metadata.licenseSpdx} needs review.`,
      licenseSpdx: metadata.licenseSpdx,
      metadata,
    }
  }

  if (!license.is_osi_approved) {
    return {
      status: 'needs_info',
      reason: 'License is not OSI approved.',
      licenseSpdx: metadata.licenseSpdx,
      metadata,
    }
  }

  return { status: 'submitted', reason: '', licenseSpdx: metadata.licenseSpdx, metadata }
}

export async function createSubmission(
  db: AppDatabase,
  input: CreateSubmissionInput,
): Promise<CreateSubmissionResult> {
  const parsed = normalizeRepositoryUrl(input.repository ?? '')
  if (!parsed.ok) {
    throw new SubmissionError(parsed.error, 'Repository URL is not valid')
  }

  const note = (input.note ?? '').trim()
  if (note.length > 4000) {
    throw new SubmissionError('invalid_note', 'Submission note is too long')
  }

  const contact = (input.contact ?? '').trim()
  if (contact.length > 320) {
    throw new SubmissionError('invalid_contact', 'Contact is too long')
  }

  const homepage = normalizeHomepage(input.homepage)
  const suggestedCategory = (input.suggestedCategory ?? '').trim() || null
  if (suggestedCategory && !categoryExists(db, suggestedCategory)) {
    throw new SubmissionError('unknown_category', 'Suggested category does not exist')
  }

  const open = findOpenSubmission(db, parsed.value.normalized)
  if (open) {
    return { submission: toSubmission(open), duplicate: true }
  }

  const existingSoftware = findSoftwareByRepository(db, parsed.value.normalized)
  const enrichmentEnabled = process.env.SUBMISSION_ENRICH !== '0'
  const enrichment = enrichmentEnabled ? await fetchGithubMetadata(parsed.value) : null

  let status: SubmissionStatus
  let statusReason: string
  let licenseSpdx: string | null
  let metadata: GithubMetadata | null

  if (existingSoftware) {
    status = 'duplicate'
    statusReason = `Already in the directory as ${existingSoftware.slug}.`
    licenseSpdx = null
    metadata = null
  } else {
    const decision = decideInitialStatus(db, enrichmentEnabled, parsed.value, enrichment)
    status = decision.status
    statusReason = decision.reason
    licenseSpdx = decision.licenseSpdx
    metadata = decision.metadata
  }

  const token = randomBytes(24).toString('base64url')
  const now = new Date().toISOString()

  db.exec('BEGIN')
  try {
    db.prepare(`
      INSERT INTO submissions (
        token, repository_url, normalized_repository, homepage, suggested_category,
        note, submitter_contact, source, status, status_reason, license_spdx,
        metadata_json, software_id, ip_hash, created_at, updated_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token,
      parsed.value.url,
      parsed.value.normalized,
      homepage || parsed.value.url,
      suggestedCategory,
      note,
      contact,
      input.source || 'web',
      status,
      statusReason,
      licenseSpdx,
      metadata ? JSON.stringify(metadata) : '',
      existingSoftware?.id ?? null,
      input.ipHash ?? '',
      now,
      now,
      status === 'duplicate' ? now : '',
    )

    const row = db.prepare('SELECT * FROM submissions WHERE token = ?').get(token) as SubmissionRow
    db.prepare(`
      INSERT INTO submission_events (submission_id, from_status, to_status, actor, reason, created_at)
      VALUES (?, '', ?, 'system', ?, ?)
    `).run(row.id, status, statusReason, now)

    db.exec('COMMIT')
    return { submission: toSubmission(row), duplicate: status === 'duplicate' }
  } catch (error) {
    db.exec('ROLLBACK')
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      const existing = findOpenSubmission(db, parsed.value.normalized)
      if (existing) {
        return { submission: toSubmission(existing), duplicate: true }
      }
    }
    throw error
  }
}

export function getSubmissionByToken(db: AppDatabase, token: string): Submission | null {
  const row = db.prepare('SELECT * FROM submissions WHERE token = ?').get(token) as SubmissionRow | undefined
  return row ? toSubmission(row) : null
}

export function getSubmissionById(db: AppDatabase, id: number): Submission | null {
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as SubmissionRow | undefined
  return row ? toSubmission(row) : null
}

export function listSubmissions(db: AppDatabase, status?: SubmissionStatus): Submission[] {
  const rows = status
    ? (db.prepare('SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC').all(status) as SubmissionRow[])
    : (db.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all() as SubmissionRow[])
  return rows.map(toSubmission)
}

function createDraftSoftware(db: AppDatabase, submission: Submission): string {
  const parsed = normalizeRepositoryUrl(submission.repositoryUrl)
  if (!parsed.ok) {
    throw new SubmissionError('invalid_repository', 'Submission repository is invalid')
  }

  const metadata = submission.metadata
  const repoName = metadata?.name || parsed.value.repository || 'software'
  const name = titleize(repoName) || repoName
  const slug = uniqueSlug(db, slugify(name) || 'software')
  const now = new Date().toISOString()
  const homepage = submission.homepage || metadata?.homepage || parsed.value.url
  const license = submission.licenseSpdx || metadata?.licenseSpdx || 'NOASSERTION'

  db.prepare(`
    INSERT INTO software (
      slug, name, homepage, repository, license, primary_language, stars, monthly_views,
      last_updated_at, latest_release, deployment_difficulty, status, is_featured
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, '', 'moderate', 'draft', 0)
  `).run(
    slug,
    name,
    homepage,
    parsed.value.url,
    license,
    metadata?.language || 'Unknown',
    metadata?.stars ?? 0,
    metadata?.pushedAt || now,
  )

  const row = db.prepare('SELECT id FROM software WHERE slug = ?').get(slug) as { id: number }

  db.prepare('INSERT OR IGNORE INTO software_markets (software_id, market_code) VALUES (?, ?)').run(
    row.id,
    'GLOBAL',
  )

  if (submission.suggestedCategory && categoryExists(db, submission.suggestedCategory)) {
    const category = db
      .prepare('SELECT id FROM categories WHERE slug = ?')
      .get(submission.suggestedCategory) as { id: number }
    db.prepare('INSERT OR IGNORE INTO software_categories (software_id, category_id) VALUES (?, ?)').run(
      row.id,
      category.id,
    )
  }

  db.prepare(`
    INSERT INTO tags (slug, name) VALUES ('self-hosted', 'self-hosted')
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name
  `).run()
  const tag = db.prepare("SELECT id FROM tags WHERE slug = 'self-hosted'").get() as { id: number }
  db.prepare('INSERT OR IGNORE INTO software_tags (software_id, tag_id) VALUES (?, ?)').run(row.id, tag.id)

  db.prepare(`
    INSERT INTO analyses (
      software_id, summary_en, features_en, use_cases_en, alternatives_en, why_choose_en
    ) VALUES (?, '', '[]', '[]', '[]', '')
    ON CONFLICT(software_id) DO NOTHING
  `).run(row.id)

  db.prepare(`
    INSERT INTO provenance (software_id, source_url, fetched_at, reviewed_at, published_at)
    VALUES (?, ?, ?, '', '')
    ON CONFLICT(software_id) DO NOTHING
  `).run(row.id, parsed.value.url, now)

  const keywordBlob = [
    name,
    metadata?.description ?? '',
    metadata?.language ?? '',
    license,
    'self-hosted',
  ].join(' ')
  db.prepare(`
    INSERT INTO search_index (software_id, keyword_blob) VALUES (?, ?)
    ON CONFLICT(software_id) DO UPDATE SET keyword_blob = excluded.keyword_blob
  `).run(row.id, keywordBlob.toLowerCase())

  return slug
}

export function transitionSubmission(
  db: AppDatabase,
  id: number,
  action: SubmissionAction,
  actor: string,
  reason = '',
): TransitionResult {
  const submission = getSubmissionById(db, id)
  if (!submission) {
    throw new SubmissionError('not_found', 'Submission not found', 404)
  }

  const target = actionTarget[action]
  if (!allowedTransitions[submission.status].includes(target)) {
    throw new SubmissionError(
      'invalid_transition',
      `Cannot move submission from ${submission.status} to ${target}`,
      409,
    )
  }

  if (action === 'reject' && !reason.trim()) {
    throw new SubmissionError('reason_required', 'A rejection reason is required')
  }

  const now = new Date().toISOString()
  let softwareSlug: string | undefined
  let softwareId = submission.softwareId

  db.exec('BEGIN')
  try {
    if (action === 'accept' && !softwareId) {
      softwareSlug = createDraftSoftware(db, submission)
      const row = db.prepare('SELECT id FROM software WHERE slug = ?').get(softwareSlug) as { id: number }
      softwareId = row.id
    }

    if (action === 'duplicate' && !softwareId) {
      const existing = findSoftwareByRepository(db, submission.normalizedRepository)
      if (!existing) {
        throw new SubmissionError('duplicate_target_missing', 'No existing software matches this repository')
      }
      softwareId = existing.id
      softwareSlug = existing.slug
    }

    const reviewedAt = ['accept', 'reject', 'duplicate'].includes(action) ? now : submission.reviewedAt
    const statusReason = reason.trim() || (action === 'accept' ? '' : submission.statusReason)

    db.prepare(`
      UPDATE submissions SET
        status = ?,
        status_reason = ?,
        software_id = ?,
        reviewed_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(target, statusReason, softwareId, reviewedAt, now, id)

    db.prepare(`
      INSERT INTO submission_events (submission_id, from_status, to_status, actor, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, submission.status, target, actor, statusReason, now)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  const updated = getSubmissionById(db, id)
  if (!updated) {
    throw new SubmissionError('not_found', 'Submission disappeared during update', 404)
  }

  return { submission: updated, softwareSlug }
}

export function publishSoftware(db: AppDatabase, slug: string): { slug: string; status: 'published' } {
  const software = db.prepare('SELECT id, slug, status, license FROM software WHERE slug = ?').get(slug) as
    | { id: number; slug: string; status: string; license: string }
    | undefined

  if (!software) {
    throw new SubmissionError('not_found', 'Software not found', 404)
  }

  const analysis = db
    .prepare('SELECT summary_en FROM analyses WHERE software_id = ?')
    .get(software.id) as { summary_en: string } | undefined
  const categoryCount = db
    .prepare('SELECT COUNT(*) AS count FROM software_categories WHERE software_id = ?')
    .get(software.id) as { count: number }
  const licenseRow = db
    .prepare('SELECT is_osi_approved FROM licenses WHERE spdx_id = ?')
    .get(software.license) as { is_osi_approved: number } | undefined

  if (!analysis || !analysis.summary_en.trim()) {
    throw new SubmissionError('publish_blocked', 'An English summary is required before publishing')
  }
  if (!software.license || !licenseRow || !licenseRow.is_osi_approved) {
    throw new SubmissionError('publish_blocked', 'A verified OSI-approved license is required before publishing')
  }
  if (categoryCount.count < 1) {
    throw new SubmissionError('publish_blocked', 'At least one category is required before publishing')
  }

  const now = new Date().toISOString()
  const linked = db.prepare('SELECT id, status FROM submissions WHERE software_id = ?').all(software.id) as Array<{
    id: number
    status: SubmissionStatus
  }>

  db.exec('BEGIN')
  try {
    db.prepare("UPDATE software SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(software.id)
    db.prepare("UPDATE software_translations SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE software_id = ?").run(
      software.id,
    )
    db.prepare(
      "UPDATE software_analysis_translations SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE software_id = ?",
    ).run(software.id)
    db.prepare(`
      UPDATE provenance SET
        reviewed_at = CASE WHEN reviewed_at = '' THEN ? ELSE reviewed_at END,
        published_at = ?
      WHERE software_id = ?
    `).run(now, now, software.id)

    for (const submission of linked) {
      if (submission.status === 'rejected' || submission.status === 'published') {
        continue
      }
      db.prepare(`
        UPDATE submissions SET status = 'published', status_reason = '', reviewed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now, now, submission.id)
      db.prepare(`
        INSERT INTO submission_events (submission_id, from_status, to_status, actor, reason, created_at)
        VALUES (?, ?, 'published', 'admin', '', ?)
      `).run(submission.id, submission.status, now)
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { slug, status: 'published' }
}
