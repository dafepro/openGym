import { describe, expect, it } from 'vitest'
import { DEFAULT_RANDOM_CONTEXT, generateRandomPractice } from './random-practice.js'
import { standardDrills } from './standard-workouts.js'
import { drillFeasibility } from './metadata.js'
import { createSession } from './session.js'
import { createCustomDrill } from './custom-drills.js'

const context = { setting: 'outdoor', equipment: ['ball', 'cones'], participants: { count: 1, roles: [] }, space: { lengthM: 8, widthM: 6 } }
const sample = (id, tag = 'futbol:ball-control', requirements = {}) => ({
  id, title: `Drill ${id}`, instructions: `Do ${id} at your own pace.`, mode: 'practice', sets: 1, side: 'both', restSec: null,
  media: { id: `video-${id}`, status: 'unavailable' },
  metadata: { version: 1, registryVersion: 1, tags: [tag], requirements: { settings: ['indoor', 'outdoor'], equipment: ['ball'], participants: { min: 1, max: 1, roles: [] }, space: { lengthM: 4, widthM: 3 }, ...requirements } },
})

describe('random practice proposals', () => {
  it('uses explicit conditions and excludes unknown requirements, partner and unavailable equipment', () => {
    const library = [sample('compatible'), sample('partner', undefined, { participants: { min: 2, max: 2, roles: [] } }), sample('goal', undefined, { equipment: ['goal'] }), sample('large', undefined, { space: { lengthM: 20, widthM: 20 } }), sample('indoor', undefined, { settings: ['indoor'] }), { ...sample('unknown'), metadata: undefined }]
    const result = generateRandomPractice(library, { context, seed: 'fixed' })
    expect(result.assignment.drills.map(d => d.title)).toEqual(['Drill compatible'])
    expect(result).toMatchObject({ selectedCount: 1, requestedCount: 3, eligibleCount: 1 })
    expect(result.explanation).toContain('3 requested')
    expect(() => generateRandomPractice(library, { seed: 1 })).toThrow('Choose a space')
    expect(() => generateRandomPractice(library, { context: { equipment: [] } })).toThrow('Choose a space')
  })

  it('produces deterministic distinct drills and varied shuffles without editing targets', () => {
    const library = standardDrills(), before = structuredClone(library)
    const options = { context, seed: 'playbook', now: 1000 }
    const first = generateRandomPractice(library, options)
    expect(generateRandomPractice(library, options)).toEqual(first)
    expect(first.assignment.drills).toHaveLength(3)
    expect(new Set(first.assignment.drills.map(d => d.id)).size).toBe(3)
    for (const drill of first.assignment.drills) {
      const source = library.find(item => item.title === drill.title && item.instructions === drill.instructions)
      expect(drill).toEqual({ ...source, id: drill.id })
      expect(drillFeasibility(drill, context).eligible).toBe(true)
    }
    const shuffles = Array.from({ length: 12 }, (_, seed) => generateRandomPractice(library, { context, seed, now: 1000 }).assignment.drills.map(d => d.title).join('|'))
    expect(new Set(shuffles).size).toBeGreaterThan(5)
    expect(library).toEqual(before)
    expect(createSession(first.assignment, { id: 'random-session', now: 1000 }).rows.length).toBeGreaterThanOrEqual(3)
  })

  it('deduplicates variants of the same drill and allows only actual playable demonstrations', () => {
    const a = sample('a'), b = sample('b'), c = sample('c')
    a.media = { id: 'approved', status: 'approved', path: '/media/approved' }
    b.mode = 'watch'
    const library = [a, { ...a, id: 'a-edition', sets: 1 }, b, c]
    const result = generateRandomPractice(library, { context, seed: 2, videoOnly: true })
    expect(result.assignment.drills).toHaveLength(1)
    expect(result.assignment.drills[0].title).toBe(a.title)
    expect(() => generateRandomPractice([c], { context, seed: 2, videoOnly: true })).toThrow('No video drills fit')
  })

  it('adds skill coverage before repeating a skill when compatible alternatives exist', () => {
    const library = [sample('control-a'), sample('control-b'), sample('control-c'), sample('passing', 'futbol:passing'), sample('balance', 'futbol:balance')]
    for (const seed of [0, 1, 12, 'practice']) {
      const result = generateRandomPractice(library, { context, seed })
      expect(result.skills.sort()).toEqual(['futbol:balance', 'futbol:ball-control', 'futbol:passing'])
    }
  })

  it('honestly names a ball-only setup as movement when no ball skills fit', () => {
    const ballOnly = { ...DEFAULT_RANDOM_CONTEXT, equipment: ['ball'] }
    const result = generateRandomPractice(standardDrills(), { context: ballOnly, seed: 2 })
    expect(result.assignment.title).toBe('Quick movement practice')
    expect(result.explanation).toContain('Movement and coordination')
    expect(result.context.equipment).toEqual(['ball'])
    expect(result.assignment.drills.every(d => drillFeasibility(d, ballOnly).eligible)).toBe(true)
    result.context.equipment.push('goal')
    expect(DEFAULT_RANDOM_CONTEXT.equipment).toEqual(['ball', 'cones'])
  })

  it('makes the explicit ball-and-cones default a soccer mix with a ball skill', () => {
    for (const seed of Array.from({ length: 12 }, (_, index) => index)) {
      const result = generateRandomPractice(standardDrills(), { context: DEFAULT_RANDOM_CONTEXT, seed })
      expect(result.assignment.title).toBe('Your soccer mix')
      expect(result.assignment.drills).toHaveLength(3)
      expect(result.assignment.drills.every(drill => drillFeasibility(drill, DEFAULT_RANDOM_CONTEXT).eligible)).toBe(true)
      expect(result.warnings).toEqual([])
      expect(result.uncheckedSpaceIds).toEqual([])
    }
  })

  it('only waives unknown space with explicit consent, preserving every other constraint', () => {
    const unmeasured = sample('unmeasured')
    delete unmeasured.metadata.requirements.space
    const needsWall = structuredClone(unmeasured)
    needsWall.id = 'wall'; needsWall.media.id = 'wall-video'; needsWall.metadata.requirements.equipment.push('wall')
    const tooLarge = sample('too-large', 'futbol:passing', { space: { lengthM: 30, widthM: 30 } })
    const unknownGear = structuredClone(unmeasured)
    unknownGear.id = 'unknown-gear'; unknownGear.media.id = 'unknown-gear-video'; delete unknownGear.metadata.requirements.equipment
    const indoors = structuredClone(unmeasured)
    indoors.id = 'indoors'; indoors.media.id = 'indoor-video'; indoors.metadata.requirements.settings = ['indoor']
    const partner = structuredClone(unmeasured)
    partner.id = 'partner'; partner.media.id = 'partner-video'; partner.metadata.requirements.participants = { min: 2, roles: [] }
    const library = [unmeasured, needsWall, tooLarge, unknownGear, indoors, partner]
    expect(() => generateRandomPractice(library, { context, seed: 1 })).toThrow('unlisted space needs')
    const result = generateRandomPractice(library, { context, seed: 1, allowUnknownSpace: true })
    expect(result.assignment.drills.map(d => d.title)).toEqual([unmeasured.title])
    expect(result.uncheckedSpaceIds).toEqual([result.assignment.drills[0].id])
    expect(result.warnings[0]).toContain('space requirements are not recorded')
    expect(result.explanation).not.toContain('All match')
    expect(result.assignment.drills[0].metadata.requirements).not.toHaveProperty('space')
    expect(() => generateRandomPractice(library, { context, allowUnknownSpace: 'yes' })).toThrow('check unmeasured space')
  })

  it('includes personal drills only when their setup metadata matches all chosen conditions', () => {
    const fields = { title: 'My touches', instructions: 'Keep the ball close.', equipment: ['ball'], setting: 'either', participants: 1, space: { lengthM: 4, widthM: 3 } }
    const known = createCustomDrill(fields, { id: 'custom-known' })
    const unknown = createCustomDrill({ title: 'My other drill', instructions: 'Practice.' }, { id: 'custom-unknown' })
    expect(generateRandomPractice([known, unknown], { context, seed: 3 }).assignment.drills.map(d => d.title)).toEqual(['My touches'])
    expect(() => generateRandomPractice([unknown], { context, seed: 3 })).toThrow('No drills fit')
  })

  it('validates proposal limits and leaves fewer-than-requested proposals honest', () => {
    expect(() => generateRandomPractice([], { context })).toThrow('No drills fit')
    for (const count of [0, 11, 1.5]) expect(() => generateRandomPractice([sample('a')], { context, count })).toThrow('between 1 and 10')
    expect(() => generateRandomPractice([sample('a')], { context, seed: Infinity })).toThrow('valid shuffle seed')
    expect(() => generateRandomPractice([sample('a')], { context, videoOnly: 'yes' })).toThrow('whether demonstrations')
  })

  it('gives changed recipes their own identity even when the shuffle seed is unchanged', () => {
    const library = [sample('a'), sample('b', 'futbol:passing')]
    const first = generateRandomPractice(library, { context, seed: 'same', count: 1 })
    const longer = generateRandomPractice(library, { context, seed: 'same', count: 2 })
    const indoors = generateRandomPractice(library, { context: { ...context, setting: 'indoor' }, seed: 'same', count: 1 })
    expect(new Set([first.assignment.id, longer.assignment.id, indoors.assignment.id]).size).toBe(3)
  })
})
