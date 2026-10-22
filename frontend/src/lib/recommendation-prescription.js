// Prescription for the single displayed suggestion, not for every catalogue candidate.
// Current, explicit plan settings beat estimates. Recent performed work can inform a reviewed
// proposal, including imports and today. Old records and PR caches cannot seed today's work.
import { defaultConfig, entryExcluded, modeOf, workoutAt } from './history.js'
import { defaultIncrement, nextPrescription, weightIncrement } from './progression.js'
import {
  bellsIn,
  dbLoadFor,
  entryAs,
  entryDbLoad,
  isBellEx,
  meaningFactor,
  ownedWeightsFor,
  withMeaning
} from './dumbbells.js'
import { EXIDX, isAssisted } from './exercises.js'
import { baseWeightFor, inventoryFor, loadKindFor } from './plates.js'
import { hasCompletedWork, isSideSet, isWarmupRow } from './workout-model.js'
import { remainingWorkoutMinutes } from './exercise-recommendations.js'
import { rirOf } from './effort.js'
import { restSecFor } from './supersetFlow.js'
import { recommendationName, recommendationProfile } from './recommendation-profile.js'
import { usesBar } from './bar.js'

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
  if (finite(target.inc) && modeOf(target) === 'reps') target.inc *= factorFor(unit(entry.target, entry, workout), to)
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
  const step =
    modeOf(config) === 'time'
      ? defaultIncrement(config.id, state.unit || 'kg')
      : weightIncrement(config, state.unit || 'kg')
  const steps = isAssisted(config) ? Math.ceil(weight / step - 1e-8) : Math.floor(weight / step + 1e-8)
  return Math.max(0, Math.round(steps * step * 100) / 100)
}

// No strength evidence is required for a transparent first-set trial. Start with the
// lightest owned bell, an empty known bar/sled, or one ordinary load step. Assistance has
// the opposite direction: begin with substantial help, using only a recent weigh-in.
function startingLoad(state, config, exercise, now) {
  const trial = { ...config }
  if (exercise.eq === 'dumbbell' && dbLoadFor(state, trial) === 'as') trial.dbLoad = 'each'
  const owned = ownedWeightsFor(state, trial)
  if (owned?.length) return { weight: owned[0], dbLoad: trial.dbLoad }
  if (isAssisted(trial)) {
    const recent = (state.bodyweight || [])
      .filter((row) => {
        const at = workoutAt(row)
        return finite(at) && at <= now && now - at <= RECENT_LOAD_DAYS * DAY && finite(row.w) && row.w > 0
      })
      .sort((a, b) => workoutAt(b) - workoutAt(a))[0]
    const mass = state.active?.bw > 0 ? state.active.bw : recent?.w
    const help = mass > 0 ? mass * 0.75 : state.unit === 'lb' ? 90 : 40
    const weight = achievableRecommendationLoad(state, trial, help)
    return weight > 0 ? { weight } : null
  }
  const base = baseWeightFor(state, config.id)
  if (usesBar(exercise) || base > 0) return { weight: base, empty: base === 0 }
  const kind = loadKindFor(state, trial)
  if (kind === 'pairs' || kind === 'single') {
    const plates = inventoryFor(state).filter((plate) => plate.n > 0 && plate.w > 0)
    return plates.length ? { weight: Math.min(...plates.map((plate) => plate.w)) * (kind === 'pairs' ? 2 : 1) } : null
  }
  return { weight: defaultIncrement(config.id, state.unit || 'kg'), dbLoad: trial.dbLoad }
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
  const profile = recommendationProfile(match.exercise)
  let config = {
    ...defaultConfig(id, profile.hold ? 'time' : undefined),
    reps: profile.reps,
    ...pickConfig(planned),
    id
  }
  const history = []
  let latest = null,
    latestAt = -Infinity,
    latestProgression = false,
    similar = null,
    similarAt = -Infinity,
    similarExact = false
  const resolve = (entry) =>
    EXIDX[entry.id] || (state.customEx || []).find((ex) => ex.id === entry.id) || entry.muscleSnapshot
  // Read only bounded recent work. Imported/per-entry no-progression work can inform a
  // held proposal; it never becomes progression evidence or updates a routine's load.
  const records = [
    ...(state.workouts || []),
    ...(active &&
    finite(active.start) &&
    active.start <= now &&
    now - active.start <= RECENT_LOAD_DAYS * DAY &&
    !active.backfill &&
    !active.editingWorkoutId
      ? [{ ...active, start: now, recommendationLive: true }]
      : [])
  ]
  for (const workout of records) {
    const at = workoutAt(workout)
    if (!finite(at) || at > now || now - at > RECENT_LOAD_DAYS * DAY || workout.warmupOnly) continue
    const entries = []
    for (const entry of workout.entries || []) {
      const rows = completedRows(entry)
      if (!rows.length) continue
      const actualMode =
        entry.target?.mode ||
        (rows.some((row) => row.min > 0) ? 'cardio' : rows.some((row) => row.sec > 0) ? 'time' : 'reps')
      const target = { ...entry.target, mode: actualMode }
      const input = { ...entry, target }
      if (entry.id === id) {
        if (planned && modeOf(config) !== actualMode) continue
        const read = normalizedEntry(input, workout, state, config)
        if (!workout.recommendationLive && !workout.source && entry.target && !entryExcluded(workout, entry))
          entries.push(read)
        if (at >= latestAt) {
          latest = read
          latestAt = at
          latestProgression =
            !workout.recommendationLive && !workout.source && !!entry.target && !entryExcluded(workout, entry)
        }
      } else if (!planned?.weight && actualMode === 'reps' && !isAssisted(config) && !config.bodyweight) {
        const donor = resolve(entry)
        if (!donor || donor.eq !== match.exercise.eq || !['dumbbell', 'barbell', 'kettlebell'].includes(donor.eq))
          continue
        const exact = recommendationName(donor) === recommendationName(match.exercise)
        if (!exact && (!profile.family || recommendationProfile(donor).family !== profile.family)) continue
        if (target.bodyweight || isAssisted({ id: entry.id })) continue
        // Unknown two-bell meanings cannot support a transfer to a different movement.
        if (
          isBellEx(donor) &&
          entryDbLoad(input) === 'as' &&
          (!exact || bellsIn({ ...target, id: entry.id }) !== bellsIn(config))
        )
          continue
        if (!similar || Number(exact) > Number(similarExact) || (exact === similarExact && at >= similarAt)) {
          similar = { entry: input, workout, exercise: donor }
          similarAt = at
          similarExact = exact
        }
      }
    }
    if (entries.length) history.push({ ...workout, entries })
  }
  let source = planned ? 'plan' : 'unset',
    sourceExercise = null
  const evidence = latest || similar?.entry
  // A new bell movement uses an explicit per-bell meaning when the donor has one.
  if (
    !latest &&
    similar &&
    isBellEx(match.exercise) &&
    dbLoadFor(state, config) === 'as' &&
    entryDbLoad(similar.entry) !== 'as'
  )
    config.dbLoad = 'each'
  const readSimilar = !latest && similar ? normalizedEntry(similar.entry, similar.workout, state, config) : null
  const recentRows = completedRows(latest || readSimilar || {}).flatMap((row) =>
    isSideSet(row)
      ? [row.sides.L, row.sides.R].filter((s) => s.done && !s.skipped)
      : [{ ...row, ...(evidence?.target?.side && finite(row.r) ? { r: row.r / 2 } : {}) }]
  )
  const targetReps = evidence?.target?.reps || 0
  const hardLastTime = recentRows.some(
    (row) =>
      row.failure ||
      (rirOf(row) != null && rirOf(row) <= 1) ||
      (finite(row.r) && (row.r === 0 || (targetReps > 0 && row.r < targetReps / (evidence?.target?.side ? 2 : 1))))
  )
  if (latest) {
    const recentConfig = Object.fromEntries(
      Object.entries(pickConfig(latest.target)).filter(([key]) => planned?.[key] == null)
    )
    config = { ...config, ...recentConfig, id, weight: planned?.weight || 0 }
    const performed = recentRows
      .map((row) => (modeOf(config) === 'time' ? row.sec : modeOf(config) === 'cardio' ? row.min : row.r))
      .filter((n) => finite(n) && n > 0)
    if (performed.length) {
      const field = modeOf(config) === 'time' ? 'sec' : modeOf(config) === 'cardio' ? 'min' : 'reps'
      // A saved target wins. Target-less imports use actual work, never a made-up ten reps.
      if (!(planned?.[field] > 0) && !(latest.target[field] > 0))
        config[field] = Math.min(...performed) * (field === 'reps' && config.side ? 2 : 1)
    }
    if (!(planned?.sets > 0))
      config.sets = Math.max(1, completedRows(latest).length / (modeOf(config) === 'time' && config.side ? 2 : 1))
    if (!planned) source = 'recent'
  }
  if (latest && !(planned?.weight > 0)) {
    const weights = recentRows
      .filter((row) => (row.r > 0 || row.sec > 0) && finite(row.w) && row.w > 0)
      .map((row) => {
        const reps = config.side ? (config.reps || 0) / 2 : config.reps
        return row.w * (row.r > 0 && row.r <= 12 && reps > row.r ? (30 + row.r) / (30 + reps) : 1)
      })
    if (weights.length) {
      config.weight = Math.min(...weights)
      source = 'recent'
    }
  } else if (!latest && readSimilar && !(planned?.weight > 0)) {
    const weights = recentRows
      .filter((row) => row.r > 0 && row.r <= 20 && finite(row.w) && row.w > 0)
      .map((row) => {
        // Convert the source's per-bell number to the destination's explicit meaning. entryAs
        // already converted same-count meanings; different-count transfers use each bell.
        const from = entryDbLoad(similar.entry),
          to = dbLoadFor(state, config)
        const donorBells = bellsIn({ ...similar.entry.target, id: similar.entry.id })
        const destBells = bellsIn(config)
        const bellFactor =
          isBellEx(match.exercise) && from !== 'as' && to !== 'as' && donorBells !== destBells
            ? ((from === 'total' ? 1 / donorBells : 1) * (to === 'total' ? destBells : 1)) /
              meaningFactor(from, to, { ...similar.entry.target, id: similar.entry.id })
            : 1
        const reps = config.side ? config.reps / 2 : config.reps
        return (
          row.w *
          bellFactor *
          Math.min(1, (30 + row.r) / (30 + reps)) *
          (similarExact ? 1 : 0.8) *
          (hardLastTime || match.fatigue > 0.35 ? 0.9 : 1)
        )
      })
    if (weights.length) {
      config.weight = Math.min(...weights)
      source = 'similar'
      sourceExercise = similar.exercise
    }
  }
  const mode = modeOf(config)
  const noProg = !!routine?.excludeFromProgression || !!current?.noProg
  if (planned && latest && latestProgression && !noProg) {
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
  const explicitRest = config.restSec != null
  config.restSec = restSecFor([{ target: config }], [0], state.restSec ?? 90)
  if (!explicitRest && config.restSec > 0) config.restSec = Math.max(config.restSec, profile.restSec)
  // A hard recent effort may call for more recovery; an explicitly disabled timer stays off.
  if (hardLastTime && config.restSec > 0) config.restSec = Math.max(config.restSec, 120)
  const elapsed = Math.max(0, (now - (active?.start ?? now) - (active?.pausedMs || 0)) / 60000)
  const nearHour = elapsed + remainingWorkoutMinutes(active, state.restSec) >= 50
  // This is today's optional accessory dose. Keep the user's rep target and rest; budget
  // excess time through sets, never by silently shortening recovery or rewriting a routine.
  config.sets = Math.min(
    Math.max(1, Math.round(config.sets) || 2),
    nearHour || hardLastTime || match.fatigue > 0.35 ? 1 : 2
  )
  delete config.setsMax // today's optional dose has a fixed cap, not the routine's set range
  if (mode === 'cardio') config.min = Math.min(config.min || 5, nearHour ? 3 : 5)
  if (mode !== 'cardio') {
    const hadLoad = config.weight > 0
    config.weight = achievableRecommendationLoad(state, config, config.weight)
    // Do not round an evidenced load up to the lightest available bell. A genuinely new
    // movement instead gets an explicit starting estimate and one calibration set.
    if (!hadLoad && !config.bodyweight) {
      const trial = startingLoad(state, config, match.exercise, now)
      const attempts = recentRows.map((row) => row.w).filter((w) => finite(w) && w > 0)
      const harderThanAttempt =
        attempts.length &&
        trial &&
        (isAssisted(config) ? trial.weight < Math.max(...attempts) : trial.weight > Math.min(...attempts))
      if (trial && finite(trial.weight) && trial.weight >= 0 && !harderThanAttempt) {
        config.weight = trial.weight
        if (trial.dbLoad) config.dbLoad = trial.dbLoad
        config.sets = 1
        source = 'starting'
      }
    }
  }
  config = withMeaning(state, config, id)
  const needsWeight = mode !== 'cardio' && config.bodyweight !== true && !(config.weight > 0) && source !== 'starting'
  if (needsWeight) source = 'unset'
  else if (source === 'unset') source = 'starting'
  const workSeconds =
    mode === 'cardio'
      ? config.min * 60
      : mode === 'time'
        ? (config.sec || 45) * (config.side ? 2 : 1)
        : Math.max(30, (config.reps || 10) * 4)
  const minutes = Math.ceil((config.sets * workSeconds + Math.max(0, config.sets - 1) * config.restSec + 60) / 60)
  return { ...match, config, minutes, source, sourceExercise, needsWeight, hardLastTime }
}
