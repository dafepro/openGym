// Shared live finish boundary for phone and watch; the caller saves this draft atomically.
import { buildCompletedWorkout, sessionEnd, sessionPrs } from './finish-workout.js'
import { bestWeightForEntry, workoutVolume } from './history.js'
import { hasCompletedWork, isWarmupRow } from './workout-model.js'
import { beatsWeight, EXIDX, isCustomEx } from './exercises.js'
import { exerciseMuscleSnapshot } from './muscles.js'
import { refillAfter } from './rotation.js'
import { isGymSplit, brandAt } from './gym-split.js'
import { applyProgramAdvances, withoutAdvances } from './circuit.js'
import { markUsed } from './session-targets.js'
export function liveWorkoutRecord(st, end = Date.now(), { effectiveEnd = false } = {}) {
  const a = st.active
  const { prs } = sessionPrs(st, a.entries)
  const w = buildCompletedWorkout(a, {
    end: effectiveEnd ? end : sessionEnd(a, end),
    prs,
    snapshotFor: (e) => (isCustomEx(EXIDX[e.id]) ? exerciseMuscleSnapshot(EXIDX[e.id]) : null),
    brandFor: (id) => (isGymSplit(st, id) ? brandAt(st, id, a.gym?.id) : '')
  })
  w.vol = workoutVolume(w)
  if (Array.isArray(w.circuits)) w.circuits = withoutAdvances(w.circuits)
  if (!w.entries.some((e) => e.sets.some((s) => hasCompletedWork(s) && !isWarmupRow(s)))) w.warmupOnly = true
  return w
}
export function commitLiveWorkout(st, w) {
  const active = st.active
  w.entries.forEach((e) => {
    const mx = bestWeightForEntry(e)
    if (mx > 0 && beatsWeight(e.id, mx, (st.exWeights[e.id] || {}).w || 0)) st.exWeights[e.id] = { w: mx, d: w.d }
  })
  st.workouts.push(w)
  if (!w.warmupOnly) applyProgramAdvances(st.routines, active?.circuits)
  st.sessionTargets = markUsed(st.sessionTargets, active?.entries || [], w.id)
  st.active = null
  refillAfter(st, w)
  return w
}
export function completeLiveWorkout(st, end) {
  const w = liveWorkoutRecord(st, end)
  return commitLiveWorkout(st, w)
}
