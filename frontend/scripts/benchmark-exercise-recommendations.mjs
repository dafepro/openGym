// Synthetic data only. Run from the repository root with Node 22+.
import { EXDB } from '../src/lib/exercises.js'
import { recommendExercises } from '../src/lib/exercise-recommendations.js'
import { recommendationPrescription } from '../src/lib/recommendation-prescription.js'

const now = Date.UTC(2026, 9, 22, 12),
  day = 86400000
const workouts = Array.from({ length: 4000 }, (_, i) => ({
  start: now - (i * 2 + 1) * day,
  entries: ['0025', '0027', '0043', '0031', '0289', '0314'].map((id) => ({
    id,
    target: { sets: 3, reps: 8, weight: 40 },
    sets: Array.from({ length: 3 }, () => ({ w: 40, r: 8, done: true, rir: 2 }))
  }))
}))
const state = {
  unit: 'kg',
  restSec: 150,
  routines: [],
  workouts,
  active: { id: 'benchmark', start: now - 20 * 60000, entries: [] }
}
const samples = [],
  alternatives = []
let ranked
for (let i = 0; i < 31; i++) {
  const start = performance.now()
  ranked = recommendExercises(state, { now })
  recommendationPrescription(state, ranked[0], { now })
  samples.push(performance.now() - start)
}
const dismissed = []
for (let i = 0; i < 30; i++) {
  const start = performance.now()
  const candidate = ranked.find((item) => !dismissed.includes(item.exercise.id))
  recommendationPrescription(state, candidate, { now })
  if (candidate) dismissed.push(candidate.exercise.id)
  alternatives.push(performance.now() - start)
}
const round = (n) => +n.toFixed(2)
const summary = (values) => {
  const ordered = [...values].sort((a, b) => a - b)
  return {
    median: round(ordered[Math.floor(ordered.length / 2)]),
    p95: round(ordered[Math.ceil(ordered.length * 0.95) - 1])
  }
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      catalogue: EXDB.length,
      workouts: workouts.length,
      coldMs: round(samples[0]),
      warmMs: summary(samples.slice(1)),
      anotherMs: summary(alternatives),
      candidates: ranked.length
    },
    null,
    2
  )
)
