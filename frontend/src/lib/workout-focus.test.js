import { describe, expect, it } from 'vitest'
import { focusSet, focusRest, focusLoadLabel, lastFocusSet } from './workout-focus.js'

const entry = (sets, target = {}) => ({ id: '0043', target, sets })
describe('the focus workspace reads existing workout semantics', () => {
  it('finds an unfinished unilateral side, including a zero-rep recorded left side', () => {
    const row = { done: false, sides: { L: { r: 0, done: true }, R: { r: 5, done: false } } }
    expect(focusSet({ entries: [entry([row])] }, 0)).toMatchObject({ setIdx: 0, side: 'R', set: { r: 5, done: false } })
  })
  it('uses the same warm-up and pyramid overrides as completion', () => {
    const active = { entries: [entry([{ warmup: true }, { warmup: true }, {}], { warmupRestSec: 30, restSec: 120 })] }
    expect(focusRest(active, 0, 0, 90)).toBe(30)
    expect(focusRest(active, 0, 1, 90)).toBe(120)
    active.entries[0] = entry([{}, {}], { pyramid: [12, 8], pyramidRest: [45, 150], restSec: 90 })
    expect(focusRest(active, 0, 0, 90)).toBe(45)
    expect(focusRest(active, 0, 1, 90)).toBe(150)
  })
  it('preserves added-weight and dumbbell meanings without converting data', () => {
    expect(focusLoadLabel(entry([], { bodyweight: true }), 'kg')).toEqual(['Added ({0})', 'kg'])
    expect(focusLoadLabel(entry([], { dbLoad: 'each' }), 'kg')).toEqual(['Each ({0})', 'kg'])
    expect(focusLoadLabel(entry([], { dbLoad: 'total' }), 'lb')).toEqual(['Both ({0})', 'lb'])
    expect(focusLoadLabel(entry([], { dbLoad: 'each', side: true }), 'kg')).toEqual(['Load ({0})', 'kg'])
  })
  it('tracks a completed side through reordering and respects the session boundary', () => {
    const logged = entry([{ at: 10, done: false, sides: { L: { r: 0, done: true }, R: { done: false } } }])
    const active = { id: 'session', entries: [entry([{ at: 20, done: true }]), logged] }
    const tracked = { sessionId: 'session', id: logged.id, at: 10, side: 'L' }
    expect(lastFocusSet(active, tracked)).toMatchObject({ entryIdx: 1, side: 'L', set: { r: 0 } })
    active.entries.reverse()
    expect(lastFocusSet(active, tracked)).toMatchObject({ entryIdx: 0, side: 'L' })
    expect(lastFocusSet({ ...active, id: 'new' }, tracked)).toMatchObject({ entryIdx: 1, at: 20 })
  })
})
