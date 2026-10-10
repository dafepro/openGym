// Shared live finish boundary for phone and watch; the caller saves this draft atomically.
import { buildCompletedWorkout, sessionEnd } from './finish-workout.js'
import { bestWeightFor, bestWeightForEntry, workoutVolume } from './history.js'
import { entryDbLoad } from './dumbbells.js'
import { isWarmupRow } from './workout-model.js'
import { betterWeight, beatsWeight, EXIDX, isCustomEx } from './exercises.js'
import { exerciseMuscleSnapshot } from './muscles.js'
import { refillAfter } from './rotation.js'
export function liveWorkoutRecord(st, end = Date.now()) {
  const a = st.active, prs = []
  for (const e of a.entries) {
    const loads = e.sets.filter(s => s.done && !isWarmupRow(s)).map(s => s.w).filter(w => w > 0)
    const mx = loads.length ? loads.reduce((a, b) => betterWeight(e.id, a, b)) : 0
    if (beatsWeight(e.id, mx, bestWeightFor(st, e.id, entryDbLoad(e)))) prs.push(e.id)
  }
  const w = buildCompletedWorkout(a, { end: sessionEnd(a, end), prs,
    snapshotFor: e => isCustomEx(EXIDX[e.id]) ? exerciseMuscleSnapshot(EXIDX[e.id]) : null })
  w.vol = workoutVolume(w)
  return w
}
export function commitLiveWorkout(st, w) {
  w.entries.forEach(e => {
    const mx = bestWeightForEntry(e)
    if (mx > 0 && beatsWeight(e.id, mx, (st.exWeights[e.id] || {}).w || 0)) st.exWeights[e.id] = { w: mx, d: w.d }
  })
  st.workouts.push(w); st.active = null; refillAfter(st, w)
  return w
}
export function completeLiveWorkout(st, end) {
  const w = liveWorkoutRecord(st, end)
  if (!w.entries.some(e => e.sets.some(s => s.done && !isWarmupRow(s)))) w.warmupOnly = true
  return commitLiveWorkout(st, w)
}
