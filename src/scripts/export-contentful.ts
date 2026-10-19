import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fetchContentfulDataset, type ContentfulEntry } from '../repositories/contentful-import.js'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

function compactEntry(entry: ContentfulEntry): Record<string, unknown> {
  return {
    id: entry.sys.id,
    type: entry.sys.type || 'Entry',
    contentType: entry.sys.contentType?.sys?.id ?? '',
    createdAt: entry.sys.createdAt ?? '',
    updatedAt: entry.sys.updatedAt ?? '',
    publishedAt: entry.sys.publishedAt ?? '',
    firstPublishedAt: entry.sys.firstPublishedAt ?? '',
    fields: entry.fields,
  }
}

const token = requiredEnv('CONTENTFUL_ACCESS_TOKEN')
const spaceId = process.env.CONTENTFUL_SPACE_ID || 'ffrhttfighww'
const environment = process.env.CONTENTFUL_ENVIRONMENT || 'master'
const outputDir = path.resolve(
  process.argv[2] || path.join('seed/contentful', new Date().toISOString().slice(0, 10)),
)

console.log(`Fetching Contentful space ${spaceId}/${environment}...`)
const dataset = await fetchContentfulDataset({ token, spaceId, environment })

mkdirSync(outputDir, { recursive: true })
const manifest = {
  spaceId,
  environment,
  exportedAt: new Date().toISOString(),
  contentTypes: {} as Record<string, number>,
}

for (const [contentType, entries] of dataset.entriesByType) {
  const compact = entries.map(compactEntry)
  writeFileSync(path.join(outputDir, `${contentType}.json`), `${JSON.stringify(compact, null, 2)}\n`)
  manifest.contentTypes[contentType] = compact.length
  console.log(`${contentType}: ${compact.length}`)
}

writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote Contentful seed snapshot to ${outputDir}`)
