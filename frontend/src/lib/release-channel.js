// Uplift publishes Worker bundles and (when available) native apps in the same repository.
// Keep channel selection separate from openGym's native download/install implementation.
import { FORK_REPOSITORY } from './brand.js'

export async function fetchNativeRelease() {
  const url = `https://api.github.com/repos/${FORK_REPOSITORY}/releases?per_page=30`
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const releases = await res.json()
  if (!Array.isArray(releases)) throw new Error('Invalid GitHub releases response')
  return (
    releases.find((r) => r && !r.draft && !r.prerelease && /^v?\d+\.\d+\.\d+(?:\+[^ ]+)?$/.test(r.tag_name)) || null
  )
}
