import { describe, expect, it, vi } from 'vitest'
import { fetchFamilySession, loginFamily, logoutFamily } from './family-access.js'

describe('family access transport', () => {
  it('sends the key only in a same-origin JSON mutation body', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ authenticated: true }) })
    await loginFamily('synthetic-test-key', fetcher)
    const [path, options] = fetcher.mock.calls[0]
    expect(path).toBe('/api/auth/login')
    expect(path).not.toContain('synthetic-test-key')
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('same-origin')
    expect(JSON.parse(options.body)).toEqual({ accessKey: 'synthetic-test-key' })
    expect(options.headers['Content-Type']).toBe('application/json')
  })
  it('rejects malformed successful access responses', async () => {
    await expect(fetchFamilySession(async () => ({ ok: true, json: async () => ({ authenticated: 'yes' }) }))).rejects.toThrow('unsupported access response')
  })
  it('does not expose server error bodies or secrets in failure copy', async () => {
    await expect(loginFamily('synthetic-test-key', async () => ({ ok: false, status: 401, json: async () => ({ error: 'private-debug-value' }) }))).rejects.toThrow('Family access is required')
  })
  it('uses an explicit logout mutation instead of a credential-bearing navigation', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ authenticated: false }) })
    await logoutFamily(fetcher)
    expect(fetcher.mock.calls[0][0]).toBe('/api/auth/logout')
    expect(fetcher.mock.calls[0][1].method).toBe('POST')
  })
})
