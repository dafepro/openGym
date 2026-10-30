import { describe, expect, it } from 'vitest'
import { syntheticCatalog } from '../../fixtures/catalog.js'
import { createSession, getSessionView, reduceSession, selectCurrentAssignment, validateCatalog, validateSession } from './index.js'
const copy = value => structuredClone(value)
const assignment = () => selectCurrentAssignment(syntheticCatalog)
const one = (mode = 'time', extra = {}) => {
  const a = assignment()
  a.drills = [{ ...a.drills.find(drill => drill.mode === mode), ...extra }]
  return a
}
let sequence = 0
function command(session, type, now, fields = {}) {
  return reduceSession(session, { type, now, id: `command-${++sequence}`, sessionId: session.id, rowId: session.currentRowId, ...fields })
}
const start = a => createSession(a, { id: 'test-session', now: 0 })
describe('validated content and immutable assignment snapshots', () => {
  it('selects a deliberate current edition and preserves archived content', () => {
    expect(validateCatalog(syntheticCatalog).assignments).toHaveLength(2)
    expect(assignment().id).toBe('synthetic-current')
    const catalog = copy(syntheticCatalog)
    const priorEdition = { ...copy(catalog.assignments[0]), status: 'archived', revision: 'old-revision' }
    catalog.assignments.push(priorEdition)
    expect(selectCurrentAssignment(catalog).revision).toBe('synthetic-assignment-v1')
    delete catalog.currentAssignmentRevision
    expect(() => validateCatalog(catalog)).toThrow('exact assignment edition')
  })
  it.each([
    ['external URL', d => { d.media.path = 'https://youtube.com/watch?v=test' }],
    ['path traversal', d => { d.media.path = '/media/../private' }],
    ['negative reps', d => { d.reps = -1 }],
    ['missing rest', d => { delete d.restSec }],
    ['ambiguous mode', d => { d.mode = 'distance' }],
    ['unapproved poster', d => { d.media.poster = 'https://outside.example/private' }],
    ['private provenance', d => { d.permissionRecord = 'operator-only' }],
    ['asset identity mismatch', d => { d.media.path = '/media/some-other-id' }],
  ])('refuses %s without guessing a prescription', (_, mutate) => {
    const catalog = copy(syntheticCatalog); mutate(catalog.assignments[0].drills[0])
    expect(() => validateCatalog(catalog)).toThrow()
  })
  it('does not mutate active or completed prescriptions when a catalog changes', () => {
    const a = assignment(); const session = start(a)
    a.drills[0].reps = 999; a.title = 'Changed'; a.status = 'archived'
    expect(session.assignment.drills[0].reps).toBe(4)
    expect(session.assignment.title).toContain('Synthetic')
    expect(validateSession(session)).toEqual(session)
  })
})
describe('one session controller', () => {
  it('records independent sides and preserves zero actual reps as unmet', () => {
    let s = start(one('reps', { sets: 1, side: 'each', restSec: 0 }))
    expect(s.rows.map(row => row.side)).toEqual(['left', 'right'])
    s = command(s, 'START', 0); s = command(s, 'DONE', 1000, { actual: 0 })
    expect(s.rows[0]).toMatchObject({ status: 'done', actual: 0, prescriptionMet: false })
    expect(s.phase).toBe('ready'); expect(s.currentRowId).toContain('right')
    s = command(s, 'START', 2000); s = command(s, 'DONE', 3000)
    expect(getSessionView(s, 3000)).toMatchObject({ allWorkRecorded: true, prescriptionMet: false })
    s = command(s, 'FINISH', 4000)
    expect(s.status).toBe('partial'); expect(validateSession(s)).toEqual(s)
  })
  it('ignores duplicate, stale and immediate Start-to-Done actions', () => {
    const initial = start(one('reps'))
    let s = command(initial, 'START', 0)
    expect(command(s, 'DONE', 200)).toBe(s)
    const done = { type: 'DONE', now: 1000, id: 'same-command', sessionId: s.id, rowId: s.currentRowId }
    s = reduceSession(s, done)
    expect(reduceSession(s, done)).toBe(s)
    expect(command(s, 'START', 2000, { rowId: initial.currentRowId })).toBe(s)
    expect(command(s, 'START', 2000, { sessionId: 'other-session' })).toBe(s)
    expect(reduceSession(initial, { type: 'START', now: 0, id: 'missing-row', sessionId: initial.id })).toBe(initial)
  })
  it('healthy foreground ticks complete timed work once at its target', () => {
    let s = start(one('time', { sets: 2 }))
    s = command(s, 'START', 0)
    for (let now = 1000; now <= 5000; now += 1000) s = command(s, 'TICK', now)
    expect(s.rows[0]).toMatchObject({ status: 'done', actual: 5, prescriptionMet: true })
    expect(s.phase).toBe('rest')
    const next = command(s, 'TICK', 6000)
    expect(next.rows.filter(row => row.status === 'done')).toHaveLength(1)
    expect(validateSession(next)).toEqual(next)
  })
  it.each(['RECONCILE', 'TICK'])('unobserved expiry via %s enters review without credit or rest', type => {
    let s = start(one('time', { sets: 2 }))
    s = command(s, 'START', 0)
    s = command(s, 'BACKGROUND', 1000)
    s = command(s, type, 10000)
    expect(s.phase).toBe('review'); expect(s.rows[0].status).toBe('pending')
    expect(s.timer.kind).toBe('work')
    s = command(s, 'CONFIRM_REVIEW', 11000, { actual: 3 })
    expect(s.rows[0]).toMatchObject({ actual: 3, status: 'done', prescriptionMet: false })
    expect(s.phase).toBe('rest')
    expect(validateSession(s)).toEqual(s)
  })
  it('a long foreground callback gap requires review even without visibility notification', () => {
    let s = command(start(one('time')), 'START', 0)
    s = command(s, 'TICK', 6000)
    expect(s.phase).toBe('review'); expect(s.rows[0].actual).toBeNull()
  })
  it('returning before expiry can resume observation, and rest expiry only becomes ready', () => {
    let s = command(start(one('time', { sets: 2 })), 'START', 0)
    s = command(s, 'BACKGROUND', 1000); s = command(s, 'RECONCILE', 3000)
    s = command(s, 'TICK', 4000); s = command(s, 'TICK', 5000)
    expect(s.phase).toBe('rest')
    s = command(s, 'RECONCILE', 30000)
    expect(s.phase).toBe('ready'); expect(s.timer).toBeNull()
    expect(s.rows.filter(row => row.status === 'done')).toHaveLength(1)
  })
  it('early Done records actual elapsed and Stop retains partial without rest', () => {
    let s = command(start(one('time', { sets: 2 })), 'START', 0)
    s = command(s, 'DONE', 1000)
    expect(s.rows[0]).toMatchObject({ actual: 1, prescriptionMet: false })
    s = command(s, 'SKIP_REST', 2000); s = command(s, 'START', 3000)
    s = command(s, 'STOP', 5000)
    expect(s.phase).toBe('ready'); expect(s.timer).toBeNull()
    expect(s.rows[1]).toMatchObject({ actual: 2, status: 'stopped', prescriptionMet: false })
    s = command(s, 'START', 6000)
    expect(getSessionView(s, 6000).remainingSec).toBe(3)
  })
  it('pause/adjust/resume rest and undo affect only their recorded row', () => {
    let s = command(start(one('reps')), 'START', 0)
    s = command(s, 'DONE', 1000); s = command(s, 'PAUSE_REST', 4000)
    expect(getSessionView(s, 100000).remainingSec).toBe(7)
    s = command(s, 'ADJUST_REST', 100000, { deltaSec: 3 })
    s = command(s, 'RESUME_REST', 101000)
    expect(getSessionView(s, 101000).remainingSec).toBe(10)
    s = command(s, 'UNDO', 102000)
    expect(s.rows[0].status).toBe('pending'); expect(s.phase).toBe('ready'); expect(s.timer).toBeNull()
  })
  it('watch review contains no athletic quantity and never starts work', () => {
    let s = start(one('watch'))
    expect(command(s, 'START', 0)).toBe(s)
    s = command(s, 'ACKNOWLEDGE', 1000)
    expect(s.rows[0]).toMatchObject({ actual: null, status: 'done', prescriptionMet: true })
    s = command(s, 'FINISH', 2000)
    expect(s.status).toBe('completed')
    expect(command(s, 'UNDO', 3000)).toBe(s)
  })
  it('finishing active work saves observed partial effort without credit or rest', () => {
    let s = command(start(one('time')), 'START', 0)
    s = command(s, 'FINISH', 1500)
    expect(s.rows[0]).toMatchObject({ actual: 1.5, status: 'stopped', prescriptionMet: false })
    expect(s.status).toBe('partial'); expect(s.timer).toBeNull()
    expect(validateSession(s)).toEqual(s)
  })
  it('Stop or Finish from interrupted review excludes unobserved wall time', () => {
    let interrupted = command(start(one('time')), 'START', 0)
    interrupted = command(interrupted, 'BACKGROUND', 1000)
    interrupted = command(interrupted, 'RECONCILE', 30000)
    const stopped = command(interrupted, 'STOP', 31000)
    expect(stopped.rows[0]).toMatchObject({ actual: 1, status: 'stopped', prescriptionMet: false })
    const finished = command(interrupted, 'FINISH', 31000)
    expect(finished.rows[0].actual).toBe(1); expect(finished.status).toBe('partial')
    let resumed = command(stopped, 'START', 32000)
    expect(getSessionView(resumed, 32000).remainingSec).toBe(4)
    expect(resumed.rows[0].status).toBe('stopped')
  })
  it('resuming stopped time at or above target requires confirmation rather than implicit credit', () => {
    let s = command(start(one('time', { durationSec: 1 })), 'START', 0)
    s = command(s, 'STOP', 1500)
    expect(s.rows[0].actual).toBe(1.5)
    s = command(s, 'START', 2000); s = command(s, 'TICK', 2200)
    expect(s.phase).toBe('review'); expect(s.rows[0].prescriptionMet).toBe(false)
    expect(s.rows[0].status).toBe('stopped')
    s = command(s, 'CONFIRM_REVIEW', 3000, { actual: 1.5 })
    expect(s.rows[0].prescriptionMet).toBe(true)
  })
  it('finishes incomplete work honestly and keeps a completed snapshot immutable', () => {
    let s = start(assignment()); const initial = copy(s)
    s = command(s, 'FINISH', 1000)
    expect(s.status).toBe('partial'); expect(s.assignment).toEqual(initial.assignment)
    expect(command(s, 'START', 2000)).toBe(s)
  })
  it('completes the whole synthetic flow, with no private content', () => {
    let s = start(assignment()); let now = 0
    while (s.phase !== 'complete') {
      if (s.phase === 'rest') s = command(s, 'SKIP_REST', now += 1000)
      else if (getSessionView(s, now).currentRow.mode === 'watch') s = command(s, 'ACKNOWLEDGE', now += 1000)
      else {
        s = command(s, 'START', now += 1000)
        const duration = getSessionView(s, now).currentRow.mode === 'time' ? 5 : 1
        for (let i = 0; i < duration; i++) s = command(s, 'TICK', now += 1000)
        if (s.phase === 'working') s = command(s, 'DONE', now)
      }
      validateSession(s)
    }
    s = command(s, 'FINISH', now += 1000)
    expect(s.status).toBe('completed'); expect(s.rows).toHaveLength(6)
    expect(s.rows.filter(row => row.mode === 'watch')[0].actual).toBeNull()
  })
})
