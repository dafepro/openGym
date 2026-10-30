import { describe, expect, it } from 'vitest'
import { createObservedClock } from './observed-clock.js'
import { createSession, getSessionView, reduceSession } from '../domain/index.js'

const assignment = { id: 'clock-test', revision: 'v1', title: 'Synthetic clock test', status: 'current', drills: [{ id: 'timed', title: 'Synthetic timer', instructions: 'Test fixture only', mode: 'time', sets: 1, durationSec: 60, restSec: 10, side: 'both', media: { id: 'missing', status: 'unavailable' } }] }
const working = () => {
  const session = createSession(assignment, { id: 'session-clock', now: 100000 })
  return reduceSession(session, { type: 'START', id: 'start-clock', sessionId: session.id, rowId: session.currentRowId, now: 100000 })
}

describe('observed foreground clock', () => {
  it('does not extend work when the wall clock rolls back', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    const session = working()
    mono = 1000; wall = 41000
    expect(getSessionView(session, clock.now()).remainingSec).toBe(59)
    const recovery = clock.reconcileTime(session)
    expect(recovery.clockChanged).toBe(true)
    const reviewed = reduceSession(session, { type: 'RECONCILE', id: 'clock-review', sessionId: session.id, now: recovery.now })
    expect(reviewed.phase).toBe('review')
    expect(reviewed.rows[0].status).toBe('pending')
    expect(reviewed.timer.kind).toBe('work')
  })

  it('recognizes a persisted work checkpoint ahead of the reloaded wall clock', () => {
    const clock = createObservedClock({ wall: () => 40000, monotonic: () => 0 })
    const recovery = clock.reconcileTime(working())
    expect(recovery.clockChanged).toBe(true)
    expect(recovery.now).toBe(160000)
  })

  it('expires rest after sleep even when the monotonic platform clock paused', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    const rest = { timer: { kind: 'rest', deadline: 110000, paused: false } }
    wall = 400000; mono = 1000
    expect(clock.reconcileTime(rest).now).toBe(400000)
    expect(clock.now()).toBe(400000)
  })

  it('accepts a detected offset once so new work is not permanently interrupted', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    mono = 1000; wall = 200000
    expect(clock.reconcileTime(null).clockChanged).toBe(true)
    mono = 2000; wall = 201000
    expect(clock.reconcileTime(null).clockChanged).toBe(false)
    expect(clock.now()).toBe(201000)
  })

  it('preserves newly earned rest across reload after work interruption review', () => {
    let wall = 100000, mono = 0
    const clock = createObservedClock({ wall: () => wall, monotonic: () => mono })
    let session = createSession({ ...assignment, drills: [{ ...assignment.drills[0], sets: 2 }] }, { id: 'sleep-session', now: clock.now() })
    session = reduceSession(session, { type: 'START', id: 'sleep-start', sessionId: session.id, rowId: session.currentRowId, now: clock.now() })
    wall = 400000; mono = 1000
    session = reduceSession(session, { type: 'RECONCILE', id: 'sleep-review', sessionId: session.id, now: clock.reconcileTime(session).now })
    expect(session.phase).toBe('review')
    expect(session.rows[0].status).toBe('pending')
    session = reduceSession(session, { type: 'CONFIRM_REVIEW', id: 'sleep-confirm', sessionId: session.id, rowId: session.currentRowId, actual: 60, now: clock.now() })
    expect(session.timer.deadline).toBe(410000)
    const reloadedClock = createObservedClock({ wall: () => 400000, monotonic: () => 0 })
    session = reduceSession(session, { type: 'RECONCILE', id: 'sleep-reload', sessionId: session.id, now: reloadedClock.reconcileTime(session).now })
    expect(session.phase).toBe('rest')
    expect(getSessionView(session, reloadedClock.now()).remainingSec).toBe(10)
  })
})
