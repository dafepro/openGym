import { afterEach, expect, it, vi } from 'vitest'
import { fetchNativeRelease } from './release-channel.js'

afterEach(() => vi.unstubAllGlobals())
const serve = (releases, status = 200) => {
  const request = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => releases
  })
  vi.stubGlobal('fetch', request)
  return request
}

it('checks only the Uplift fork, ignoring Worker bundles, drafts and betas', async () => {
  const native = { tag_name: 'v2.0.0+build.1', assets: [] }
  const request = serve([
    { tag_name: 'uplift-fb8a6478' },
    { tag_name: 'v99.0.0', draft: true },
    { tag_name: 'v98.0.0', prerelease: true },
    { tag_name: 'nightly' },
    native,
    { tag_name: 'v1.0.0', assets: [] }
  ])
  expect(await fetchNativeRelease()).toBe(native)
  expect(request).toHaveBeenCalledWith('https://api.github.com/repos/dafepro/openGym/releases?per_page=30', {
    headers: { Accept: 'application/vnd.github+json' }
  })
})

it('offers no native release when only Worker artifacts have been published', async () => {
  serve([{ tag_name: 'uplift-deadbeef', assets: [{ name: 'worker.tar.gz' }] }])
  expect(await fetchNativeRelease()).toBeNull()
})

it('handles a fork with no releases', async () => {
  serve([], 404)
  expect(await fetchNativeRelease()).toBeNull()
  serve([])
  expect(await fetchNativeRelease()).toBeNull()
})

it('rejects malformed responses and reports network/API failures', async () => {
  serve({ tag_name: 'v99.0.0' })
  await expect(fetchNativeRelease()).rejects.toThrow('Invalid GitHub releases response')
  serve(null, 500)
  await expect(fetchNativeRelease()).rejects.toThrow('GitHub API 500')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  await expect(fetchNativeRelease()).rejects.toThrow('offline')
})
