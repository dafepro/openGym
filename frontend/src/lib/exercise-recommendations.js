// Local, deterministic ranking for one optional addition to a live workout. Scores are
// coaching heuristics, not measurements of recovery or medical clearance. Never reads notes,
// never writes history. Prescription is computed separately, only for the displayed match.
import { allExercises, EXIDX } from './exercises.js'
import { activeProfile, ALL_EQUIPMENT, exAvailable } from './equipment.js'
import { defaultConfig, workoutAt } from './history.js'
import { musclesOf } from './muscles.js'
import { fatigueOf, FATIGUE_SCAN_MS, FATIGUE_RIR_WINDOW_MS } from './recovery.js'
import { hasCompletedWork, isWarmupRow, isSideSet } from './workout-model.js'
import { restSecFor } from './supersetFlow.js'

const DAY = 86400000
const COMMON = new Set([
  'barbell bench press',
  'barbell squat',
  'barbell deadlift',
  'barbell bent over row',
  'dumbbell bench press',
  'dumbbell lateral raise',
  'dumbbell biceps curl',
  'cable lat pulldown',
  'cable seated row',
  'push-up',
  'pull-up',
  'plank',
  'sled 45° leg press',
  'lever seated leg curl',
  'bodyweight squat'
])
const EQUIPMENT_PRIOR = {
  barbell: 6,
  dumbbell: 6,
  cable: 5,
  'body weight': 5,
  'leverage machine': 5,
  'sled machine': 4,
  'smith machine': 4,
  kettlebell: 3
}
const workRows = (entry) =>
  (entry.sets || []).filter((row) => !row.skipped && !isWarmupRow(row) && hasCompletedWork(row))
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const average = (weights, values) => {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0)
  return total ? Object.entries(weights).reduce((sum, [m, w]) => sum + w * (values[m] || 0), 0) / total : 0
}
const primaryOf = (weights) => {
  const max = Math.max(0, ...Object.values(weights))
  return Object.fromEntries(Object.entries(weights).filter(([, w]) => w === max))
}
const features = new WeakMap()
function featuresOf(ex) {
  if (!features.has(ex)) {
    const weights = musclesOf(ex)
    features.set(ex, { weights, primary: primaryOf(weights), common: commonExerciseScore(ex) })
  }
  return features.get(ex)
}

/** An editorial familiarity prior, not a claim about measured global popularity. */
export function commonExerciseScore(ex) {
  const category = ex.cat || 'strength'
  const simple = Math.max(0, 5 - (ex.n || '').split(/\s+/).length)
  return (
    (COMMON.has((ex.n || '').toLowerCase()) ? 10 : 0) +
    (EQUIPMENT_PRIOR[ex.eq] || 0) +
    simple +
    (['strength', 'calisthenics', 'isometric'].includes(category) ? 4 : -8)
  )
}

// Count planned work in today's budget without marking it as performed or as fatigue.
export function remainingWorkoutMinutes(active, restSec = 90) {
  return (active?.entries || []).reduce((minutes, entry) => {
    const rest = restSecFor([entry], [0], restSec)
    const pending = (entry.sets || [])
      .filter((row) => !row.skipped)
      .flatMap((row) => (isSideSet(row) ? [row.sides.L, row.sides.R] : [row]))
    return (
      minutes +
      pending
        .filter((row) => !row.skipped && !hasCompletedWork(row))
        .reduce(
          (sum, row) =>
            sum + ((row.min > 0 ? row.min * 60 : row.sec > 0 ? row.sec : 40) + Math.max(0, Number(rest) || 0)) / 60,
          0
        )
    )
  }, 0)
}

/** Highest match first, with stable ID ties and an explicit, inspectable score breakdown. */
export function recommendExercises(
  state,
  { now = Date.now(), muscle = '', excluded = [], catalog = allExercises(state) } = {}
) {
  const active = state.active
  if (!active || active.backfill || active.editingWorkoutId || !Number.isFinite(now)) return []
  const byId = new Map(catalog.map((ex) => [ex.id, ex]))
  const resolve = (entry) => byId.get(entry.id) || EXIDX[entry.id] || entry
  const occupied = new Set((active.entries || []).map((entry) => resolve(entry).id))
  const omitted = new Set(excluded)
  const history = (state.workouts || []).filter((w) => {
    const at = workoutAt(w)
    return Number.isFinite(at) && at <= now && now - at < FATIGUE_SCAN_MS + FATIGUE_RIR_WINDOW_MS
  })
  let latest = -Infinity
  const counts = {},
    lastMuscle = {},
    weekly = {},
    planned = {},
    personalPlan = new Set()
  for (const routine of state.routines || []) for (const entry of routine.ex || []) personalPlan.add(resolve(entry).id)
  for (const workout of history) {
    const age = now - workoutAt(workout)
    if (age > 90 * DAY) continue
    const seen = new Set()
    for (const entry of workout.entries || []) {
      const rows = workRows(entry)
      if (!rows.length) continue
      latest = Math.max(latest, workoutAt(workout))
      const ex = resolve(entry)
      if (!seen.has(ex.id)) counts[ex.id] = (counts[ex.id] || 0) + Math.exp(-age / (45 * DAY))
      seen.add(ex.id)
      for (const [m, w] of Object.entries(featuresOf(ex).weights)) {
        lastMuscle[m] = Math.max(lastMuscle[m] ?? -Infinity, workoutAt(workout))
        if (age <= 7 * DAY) weekly[m] = (weekly[m] || 0) + rows.length * w
      }
    }
  }
  for (const entry of active.entries || [])
    for (const [m, w] of Object.entries(featuresOf(resolve(entry)).weights)) {
      const rows = (entry.sets || []).filter((row) => !isWarmupRow(row) && !row.skipped)
      planned[m] = (planned[m] || 0) + rows.reduce((sum, row) => sum + (hasCompletedWork(row) ? 1 : 0.5), 0) * w
    }
  // Current work enters the existing recovery model at now, not at session start. Future
  // history is excluded above; a deleted custom exercise still carries its muscle snapshot.
  const current = { ...active, start: now }
  const fatigue = fatigueOf([...history, current], now, { unit: state.unit, bodyweight: active.bw })
  const recency = Object.fromEntries(
    Object.entries(lastMuscle).map(([m, at]) => [m, clamp(1 - (now - at) / (3 * DAY), 0, 1)])
  )
  const coverage = Object.fromEntries(Object.entries(weekly).map(([m, sets]) => [m, Math.min(1, sets / 10)]))
  const sessionLoad = Object.fromEntries(Object.entries(planned).map(([m, sets]) => [m, Math.min(1, sets / 6)]))
  const gapDays = (now - latest) / DAY
  const elapsed = Math.max(0, (now - (active.start ?? now) - (active.pausedMs || 0)) / 60000)
  const nearHour = elapsed + remainingWorkoutMinutes(active, state.restSec) >= 50
  const profile = activeProfile(state)
  const ranked = []
  const seen = new Set()
  for (const ex of catalog) {
    if (seen.has(ex.id) || occupied.has(ex.id) || omitted.has(ex.id) || !exAvailable(state, ex)) continue
    seen.add(ex.id)
    // An opaque imported equipment label cannot establish that a filtered gym can support it.
    // It remains available in the ordinary library, where the user can choose deliberately.
    if (profile && ex.eq && !ALL_EQUIPMENT.includes(ex.eq)) continue
    const { weights, primary, common } = featuresOf(ex)
    if (!Object.keys(weights).length || (muscle && !primary[muscle])) continue
    const fatigueScore = average(weights, fatigue)
    if (fatigueScore > 0.6 || Object.keys(primary).some((m) => fatigue[m] > 0.75)) continue
    const breakdown = {
      recovery: 30 * (1 - fatigueScore),
      spacing: -24 * average(weights, recency) * (gapDays < 1 ? 1.3 : 1),
      balance: -14 * average(primary, coverage),
      session: -30 * average(primary, sessionLoad),
      familiar: 18 * (1 - Math.exp(-(counts[ex.id] || 0) / 3)),
      planned: personalPlan.has(ex.id) ? 3 : 0,
      favourite: (state.favEx || []).includes(ex.id) ? 3 : 0,
      common: common * (gapDays > 14 ? 1.2 : 1)
    }
    const config = { ...defaultConfig(ex.id) }
    // Cheap ranking defaults. The displayed candidate gets its personalized prescription
    // separately; optional volume never shortens the user's rest.
    config.sets = nearHour ? 1 : 2
    const rest = Math.max(0, state.restSec ?? 90)
    const minutes = Math.ceil((config.sets * (config.sec || 40) + Math.max(0, config.sets - 1) * rest + 60) / 60)
    const reason =
      counts[ex.id] > 0
        ? 'familiar'
        : history.length && average(primary, coverage) < 0.2
          ? 'spacing'
          : fatigueScore > 0.1
            ? 'recovery'
            : 'common'
    ranked.push({
      exercise: ex,
      score: Object.values(breakdown).reduce((sum, n) => sum + n, 0),
      breakdown,
      fatigue: fatigueScore,
      reason,
      config,
      minutes
    })
  }
  return ranked.sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id, 'en'))
}
