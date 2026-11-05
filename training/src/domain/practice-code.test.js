import { describe, expect, it } from 'vitest'
import { syntheticCatalog } from '../../fixtures/catalog.js'
import { createPracticeCode, extractPracticeCode, readPracticeCode, MAX_CODE_LENGTH } from './practice-code.js'
import { createPractice, encodePractice } from './practice-builder.js'
import { createSession } from './session.js'

const catalog = syntheticCatalog
const original = () => createPractice('Coach’s three-part practice ⚽', [
  { id: 'cones', title: 'Cone dribbling', instructions: 'Setup: four cones, two steps apart.\nWeave through and return. Keep the ball within one foot.', mode: 'reps', sets: 3, reps: 8, side: 'both', restSec: 30, media: { id: 'no-video', status: 'unavailable' } },
  { id: 'wall', title: 'Wall sit', instructions: 'Use a clear wall. Settle into a comfortable hold.', mode: 'time', sets: 2, durationSec: 30, side: 'both', restSec: 30, media: { id: 'no-video', status: 'unavailable' } },
  { id: 'move', title: 'Skill move', instructions: 'Practice your chosen move with each foot. Start with control.', mode: 'time', sets: 1, durationSec: 600, side: 'each', restSec: 15, media: { id: 'no-video', status: 'unavailable' } },
], { id: 'coach-local', revision: 'first', note: 'Control first. Speed follows.' })

describe('portable practice passes', () => {
  it('carries custom drills, Unicode, exact targets and both feet to a blank device', async () => {
    const assignment = original()
    const pass = await createPracticeCode(assignment, 'https://train.quicktrack.cc')
    const decoded = await readPracticeCode(pass.link, { assignments: [] })
    expect(decoded.title).toBe(assignment.title)
    expect(decoded.note).toBe(assignment.note)
    expect(decoded.drills.map(({ id, ...drill }) => drill)).toEqual(assignment.drills.map(({ id, ...drill }) => drill))
    expect(decoded.id).toBe(`shared-${pass.identity}`)
    expect(pass.code.length).toBeLessThan(1000)
    expect(pass.code.length).toBeLessThan(encodePractice(assignment).length / 2)
    const session = createSession(decoded, { id: 'received-session', now: 1000 })
    const feet = session.rows.filter(row => row.drillId === 'drill-3')
    expect(feet.map(row => row.target)).toEqual([600, 600])
    expect(new Set(feet.map(row => row.side)).size).toBe(2)
  })
  it('has the same content identity across local IDs, editions and repeated shares', async () => {
    const first = await createPracticeCode(original(), 'https://a.example')
    const edited = original(); edited.id = 'other-device'; edited.revision = 'new-local-edition'; edited.drills[0].id = 'different-id'
    const second = await createPracticeCode(edited, 'https://b.example')
    expect(second.code).toBe(first.code)
    edited.drills[2].durationSec = 300
    expect((await createPracticeCode(edited, 'https://b.example')).identity).not.toBe(first.identity)
    const received = await readPracticeCode(first.code, catalog)
    expect((await createPracticeCode(received, 'https://a.example')).code).toBe(first.code)
  })
  it('retains old shared links while rejecting damaged and unsupported versions', async () => {
    const assignment = original()
    expect(await readPracticeCode(encodePractice(assignment), catalog)).toEqual(assignment)
    const { code } = await createPracticeCode(assignment, 'https://train.quicktrack.cc')
    for (const input of ['', code.slice(0, -1), code.replace(/^QT2/, 'QT3'), code.replace(/.$/, code.endsWith('0') ? '1' : '0'), 'QT2.' + 'x'.repeat(MAX_CODE_LENGTH), 'javascript:alert(1)']) await expect(readPracticeCode(input, catalog)).rejects.toThrow()
    expect(extractPracticeCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `)).toBe(code)
    expect(() => extractPracticeCode('https://example.com/not-a-practice')).toThrow()
  })
  it('requires local catalog approval for video references', async () => {
    const assignment = original()
    assignment.drills[0].media = { id: 'unpublished', status: 'approved', path: '/media/unpublished' }
    const pass = await createPracticeCode(assignment, 'https://train.quicktrack.cc')
    expect((await readPracticeCode(pass.code, catalog)).drills[0].media).toEqual({ id: 'unpublished', status: 'unavailable' })
    assignment.drills[0].media = catalog.assignments[0].drills[0].media
    const approved = await createPracticeCode(assignment, 'https://train.quicktrack.cc')
    expect((await readPracticeCode(approved.code, catalog)).drills[0].media).toEqual(assignment.drills[0].media)
  })
})

it('keeps identity when a receiving device has no video catalog yet', async () => {
  const assignment = structuredClone(catalog.assignments[0])
  const first = await createPracticeCode(assignment, 'https://train.quicktrack.cc')
  const offline = await readPracticeCode(first.code, { assignments: [] })
  expect(offline.drills.every(drill => drill.media.status === 'unavailable')).toBe(true)
  expect((await createPracticeCode(offline, 'https://another.example')).code).toBe(first.code)
  const availableAgain = await readPracticeCode(first.code, catalog)
  expect(availableAgain.drills.map(drill => drill.media)).toEqual(assignment.drills.map(drill => drill.media))
})

it('rejects compressed expansion beyond the read budget before parsing a payload', async () => {
  const bytes = new TextEncoder().encode('x'.repeat(200000))
  const packed = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer())
  const code = `QT2.${Buffer.from(packed).toString('base64url')}.${'0'.repeat(32)}`
  expect(code.length).toBeLessThan(MAX_CODE_LENGTH)
  await expect(readPracticeCode(code, catalog)).rejects.toThrow('damaged or too large')
})

it('refuses invalid source content and non-web share origins', async () => {
  await expect(createPracticeCode({ ...original(), progress: { completed: true } }, 'https://train.quicktrack.cc')).rejects.toThrow()
  for (const origin of ['javascript:alert(1)', 'https://user:password@example.com']) await expect(createPracticeCode(original(), origin)).rejects.toThrow('training site')
})

it('references published drills with exact overrides and resolves retained editions', async () => {
  const source = structuredClone(catalog.assignments[0])
  source.drills[0].mode = 'time'; source.drills[0].durationSec = 600; source.drills[0].sets = 2; source.drills[0].side = 'each'; source.drills[0].restSec = 15
  delete source.drills[0].reps
  const pass = await createPracticeCode(source, 'https://train.quicktrack.cc', catalog)
  expect(pass.code).toMatch(/^QT3\./)
  const full = await createPracticeCode(source, 'https://train.quicktrack.cc')
  expect(pass.code.length).toBeLessThan(full.code.length)
  expect(pass.identity).toBe(full.identity)
  const decoded = await readPracticeCode(pass.code, catalog)
  expect(decoded.drills[0]).toMatchObject({ mode: 'time', durationSec: 600, sets: 2, side: 'each', restSec: 15 })
  const later = { ...catalog, revision: 'new-edition', assignments: [] }
  const recovered = await readPracticeCode(pass.code, later, async revision => { expect(revision).toBe(catalog.revision); return catalog })
  expect(recovered.drills[0].instructions).toBe(source.drills[0].instructions)
  expect(recovered.drills[0].media.status).toBe('unavailable')
  const changed = structuredClone(catalog); changed.assignments[0].drills[0].instructions += ' Changed.'
  await expect(readPracticeCode(pass.code, changed)).rejects.toThrow('edition has changed')
})

it('embeds custom drill instructions alongside compact published references', async () => {
  const source = structuredClone(catalog.assignments[0])
  source.drills.push(original().drills[2])
  const pass = await createPracticeCode(source, 'https://train.quicktrack.cc', catalog)
  const decoded = await readPracticeCode(pass.code, catalog)
  expect(decoded.drills.at(-1).instructions).toBe(source.drills.at(-1).instructions)
  expect(decoded.drills.at(-1).durationSec).toBe(600)
})
