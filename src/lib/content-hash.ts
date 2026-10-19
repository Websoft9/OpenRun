import { createHash } from 'node:crypto'

export function contentHash(...values: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 16)
}
