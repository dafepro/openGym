import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { recommendationPrescription, achievableRecommendationLoad } from './recommendation-prescription.js'
import { buildWorkoutAddition } from './workout-addition.js'
const NOW = Date.UTC(2026, 9, 22, 12),
  DAY = 86400000,
  ID = '0025'
const base = (extra = {}) => ({
  unit: 'kg',
  restSec: 150,
  routines: [],
  workouts: [],
  exWeights: { [ID]: { w: 300, d: '2026-10-21' } },
  active: { id: 'a', start: NOW - 1200000, cur: 0, entries: [] },
  ...extra
})
const match = (id = ID) => ({ exercise: EXIDX[id], fatigue: 0.1 })
const history = (ago = DAY, { target = { sets: 3, reps: 10, weight: 40 }, row = {}, ...more } = {}) => ({
  d: new Date(NOW - ago).toISOString().slice(0, 10),
  start: NOW - ago,
  entries: [
    { id: ID, rid: 'r', target, sets: Array.from({ length: 3 }, () => ({ w: 40, r: 10, done: true, ...row })) }
  ],
  ...more
})
const propose = (s, m = match()) => recommendationPrescription(s, m, { now: NOW })

describe('personalized addition prescription', () => {
  it('uses the explicit current plan, optional sets and its rep/rest targets', () => {
    const s = base({ routines: [{ id: 'r', ex: [{ id: ID, sets: 5, reps: 5, weight: 60, restSec: 180 }] }] })
    expect(propose(s)).toMatchObject({ source: 'plan', config: { sets: 2, reps: 5, weight: 60, restSec: 180 } })
    expect(s.routines[0].ex[0].sets).toBe(5)
  })
  it('uses recent performed loads instead of the historic-best cache', () => {
    expect(propose(base({ workouts: [history()] }))).toMatchObject({
      source: 'recent',
      config: { weight: 40, reps: 10, sets: 2, restSec: 150 }
    })
  })
  it('keeps stale, future, skipped, warm-up and unrecorded loads unset', () => {
    for (const record of [
      history(22 * DAY),
      history(-DAY),
      history(DAY, { row: { skipped: true } }),
      history(DAY, { row: { phase: 'warmup' } }),
      history(DAY, { row: { done: false } })
    ])
      expect(propose(base({ workouts: [record] }))).toMatchObject({
        needsWeight: true,
        source: 'unset',
        config: { weight: 0 }
      })
  })
  it('converts kg/lb stamps and respects available plates and dumbbells', () => {
    expect(
      propose(
        base({ workouts: [history(DAY, { unit: 'lb', target: { sets: 3, reps: 10, weight: 100 }, row: { w: 100 } })] })
      ).config.weight
    ).toBe(45)
    expect(achievableRecommendationLoad(base(), { id: ID }, 19)).toBe(0)
    const db = Object.values(EXIDX).find((ex) => ex.eq === 'dumbbell')
    const s = base({ dumbbells: { kg: { weights: [10, 15, 20] } } })
    expect(achievableRecommendationLoad(s, { id: db.id }, 17)).toBe(15)
    expect(achievableRecommendationLoad(s, { id: db.id }, 9)).toBe(0)
  })
  it('uses chosen progression but never proposes a harder ordinary load after high effort', () => {
    const routine = { id: 'r', prog: 'linear', ex: [{ id: ID, sets: 3, reps: 10, weight: 40, prog: 'linear' }] }
    expect(propose(base({ routines: [routine], workouts: [history()] })).config.weight).toBe(42.5)
    const off = { ...routine, ex: [{ ...routine.ex[0], prog: 'off' }] }
    expect(propose(base({ routines: [off], workouts: [history()] })).config.weight).toBe(40)
    const p = propose(base({ restSec: 60, routines: [routine], workouts: [history(DAY, { row: { failure: true } })] }))
    expect(p.config.weight).toBeLessThanOrEqual(40)
    expect(p.config.sets).toBe(1)
    expect(p.config.restSec).toBeGreaterThanOrEqual(120)
    expect(propose(base({ restSec: 0, workouts: [history(DAY, { row: { failure: true } })] })).config.restSec).toBe(0)
  })
  it('uses volume to manage late additions, preserving rest', () => {
    const s = base({ workouts: [history()] })
    s.active.start = NOW - 58 * 60000
    expect(propose(s).config).toMatchObject({ sets: 1, restSec: 150 })
  })
  it('resolves a zero exercise override as the default rest, matching the live controller', () => {
    const s = base({ routines: [{ id: 'r', ex: [{ id: ID, weight: 40, restSec: 0 }] }] })
    expect(propose(s).config.restSec).toBe(150)
  })
  it('respects each/total dumbbell meanings and never uses body mass as added load', () => {
    const db = Object.values(EXIDX).find((ex) => ex.eq === 'dumbbell' && /bench press/.test(ex.n))
    const s = base({
      dbLoad: { [db.id]: { mode: 'each' } },
      dumbbells: { kg: { weights: [10, 15, 20] } },
      workouts: [
        {
          start: NOW - DAY,
          entries: [
            {
              id: db.id,
              target: { sets: 3, reps: 8, weight: 40, dbLoad: 'total' },
              sets: [{ w: 40, r: 8, done: true }]
            }
          ]
        }
      ]
    })
    expect(propose(s, match(db.id)).config).toMatchObject({ weight: 20, dbLoad: 'each' })
    expect(s.workouts[0].entries[0].sets[0].w).toBe(40)
    const bw = Object.values(EXIDX).find((ex) => ex.eq === 'body weight' && ex.n === 'push-up')
    expect(
      propose(
        base({ bodyweight: [90], routines: [{ id: 'r', ex: [{ id: bw.id, bodyweight: true, weight: 0, reps: 10 }] }] }),
        match(bw.id)
      ).config.weight
    ).toBe(0)
    expect(
      propose(
        base({ routines: [{ id: 'r', ex: [{ id: bw.id, bodyweight: true, weight: 10, reps: 8 }] }] }),
        match(bw.id)
      ).config.weight
    ).toBe(10)
  })
  it('uses only the performed limb of a partial unilateral row', () => {
    const s = base({
      workouts: [
        history(DAY, {
          target: { sets: 3, reps: 10, weight: 20, side: true },
          row: {
            done: false,
            sides: { L: { done: true, w: 20, r: 5 }, R: { done: false, w: 100, r: 0 } }
          }
        })
      ]
    })
    expect(propose(s)).toMatchObject({ hardLastTime: false, config: { side: true, weight: 20, reps: 10 } })
  })
  it('rounds assistance toward more help and responds equally to RIR, RPE and zero-rep misses', () => {
    const assisted = Object.values(EXIDX).find((ex) => /assisted/.test(ex.n) && ex.eq !== 'body weight')
    expect(achievableRecommendationLoad(base(), { id: assisted.id, inc: 5 }, 22)).toBe(25)
    const loaded = base({ loadKind: { [assisted.id]: { kind: 'single' } }, plates: { kg: { 5: 1 } } })
    expect(achievableRecommendationLoad(loaded, { id: assisted.id }, 7)).toBe(10)
    expect(achievableRecommendationLoad(loaded, { id: assisted.id }, 11)).toBe(0)
    for (const row of [{ rir: 1 }, { rpe: 9 }, { r: 0 }]) {
      expect(propose(base({ restSec: 60, workouts: [history(DAY, { row })] }))).toMatchObject({
        hardLastTime: true,
        config: { sets: 1, restSec: 150 }
      })
    }
  })
  it('prefers the active routine and leaves manual catalogue additions eligible for progression', () => {
    const s = base({
      routines: [
        { id: 'other', ex: [{ id: ID, weight: 70, reps: 5 }] },
        { id: 'current', ex: [{ id: ID, weight: 30, reps: 12 }] }
      ]
    })
    s.active.routineId = 'current'
    expect(propose(s).config).toMatchObject({ weight: 30, reps: 12 })
    expect(
      buildWorkoutAddition(s, { id: ID, sets: 1, reps: 6, weight: 25 }, { optional: false }).noProg
    ).toBeUndefined()
  })
  it('commits exactly the reviewed load without mutating history or crediting a full routine', () => {
    const s = base({ workouts: [history()] }),
      before = JSON.stringify(s)
    const built = buildWorkoutAddition(s, { id: ID, sets: 2, reps: 8, weight: 35, restSec: 180 })
    expect(built.sets).toEqual([
      { w: 35, r: 8, done: false },
      { w: 35, r: 8, done: false }
    ])
    expect(built.target.restSec).toBe(180)
    expect(built.noProg).toBe(true)
    expect(JSON.stringify(s)).toBe(before)
  })
})

const byName = (name) => Object.values(EXIDX).find((ex) => ex.n === name)
const front = byName('dumbbell front raise')
const frontMatch = { exercise: front, fatigue: 0.1 }
const recentWork = (ex, sets, extra = {}) => ({
  start: NOW - DAY,
  source: 'Hevy',
  entries: [{ id: ex.id, sets }],
  ...extra
})
const done = (w, r, more = {}) => ({ w, r, done: true, ...more })
describe('evidence-based exercise setup', () => {
  it('uses recent imported actual work without requiring an app target, never an old export', () => {
    const s = base({
      unit: 'lb',
      workouts: [recentWork(front, [done(15, 12, { u: 'lb' }), done(15, 12, { u: 'lb' })])]
    })
    expect(propose(s, frontMatch)).toMatchObject({
      needsWeight: false,
      source: 'recent',
      config: { sets: 2, reps: 12, weight: 15, restSec: 150 }
    })
    s.workouts[0].start = NOW - 22 * DAY
    expect(propose(s, frontMatch)).toMatchObject({ needsWeight: true, config: { weight: 0 } })
  })
  it('uses completed work today and holds optional/non-progressing work without granting progression', () => {
    const s = base({
      routines: [{ id: 'r', prog: 'linear', ex: [{ id: ID, sets: 3, reps: 10, weight: 0 }] }],
      workouts: [history()]
    })
    s.active.entries = [
      { id: ID, noProg: true, target: { sets: 2, reps: 10 }, sets: [done(30, 10), done(999, 10, { done: false })] }
    ]
    expect(propose(s).config).toMatchObject({ sets: 2, weight: 30, reps: 10 })
    s.active.entries = []
    s.workouts.push({ ...history(0.5 * DAY, { row: { w: 25 } }), source: 'StrongLifts' })
    expect(propose(s).config.weight).toBe(25)
    s.workouts.at(-1).source = undefined
    s.workouts.at(-1).entries[0].noProg = true
    expect(propose(s).config.weight).toBe(25)
  })
  it('fills missing plan fields but preserves explicitly chosen reps and rest', () => {
    const s = base({
      routines: [{ id: 'r', ex: [{ id: ID, weight: 0, restSec: 180 }] }],
      workouts: [history(DAY, { target: null, row: { r: 6 } })]
    })
    expect(propose(s).config).toMatchObject({ weight: 40, reps: 6, restSec: 180 })
    s.routines[0].ex[0].reps = 12
    expect(propose(s).config).toMatchObject({ reps: 12, restSec: 180 })
    expect(propose(s).config.weight).toBeLessThan(40)
  })
  it('gives an unknown raise higher reps, a compound longer rest and a hold a duration', () => {
    expect(propose(base({ restSec: 90 }), frontMatch)).toMatchObject({
      needsWeight: true,
      config: { sets: 2, reps: 12, restSec: 90 }
    })
    expect(propose(base({ restSec: 90 })).config).toMatchObject({ reps: 8, restSec: 150 })
    const plank = byName('kneeling plank')
    expect(propose(base(), { exercise: plank, fatigue: 0 })).toMatchObject({
      needsWeight: false,
      config: { mode: 'time', sec: 45 }
    })
    expect(propose(base({ restSec: 0 })).config.restSec).toBe(0)
  })
  it('normalizes target-less kg/lb work and ignores zero-rep attempts as a load baseline', () => {
    const s = base({
      workouts: [recentWork(EXIDX[ID], [done(100, 8, { u: 'lb' }), done(999, 0), done(999, 12, { skipped: true })])]
    })
    expect(propose(s)).toMatchObject({ hardLastTime: true, config: { weight: 45, reps: 8, sets: 1 } })
    s.workouts[0].entries[0].sets = [done(100, 0)]
    expect(propose(s)).toMatchObject({ needsWeight: true, config: { weight: 0 } })
  })
  it('keeps recent bodyweight added loads and timed work in their own meanings', () => {
    const push = byName('push-up')
    expect(
      propose(base({ workouts: [recentWork(push, [done(10, 8)])] }), { exercise: push, fatigue: 0 }).config
    ).toMatchObject({ bodyweight: true, weight: 10, reps: 8 })
    expect(propose(base({ workouts: [recentWork(EXIDX[ID], [{ sec: 30, w: 40, done: true }])] })).config).toMatchObject(
      { mode: 'time', sec: 30, weight: 40 }
    )
  })
  it('estimates only a matching free-weight movement, labels the donor and snaps down to owned bells', () => {
    const donor = Object.values(EXIDX).find(
      (ex) => ex.id !== front.id && ex.eq === 'dumbbell' && /front raise/.test(ex.n) && !/one arm|single arm/.test(ex.n)
    )
    expect(donor).toBeTruthy()
    const s = base({
      dumbbells: { kg: { weights: [5, 7.5, 10, 12.5] } },
      workouts: [
        recentWork(donor, [done(20, 12)], {
          entries: [{ id: donor.id, target: { dbLoad: 'total', reps: 12 }, sets: [done(20, 12)] }]
        })
      ]
    })
    const before = JSON.stringify(s)
    expect(propose(s, frontMatch)).toMatchObject({
      source: 'similar',
      sourceExercise: { id: donor.id },
      needsWeight: false,
      config: { weight: 7.5, reps: 12, dbLoad: 'each' }
    })
    expect(JSON.stringify(s)).toBe(before)
    s.workouts[0].entries[0].target.dbLoad = 'as'
    expect(propose(s, frontMatch).needsWeight).toBe(true)
    for (const name of [
      'dumbbell bench press',
      'dumbbell lateral raise',
      'cable front raise',
      'dumbbell lateral to front raise'
    ]) {
      const other = byName(name)
      if (other) {
        s.workouts[0].entries[0] = { id: other.id, target: { dbLoad: 'each' }, sets: [done(50, 12)] }
        expect(propose(s, frontMatch).needsWeight).toBe(true)
      }
    }
  })
})

it('converts a single-bell variation to combined bells and respects legacy unilateral totals', () => {
  const donor = byName('dumbbell one arm front raise')
  const s = base({
    dbLoad: { [front.id]: { mode: 'total' } },
    dumbbells: { kg: { weights: [5, 7.5, 10] } },
    workouts: [
      recentWork(donor, [], { entries: [{ id: donor.id, target: { dbLoad: 'each', reps: 12 }, sets: [done(10, 12)] }] })
    ]
  })
  expect(propose(s, frontMatch).config).toMatchObject({ dbLoad: 'total', weight: 15 })
  s.workouts[0].entries[0].target.side = true
  // Twelve total reps are six per arm, not twelve per arm at the same weight.
  expect(propose(s, frontMatch).config.weight).toBe(10)
})
it('treats a legacy unilateral row as total reps and does not change its historical record', () => {
  const s = base({ workouts: [history(DAY, { target: { sets: 3, reps: 12, weight: 40, side: true }, row: { r: 8 } })] })
  const before = JSON.stringify(s)
  expect(propose(s)).toMatchObject({ hardLastTime: true, config: { sets: 1, reps: 12 } })
  expect(propose(s).config.weight).toBeLessThan(40)
  expect(JSON.stringify(s)).toBe(before)
})
