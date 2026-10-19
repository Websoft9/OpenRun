import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { getContentfulSeedDir } from './database.js'
import type { ContentfulDataset, ContentfulEntry } from '../repositories/contentful-import.js'

type SeedManifest = {
  spaceId: string
  environment: string
  exportedAt: string
  contentTypes: Record<string, number>
}

type SeedEntry = {
  id: string
  type?: string
  contentType?: string
  createdAt?: string
  updatedAt?: string
  publishedAt?: string
  firstPublishedAt?: string
  fields: Record<string, Record<string, unknown>>
}

export function loadContentfulSeed(dir = getContentfulSeedDir()): ContentfulDataset {
  const manifestPath = path.join(dir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Contentful seed snapshot not found at ${manifestPath}. Expected a version directory such as seed/contentful/2026-10-19.`,
    )
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as SeedManifest
  const entriesByType = new Map<string, ContentfulEntry[]>()
  const entriesById = new Map<string, ContentfulEntry>()

  for (const contentType of Object.keys(manifest.contentTypes)) {
    const filePath = path.join(dir, `${contentType}.json`)
    if (!existsSync(filePath)) {
      continue
    }
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as SeedEntry[]
    const entries: ContentfulEntry[] = raw.map((item) => ({
      sys: {
        id: item.id,
        type: item.type ?? 'Entry',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        publishedAt: item.publishedAt,
        firstPublishedAt: item.firstPublishedAt,
        contentType: { sys: { id: item.contentType ?? contentType } },
      },
      fields: item.fields,
    }))
    entriesByType.set(contentType, entries)
    for (const entry of entries) {
      entriesById.set(entry.sys.id, entry)
    }
  }

  return {
    spaceId: manifest.spaceId,
    environment: manifest.environment,
    entriesByType,
    entriesById,
  }
}
