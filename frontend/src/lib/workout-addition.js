import { applyIntensifierPlan, buildSets } from './history.js'
import { withMeaning } from './dumbbells.js'
import { dropGrid } from './plates.js'

// Commit only the reviewed proposal or explicit edits, never re-read old loads. Optional
// volume does not earn a full routine's progression credit; the existing toggle can opt in.
export function buildWorkoutAddition(state, config, { optional = true } = {}) {
  const target = withMeaning(state, config, config.id)
  const fresh = { ...state, workouts: [], exWeights: {} }
  return {
    target,
    plan: null,
    ...(optional ? { noProg: true } : {}),
    sets: applyIntensifierPlan(buildSets(fresh, target, { useTarget: true }), target, dropGrid(state, target))
  }
}
