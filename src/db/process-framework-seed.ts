import { processFrameworkSeed, processNodeSeeds, type ProcessNodeSeed } from '../data/process-framework.js'
import type { AppDatabase } from './database.js'

export type ProcessSeedResult = {
  framework: string
  version: string
  total: number
  l1: number
  l2: number
  l3: number
  removed: number
}

export function seedProcessFramework(
  db: AppDatabase,
  framework = processFrameworkSeed,
  nodes: ProcessNodeSeed[] = processNodeSeeds,
): ProcessSeedResult {
  const upsertFramework = db.prepare(`
    INSERT INTO process_frameworks (id, name, version, license, source)
    VALUES (@id, @name, @version, @license, @source)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      version = excluded.version,
      license = excluded.license,
      source = excluded.source
  `)

  const upsertNode = db.prepare(`
    INSERT INTO process_nodes (
      code, framework_id, parent_code, level, name, name_zh, description,
      position, inputs_json, outputs_json, roles_json, kpis_json, source, license
    ) VALUES (
      @code, @frameworkId, @parentCode, @level, @name, @nameZh, '',
      @position, '[]', '[]', '[]', '[]', @source, @license
    )
    ON CONFLICT(code) DO UPDATE SET
      framework_id = excluded.framework_id,
      parent_code = excluded.parent_code,
      level = excluded.level,
      name = excluded.name,
      name_zh = excluded.name_zh,
      position = excluded.position,
      source = excluded.source,
      license = excluded.license
  `)

  const known = new Set(nodes.map((node) => node.code))
  const sorted = [...nodes].sort((left, right) => left.level - right.level || left.code.localeCompare(right.code))
  let removed = 0

  db.exec('BEGIN')
  try {
    upsertFramework.run(framework)
    for (const node of sorted) {
      upsertNode.run({
        code: node.code,
        frameworkId: framework.id,
        parentCode: node.parentCode,
        level: node.level,
        name: node.name,
        nameZh: node.nameZh,
        position: node.position,
        source: framework.source,
        license: framework.license,
      })
    }

    const existing = db
      .prepare('SELECT code, level FROM process_nodes ORDER BY level DESC')
      .all() as Array<{ code: string; level: number }>
    const remove = db.prepare('DELETE FROM process_nodes WHERE code = ?')
    for (const row of existing) {
      if (!known.has(row.code)) {
        remove.run(row.code)
        removed += 1
      }
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return {
    framework: framework.id,
    version: framework.version,
    total: nodes.length,
    l1: nodes.filter((node) => node.level === 1).length,
    l2: nodes.filter((node) => node.level === 2).length,
    l3: nodes.filter((node) => node.level === 3).length,
    removed,
  }
}
