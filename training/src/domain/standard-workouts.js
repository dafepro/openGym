import { skillWorkouts } from '../data/skill-workouts.js'
import { movementWorkouts } from '../data/movement-workouts.js'

// Public, original starter practices. Trainer assignments remain in the separate
// approved catalog; starting a template never assigns it or edits that catalog.
export const standardWorkouts = [...skillWorkouts, ...movementWorkouts]
export function standardDrills() {
  const drills = standardWorkouts.flatMap(item => item.assignment.drills)
  const family = drill => /^std-move-.+-(warmup|cooldown)$/.exec(drill.id)?.[1]
  // Full practices retain their setup-specific variants. The independent picker
  // needs one solo, small-space option per repeated preparation/recovery drill.
  const preferred = new Map()
  const cost = drill => {
    const requirement = drill.metadata.requirements
    return requirement.participants.min * 10000 + requirement.space.lengthM * requirement.space.widthM
  }
  for (const drill of drills) {
    const key = family(drill)
    if (key && (!preferred.has(key) || cost(drill) < cost(preferred.get(key)))) preferred.set(key, drill)
  }
  const seen = new Set()
  return drills.filter(drill => {
    if (seen.has(drill.id) || family(drill) && preferred.get(family(drill)) !== drill) return false
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
