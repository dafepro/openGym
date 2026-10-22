import { afterEach, describe, expect, it } from 'vitest'
import { registerCustom } from './exercises.js'
import { recommendExercises, commonExerciseScore, remainingWorkoutMinutes } from './exercise-recommendations.js'
const NOW = Date.UTC(2026, 9, 22, 12),
  DAY = 86400000
const ex = (id, muscle, extra = {}) => ({
  id,
  n: id,
  bp: 'chest',
  eq: 'body weight',
  muscleWeights: { [muscle]: 1 },
  cat: 'strength',
  ...extra
})
const chest = ex('test-chest', 'chest'),
  legs = ex('test-legs', 'quadriceps')
const state = (extra = {}) => ({
  unit: 'kg',
  restSec: 90,
  workouts: [],
  routines: [],
  favEx: [],
  active: { id: 'live', start: NOW - 1200000, entries: [], cur: 0 },
  ...extra
})
const workout = (id, ago = DAY, n = 3, row = {}) => ({
  start: NOW - ago,
  entries: [
    { id, target: { sets: n, reps: 10 }, sets: Array.from({ length: n }, () => ({ done: true, r: 10, w: 20, ...row })) }
  ]
})
const rank = (s, extra = {}) => recommendExercises(s, { now: NOW, catalog: [chest, legs], ...extra })
afterEach(() => registerCustom([]))

describe('exercise recommendation rules', () => {
  it('works without history or filters and breaks ties independently of catalogue order', () => {
    expect(rank(state())).toHaveLength(2)
    expect(rank(state()).map((x) => x.exercise.id)).toEqual(
      rank(state(), { catalog: [legs, chest] }).map((x) => x.exercise.id)
    )
    expect(commonExerciseScore(ex('common', 'chest', { n: 'barbell bench press', eq: 'barbell' }))).toBeGreaterThan(
      commonExerciseScore(ex('rare', 'chest', { n: 'twisting unstable handstand variation', cat: 'plyometrics' }))
    )
  })
  it('honours equipment, accessories and unknown kit under a selected profile', () => {
    const db = ex('db', 'chest', { n: 'dumbbell incline bench press', eq: 'dumbbell' })
    const bar = ex('bar', 'upper-back', { n: 'pull-up' }),
      unknown = ex('unknown', 'chest', { eq: 'custom' })
    const s = state({
      equipFilterOn: true,
      activeEquipId: 'home',
      equipProfiles: [{ id: 'home', accV: 1, equipment: ['dumbbell'] }]
    })
    expect(rank(s, { catalog: [chest, db, bar, unknown] }).map((x) => x.exercise.id)).toEqual([chest.id])
    s.equipProfiles[0].equipment.push('bench', 'pull-up bar')
    expect(rank(s, { catalog: [chest, db, bar, unknown] })).toHaveLength(3)
  })
  it('targets primary muscles and never silently broadens an empty filter', () => {
    expect(rank(state(), { muscle: 'quadriceps' }).map((x) => x.exercise.id)).toEqual([legs.id])
    expect(
      rank(state(), {
        muscle: 'triceps',
        catalog: [ex('compound', 'chest', { muscleWeights: { chest: 1, triceps: 0.4 } })]
      })
    ).toEqual([])
  })
  it('excludes all current occurrences and every dismissed option', () => {
    const s = state()
    s.active.entries.push({ id: chest.id, sets: [{ done: false }] })
    expect(rank(s).map((x) => x.exercise.id)).toEqual([legs.id])
    expect(rank(s, { excluded: [legs.id] })).toEqual([])
  })
  it('rewards performed familiarity, excluding skipped, unrecorded and warm-up-only history', () => {
    registerCustom([chest, legs])
    expect(
      rank(state({ workouts: [workout(chest.id, 10 * DAY)] })).find((x) => x.exercise.id === chest.id).breakdown
        .familiar
    ).toBeGreaterThan(0)
    for (const row of [{ done: false }, { skipped: true }, { warmup: true }])
      expect(
        rank(state({ workouts: [workout(chest.id, DAY, 1, row)] })).find((x) => x.exercise.id === chest.id)?.breakdown
          .familiar || 0
      ).toBe(0)
  })
  it('recognizes zero-rep, timed and partially completed unilateral work', () => {
    registerCustom([chest, legs])
    for (const row of [
      { r: 0 },
      { r: undefined, sec: 30 },
      { done: false, sides: { L: { done: true, w: 20, r: 5 }, R: { done: false, w: 20, r: 5 } } }
    ])
      expect(
        rank(state({ workouts: [workout(chest.id, 10 * DAY, 1, row)] })).find((x) => x.exercise.id === chest.id)
          .breakdown.familiar
      ).toBeGreaterThan(0)
  })
  it('responds to spacing/fatigue and ignores future and invalid timestamps', () => {
    registerCustom([chest, legs])
    const a = rank(state({ workouts: [workout(chest.id, DAY, 2)] })).find((x) => x.exercise.id === chest.id)
    const b = rank(state({ workouts: [workout(chest.id, 4 * DAY, 2)] })).find((x) => x.exercise.id === chest.id)
    expect(b.fatigue).toBeLessThan(a.fatigue)
    expect(b.breakdown.spacing).toBeGreaterThan(a.breakdown.spacing)
    expect(rank(state({ workouts: [workout(chest.id, -DAY), { entries: [], start: NaN }] }))).toEqual(rank(state()))
  })
  it('reserves pending volume separately and can decline heavily fatigued targets', () => {
    const other = ex('other-chest', 'chest')
    registerCustom([chest, legs, other])
    const s = state()
    s.active.entries.push({ id: other.id, sets: [{ done: false }, { done: false }, { done: false }] })
    const p = rank(s).find((x) => x.exercise.id === chest.id)
    expect(p.breakdown.session).toBeLessThan(0)
    expect(p.fatigue).toBe(0)
    expect(rank(state({ workouts: [workout(chest.id, 1000, 12)] }), { muscle: 'chest' })).toEqual([])
  })
  it('is pure, does not seed loads, and does not recommend while editing historical sessions', () => {
    const s = state({ workouts: [workout(chest.id, 100 * DAY)] }),
      before = JSON.stringify(s)
    expect(rank(s)[0].config.weight).toBe(0)
    expect(JSON.stringify(s)).toBe(before)
    for (const flag of [{ backfill: {} }, { editingWorkoutId: 'saved' }])
      expect(rank({ ...s, active: { ...s.active, ...flag } })).toEqual([])
  })
  it('estimates remaining work with the full explicit rest interval', () => {
    expect(
      remainingWorkoutMinutes(
        {
          entries: [
            {
              target: { restSec: 150 },
              sets: [{ done: true }, { done: false, sec: 30 }, { done: false, skipped: true }]
            }
          ]
        },
        30
      )
    ).toBe(3)
  })
  it('never traverses old workout entries outside the recovery pool', () => {
    const old = {
      start: NOW - 121 * DAY,
      get entries() {
        throw new Error('old payload must not be read')
      }
    }
    expect(rank(state({ workouts: [old] }))).toEqual(rank(state()))
  })
  it('budgets the unchecked limb of a partial timed set', () => {
    expect(
      remainingWorkoutMinutes({
        entries: [
          {
            target: { restSec: 150 },
            sets: [
              {
                sides: {
                  L: { done: true, sec: 30 },
                  R: { done: false, sec: 30 }
                }
              }
            ]
          }
        ]
      })
    ).toBe(3)
  })
})
