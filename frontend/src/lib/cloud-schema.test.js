import { it, expect } from 'vitest'
import { validCloudState } from './cloud-schema.js'
const s = x => ({ unit: 'kg', routines: [], workouts: [], ...x })
it('rejects malformed nested history, routine collections and poisoned timestamps', () => {
  for (const x of [s({ workouts: [{ id: 'bad', entries: 'broken' }] }), s({ workouts: [{ entries: [{ sets: null }] }] }),
    s({ routines: [{ id: 'bad', ex: 'broken' }] }), s({ _ts: Infinity }), s({ edited: { theme: 'infinity' } }),
    s({ dayPlan: [] }), s({ unitSet: { at: 'Infinity' } }), s({ deleted: { workouts: { bad: 'Infinity' } } }),
    s({ undone: { theme: [0, 1, 'Infinity'] } }), JSON.parse('{"unit":"kg","routines":[],"workouts":[],"__proto__":{"bad":1}}')]) expect(validCloudState(x)).toBe(false)
})
it('preserves zero reps, skipped and timed sets without normalizing their meaning', () => {
  expect(validCloudState(s({ workouts: [{ id: 'real', entries: [{ id: 'bench', sets: [{ r: 0, done: true }, { r: null, skip: true }, { dur: 60, done: true }, {}] }] }] }))).toBe(true)
})
