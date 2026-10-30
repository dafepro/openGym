import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, copyFile, writeFile, readFile, rm, stat, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syntheticCatalog } from '../fixtures/catalog.js'
import { prepareCatalog } from './prepare-catalog.mjs'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'training-content-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const input = join(root, 'private.json')
  const clip = join(root, 'original.mp4')
  await copyFile(new URL('../fixtures/media/playback-test.mp4', import.meta.url), clip)
  const data = { catalog: structuredClone(syntheticCatalog), media: [{ id: 'sample-playback', file: clip, permission: { status: 'approved', reference: 'PRIVATE-PROVENANCE-SENTINEL' } }] }
  const save = () => writeFile(input, JSON.stringify(data))
  await save()
  return { root, input, output: join(root, 'prepared'), data, save }
}
test('stages exact hashed media and private catalog; excludes permission evidence from child envelope', async t => {
  const f = await fixture(t)
  const result = await prepareCatalog(f.input, f.output)
  const bytes = await readFile(join(f.output, 'catalogs', `${result.revision}.json`))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), result.sha256)
  assert.equal(bytes.toString().includes('PRIVATE-PROVENANCE-SENTINEL'), false)
  const envelope = JSON.parse(bytes)
  const media = await readFile(join(f.output, 'media', 'sample-playback'))
  assert.equal(createHash('sha256').update(media).digest('hex'), envelope.media[0].sha256)
  assert.equal(media.length, envelope.media[0].byteLength)
  assert.equal((await stat(f.output)).mode & 0o777, 0o700)
  await assert.rejects(prepareCatalog(f.input, f.output), { code: 'EEXIST' })
})
test('refuses missing approval or absent inventory without creating output', async t => {
  const f = await fixture(t)
  f.data.media[0].permission.status = 'pending'; await f.save()
  await assert.rejects(prepareCatalog(f.input, f.output), /recorded permission/)
  await assert.rejects(stat(f.output), { code: 'ENOENT' })
  f.data.media = []; await f.save()
  await assert.rejects(prepareCatalog(f.input, f.output), /each approved/)
})
test('rejects private metadata in child catalog and private staging in Git checkouts', async t => {
  const f = await fixture(t)
  f.data.catalog.sourceUrl = 'https://example.invalid/private'; await f.save()
  await assert.rejects(prepareCatalog(f.input, f.output), /child-safe/)
  delete f.data.catalog.sourceUrl; await f.save()
  const checkout = join(f.root, 'checkout'); await mkdir(checkout); await mkdir(join(checkout, '.git'))
  await assert.rejects(prepareCatalog(f.input, join(checkout, 'prepared')), /outside Git/)
})
