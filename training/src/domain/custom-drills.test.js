import { describe, expect, it } from 'vitest'
import { createCustomDrill, customDrillFields, MAX_CUSTOM_DRILLS, readCustomDrills, removeCustomDrill, saveCustomDrill } from './custom-drills.js'
import { createPractice, decodePractice, encodePractice } from './practice-builder.js'
import { createSession, reduceSession } from './session.js'

const personal = (fields = {}, id = 'custom-first') => createCustomDrill({ title: 'My wall touch', setup: 'A ball and a clear wall.', instructions: 'Pass, receive, and repeat.', ...fields }, { id })
const local = (initial = null) => {
  let source = initial
  return { getItem: () => source, setItem: (_, next) => { source = next } }
}

describe('personal drill setup and durable library', () => {
  it('creates an explicit self-paced drill with portable setup and no invented targets or video', () => {
    const drill = personal({ title: '  My touch  ', tags: ['FUTBOL:CONTROL', ' driveway ', 'futbol:ball-mastery'] })
    expect(drill).toMatchObject({ id: 'custom-first', title: 'My touch', mode: 'practice', sets: 1, side: 'both', restSec: null, media: { id: 'custom-first', status: 'unavailable' } })
    expect(drill.instructions).toBe('Setup: A ball and a clear wall.\n\nPass, receive, and repeat.')
    expect(drill).not.toHaveProperty('reps')
    expect(drill).not.toHaveProperty('durationSec')
    expect(drill.metadata.tags).toEqual(['futbol:ball-control', 'driveway'])
    expect(drill.metadata).not.toHaveProperty('requirements')
  })

  it('retains real time/repetition targets and explicit context while rejecting invalid inputs', () => {
    const fields = { mode: 'time', durationSec: 30, sets: 2, side: 'each', restSec: 10, equipment: ['BALL', 'wall'], setting: 'either', participants: 1, space: { lengthM: 4, widthM: 3 } }
    const drill = personal(fields)
    expect(drill).toMatchObject({ mode: 'time', durationSec: 30, sets: 2, side: 'each', restSec: 10, metadata: { requirements: { equipment: ['ball', 'wall'], settings: ['indoor', 'outdoor'], participants: { min: 1, max: 1, roles: [] }, space: { lengthM: 4, widthM: 3 } } } })
    fields.space.lengthM = 100
    expect(drill.metadata.requirements.space.lengthM).toBe(4)
    expect(personal({ mode: 'reps', reps: 8, sets: 3 })).toMatchObject({ mode: 'reps', reps: 8, sets: 3 })
    for (const bad of [{ title: '' }, { instructions: ' ' }, { mode: 'time', durationSec: 0 }, { mode: 'reps', reps: 1.5 }, { mode: 'watch' }, { sets: -2, mode: 'reps', reps: 4 }, { participants: 0 }, { setting: 'anywhere' }, { media: {} }]) expect(() => personal(bad)).toThrow()
    expect(() => personal({}, 'assigned-wall')).toThrow('own stable identifier')
  })

  it('saves, edits and removes exact records without stale or corrupt overwrites', () => {
    const storage = local(), drill = personal()
    const first = saveCustomDrill(storage, 'custom', null, drill)
    expect(readCustomDrills(storage.getItem())).toEqual([drill])
    drill.title = 'Changed outside storage'
    expect(readCustomDrills(storage.getItem())[0].title).toBe('My wall touch')
    expect(() => saveCustomDrill(storage, 'custom', null, personal())).toThrow('another tab')
    const second = saveCustomDrill(storage, 'custom', first.source, personal({ title: 'Updated' }))
    expect(second.drills).toHaveLength(1)
    expect(second.drills[0].title).toBe('Updated')
    expect(() => removeCustomDrill(storage, 'custom', second.source, 'custom-missing')).toThrow('no longer saved')
    expect(removeCustomDrill(storage, 'custom', second.source, 'custom-first').drills).toEqual([])
    const broken = local('{broken')
    expect(() => saveCustomDrill(broken, 'custom', '{broken', personal())).toThrow('could not be read')
    expect(broken.getItem()).toBe('{broken')
  })

  it('rejects duplicate IDs, excess records, unauthorized media and storage failures', () => {
    const drill = personal()
    expect(() => readCustomDrills(JSON.stringify({ version: 1, drills: [drill, drill] }))).toThrow('identifiers conflict')
    expect(() => readCustomDrills(JSON.stringify({ version: 2, drills: [] }))).toThrow('unsupported format')
    expect(() => readCustomDrills(JSON.stringify({ version: 1, drills: [], unknown: true }))).toThrow('unsupported format')
    const media = { ...drill, media: { id: drill.id, status: 'approved', path: `/media/${drill.id}` } }
    expect(() => readCustomDrills(JSON.stringify({ version: 1, drills: [media] }))).toThrow('unapproved video')
    const storage = local(JSON.stringify({ version: 1, drills: Array.from({ length: MAX_CUSTOM_DRILLS }, (_, i) => personal({}, `custom-${i}`)) }))
    const before = storage.getItem()
    expect(() => saveCustomDrill(storage, 'custom', before, personal())).toThrow('100 personal drills')
    expect(storage.getItem()).toBe(before)
    const blocked = { getItem: () => null, setItem: () => { throw new Error('quota exceeded') } }
    expect(() => saveCustomDrill(blocked, 'custom', null, personal())).toThrow('quota exceeded')
  })

  it('shares a personal drill and records it without rewriting the saved source', () => {
    const drill = personal({ mode: 'reps', reps: 5 })
    const assignment = createPractice('My own practice', [drill], { id: 'own-practice', revision: 'v1' })
    const shared = decodePractice(encodePractice(assignment), { assignments: [] })
    expect(shared).toEqual(assignment)
    let session = createSession(shared, { id: 'own-session', now: 1000 })
    const command = (type, now, extra = {}) => { session = reduceSession(session, { id: `event-${now}`, sessionId: session.id, rowId: session.currentRowId, type, now, ...extra }) }
    command('START', 2000)
    command('DONE', 3000, { actual: 4 })
    expect(session.rows[0].actual).toBe(4)
    expect(drill.reps).toBe(5)
    expect(assignment.drills[0].reps).toBe(5)
  })

  it('recovers editable setup and targets while preserving IDs and explicit context', () => {
    for (const tracking of [{ mode: 'practice' }, { mode: 'reps', reps: 8, sets: 2, side: 'each', restSec: 15 }, { mode: 'time', durationSec: 25, sets: 3, restSec: 10 }]) {
      const drill = personal({ ...tracking, tags: ['futbol:passing', 'driveway'], equipment: ['ball', 'wall'], setting: 'either', participants: 1, space: { lengthM: 4, widthM: 3 } })
      const before = structuredClone(drill)
      const fields = customDrillFields(drill)
      expect(fields.setup).toBe('A ball and a clear wall.')
      expect(fields.instructions).toBe('Pass, receive, and repeat.')
      expect(createCustomDrill(fields, { id: drill.id })).toEqual(drill)
      fields.equipment.push('cones'); fields.tags.push('edited'); fields.space.lengthM = 9
      expect(drill).toEqual(before)
    }
    const noSetup = personal({ setup: '', instructions: 'Keep touching the ball.' })
    expect(customDrillFields(noSetup)).toMatchObject({ setup: '', instructions: noSetup.instructions })
    const paragraphs = personal({ setup: 'A ball. \n\n A wall.', instructions: 'Pass.\n\nReceive.' })
    expect(createCustomDrill(customDrillFields(paragraphs), { id: paragraphs.id })).toEqual(paragraphs)
  })

  it('refuses edits that would silently lose metadata the personal editor cannot represent', () => {
    const drill = personal()
    drill.metadata.physicalEmphasis = ['coordination']
    expect(() => customDrillFields(drill)).toThrow('cannot preserve')
    expect(drill.metadata.physicalEmphasis).toEqual(['coordination'])
  })
})
