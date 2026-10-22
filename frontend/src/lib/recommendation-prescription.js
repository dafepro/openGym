// Prescription for the single displayed suggestion, not for every catalogue candidate.
// Current, explicit plan settings beat historical guesses. Only recent completed app sessions
// with a target can supply a load: CSV history and old PR caches cannot seed today's work.
import { defaultConfig, entryExcluded, modeOf, workoutAt } from './history.js'
import { nextPrescription, weightIncrement } from './progression.js'
import { dbLoadFor, entryAs, entryDbLoad, meaningFactor, ownedWeightsFor, withMeaning } from './dumbbells.js'
import { isAssisted } from './exercises.js'
import { baseWeightFor, inventoryFor, loadKindFor } from './plates.js'
import { hasCompletedWork, isSideSet, isWarmupRow } from './workout-model.js'
import { remainingWorkoutMinutes } from './exercise-recommendations.js'
import { rirOf } from './effort.js'
import { restSecFor } from './supersetFlow.js'

const DAY = 86400000
export const RECENT_LOAD_DAYS = 21
const FIELDS = [
  'sets',
  'reps',
  'repsMin',
  'repsMax',
  'setsMax',
  'weight',
  'mode',
  'sec',
  'min',
  'speed',
  'bodyweight',
  'side',
  'inc',
  'restSec',
  'dbLoad',
  'prog',
  'deloadFactor'
]
const pickConfig = (source) =>
  Object.fromEntries(FIELDS.filter((key) => source?.[key] != null).map((key) => [key, source[key]]))
const finite = (n) => typeof n === 'number' && Number.isFinite(n)
const completedRows = (entry) => (entry.sets || []).filter((s) => !isWarmupRow(s) && !s.skipped && hasCompletedWork(s))
const unit = (...objects) => objects.map((o) => o?.unit || o?.weightUnit || o?.u).find(Boolean)
const factorFor = (from, to) => (from && from !== to ? (from === 'lb' ? 0.45359237 : 1 / 0.45359237) : 1)

function normalizedEntry(entry, workout, state, config) {
  const read = entryAs(entry, dbLoadFor(state, config))
  const to = state.unit || 'kg'
  const convert = (row) => ({
    ...row,
    unit: to,
    ...(finite(row.w) ? { w: row.w * factorFor(unit(row, entry.target, entry, workout), to) } : {})
  })
  const target = { ...read.target, unit: to }
  if (finite(target.weight))
    target.weight *=
      factorFor(unit(entry.target, entry, workout), to) *
      meaningFactor(entryDbLoad(entry), dbLoadFor(state, config), { ...entry.target, id: entry.id })
  return {
    ...read,
    target,
    sets: (read.sets || []).map((row) =>
      isSideSet(row) ? { ...convert(row), sides: { L: convert(row.sides.L), R: convert(row.sides.R) } } : convert(row)
    )
  }
}

/** Snap to an achievable load without rounding a lift up (or assistance down). */
export function achievableRecommendationLoad(state, config, weight) {
  // In openGym bodyweight rows store added load, never the person's body mass.
  if (!finite(weight) || weight <= 0) return 0
  const assisted = isAssisted(config)
  const owned = ownedWeightsFor(state, config)
  if (owned)
    return assisted
      ? owned.find((w) => w >= weight - 1e-6) || 0
      : Math.max(0, ...owned.filter((w) => w <= weight + 1e-6))
  const kind = loadKindFor(state, config)
  if (kind === 'pairs' || kind === 'single') {
    const base = baseWeightFor(state, config.id)
    if (!assisted && weight + 1e-6 < base) return 0
    const sides = kind === 'pairs' ? 2 : 1
    const inventory = inventoryFor(state)
    const limit = assisted
      ? inventory.reduce((sum, plate) => sum + Math.round(plate.w * 100) * plate.n * (kind === 'single' ? 2 : 1), 0)
      : Math.floor(((weight - base + 1e-6) * 100) / sides)
    let sums = new Set([0])
    for (const plate of inventory) {
      const step = Math.round(plate.w * 100),
        count = plate.n * (kind === 'single' ? 2 : 1)
      const next = new Set(sums)
      for (const sum of sums)
        for (let n = 1; n <= count && sum + n * step <= limit; n++) {
          next.add(sum + n * step)
          if (next.size > 10000) return 0 // unusual inventories require an explicit load choice
        }
      sums = next
    }
    const loads = [...sums].map((sum) => Math.round((base + (sum * sides) / 100) * 100) / 100)
    if (assisted) {
      const suitable = loads.filter((w) => w >= weight - 1e-6)
      return suitable.length ? Math.min(...suitable) : 0
    }
    return Math.max(...loads)
  }
  const step = weightIncrement(config, state.unit || 'kg')
  const steps = isAssisted(config) ? Math.ceil(weight / step - 1e-8) : Math.floor(weight / step + 1e-8)
  return Math.max(0, Math.round(steps * step * 100) / 100)
}

export function recommendationPrescription(state, match, { now = Date.now() } = {}) {
  if (!match) return null
  const id = match.exercise.id,
    active = state.active
  const current = active?.entries?.[active.cur]
  const preferred = current?.rid || active?.routineId || active?.routineIds?.[0]
  const routines = [...(state.routines || [])].sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred))
  const routine = routines.find((r) => (r.ex || []).some((e) => e.id === id))
  const planned = routine?.ex.find((e) => e.id === id)
  let config = { ...defaultConfig(id), ...pickConfig(planned), id }
  const history = []
  let latest = null,
    latestAt = -Infinity
  for (const workout of state.workouts || []) {
    const at = workoutAt(workout)
    if (!finite(at) || at > now || now - at > RECENT_LOAD_DAYS * DAY || workout.warmupOnly || workout.source) continue
    const entries = []
    for (const entry of workout.entries || []) {
      // Imported records have no app prescription. They still inform ranking and fatigue.
      if (entry.id !== id || !entry.target || entryExcluded(workout, entry) || !completedRows(entry).length) continue
      const read = normalizedEntry(entry, workout, state, config)
      if (modeOf(read.target || { id }) !== modeOf(config)) continue
      entries.push(read)
      if (at > latestAt) {
        latest = read
        latestAt = at
      }
    }
    if (entries.length) history.push({ ...workout, entries })
  }
  let source = planned ? 'plan' : 'unset'
  const recentRows = latest
    ? completedRows(latest).flatMap((row) =>
        isSideSet(row) ? [row.sides.L, row.sides.R].filter((s) => s.done) : [row]
      )
    : []
  const hardLastTime = recentRows.some(
    (row) =>
      row.failure ||
      (rirOf(row) != null && rirOf(row) <= 1) ||
      (finite(row.r) && row.r < (latest?.target?.reps || 0) / (latest?.target?.side ? 2 : 1))
  )
  if (!planned && latest) {
    config = { ...config, ...pickConfig(latest.target), id, weight: 0 }
    // Hold the most recent working load, not the historical maximum. Zero-rep attempts are
    // evidence of a miss, never proof that the load should rise.
    const weights = recentRows.map((row) => row.w).filter((w) => finite(w) && w > 0)
    if (weights.length) config.weight = Math.min(...weights)
    source = 'recent'
  }
  const mode = modeOf(config)
  const noProg = !!routine?.excludeFromProgression || !!current?.noProg
  if (planned && latest && !noProg) {
    // Reuse the user's chosen progression rule against the bounded, unit-normalized history.
    const plan = nextPrescription(
      { ...state, workouts: history.sort((a, b) => workoutAt(a) - workoutAt(b)), exWeights: {} },
      config,
      routine
    )
    if (finite(plan.weight)) config.weight = plan.weight
    if (finite(plan.reps)) config.reps = plan.reps
    if (Array.isArray(plan.rowReps) && plan.rowReps.length && plan.rowReps.every(finite))
      config.reps = Math.min(...plan.rowReps)
    if (finite(plan.sec)) config.sec = plan.sec
  }
  if (hardLastTime) {
    const loads = recentRows.map((row) => row.w).filter((w) => finite(w) && w > 0)
    if (loads.length && config.weight > 0)
      config.weight = isAssisted(config) ? Math.max(config.weight, ...loads) : Math.min(config.weight, ...loads)
  }
  // Per-exercise zero means "use my default" in the existing controller. Only a zero
  // global default switches rest off. Resolve the same meaning before displaying it.
  const restTarget = config.restSec == null ? { restSec: current?.target?.restSec } : config
  config.restSec = restSecFor([{ target: restTarget }], [0], state.restSec ?? 90)
  // A hard recent effort may call for more recovery; an explicitly disabled timer stays off.
  if (hardLastTime && config.restSec > 0) config.restSec = Math.max(config.restSec, 120)
  const elapsed = Math.max(0, (now - (active?.start ?? now)) / 60000)
  const nearHour = elapsed + remainingWorkoutMinutes(active, state.restSec) >= 50
  // This is today's optional accessory dose. Keep the user's rep target and rest; budget
  // excess time through sets, never by silently shortening recovery or rewriting a routine.
  config.sets = Math.min(
    Math.max(1, Math.round(config.sets) || 2),
    nearHour || hardLastTime || match.fatigue > 0.35 ? 1 : 2
  )
  delete config.setsMax // today's optional dose has a fixed cap, not the routine's set range
  if (mode === 'cardio') config.min = Math.min(config.min || 5, nearHour ? 3 : 5)
  if (mode !== 'cardio') config.weight = achievableRecommendationLoad(state, config, config.weight)
  config = withMeaning(state, config, id)
  const needsWeight = mode !== 'cardio' && config.bodyweight !== true && !(config.weight > 0)
  if (needsWeight) source = 'unset'
  const workSeconds =
    mode === 'cardio'
      ? config.min * 60
      : mode === 'time'
        ? (config.sec || 45) * (config.side ? 2 : 1)
        : Math.max(30, (config.reps || 10) * 4)
  const minutes = Math.ceil((config.sets * workSeconds + Math.max(0, config.sets - 1) * config.restSec + 60) / 60)
  return { ...match, config, minutes, source, needsWeight, hardLastTime }
}
