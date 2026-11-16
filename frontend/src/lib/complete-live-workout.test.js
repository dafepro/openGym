import { expect, it } from 'vitest'
import { liveWorkoutRecord, commitLiveWorkout, completeLiveWorkout } from './complete-live-workout.js'
import { cleanCircuit, programAdvance } from './circuit.js'

const state = (warmup = false) => {
  const circuit = cleanCircuit({ mode: 'intervals', program: 'runwalk', level: 1, n: 2 })
  return {
    unit: 'kg',
    workouts: [],
    exWeights: {},
    routines: [{ id: 'r1', ex: [{ id: '0685', sg: 'g', sgCircuit: circuit }] }],
    sessionTargets: { once: { id: 'once', _ts: 10 } },
    active: {
      id: 'live',
      start: 1000,
      d: '2026-11-16',
      name: 'Test',
      entries: [
        {
          id: '0685',
          sessionTarget: { id: 'once' },
          target: { mode: 'reps', reps: 5 },
          sets: [{ w: 0, r: 5, done: true, at: 2000, ...(warmup ? { phase: 'warmup' } : {}) }]
        }
      ],
      circuits: [
        {
          mode: 'intervals',
          sg: 'g',
          ended: 'done',
          advance: programAdvance(circuit, { sg: 'g', ended: 'done' }, 'r1')
        }
      ]
    }
  }
}
it('phone and watch commits share circuit advancement and consume session targets', () => {
  const phone = state(),
    watch = state()
  const record = liveWorkoutRecord(phone, 3000)
  expect(phone.active).not.toBeNull()
  commitLiveWorkout(phone, record)
  completeLiveWorkout(watch, 3000)
  expect(watch.workouts).toEqual(phone.workouts)
  expect(watch.routines).toEqual(phone.routines)
  expect(phone.routines[0].ex[0].sgCircuit.level).toBe(2)
  expect(phone.sessionTargets.once.used).toBe(record.id)
  expect(watch.sessionTargets.once.used).toBe(record.id)
  expect(record.circuits[0].advance).toBeUndefined()
  expect(phone.active).toBeNull()
})
it('a warm-up-only session cannot advance a circuit programme', () => {
  const s = state(true)
  expect(completeLiveWorkout(s, 3000).warmupOnly).toBe(true)
  expect(s.routines[0].ex[0].sgCircuit.level).toBe(1)
})
