import { describe, it, expect, vi } from 'vitest'
import { digest } from './http.js'
import { publicEdition } from '../src/domain/public-practices.js'
const additions = vi.hoisted(() => {
  const entry = digit => {
    const id = `${digit}2345678-1234-4234-8234-123456789abc`
    return { requestId: id, assignment: { id: `coach-${id}`, revision: 'v1', title: `Practice ${digit}`, note: 'Close touches.', status: 'archived', drills: [{ id: `coach-${id}-1`, title: 'Cone control', instructions: 'Setup: Two cones.\nDribble around them.', mode: 'time', durationSec: 30, sets: 2, side: 'both', restSec: 15, media: { id: 'youtube-QKz7fDjPnvg', status: 'approved', provider: 'youtube', youtubeId: 'QKz7fDjPnvg', portrait: true } }] }, sources: [{ videoId: 'QKz7fDjPnvg', url: 'https://www.youtube.com/watch?v=QKz7fDjPnvg', title: 'Cone control', author: 'Trainer' }] }
  }
  return { schemaVersion: 1, practices: [entry('1'), entry('2')] }
})
vi.mock('../public/practice-additions.json', () => ({ default: additions }))
import { loadCatalog, loadCatalogEdition } from './catalog.js'
async function fixture() {
  const original = { id: 'original', revision: 'v1', title: 'Original practice', status: 'current', drills: [{ id: 'original-1', title: 'Original drill', instructions: 'Original instructions.', mode: 'time', sets: 1, durationSec: 30, side: 'both', restSec: 10, media: { id: 'original-video', status: 'approved', path: '/media/original-video' } }] }
  const envelope = { schemaVersion: 1, revision: 'first-four-v2', catalog: { schemaVersion: 1, revision: 'first-four-v2', currentAssignmentId: original.id, assignments: [original] }, media: [{ id: 'original-video', sha256: 'a'.repeat(64), byteLength: 10, contentType: 'video/mp4' }] }
  const bytes = new TextEncoder().encode(JSON.stringify(envelope))
  return { CATALOG_REVISION: envelope.revision, CATALOG_SHA256: await digest(bytes), TRAINING_CONTENT: { get: async key => key === 'catalogs/first-four-v2.json' ? { size: bytes.length, body: new Response(bytes).body } : null } }
}
describe('published catalog additions at the real Worker boundary', () => {
  it('keeps the original assignment and hosted-media authorization while adding approved practices', async () => {
    const result = await loadCatalog(await fixture())
    expect(result.catalog.currentAssignmentId).toBe('original')
    expect(result.catalog.assignments).toHaveLength(3)
    expect([...result.media.keys()]).toEqual(['original-video'])
    expect(result.catalog.revision).toBe(await publicEdition('first-four-v2', additions.practices))
  })
  it('resolves a historical public prefix against the immutable original edition', async () => {
    const revision = await publicEdition('first-four-v2', additions.practices.slice(0, 1))
    const historical = await loadCatalogEdition(await fixture(), revision)
    expect(historical.revision).toBe(revision)
    expect(historical.assignments.map(a => a.title)).toEqual(['Original practice', 'Practice 1'])
    await expect(loadCatalogEdition(await fixture(), revision.replace(/-[a-f0-9]{16}$/, '-0000000000000000'))).rejects.toThrow()
    await expect(loadCatalogEdition(await fixture(), revision.replace('--c1-', '--c3-'))).rejects.toThrow()
  })
})
