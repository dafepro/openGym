import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { assertPrivatePreviewMode, loadPrivatePreview, privatePreviewMiddleware } from './private-preview.mjs'

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'training-preview-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(join(directory, 'media'))
  const catalog = { schemaVersion: 1, revision: 'preview-test-v1', currentAssignmentId: 'preview-test', assignments: [{ id: 'preview-test', revision: 'v1', status: 'current', title: 'Local review test', drills: [{ id: 'test-drill', title: 'Review test', instructions: 'Test data only', mode: 'watch', sets: 1, side: 'both', restSec: null, media: { id: 'fixture-video', status: 'approved', path: '/media/fixture-video' } }] }] }
  const manifest = { schemaVersion: 1, catalogFile: 'catalog.json', media: [{ id: 'fixture-video', file: 'media/clip.mp4' }] }
  const path = join(directory, 'bundle.json')
  writeFileSync(join(directory, 'catalog.json'), JSON.stringify(catalog))
  writeFileSync(join(directory, 'media/clip.mp4'), Buffer.from('0123456789abcdef'))
  writeFileSync(path, JSON.stringify(manifest))
  return { directory, path, manifest, catalog }
}
async function serverFor(t, bundle) {
  const middleware = privatePreviewMiddleware(bundle)
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end() }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }))
  return `http://127.0.0.1:${server.address().port}`
}

test('private preview refuses build/static-preview/demo combinations before reading any bundle', () => {
  assert.throws(() => assertPrivatePreviewMode({ bundlePath: '/unused/private.json', command: 'build' }), /development-only/)
  assert.throws(() => assertPrivatePreviewMode({ bundlePath: '/unused/private.json', command: 'serve', isPreview: true }), /development-only/)
  assert.throws(() => assertPrivatePreviewMode({ bundlePath: '/unused/private.json', command: 'serve', demo: true }), /either/)
  assert.doesNotThrow(() => assertPrivatePreviewMode({ bundlePath: '/unused/private.json', command: 'serve' }))
})

test('catalog is fetched at runtime with no local paths and media is served by exact approved identity', async t => {
  const data = fixture(t)
  const url = await serverFor(t, loadPrivatePreview(data.path))
  const catalog = await fetch(`${url}/__training-preview/catalog`)
  assert.equal(catalog.status, 200)
  assert.equal(catalog.headers.get('cache-control'), 'no-store')
  const text = await catalog.text()
  assert.deepEqual(JSON.parse(text), data.catalog)
  assert.ok(!text.includes(data.directory))
  assert.ok(!text.includes('clip.mp4'))
  const media = await fetch(`${url}/media/fixture-video`)
  assert.equal(media.headers.get('content-type'), 'video/mp4')
  assert.equal(await media.text(), '0123456789abcdef')
  assert.equal((await fetch(`${url}/media/unknown`)).status, 404)
  assert.equal((await fetch(`${url}/api/auth/session`)).status, 404)
})

test('streaming supports GET/HEAD, bounded, suffix and open-ended ranges without exposing arbitrary files', async t => {
  const data = fixture(t)
  const url = await serverFor(t, loadPrivatePreview(data.path))
  for (const [range, expected, contentRange] of [['bytes=2-4', '234', 'bytes 2-4/16'], ['bytes=-3', 'def', 'bytes 13-15/16'], ['bytes=12-', 'cdef', 'bytes 12-15/16']]) {
    const response = await fetch(`${url}/media/fixture-video`, { headers: { Range: range } })
    assert.equal(response.status, 206)
    assert.equal(response.headers.get('content-range'), contentRange)
    assert.equal(await response.text(), expected)
  }
  const head = await fetch(`${url}/media/fixture-video`, { method: 'HEAD', headers: { Range: 'bytes=2-4' } })
  assert.equal(head.status, 206)
  assert.equal(head.headers.get('content-length'), '3')
  assert.equal(await head.text(), '')
  for (const range of ['bytes=20-', 'bytes=8-2', 'bytes=-0', 'bytes=0-1,4-5', 'garbage']) {
    const response = await fetch(`${url}/media/fixture-video`, { headers: { Range: range } })
    assert.equal(response.status, 416)
    assert.equal(response.headers.get('content-range'), 'bytes */16')
  }
  assert.equal((await fetch(`${url}/media/fixture-video`, { method: 'POST' })).status, 405)
  assert.equal((await fetch(`${url}/media/%2e%2e%2fprivate`)).status, 404)
})

test('private routes deny non-local Host, foreign Origin and cross-site embedding', async t => {
  const data = fixture(t)
  const url = await serverFor(t, loadPrivatePreview(data.path))
  for (const headers of [{ Host: 'example.com' }, { Origin: 'https://example.com' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const response = await new Promise((resolve, reject) => {
      const outgoing = request(`${url}/__training-preview/catalog`, { headers }, incoming => {
        let text = ''; incoming.on('data', bytes => { text += bytes }); incoming.on('end', () => resolve({ status: incoming.statusCode, text }))
      }); outgoing.on('error', reject); outgoing.end()
    })
    assert.equal(response.status, 403)
    assert.equal(response.text, '')
  }
})

test('bundle validation rejects Git directories, unapproved files, missing media and symlink escapes', t => {
  const data = fixture(t)
  assert.throws(() => loadPrivatePreview('relative.json'), /absolute/)
  const extra = { ...data.manifest, media: [...data.manifest.media, { id: 'unapproved', file: 'media/clip.mp4' }] }
  writeFileSync(data.path, JSON.stringify(extra))
  assert.throws(() => loadPrivatePreview(data.path), /approved catalog identities/)
  writeFileSync(data.path, JSON.stringify({ ...data.manifest, media: [] }))
  assert.throws(() => loadPrivatePreview(data.path), /missing/)
  const outside = mkdtempSync(join(tmpdir(), 'training-outside-test-'))
  t.after(() => rmSync(outside, { recursive: true, force: true }))
  writeFileSync(join(outside, 'outside.mp4'), 'private bytes')
  symlinkSync(join(outside, 'outside.mp4'), join(data.directory, 'media/escape.mp4'))
  writeFileSync(data.path, JSON.stringify({ ...data.manifest, media: [{ id: 'fixture-video', file: 'media/escape.mp4' }] }))
  assert.throws(() => loadPrivatePreview(data.path), /escapes/)
  writeFileSync(data.path, JSON.stringify(data.manifest))
  mkdirSync(join(data.directory, '.git'))
  assert.throws(() => loadPrivatePreview(data.path), /outside Git/)
})

test('validation errors do not print private filesystem paths or catalog contents', t => {
  const data = fixture(t)
  writeFileSync(join(data.directory, 'catalog.json'), '{private content')
  assert.throws(() => loadPrivatePreview(data.path), error => !error.message.includes(data.directory) && !error.message.includes('private content'))
})
