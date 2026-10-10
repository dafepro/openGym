import { describe, expect, it } from 'vitest'
import { bindWatchLayout, watchSnapshot, applyWatchOperations } from './garmin.js'
import { defaultWatchPreferences, isWatchSnapshot } from '../../../shared/garmin.ts'
import { focusSet, focusFlowEntries } from './workout-focus.js'
import { cloudState } from './cloud-sync.js'
const NOW = Date.UTC(2026, 9, 10, 12)
export function state() {
  const S = { unit: 'kg', restSec: 90, workouts: [], routines: [], exWeights: {}, active: { id: 'test-watch', name: 'Test', d: '2026-10-10', start: NOW - 60000, cur: 0,
    entries: [{ id: '0043', target: { reps: 5 }, sets: [{ w: 20, r: 5, phase: 'warmup', done: false }, { w: 40, r: 5, done: false }, { w: 40, r: 5, done: false }] },
      { id: '0025', target: { reps: 5 }, sets: [{ w: 40, r: 5, done: false }] }] } }
  bindWatchLayout(S); return S
}
const snapshot = S => watchSnapshot(S, defaultWatchPreferences)
function event(S, { set = 0, scope = 'work', seq = 1, ...rest } = {}) {
  const s = scope === 'warmup' ? snapshot(S).workout.prep.stations[0].warmups[set] : snapshot(S).workout.sets.filter(s => s[0] === 0)[set]
  return { id: `${S.active.id}:${scope === 'warmup' ? 'warmup:' : ''}0:${set}:${seq}`, session: S.active.id, lift: 0, set, scope, expected: scope === 'warmup' ? [s[1], s[2]] : [s[3], s[4]],
    exercise: snapshot(S).workout.sets[0][2], reps: 5, weight: 40, unit: 'kg', at: NOW / 1000, ...rest }
}
function command(S, kind, extra = {}) { return { id: `${S.active.id}:cmd:10`, session: S.active.id, at: NOW / 1000, kind, ...extra } }
const apply = (S, events = [], commands = [], ui = {}) => applyWatchOperations(S, events, commands, ui, NOW)
describe('Uplift Garmin protocol adapter', () => {
  it('sends bounded preparation, work and warm-up tuples with the original v1 contract', () => {
    const s = snapshot(state()); expect(isWatchSnapshot(s)).toBe(true)
    expect(s.workout.sets).toHaveLength(3); expect(s.workout.prep.stations[0].warmups).toEqual([[0, 20, 5, -1]])
    expect(s.workout.prep.stations[0].loads[1][2]).toEqual([[10, 1]])
  })
  it('saves zero reps distinctly, deduplicates delivery and does not mutate the input', () => {
    const S = state(); S.active.entries[0]._watchPhase = 'work'
    const e = event(S, { reps: 0 }), result = apply(S, [e])
    expect(result.state.active.entries[0].sets[1]).toMatchObject({ done: true, r: 0, at: NOW })
    expect(S.active.entries[0].sets[1].done).toBe(false)
    expect(apply(result.state, [e]).effects).toEqual([])
    expect(result.state._watch.receipts).toEqual([{ id: e.id, status: 'saved' }])
  })
  it('records warm-ups separately and advances preparation when its ramp completes', () => {
    const S = state(); S.active.entries[0]._watchPhase = 'warmup'
    const next = apply(S, [event(S, { scope: 'warmup', reps: 0, weight: 20 })]).state
    expect(next.active.entries[0].sets[0]).toMatchObject({ done: true, r: 0, phase: 'warmup' })
    expect(next.active.entries[0].sets[1].done).toBe(false)
    expect(next.active.entries[0]._watchPhase).toBe('work')
  })
  it.each(['weight', 'exercise', 'unit', 'session', 'future', 'paused', 'phase'])('reviews a stale %s rather than overwriting phone results', key => {
    const S = state(); S.active.entries[0]._watchPhase = 'work'
    const e = event(S), ui = {}
    if (key === 'weight') S.active.entries[0].sets[1].w = 45
    if (key === 'exercise') e.exercise = 'Wrong exercise'
    if (key === 'unit') e.unit = 'lb'
    if (key === 'session') { e.session = 'old'; e.id = 'old:0:0:1' }
    if (key === 'future') e.at += 3600
    if (key === 'paused') ui.timer = { paused: true }
    if (key === 'phase') S.active.entries[0]._watchPhase = 'setup'
    const next = apply(S, [e], [], ui).state
    expect(next.active.entries[0].sets[1].done).toBe(false)
    expect(next._watch.receipts[0].status).toBe('review')
  })
  it('invalidates reordered identical exercises and rebuilt row identities', () => {
    const S = state(); S.active.entries.reverse(); expect(snapshot(S).workout).toBe(null)
    const other = state(); other.active.entries[0].sets[1] = { w: 40, r: 5, done: false }; expect(snapshot(other).workout).toBe(null)
  })
  it('directs unsupported timed, cardio, superset and drop sessions to phone', () => {
    for (const change of [e => { e.target.mode = 'time' }, e => { e.target.mode = 'cardio' }, e => { e.sg = 'pair' }, e => { e.sets[1].type = 'dropset' }]) {
      const S = state(); change(S.active.entries[0]); expect(snapshot(S).issue).toBe('Use phone for this workout')
    }
  })
  it('skips only pending working sets while preserving completed zero and unattempted warm-ups', () => {
    const S = state(); S.active.entries[0]._watchPhase = 'work'; S.active.entries[0].sets[1] = { ...S.active.entries[0].sets[1], done: true, r: 0 }
    const c = command(S, 'skip-exercise', { lift: 0, expected: snapshot(S).workout.sets.filter(s => s[0] === 0 && s[6] === -1) })
    const next = apply(S, [], [c]).state
    expect(next.active.entries[0].sets[0].done).toBe(false)
    expect(next.active.entries[0].sets[1].r).toBe(0)
    expect(next.active.entries[0].sets[2]).toMatchObject({ done: false, skipped: true, r: null })
    expect(next.active.cur).toBe(1)
    expect(focusSet(next.active, 0).row).toBeUndefined()
    expect(focusFlowEntries(next.active)[0].sets.every(s => s.done)).toBe(true)
  })
  it('guards preparation and keeps bypassed warm-ups unrecorded', () => {
    const S = state(), c = command(S, 'prepare', { lift: 0, from: 'setup', to: 'work', expected: snapshot(S).workout.sets.filter(s => s[0] === 0 && s[6] === -1) })
    expect(apply(S, [], [c]).state.active.entries[0]._watchPhase).toBe('work')
    c.expected[0][3] = 45; expect(apply(S, [], [c]).state._watch.receipts[0].status).toBe('review')
  })
  it('uses original finish time, volume and shared progression; excludes wire IDs and receipts from cloud', () => {
    const S = state(); S.active.entries[0]._watchPhase = 'work'
    const next = apply(S, [event(S)]).state, c = command(next, 'finish', { recorded: 1, total: 3, warmups: 0 })
    const finished = apply(next, [], [c]).state
    expect(finished.active).toBeNull(); expect(finished.workouts[0].end).toBe(NOW)
    expect(finished.workouts[0].vol).toBe(200); expect(finished.exWeights['0043'].w).toBe(40)
    expect(finished.workouts[0].entries[0].sets[1]._watchKey).toBeUndefined()
    expect(cloudState(finished)._watch).toBeUndefined()
  })
  it('withholds receipts when review is full and rejects malformed operations as a batch', () => {
    const S = state(); S._watch = { receipts: [], review: Array.from({ length: 60 }, () => ({ operation: { session: 'old' } })) }
    expect(apply(S, [event(S)]).state._watch.receipts).toEqual([])
    expect(() => apply(S, [event(S), { nope: true }])).toThrow()
  })
})

it('reports explicit recovery deadlines for all stations while switching during rest', () => {
  const S = state(); S.active.entries[0]._watchPhase = 'work'
  const ui = { timer: { endsAt: NOW + 90000, forIdx: 0, left: 90, total: 90 } }
  const c = command(S, 'station', { lift: 1, from: 0, expected: watchSnapshot(S).workout.sets.filter(s => s[0] === 1 && s[6] === -1) })
  const next = apply(S, [], [c], ui)
  const w = watchSnapshot(next.state, defaultWatchPreferences, ui).workout
  expect(w.rest).toBe(0); expect(w.rests).toEqual([[0, (NOW + 90000) / 1000], [1, 0]])
  expect(next.effects).toContainEqual({ kind: 'station', lift: 1, deadline: 0 })
})
it('retains an entirely skipped station in finished history without claiming completed work', () => {
  const S = state(); S.active.entries[0]._watchPhase = 'work'
  const recorded = apply(S, [event(S)]).state
  recorded.active.cur = 1; recorded.active.entries[1]._watchPhase = 'work'
  const skip = command(recorded, 'skip-exercise', { lift: 1, expected: watchSnapshot(recorded).workout.sets.filter(s => s[0] === 1) })
  const skipped = apply(recorded, [], [skip]).state
  const finish = { ...command(skipped, 'finish', { recorded: 1, total: 3, warmups: 0 }), id: 'test-watch:cmd:11' }
  const done = apply(skipped, [], [finish]).state
  expect(done.workouts[0].entries[1].sets[0]).toMatchObject({ skipped: true, done: false, r: null })
  expect(done.workouts[0].vol).toBe(200)
})
it('marks a warmup-only finish so it cannot advance the program queue', () => {
  const S = state(); S.active.entries[0]._watchPhase = 'warmup'
  const warm = apply(S, [event(S, { scope: 'warmup', weight: 20 })]).state
  const finish = command(warm, 'finish', { recorded: 0, total: 3, warmups: 1 })
  const done = apply(warm, [], [finish]).state
  expect(done.workouts[0].warmupOnly).toBe(true); expect(done.workouts[0].vol).toBe(0)
})
it.each(['setup', 'warmup'])('accepts firmware skip-exercise from %s and keeps untouched warm-ups unrecorded', phase => {
  const S = state(); S.active.entries[0]._watchPhase = phase
  const c = command(S, 'skip-exercise', { lift: 0, expected: snapshot(S).workout.sets.filter(s => s[0] === 0) })
  const next = apply(S, [], [c]).state
  expect(next._watch.receipts[0].status).toBe('saved')
  expect(next.active.entries[0].sets[0]).toMatchObject({ done: false, r: 5 })
  expect(next.active.entries[0].sets[1]).toMatchObject({ skipped: true, done: false, r: null })
  expect(next.active.cur).toBe(1)
})
it('matches firmware setup reset when automatically advancing to a previously prepared station', () => {
  const S = state(); S.active.entries[0]._watchPhase = 'work'; S.active.entries[1]._watchPhase = 'work'
  S.active.entries[0].sets[1].done = true
  const next = apply(S, [event(S, { set: 1 })]).state
  expect(next.active.cur).toBe(1)
  expect(snapshot(next).workout.prep.stations[1].phase).toBe('setup')
  const prep = command(next, 'prepare', { lift: 1, from: 'setup', to: 'work', expected: snapshot(next).workout.sets.filter(s => s[0] === 1) })
  expect(apply(next, [], [prep]).state._watch.receipts.at(-1).status).toBe('saved')
})
it('labels skipped history distinctly from a recorded zero', async () => {
  const { setLabel } = await import('./history.js')
  expect(setLabel('0043', { w: 40, r: null, skipped: true, done: false })).toBe('Skipped')
  expect(setLabel('0043', { w: 40, r: 0, done: true })).toBe('40×0')
})
it('matches the firmware global first work station after finishing a station out of order', () => {
  const S = state(); S.active.entries.push({ ...structuredClone(S.active.entries[1]), _watchKey: 'third', sets: [{ w: 40, r: 5, done: false, _watchKey: 'third-row' }] })
  delete S.active._watchLayout; bindWatchLayout(S)
  S.active.cur = 1; S.active.entries[1]._watchPhase = 'work'
  const row = snapshot(S).workout.sets.find(s => s[0] === 1)
  const e = { ...event(S), id: 'test-watch:1:0:1', lift: 1, set: 0, exercise: row[2], expected: [row[3], row[4]] }
  const next = apply(S, [e]).state
  expect(next.active.cur).toBe(0)
  expect(snapshot(next).workout.prep.stations[0].phase).toBe('setup')
})
it('skips past stations with only untouched warmups when selecting the next working station', () => {
  const S = state(); S.active.entries.push({ ...structuredClone(S.active.entries[1]), _watchKey: 'third', sets: [{ w: 40, r: 5, done: false, _watchKey: 'third-row' }] })
  delete S.active._watchLayout; bindWatchLayout(S)
  S.active.entries[0].sets[1].skipped = true; S.active.entries[0].sets[2].skipped = true
  S.active.cur = 2
  const c = command(S, 'skip-exercise', { lift: 2, expected: snapshot(S).workout.sets.filter(s => s[0] === 2) })
  const next = apply(S, [], [c]).state
  expect(next.active.cur).toBe(1)
  expect(next.active.entries[0].sets[0].done).toBe(false)
  expect(next.active.entries[2]._watchSkipWarmups).toBe(true)
})
