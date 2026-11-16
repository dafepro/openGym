import { applyIntensifierPlan, buildSets } from './history.js'
import { withMeaning } from './dumbbells.js'
import { dropGrid } from './plates.js'
import { exConverted, exView, viewTarget, storedEntry } from './ex-unit.js'

// Commit only the reviewed proposal or explicit edits, never re-read old loads. Optional
// volume does not earn a full routine's progression credit; the existing toggle can opt in.
export function buildWorkoutAddition(state, config, { optional = true } = {}) {
  if (exConverted(state, config.id)) {
    const entry = buildWorkoutAddition(exView(state, config.id), viewTarget(state, config.id, config), { optional })
    return storedEntry(state, { ...entry, id: config.id })
  }
  const target = withMeaning(state, config, config.id)
  const fresh = { ...state, workouts: [], exWeights: {} }
  return {
    target,
    plan: null,
    ...(optional ? { noProg: true } : {}),
    sets: applyIntensifierPlan(buildSets(fresh, target, { useTarget: true }), target, dropGrid(state, target))
  }
}
