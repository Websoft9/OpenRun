import type { NormalizedRepository } from './security.js'

export type GithubMetadata = {
  name: string
  fullName: string
  homepage: string
  licenseSpdx: string | null
  language: string | null
  stars: number
  pushedAt: string | null
  defaultBranch: string | null
  htmlUrl: string
  archived: boolean
  description: string | null
}

export type GithubEnrichmentError = 'not_found' | 'rate_limited' | 'unavailable'

export type GithubEnrichmentResult =
  | { ok: true; metadata: GithubMetadata }
  | { ok: false; error: GithubEnrichmentError }

type GithubRepositoryResponse = {
  name?: unknown
  full_name?: unknown
  homepage?: unknown
  license?: { spdx_id?: unknown } | null
  language?: unknown
  stargazers_count?: unknown
  pushed_at?: unknown
  default_branch?: unknown
  html_url?: unknown
  archived?: unknown
  description?: unknown
}

export async function fetchGithubMetadata(repository: NormalizedRepository): Promise<GithubEnrichmentResult | null> {
  if (repository.host !== 'github.com' || !repository.owner || !repository.repository) {
    return null
  }

  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'OpenRun-Catalog-Submission',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`,
      {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      },
    )
  } catch {
    return { ok: false, error: 'unavailable' }
  }

  if (response.status === 404) {
    return { ok: false, error: 'not_found' }
  }

  const remaining = response.headers.get('x-ratelimit-remaining')
  if (response.status === 403 || response.status === 429 || remaining === '0') {
    return { ok: false, error: 'rate_limited' }
  }

  if (!response.ok) {
    return { ok: false, error: 'unavailable' }
  }

  let payload: GithubRepositoryResponse
  try {
    payload = (await response.json()) as GithubRepositoryResponse
  } catch {
    return { ok: false, error: 'unavailable' }
  }

  const licenseSpdx =
    payload.license && typeof payload.license.spdx_id === 'string' ? payload.license.spdx_id : null
  const stars = typeof payload.stargazers_count === 'number' ? payload.stargazers_count : 0

  return {
    ok: true,
    metadata: {
      name: typeof payload.name === 'string' ? payload.name : repository.repository,
      fullName: typeof payload.full_name === 'string' ? payload.full_name : `${repository.owner}/${repository.repository}`,
      homepage: typeof payload.homepage === 'string' ? payload.homepage : '',
      licenseSpdx,
      language: typeof payload.language === 'string' ? payload.language : null,
      stars,
      pushedAt: typeof payload.pushed_at === 'string' ? payload.pushed_at : null,
      defaultBranch: typeof payload.default_branch === 'string' ? payload.default_branch : null,
      htmlUrl: typeof payload.html_url === 'string' ? payload.html_url : repository.url,
      archived: payload.archived === true,
      description: typeof payload.description === 'string' ? payload.description : null,
    },
  }
}
