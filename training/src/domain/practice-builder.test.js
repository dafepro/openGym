import { describe, expect, it } from 'vitest'
import { syntheticCatalog } from '../../fixtures/catalog.js'
import { changePrescription, createPractice, decodePractice, drillLibrary, encodePractice, MAX_SHARE_LENGTH, practiceLink, readSavedPractices, savePractice } from './practice-builder.js'
import { rankTrainingDrills } from './recommendations.js'
import { createSession } from './session.js'

const source = syntheticCatalog.assignments[0]
const practice = () => createPractice('Touch & turn ⚽', structuredClone(source.drills), { id: 'personal-practice', revision: 'edition-1' })

describe('personal practice composition and sharing', () => {
  it('round trips Unicode, ordering, prescriptions and metadata without carrying progress', () => {
    const original = practice()
    const token = encodePractice(original)
    expect(decodePractice(token, syntheticCatalog)).toEqual(original)
    expect(token.length).toBeLessThan(MAX_SHARE_LENGTH)
    expect(practiceLink(original, 'https://train.quicktrack.cc/')).toBe(`https://train.quicktrack.cc/#/shared/${token}`)
    expect(atob(token.replaceAll('-', '+').replaceAll('_', '/'))).not.toContain('activeSession')
    expect(() => encodePractice({ ...original, sessions: [] })).toThrow()
  })

  it('cannot authorize media just by putting its identity in a link', () => {
    const original = practice()
    original.drills[0].media = { id: 'unpublished-video', status: 'approved', path: '/media/unpublished-video' }
    const decoded = decodePractice(encodePractice(original), syntheticCatalog)
    expect(decoded.drills[0].media).toEqual({ id: 'unpublished-video', status: 'unavailable' })
    expect(() => encodePractice({ ...original, drills: [{ ...original.drills[0], media: { id: 'x', status: 'approved', path: 'https://example.com/video.mp4' } }] })).toThrow()
  })

  it('rejects truncated, unsupported and oversized links', () => {
    for (const token of ['', '%', 'x'.repeat(MAX_SHARE_LENGTH + 1), btoa('{'), Buffer.from(JSON.stringify({ format: 'quicktrack-practice', version: 99, assignment: practice() })).toString('base64url')]) expect(() => decodePractice(token, syntheticCatalog)).toThrow()
  })

  it('does not change source prescriptions or started session snapshots when edited', () => {
    const original = practice()
    const before = structuredClone(source)
    const session = createSession(original, { id: 'test-session', now: 1000 })
    original.drills[0].title = 'Edited after starting'
    expect(session.assignment.drills[0].title).toBe(before.drills[0].title)
    const changed = changePrescription(original.drills[0], { mode: 'time', durationSec: 40, sets: 2 })
    expect(changed.reps).toBeUndefined()
    expect(source).toEqual(before)
    const watch = changePrescription(changed, { mode: 'watch' })
    expect(watch).toMatchObject({ sets: 1, side: 'both', restSec: null })
    expect(watch.durationSec).toBeUndefined()
    expect(() => createPractice('Needs target', [{ ...changed, durationSec: '' }], { id: 'test', revision: 'v1' })).toThrow()
  })

  it('counts drafted physical practice as planned coverage, without inventing completed work', () => {
    const drill = { ...practice().drills[0], metadata: { version: 1, registryVersion: 1, tags: ['futbol:passing'] }, mode: 'reps', reps: 5 }
    const options = { now: 1000, plannedDrills: [drill] }
    const ranked = rankTrainingDrills([drill], options)[0]
    expect(ranked.breakdown.planned).toBeLessThan(0)
    expect(ranked.exposure.performed['futbol:passing']).toBe(0)
    expect(rankTrainingDrills([drill], { ...options, plannedDrills: [{ ...drill, mode: 'watch' }] })[0].breakdown.planned).toBeCloseTo(0)
  })

  it('deduplicates library demonstrations across assignments', () => {
    const library = drillLibrary({ assignments: [source, source] })
    expect(library.length).toBeLessThanOrEqual(source.drills.length)
    library[0].title = 'Changed locally'
    expect(source.drills[0].title).not.toBe('Changed locally')
  })

  it('saves practices separately and refuses stale-tab overwrites or invalid existing data', () => {
    let value = null
    const storage = { getItem: () => value, setItem: (_, next) => { value = next } }
    const first = savePractice(storage, 'practices', null, practice())
    expect(readSavedPractices(value)).toEqual([practice()])
    expect(() => savePractice(storage, 'practices', null, practice())).toThrow('another tab')
    const updated = { ...practice(), title: 'Updated practice', revision: 'edition-2' }
    expect(savePractice(storage, 'practices', first.source, updated).practices).toEqual([updated])
    value = '{invalid'
    expect(() => savePractice(storage, 'practices', value, practice())).toThrow()
    expect(value).toBe('{invalid')
  })
})
