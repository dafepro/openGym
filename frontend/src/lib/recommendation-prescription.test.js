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
  it('keeps stale, future, imported-without-target and unrecorded loads unset', () => {
    for (const record of [
      history(22 * DAY),
      history(-DAY),
      history(DAY, { source: 'StrongLifts' }),
      history(DAY, { source: 'Hevy' }),
      history(DAY, { target: null }),
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
        config: { sets: 1, restSec: 120 }
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
