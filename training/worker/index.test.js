import { describe, expect, it } from 'vitest'
import worker, { handleRequest } from './index.js'
import { COOKIE } from './auth.js'
import { digest } from './http.js'

const ORIGIN = 'https://train.quicktrack.cc'
const NOW = 1800000000000
const ACCESS = 'A'.repeat(43) // Synthetic test-only access key, never an operational credential.
const encoder = new TextEncoder()

class MemoryBucket {
  records = new Map()
  gets = []
  heads = []
  async put(key, value, contentType = 'application/json') {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value
    const hash = await digest(bytes)
    this.records.set(key, { bytes, size: bytes.length, etag: hash, httpEtag: `"${hash}"`,
      httpMetadata: { contentType }, customMetadata: { sha256: hash } })
    return hash
  }
  async head(key) { this.heads.push(key); return this.records.get(key) || null }
  async get(key, options = {}) {
    this.gets.push({ key, options })
    const record = this.records.get(key)
    if (!record) return null
    if (options.onlyIf?.etagMatches && options.onlyIf.etagMatches !== record.etag) return { ...record }
    const range = options.range
    const bytes = range ? record.bytes.slice(range.offset, range.offset + range.length) : record.bytes
    return { ...record, body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } }) }
  }
}

function request(path, { method = 'GET', cookie, body, headers = {}, origin = ORIGIN } = {}) {
  return new Request(ORIGIN + path, { method, headers: {
    ...(cookie ? { Cookie: cookie } : {}), ...(method === 'POST' ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...headers
  }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) })
}

async function setup() {
  const bucket = new MemoryBucket()
  const video = encoder.encode('0123456789')
  const sha256 = await bucket.put('media/synthetic-video-v1', video, 'video/mp4')
  const catalog = { schemaVersion: 1, revision: 'synthetic-catalog-v1', currentAssignmentId: 'synthetic-assignment',
    currentAssignmentRevision: 'v1', assignments: [{ id: 'synthetic-assignment', revision: 'v1', title: 'Synthetic assignment', status: 'current',
      assignedOn: '2026-10-30', drills: [{ id: 'synthetic-drill', title: 'Synthetic drill', instructions: 'Synthetic instructions only.',
        mode: 'time', durationSec: 10, sets: 1, side: 'both', restSec: 0,
        media: { id: 'synthetic-video-v1', status: 'approved', path: '/media/synthetic-video-v1' } }] }] }
  const envelope = { schemaVersion: 1, revision: catalog.revision, catalog,
    media: [{ id: 'synthetic-video-v1', sha256, byteLength: video.length, contentType: 'video/mp4' }] }
  const env = { APP_ORIGIN: ORIGIN, SESSION_TTL_SECONDS: '900', SESSION_EPOCH: 'synthetic-epoch-v1',
    SESSION_SIGNING_KEY: 'b'.repeat(64), FAMILY_ACCESS_SHA256: await digest(ACCESS),
    LOGIN_LIMIT: { limit: async () => ({ success: true }) }, TRAINING_CONTENT: bucket,
    CATALOG_REVISION: catalog.revision, CATALOG_SHA256: await bucket.put(`catalogs/${catalog.revision}.json`, JSON.stringify(envelope)),
    ASSETS: { fetch: async () => new Response('Synthetic public app shell', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public' } }) } }
  const login = await handleRequest(request('/api/auth/login', { method: 'POST', body: { accessKey: ACCESS } }), env, NOW)
  const cookie = login.headers.get('Set-Cookie').split(';')[0]
  return { env, bucket, catalog, envelope, cookie }
}

describe('family sessions', () => {
  it('issues a secure host cookie, verifies it and rejects a forged signature', async () => {
    const { env } = await setup()
    const response = await handleRequest(request('/api/auth/login', { method: 'POST', body: { accessKey: ACCESS } }), env, NOW)
    const header = response.headers.get('Set-Cookie')
    expect(header).toContain(`${COOKIE}=`)
    expect(header).toContain('Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=900')
    expect(header).not.toContain('Domain=')
    const cookie = header.split(';')[0]
    expect(await (await handleRequest(request('/api/auth/session', { cookie }), env, NOW)).json()).toEqual({ authenticated: true, expiresAt: NOW + 900000 })
    const forged = cookie.slice(0, cookie.indexOf('.') + 1) + 'AAAA'
    expect(await (await handleRequest(request('/api/auth/session', { cookie: forged }), env, NOW)).json()).toEqual({ authenticated: false })
  })

  it('rejects wrong keys, origins, cross-site metadata and non-JSON/oversized input', async () => {
    const { env } = await setup()
    for (const [options, status] of [
      [{ body: { accessKey: 'Z'.repeat(43) } }, 401],
      [{ body: { accessKey: ACCESS }, origin: 'https://other.example' }, 403],
      [{ body: { accessKey: ACCESS }, headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403],
      [{ body: { accessKey: ACCESS }, headers: { 'Content-Type': 'text/plain' } }, 400],
      [{ body: ' '.repeat(600) }, 400]
    ]) expect((await handleRequest(request('/api/auth/login', { method: 'POST', ...options }), env, NOW)).status).toBe(status)
    expect((await handleRequest(new Request(ORIGIN + '/api/auth/logout', { method: 'POST' }), env, NOW)).status).toBe(403)
  })

  it('fails closed if the limiter/config is missing, throws or refuses a login', async () => {
    const { env } = await setup()
    const login = () => request('/api/auth/login', { method: 'POST', body: { accessKey: ACCESS } })
    expect((await handleRequest(login(), { ...env, LOGIN_LIMIT: undefined }, NOW)).status).toBe(503)
    expect((await handleRequest(login(), { ...env, SESSION_SIGNING_KEY: '' }, NOW)).status).toBe(503)
    env.LOGIN_LIMIT.limit = async () => { throw new Error('Synthetic failure') }
    expect((await handleRequest(login(), env, NOW)).status).toBe(503)
    env.LOGIN_LIMIT.limit = async () => ({ success: false })
    const blocked = await handleRequest(login(), env, NOW)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBe('60')
    env.LOGIN_LIMIT.limit = async () => ({})
    expect((await handleRequest(login(), env, NOW)).status).toBe(503)
  })

  it('expires and revokes the whole family through epoch/signing-key changes', async () => {
    const { env, cookie } = await setup()
    expect((await handleRequest(request('/api/catalog', { cookie }), env, NOW + 900000)).status).toBe(401)
    expect((await handleRequest(request('/api/catalog', { cookie }), { ...env, SESSION_EPOCH: 'next-epoch' }, NOW)).status).toBe(401)
    expect((await handleRequest(request('/api/catalog', { cookie }), { ...env, SESSION_SIGNING_KEY: 'c'.repeat(64) }, NOW)).status).toBe(401)
    expect((await handleRequest(request('/api/catalog', { cookie: cookie + '; ' + cookie }), env, NOW)).status).toBe(401)
  })

  it('renews an existing session and clears the browser cookie on same-origin logout', async () => {
    const { env, cookie } = await setup()
    const renewed = await handleRequest(request('/api/auth/renew', { method: 'POST', cookie }), env, NOW + 100000)
    expect(await renewed.json()).toEqual({ authenticated: true, expiresAt: NOW + 1000000 })
    const logout = await handleRequest(request('/api/auth/logout', { method: 'POST', cookie }), env, NOW)
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect(await logout.json()).toEqual({ authenticated: false })
    expect(await (await handleRequest(request('/api/auth/session'), env, NOW)).json()).toEqual({ authenticated: false })
  })

  it('ignores Cloudflare execution-context as the third fetch argument', async () => {
    const { env } = await setup()
    const response = await worker.fetch(request('/api/auth/login', { method: 'POST', body: { accessKey: ACCESS } }), env, { waitUntil() {} })
    expect(response.status).toBe(200)
    expect(Number.isFinite((await response.json()).expiresAt)).toBe(true)
  })
})

describe('private catalog and media boundary', () => {
  it('denies anonymous catalogue, media, HEAD and Range before any R2 read', async () => {
    const { env, bucket } = await setup()
    for (const [path, options] of [['/api/catalog', {}], ['/media/synthetic-video-v1', {}], ['/media/synthetic-video-v1', { method: 'HEAD' }], ['/media/synthetic-video-v1', { headers: { Range: 'bytes=0-1' } }]]) {
      const response = await handleRequest(request(path, options), env, NOW)
      expect(response.status).toBe(401)
      expect(response.headers.get('Cache-Control')).toContain('no-store')
      expect(response.headers.get('Vary')).toBe('Cookie')
    }
    expect(bucket.gets).toHaveLength(0)
    expect(bucket.heads).toHaveLength(0)
  })

  it('projects the child catalog without the private registry or provenance', async () => {
    const { env, bucket, envelope, cookie, catalog } = await setup()
    const expected = structuredClone(catalog)
    envelope.catalog.provenance = 'synthetic-private-metadata'
    envelope.catalog.assignments[0].drills[0].permission = 'synthetic-private-permission'
    env.CATALOG_SHA256 = await bucket.put(`catalogs/${env.CATALOG_REVISION}.json`, JSON.stringify(envelope))
    const response = await handleRequest(request('/api/catalog', { cookie }), env, NOW)
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result).toEqual(expected)
    expect(JSON.stringify(result)).not.toContain('synthetic-private-')
    expect(result.media).toBeUndefined()
  })

  it('fails closed on absent, mismatched or malformed selected manifests', async () => {
    const { env, bucket, envelope, cookie } = await setup()
    expect((await handleRequest(request('/api/catalog', { cookie }), { ...env, CATALOG_SHA256: '0'.repeat(64) }, NOW)).status).toBe(503)
    expect((await handleRequest(request('/api/catalog', { cookie }), { ...env, CATALOG_REVISION: '../other' }, NOW)).status).toBe(503)
    envelope.media = []
    env.CATALOG_SHA256 = await bucket.put(`catalogs/${env.CATALOG_REVISION}.json`, JSON.stringify(envelope))
    expect((await handleRequest(request('/api/catalog', { cookie }), env, NOW)).status).toBe(503)
  })

  it('never allows arbitrary keys, nested paths, query overrides or external URLs', async () => {
    const { env, bucket, cookie } = await setup()
    for (const path of ['/media/unknown', '/media/catalogs%2Fprivate.json', '/media/a/b', '/media/%2e%2e%2fprivate', '/media/synthetic-video-v1?key=other', '/api/proxy?url=https://youtube.com']) {
      expect((await handleRequest(request(path, { cookie }), env, NOW)).status).toBe(404)
    }
    expect(bucket.heads).toHaveLength(0)
    expect(bucket.gets.every(read => read.key === `catalogs/${env.CATALOG_REVISION}.json`)).toBe(true)
  })

  it('requires both registry and approved selected-catalog references', async () => {
    const { env, bucket, envelope, cookie } = await setup()
    envelope.catalog.assignments[0].drills[0].media.status = 'unavailable'
    env.CATALOG_SHA256 = await bucket.put(`catalogs/${env.CATALOG_REVISION}.json`, JSON.stringify(envelope))
    expect((await handleRequest(request('/media/synthetic-video-v1', { cookie }), env, NOW)).status).toBe(404)
    expect(bucket.heads).toHaveLength(0)
  })

  it('streams full and ranged responses with private headers and exact byte counts', async () => {
    const { env, bucket, cookie } = await setup()
    for (const [range, body, contentRange] of [[null, '0123456789', null], ['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=7-', '789', 'bytes 7-9/10'], ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-99', '89', 'bytes 8-9/10']]) {
      const response = await handleRequest(request('/media/synthetic-video-v1', { cookie, headers: range ? { Range: range } : {} }), env, NOW)
      expect(response.status).toBe(range ? 206 : 200)
      expect(response.headers.get('Content-Type')).toBe('video/mp4')
      expect(response.headers.get('Content-Length')).toBe(String(body.length))
      expect(response.headers.get('Content-Range')).toBe(contentRange)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0')
      expect(response.headers.get('Vary')).toBe('Cookie')
      expect(await response.text()).toBe(body)
    }
    expect(bucket.gets.filter(read => read.key.startsWith('media/')).every(read => read.options.onlyIf.etagMatches)).toBe(true)
  })

  it('rejects invalid/multiple/unsatisfiable ranges and gives HEAD no body', async () => {
    const { env, cookie } = await setup()
    for (const range of ['bytes=10-', 'bytes=5-3', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=x-y', 'bytes=-', 'bytes=999999999999999999999-']) {
      const response = await handleRequest(request('/media/synthetic-video-v1', { cookie, headers: { Range: range } }), env, NOW)
      expect(response.status).toBe(416)
      expect(response.headers.get('Content-Range')).toBe('bytes */10')
    }
    const head = await handleRequest(request('/media/synthetic-video-v1', { cookie, method: 'HEAD', headers: { Range: 'bytes=1-2' } }), env, NOW)
    expect(head.status).toBe(200)
    expect(head.headers.get('Content-Length')).toBe('10')
    expect(await head.text()).toBe('')
  })

  it('handles conditionals only after authorization', async () => {
    const { env, cookie, bucket } = await setup()
    const etag = bucket.records.get('media/synthetic-video-v1').httpEtag
    expect((await handleRequest(request('/media/synthetic-video-v1', { headers: { 'If-None-Match': etag } }), env, NOW)).status).toBe(401)
    const cached = await handleRequest(request('/media/synthetic-video-v1', { cookie, headers: { 'If-None-Match': etag } }), env, NOW)
    expect(cached.status).toBe(304)
    const changed = await handleRequest(request('/media/synthetic-video-v1', { cookie, headers: { Range: 'bytes=1-2', 'If-Range': '"old"' } }), env, NOW)
    expect(changed.status).toBe(200)
    expect(await changed.text()).toBe('0123456789')
  })

  it('rejects changed object metadata rather than streaming unverified media', async () => {
    const { env, cookie, bucket } = await setup()
    bucket.records.get('media/synthetic-video-v1').customMetadata.sha256 = '0'.repeat(64)
    expect((await handleRequest(request('/media/synthetic-video-v1', { cookie }), env, NOW)).status).toBe(503)
  })

  it('serves only allowlisted public code shell/assets and no storage operations', async () => {
    const { env, cookie } = await setup()
    const shell = await handleRequest(request('/'), env, NOW)
    expect(shell.status).toBe(200)
    expect(shell.headers.get('Cache-Control')).toContain('no-store')
    expect(shell.headers.get('Content-Security-Policy')).toContain("frame-src 'none'")
    expect((await handleRequest(request('/private/catalog.json'), env, NOW)).status).toBe(404)
    expect((await handleRequest(request('/assets/private.mp4'), env, NOW)).status).toBe(404)
    expect((await handleRequest(request('/media/synthetic-video-v1', { cookie, method: 'POST' }), env, NOW)).status).toBe(405)
    expect((await handleRequest(request('/api/garmin/config', { cookie }), env, NOW)).status).toBe(404)
  })
})
