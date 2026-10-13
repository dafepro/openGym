import { describe, it, expect, vi } from 'vitest'
import { googleDriveProvider, DRIVE_SCOPE, validClientId } from './google-drive.js'

const state = { unit: 'kg', workouts: [{ id: 'w', entries: [] }], routines: [] }
const envelope = { format: 'opengym-sync', version: 1, state }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const make = fetcher => googleDriveProvider({ token: 'test-token', expiresAt: Date.now() + 3600000, fetcher })

describe('private Drive snapshot provider', () => {
  it('paginates all app-data snapshots, omits cookies and never forwards openGym headers', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ files: [{ id: 'one', size: '20' }], nextPageToken: 'page2' }))
      .mockResolvedValueOnce(json({ files: [{ id: 'two' }] })).mockResolvedValueOnce(json(envelope)).mockResolvedValueOnce(json(envelope))
    expect((await make(fetcher).read()).map(s => s.id)).toEqual(['one', 'two'])
    const first = new URL(fetcher.mock.calls[0][0])
    expect(first.searchParams.get('spaces')).toBe('appDataFolder')
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('pageToken')).toBe('page2')
    for (const [url, opts] of fetcher.mock.calls) {
      expect(new URL(url).origin).toBe('https://www.googleapis.com')
      expect(opts.credentials).toBe('omit'); expect(opts.redirect).toBe('error')
      expect(opts.headers).toEqual({ Authorization: 'Bearer test-token' })
    }
  })
  it('creates an immutable snapshot, removes device-only state and verifies the readback', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ id: 'created' })).mockResolvedValueOnce(json(envelope))
    await make(fetcher).append({ ...state, active: { private: true }, _wid: 'private' })
    const [url, opts] = fetcher.mock.calls[0]
    expect(url).toContain('upload/drive/v3/files?uploadType=multipart')
    expect(opts.method).toBe('POST')
    expect(opts.body).toContain('"parents":["appDataFolder"]')
    expect(opts.body).not.toContain('"active"'); expect(opts.body).not.toContain('_wid')
    expect(fetcher.mock.calls[1][0]).toContain('/created?alt=media')
  })
  it('refuses malformed, future-format, incomplete and corrupted snapshots', async () => {
    for (const value of [{ ...envelope, version: 2 }, { ...envelope, state: { ...state, workouts: null } }, {}]) {
      const p = make(vi.fn().mockResolvedValueOnce(json({ files: [{ id: 'bad' }] })).mockResolvedValueOnce(json(value)))
      await expect(p.read()).rejects.toMatchObject({ code: 'google-data' })
    }
    await expect(make(vi.fn().mockResolvedValue(json({ files: [], incompleteSearch: true }))).read()).rejects.toMatchObject({ code: 'google-data' })
    await expect(make(vi.fn().mockResolvedValueOnce(json({ id: 'new' })).mockResolvedValueOnce(json({ ...envelope, state: { ...state, workouts: [] } }))).append(state)).rejects.toMatchObject({ code: 'google-data' })
  })
  it('surfaces revoked and expired access without sending expired tokens', async () => {
    await expect(make(vi.fn().mockResolvedValue(json({}, 401))).read()).rejects.toMatchObject({ code: 'google-auth' })
    const fetcher = vi.fn()
    await expect(googleDriveProvider({ token: 'secret', expiresAt: 1, fetcher }).read()).rejects.toMatchObject({ code: 'google-auth' })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('bounds downloads and refuses redirects or non-JSON answers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Length': String(6 * 1024 * 1024) } }))
    await expect(make(fetcher).read()).rejects.toMatchObject({ code: 'google-size' })
    await expect(make(vi.fn().mockResolvedValue(new Response('<html>'))).read()).rejects.toMatchObject({ code: 'google-data' })
    await expect(make(vi.fn().mockRejectedValue(new TypeError('redirect'))).read()).rejects.toMatchObject({ code: 'google-network' })
  })
  it('compacts only named ancestors and tolerates another device removing them first', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(new Response(null, { status: 204 }))
    await make(fetcher).compact(['old/one', 'old-two'])
    expect(fetcher.mock.calls.map(([u]) => u)).toEqual(['https://www.googleapis.com/drive/v3/files/old%2Fone', 'https://www.googleapis.com/drive/v3/files/old-two'])
    expect(fetcher.mock.calls.every(([, o]) => o.method === 'DELETE')).toBe(true)
  })
  it('uses the narrow app-data scope and validates public OAuth client IDs', () => {
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.appdata')
    expect(validClientId('123-example.apps.googleusercontent.com')).toBe(true)
    expect(validClientId('https://attacker.example')).toBe(false)
  })
})
