import type { AppDatabase } from '../db/database.js'
import type { Locale } from '../i18n/index.js'

export type ProcessSummary = {
  code: string
  parentCode: string | null
  level: number
  name: string
  nameZh: string
  position: number
  childCount: number
}

export type ProcessNode = ProcessSummary & {
  children: ProcessNode[]
}

export type ProcessSoftware = {
  slug: string
  name: string
  fitLevel: 'core' | 'partial' | 'adjacent'
  confidence: number
  evidenceUrl: string
}

export type ProcessDetail = {
  process: ProcessNode
  software: ProcessSoftware[]
}

type ProcessRow = {
  code: string
  parent_code: string | null
  level: number
  name: string
  name_zh: string
  position: number
}

function mapRow(row: ProcessRow, locale: Locale): ProcessSummary {
  return {
    code: row.code,
    parentCode: row.parent_code,
    level: row.level,
    name: locale === 'zh' && row.name_zh ? row.name_zh : row.name,
    nameZh: row.name_zh,
    position: row.position,
    childCount: 0,
  }
}

export function listProcesses(
  db: AppDatabase,
  locale: Locale,
  filters: { level?: number; parent?: string; q?: string; limit?: number } = {},
): ProcessSummary[] {
  const conditions: string[] = []
  const params: Array<string | number> = []

  if (filters.level !== undefined) {
    conditions.push('pn.level = ?')
    params.push(filters.level)
  }
  if (filters.parent) {
    conditions.push('pn.parent_code = ?')
    params.push(filters.parent)
  }
  if (filters.q) {
    conditions.push('(lower(pn.code) LIKE ? OR lower(pn.name) LIKE ? OR lower(pn.name_zh) LIKE ?)')
    const query = `%${filters.q.toLowerCase()}%`
    params.push(query, query, query)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 500

  const rows = db
    .prepare(`
      SELECT
        pn.code, pn.parent_code, pn.level, pn.name, pn.name_zh, pn.position,
        (SELECT COUNT(*) FROM process_nodes child WHERE child.parent_code = pn.code) AS child_count
      FROM process_nodes pn
      ${where}
      ORDER BY pn.level, pn.position, pn.code
      LIMIT ?
    `)
    .all(...params, limit) as Array<ProcessRow & { child_count: number }>

  return rows.map((row) => ({ ...mapRow(row, locale), childCount: row.child_count }))
}

function loadAllNodes(db: AppDatabase, locale: Locale): ProcessSummary[] {
  const rows = db
    .prepare(`
      SELECT
        pn.code, pn.parent_code, pn.level, pn.name, pn.name_zh, pn.position,
        (SELECT COUNT(*) FROM process_nodes child WHERE child.parent_code = pn.code) AS child_count
      FROM process_nodes pn
      ORDER BY pn.level, pn.position, pn.code
    `)
    .all() as Array<ProcessRow & { child_count: number }>
  return rows.map((row) => ({ ...mapRow(row, locale), childCount: row.child_count }))
}

function buildNode(code: string, byParent: Map<string | null, ProcessSummary[]>): ProcessNode | null {
  const row = byParent.get('__all__')?.find((node) => node.code === code)
  if (!row) {
    return null
  }
  const children = (byParent.get(code) ?? []).map((child) => buildNode(child.code, byParent)).filter((node): node is ProcessNode => Boolean(node))
  return { ...row, children }
}

export function getProcessByCode(db: AppDatabase, code: string, locale: Locale): ProcessDetail | null {
  const all = loadAllNodes(db, locale)
  const byParent = new Map<string | null, ProcessSummary[]>()
  byParent.set('__all__', all)
  for (const node of all) {
    const list = byParent.get(node.parentCode) ?? []
    list.push(node)
    byParent.set(node.parentCode, list)
  }

  const process = buildNode(code, byParent)
  if (!process) {
    return null
  }

  return { process, software: listProcessSoftware(db, code, locale) }
}

export function listProcessSoftware(db: AppDatabase, code: string, locale: Locale): ProcessSoftware[] {
  const rows = db
    .prepare(`
      SELECT
        s.slug,
        COALESCE(NULLIF(st.name, ''), s.name) AS name,
        sp.fit_level,
        sp.confidence,
        sp.evidence_url
      FROM software_processes sp
      JOIN software s ON s.id = sp.software_id AND s.status = 'published'
      LEFT JOIN software_translations st
        ON st.software_id = s.id AND st.locale = ? AND st.status = 'published'
      WHERE sp.process_code = ? AND sp.review_status = 'published'
      ORDER BY sp.fit_level, sp.confidence DESC, name
    `)
    .all(locale, code) as Array<{
    slug: string
    name: string
    fit_level: 'core' | 'partial' | 'adjacent'
    confidence: number
    evidence_url: string
  }>

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    fitLevel: row.fit_level,
    confidence: row.confidence,
    evidenceUrl: row.evidence_url,
  }))
}

export function getProcessStats(db: AppDatabase): { total: number; l1: number; l2: number; l3: number } {
  const rows = db.prepare('SELECT level, COUNT(*) AS count FROM process_nodes GROUP BY level').all() as Array<{
    level: number
    count: number
  }>
  const counts = new Map(rows.map((row) => [row.level, row.count]))
  return {
    total: rows.reduce((sum, row) => sum + row.count, 0),
    l1: counts.get(1) ?? 0,
    l2: counts.get(2) ?? 0,
    l3: counts.get(3) ?? 0,
  }
}
