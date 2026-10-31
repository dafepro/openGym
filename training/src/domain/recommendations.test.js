import { describe, expect, it } from 'vitest'
import { syntheticCatalog } from '../../fixtures/catalog.js'
import { createSession, reduceSession } from './index.js'
import { rankTrainingDrills } from './recommendations.js'
const NOW = Date.UTC(2026, 9, 30, 12), DAY = 86400000
const drill = (id, tags, extra = {}) => ({ ...structuredClone(syntheticCatalog.assignments[0].drills[0]), id, sets: 1,
  metadata: { version: 1, registryVersion: 1, tags, requirements: { equipment: [], settings: [], participants: { min: 1, roles: [] }, space: { lengthM: 0, widthM: 0 } } }, ...extra })
const passing = drill('passing', ['futbol:passing']), shooting = drill('shooting', ['futbol:shooting'])
function sessionFor(d, { ago = DAY, actual = 4, status = 'done', active = false } = {}) {
  const assignment = structuredClone(syntheticCatalog.assignments[0]); assignment.drills = [d]
  let session = createSession(assignment, { id: `history-${d.id}`, now: NOW - ago })
  session.rows[0] = { ...session.rows[0], status, actual, prescriptionMet: status === 'done' && (d.mode === 'watch' || actual >= session.rows[0].target) }
  if (!active) session = reduceSession(session, { type: 'FINISH', id: 'history-finish', sessionId: session.id, now: NOW - ago + 1000 })
  return session
}
const rank = (drills = [passing, shooting], options = {}) => rankTrainingDrills(drills, { now: NOW, ...options })
const byId = (ranked, id) => ranked.find(item => item.candidateId === id)
describe('deterministic, inspectable optional drill ranking', () => {
  it('breaks ties by stable candidate identity independently of source order', () => {
    expect(rank().map(item => item.candidateId)).toEqual(['passing', 'shooting'])
    expect(rank([shooting, passing])).toEqual(rank())
    expect(Object.values(rank()[0].breakdown).reduce((a, b) => a + b, 0)).toBe(rank()[0].score)
  })
  it('uses explicit edition candidate IDs without collapsing same local drill IDs', () => {
    expect(() => rank([passing, { ...shooting, id: passing.id }])).toThrow('wrap assignment editions')
    const candidates = [{ candidateId: 'assignment-a:v1:drill', drill: passing }, { candidateId: 'assignment-b:v1:drill', drill: { ...shooting, id: passing.id } }]
    expect(rank(candidates).map(item => item.candidateId)).toEqual(['assignment-a:v1:drill', 'assignment-b:v1:drill'])
    expect(rank(candidates, { excludedIds: ['assignment-a:v1:drill'] })).toHaveLength(1)
    expect(candidates[1].drill.id).toBe('passing')
  })
  it('filters feasibility before a high focus score and exposes reasons when requested', () => {
    const partner = drill('partner', ['futbol:passing'], { metadata: { ...passing.metadata, requirements: { equipment: ['ball'], participants: { min: 2, roles: ['passer'] }, space: { lengthM: 20, widthM: 10 } } } })
    const options = { context: { equipment: [], participants: { count: 1, roles: [] }, space: { lengthM: 3, widthM: 3 } }, focusSkills: ['futbol:passing'] }
    expect(rank([partner, shooting], options).map(item => item.candidateId)).toEqual(['shooting'])
    const result = rank([partner, shooting], { ...options, includeIneligible: true })
    expect(result[0].eligible).toBe(true); expect(result[1].candidateId).toBe('partner')
    expect(result[1].issues.map(item => item.code)).toContain('missing-equipment')
    expect(result[1].score).toBeGreaterThan(result[0].score)
  })
  it('matches aliases and exact custom-tag filters without adding unknown semantic scores', () => {
    const custom = drill('custom', ['Coach blue', 'futbol:finishing'])
    expect(rank([custom, passing], { requiredTags: [' coach BLUE ', 'futbol:shooting'] }).map(item => item.candidateId)).toEqual(['custom'])
    expect(byId(rank([custom], { focusSkills: ['futbol:shooting'] }), 'custom').breakdown.focus).toBe(40)
    expect(rank([custom], { focusSkills: ['made-up skill'] })[0].breakdown.focus).toBe(0)
    expect(rank([custom], { requiredTags: ['nonexistent'] })).toEqual([])
  })
  it('does not derive scores from unknown labels, physical emphasis or title keywords', () => {
    const extended = { ...passing, metadata: { ...passing.metadata, tags: [...passing.metadata.tags, 'futbol:unregistered', 'coach blue'], physicalEmphasis: ['strength', 'quadriceps'] } }
    expect(rank([extended])[0].breakdown).toEqual(rank([passing])[0].breakdown)
    const titleOnly = { ...passing, title: 'Passing finishing shooting', metadata: undefined }
    expect(rank([titleOnly], { focusSkills: ['futbol:passing'] })[0].breakdown.focus).toBe(0)
  })
  it('supports reinforcement and diversification deliberately instead of muscle-spacing punishment', () => {
    const history = [sessionFor(drill('prior-pass', ['futbol:passing']))]
    const reinforcement = rank(undefined, { history, strategy: 'reinforce' })
    const diversification = rank(undefined, { history, strategy: 'diversify' })
    expect(reinforcement[0].candidateId).toBe('passing')
    expect(diversification[0].candidateId).toBe('shooting')
    expect(byId(reinforcement, 'passing').breakdown.reinforcement).toBeGreaterThan(0)
    expect(byId(reinforcement, 'passing').exposure.performed['futbol:passing']).toBe(1)
    expect(Object.keys(reinforcement[0].breakdown)).not.toContain('spacing')
  })
  it('keeps planned coverage distinct from performed exposure', () => {
    const activeSession = sessionFor(drill('planned-pass', ['futbol:passing']), { status: 'pending', actual: null, active: true })
    const result = byId(rank(undefined, { activeSession }), 'passing')
    expect(result.breakdown.planned).toBeLessThan(0)
    expect(result.breakdown.reinforcement).toBe(0)
    expect(result.exposure.performed['futbol:passing']).toBe(0)
    expect(result.exposure.pending['futbol:passing']).toBe(1)
  })
  it.each([
    { actual: 0 }, { actual: 1.5 }, { status: 'pending', actual: null }, { ago: -DAY },
  ])('does not count zero, unperformed or future work as practice %j', extra => {
    const history = [sessionFor(passing, extra)]
    const result = byId(rank(undefined, { history }), 'passing')
    expect(result.breakdown.reinforcement).toBe(0); expect(result.breakdown.familiarity).toBe(0)
  })
  it('does not move saved active work to now, while keeping old pending plans separate', () => {
    const active = sessionFor(passing, { active: true, ago: 30 * DAY })
    const current = byId(rank(undefined, { activeSession: active }), 'passing')
    const recent = byId(rank(undefined, { history: [sessionFor(passing, { ago: DAY })] }), 'passing')
    expect(current.breakdown.reinforcement).toBeLessThan(recent.breakdown.reinforcement)
    const oldPending = sessionFor(passing, { active: true, ago: 100 * DAY, status: 'pending', actual: null })
    const result = byId(rank(undefined, { activeSession: oldPending }), 'passing')
    expect(result.exposure.pending['futbol:passing']).toBe(1)
    expect(result.breakdown.reinforcement).toBe(0)
  })
  it('does not count a watch acknowledgment or a future row timestamp as athletic exposure', () => {
    const watch = drill('review-only', ['futbol:passing'], { mode: 'watch', sets: 1, side: 'both', restSec: null })
    const history = [sessionFor(watch, { actual: null })]
    expect(byId(rank(undefined, { history }), 'passing').exposure.performed['futbol:passing']).toBe(0)
    const future = sessionFor(passing); future.rows[0].completedAt = NOW + DAY
    expect(byId(rank(undefined, { history: [future] }), 'passing').breakdown.familiarity).toBe(0)
  })
  it('counts positive recorded partial work as exposure without claiming mastery', () => {
    const result = byId(rank(undefined, { history: [sessionFor(passing, { status: 'stopped', actual: 1 })] }), 'passing')
    expect(result.exposure.performed['futbol:passing']).toBe(1)
    expect(result.breakdown.reinforcement).toBeGreaterThan(0)
    expect(result).not.toHaveProperty('mastery')
  })
  it('uses snapshot skill metadata rather than changed candidate/catalog tags', () => {
    const history = [sessionFor(drill('same-id', ['futbol:passing']))]
    const changed = drill('same-id', ['futbol:shooting'])
    expect(byId(rank([changed, passing], { history }), 'same-id').exposure.performed['futbol:shooting']).toBe(0)
    expect(byId(rank([changed, passing], { history }), 'same-id').breakdown.familiarity).toBe(0)
  })
  it('does not traverse old session payloads and does not double count duplicate sessions', () => {
    const old = { id: 'old', startedAt: NOW - 100 * DAY, endedAt: NOW - 100 * DAY, status: 'partial', get assignment() { throw new Error('must not read old content') } }
    expect(rank(undefined, { history: [old] })).toEqual(rank())
    const session = sessionFor(passing)
    expect(rank(undefined, { history: [session, session] })).toEqual(rank(undefined, { history: [session] }))
  })
  it('is pure and returns the supplied prescription without filling missing quantities or changing snapshots', () => {
    const missing = { id: 'metadata-only', metadata: passing.metadata }
    const before = JSON.stringify({ passing, missing })
    const result = rank([passing, missing])
    expect(result.find(item => item.candidateId === 'metadata-only').drill).not.toHaveProperty('sets')
    expect(result.find(item => item.candidateId === 'metadata-only').drill).not.toHaveProperty('reps')
    expect(JSON.stringify({ passing, missing })).toBe(before)
    result[0].drill.title = 'changed outside'
    expect(JSON.stringify({ passing, missing })).toBe(before)
  })
})

it('counts explicitly completed self-paced drills as skill exposure, but not started or watched drills', () => {
  const d = { ...passing, mode: 'practice', side: 'both', restSec: null }; delete d.reps
  const a = { ...structuredClone(syntheticCatalog.assignments[0]), drills: [d] }
  let s = createSession(a, { id: 'self-paced-history', now: NOW - DAY })
  const send = (type, offset) => { s = reduceSession(s, { type, id: `self-${type}`, sessionId: s.id, rowId: s.currentRowId, now: NOW - DAY + offset }) }
  send('START', 0)
  expect(byId(rank([d], { activeSession: s }), d.id).exposure.performed['futbol:passing']).toBe(0)
  send('DONE', 1000); send('FINISH', 2000)
  expect(byId(rank([d], { history: [s] }), d.id).exposure.performed['futbol:passing']).toBe(1)
  expect(s.rows[0].actual).toBeNull()
})
