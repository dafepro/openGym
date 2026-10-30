import { describe, expect, it } from 'vitest'
import { createObservedClock } from './observed-clock.js'
import { createSession, getSessionView, reduceSession, validateSession } from '../domain/index.js'
import { exportProgress, parseProgressExport } from '../storage/index.js'

const assignment = { id: 'clock-test', revision: 'v1', title: 'Synthetic clock test', status: 'current', drills: [{ id: 'timed', title: 'Synthetic timer', instructions: 'Test fixture only', mode: 'time', sets: 2, durationSec: 60, restSec: 10, side: 'both', media: { id: 'missing', status: 'unavailable' } }] }
const repsAssignment = { ...assignment, drills: [{ ...assignment.drills[0], mode: 'reps', durationSec: undefined, reps: 4 }] }
let commandNumber = 0
const send = (session, type, now, fields = {}) => reduceSession(session, { type, id: `clock-command-${++commandNumber}`, sessionId: session.id, rowId: session.currentRowId, now, ...fields })
const reconcile = (session, clock) => {
  const check = clock.reconcileTime(session)
  return send(session, check.clockChanged ? 'CLOCK_CHANGE' : 'RECONCILE', check.now, check)
}
const working = (content = assignment) => send(createSession(content, { id: 'session-clock', now: 100000 }), 'START', 100000)
const resting = () => send(send(createSession(repsAssignment, { id: 'session-rest', now: 98000 }), 'START', 99000), 'DONE', 100000)
const roundTrip = session => parseProgressExport(exportProgress({ schemaVersion: 1, revision: 0, activeSession: session, sessions: [] }, { now: 500000 })).activeSession

describe('observed foreground clock', () => {
  it('uses monotonic foreground time and sends backward timed work to review without credit', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    let session = working()
    mono = 1000; wall = 41000
    expect(getSessionView(session, clock.now()).remainingSec).toBe(59)
    session = reconcile(session, clock)
    expect(clock.now()).toBe(41000)
    expect(session.phase).toBe('review')
    expect(session.rows[0].status).toBe('pending')
    expect(session.timer.kind).toBe('work')
    expect(getSessionView(session, clock.now()).elapsedSec).toBe(1)
    expect(() => validateSession(roundTrip(session))).not.toThrow()
  })

  it('lets an explicit reps Done pass after real elapsed time despite a backward wall change', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    let session = working(repsAssignment)
    mono = 1000; wall = 41000
    session = reconcile(session, clock)
    expect(session.rows[0].status).toBe('pending')
    expect(session.lastActionAt).toBe(40000)
    mono = 2000; wall = 42000
    session = send(session, 'DONE', clock.now(), { actual: 3 })
    expect(session.rows[0]).toMatchObject({ status: 'done', actual: 3, prescriptionMet: false })
    expect(session.phase).toBe('rest')
    expect(getSessionView(session, clock.now()).remainingSec).toBe(10)
    expect(() => validateSession(roundTrip(session))).not.toThrow()
    const finished = send(session, 'FINISH', clock.now())
    const saved = parseProgressExport(exportProgress({ schemaVersion: 1, revision: 1, activeSession: null, sessions: [finished] }, { now: clock.now() })).sessions[0]
    expect(saved.endedAt).toBe(42000)
    expect(saved.startedAt).toBe(100000)
    expect(saved.rows[0]).toMatchObject({ status: 'done', actual: 3, prescriptionMet: false })
    expect(saved.rows[1].status).toBe('pending')
    expect(saved.status).toBe('partial')
    expect(saved.assignment).toEqual(session.assignment)
    expect(() => validateSession(saved)).not.toThrow()
  })

  it('recovers a reps gesture checkpoint after a reload with a backward wall clock', () => {
    let mono = 0
    const clock = createObservedClock({ wall: () => 40000 + mono, monotonic: () => mono })
    let session = reconcile(working(repsAssignment), clock)
    expect(session.lastActionAt).toBe(40000)
    mono = 100
    expect(send(session, 'DONE', clock.now())).toBe(session)
    mono = 1000
    session = send(session, 'DONE', clock.now(), { actual: 4 })
    expect(session.rows[0].actual).toBe(4)
    expect(session.rows[0].status).toBe('done')
  })

  it('preserves nine seconds of a ten-second rest through a backward epoch shift and reload', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    let session = resting()
    mono = 1000; wall = 41000
    session = reconcile(session, clock)
    expect(session.timer.deadline).toBe(50000)
    expect(getSessionView(session, clock.now()).remainingSec).toBe(9)
    expect(session.rows.filter(row => row.status === 'done')).toHaveLength(1)
    mono = 2000; wall = 42000
    const reloadedClock = createObservedClock({ wall: () => wall, monotonic: () => 0 })
    session = reconcile(roundTrip(session), reloadedClock)
    expect(getSessionView(session, reloadedClock.now()).remainingSec).toBe(8)
    expect(() => validateSession(session)).not.toThrow()
  })

  it('bounds rest to its known remainder when reload loses the old monotonic anchor', () => {
    const clock = createObservedClock({ wall: () => 40000, monotonic: () => 0 })
    const session = reconcile(resting(), clock)
    expect(getSessionView(session, clock.now()).remainingSec).toBe(10)
    expect(session.timer.deadline).toBe(50000)
  })

  it('keeps paused rest frozen across rollback and resumes from that remainder', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    let session = send(resting(), 'PAUSE_REST', 100500)
    mono = 1000; wall = 41000
    session = reconcile(session, clock)
    expect(getSessionView(session, clock.now()).remainingSec).toBe(9.5)
    mono = 6000; wall = 46000
    expect(getSessionView(session, clock.now()).remainingSec).toBe(9.5)
    session = send(session, 'RESUME_REST', clock.now())
    expect(session.timer.deadline).toBe(55500)
    expect(() => validateSession(roundTrip(session))).not.toThrow()
  })

  it('expires rest after sleep even when the platform monotonic clock paused', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    mono = 1000; wall = 400000
    const session = reconcile(resting(), clock)
    expect(session.phase).toBe('ready')
    expect(session.timer).toBeNull()
    expect(session.rows.filter(row => row.status === 'done')).toHaveLength(1)
  })

  it('retains resumed partial-work evidence across rollback without credit or rest', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    let session = working()
    mono = 2000; wall = 102000; session = send(session, 'TICK', clock.now())
    mono = 3000; wall = 103000; session = send(session, 'STOP', clock.now())
    expect(session.rows[0].actual).toBe(3)
    mono = 4000; wall = 104000; session = send(session, 'START', clock.now())
    mono = 5000; wall = 45000; session = reconcile(session, clock)
    expect(session.phase).toBe('review')
    expect(session.rows[0]).toMatchObject({ status: 'stopped', actual: 3, prescriptionMet: false })
    expect(getSessionView(session, clock.now()).elapsedSec).toBe(4)
    expect(() => validateSession(roundTrip(session))).not.toThrow()
    mono = 6000; wall = 46000; session = send(session, 'STOP', clock.now())
    expect(session.rows[0].actual).toBe(4)
    expect(session.phase).toBe('ready')
    expect(session.timer).toBeNull()
  })

  it('applies an epoch change only once even while a slow persistence queue holds the old checkpoint', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    const original = resting()
    mono = 1000; wall = 41000
    const shift = clock.reconcileTime(original)
    mono = 2000; wall = 42000
    expect(clock.reconcileTime(original).clockChanged).toBe(false)
    const shifted = send(original, 'CLOCK_CHANGE', shift.now, shift)
    expect(send(shifted, 'CLOCK_CHANGE', shift.now, shift)).toBe(shifted)
    expect(getSessionView(shifted, clock.now()).remainingSec).toBe(8)
  })

  it('rejects missing, nonfinite or inconsistent clock-change proof without mutating work', () => {
    const original = working()
    const valid = { previousNow: 101000, clockShiftMs: -60000, clockRevision: 0 }
    for (const fields of [{ ...valid, previousNow: undefined }, { ...valid, clockShiftMs: NaN }, { ...valid, clockShiftMs: Infinity }, { ...valid, clockShiftMs: 1 }, { ...valid, clockRevision: undefined }, { ...valid, clockRevision: 1 }]) {
      expect(send(original, 'CLOCK_CHANGE', 41000, fields)).toBe(original)
    }
  })

  it('preserves newly earned rest across reload after interrupted-work confirmation', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    let session = working()
    mono = 1000; wall = 400000; session = reconcile(session, clock)
    expect(session.phase).toBe('review')
    expect(session.rows[0].status).toBe('pending')
    session = send(session, 'CONFIRM_REVIEW', clock.now(), { actual: 60 })
    expect(session.timer.deadline).toBe(410000)
    const reloadedClock = createObservedClock({ wall: () => 400000, monotonic: () => 0 })
    session = reconcile(roundTrip(session), reloadedClock)
    expect(session.phase).toBe('rest')
    expect(getSessionView(session, reloadedClock.now()).remainingSec).toBe(10)
  })
})
