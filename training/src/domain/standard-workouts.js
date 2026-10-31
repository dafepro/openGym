import { skillWorkouts } from '../data/skill-workouts.js'
import { movementWorkouts } from '../data/movement-workouts.js'

// Public, original starter practices. Trainer assignments remain in the separate
// approved catalog; starting a template never assigns it or edits that catalog.
export const standardWorkouts = [...skillWorkouts, ...movementWorkouts]
export function standardDrills() {
  const seen = new Set()
  return standardWorkouts.flatMap(item => item.assignment.drills).filter(drill => {
    if (seen.has(drill.id)) return false
    seen.add(drill.id); return true
  }).map(drill => structuredClone(drill))
}
export function workoutSummary(assignment) {
  let seconds = 0, hasReps = false
  for (const [index, drill] of assignment.drills.entries()) {
    const sets = drill.sets * (drill.side === 'each' ? 2 : 1)
    if (drill.mode === 'time') seconds += sets * drill.durationSec
    if (drill.mode === 'reps') hasReps = true
    seconds += Math.max(0, sets - (index === assignment.drills.length - 1 ? 1 : 0)) * (drill.restSec || 0)
  }
  const equipment = [...new Set(assignment.drills.flatMap(drill => drill.metadata?.requirements?.equipment || []))]
  const people = Math.max(1, ...assignment.drills.map(drill => drill.metadata?.requirements?.participants?.min || 1))
  return { seconds, hasReps, equipment, people }
}
