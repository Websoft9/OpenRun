import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const fallbackSalt = randomBytes(16).toString('hex')

export function hashIp(ip: string): string {
  const salt = process.env.SUBMISSION_IP_SALT || fallbackSalt
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '0.0.0.0') {
    return true
  }
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return true
  }
  return isPrivateIpv4(host)
}

export type NormalizedRepository = {
  url: string
  normalized: string
  host: string
  path: string
  owner: string | null
  repository: string | null
}

export type RepositoryParseError =
  | 'invalid_repository'
  | 'unsupported_protocol'
  | 'private_host'
  | 'invalid_repository_path'

export function normalizeRepositoryUrl(
  raw: string,
): { ok: true; value: NormalizedRepository } | { ok: false; error: RepositoryParseError } {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: 'invalid_repository' }
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { ok: false, error: 'invalid_repository' }
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'unsupported_protocol' }
  }

  if (url.username || url.password) {
    return { ok: false, error: 'invalid_repository' }
  }

  const host = url.hostname.toLowerCase()
  if (isPrivateHostname(host)) {
    return { ok: false, error: 'private_host' }
  }

  if (url.port && url.port !== '443') {
    return { ok: false, error: 'invalid_repository' }
  }

  const segments = url.pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length < 2) {
    return { ok: false, error: 'invalid_repository_path' }
  }

  const cleanedSegments = [...segments]
  const last = cleanedSegments[cleanedSegments.length - 1]
  cleanedSegments[cleanedSegments.length - 1] = last.replace(/\.git$/i, '')
  if (!cleanedSegments[cleanedSegments.length - 1]) {
    return { ok: false, error: 'invalid_repository_path' }
  }

  const path = `/${cleanedSegments.join('/')}`
  const urlValue = `https://${host}${path}`
  const isGithub = host === 'github.com' || host === 'www.github.com'
  const normalized = isGithub ? `https://github.com${path.toLowerCase()}` : `${urlValue}`

  if (isGithub) {
    const [owner, repository] = cleanedSegments
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository)) {
      return { ok: false, error: 'invalid_repository' }
    }
    return {
      ok: true,
      value: {
        url: urlValue,
        normalized,
        host: 'github.com',
        path: `/${owner}/${repository}`,
        owner,
        repository,
      },
    }
  }

  return {
    ok: true,
    value: {
      url: urlValue,
      normalized,
      host,
      path,
      owner: cleanedSegments.length >= 2 ? cleanedSegments[cleanedSegments.length - 2] : null,
      repository: cleanedSegments[cleanedSegments.length - 1],
    },
  }
}
