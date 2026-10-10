// Drive data is untrusted, including files written by a future/broken client.
// Validate structures before any head can reach persistence. This preserves
// null/zero/skipped/timed set values; it does not fabricate or normalize sets.
const object = x => !!x && typeof x === 'object' && !Array.isArray(x)
const records = x => Array.isArray(x) && x.every(object)
const optional = (x, key, check) => !(key in x) || check(x[key])
const id = x => typeof x === 'string' || typeof x === 'number'
export function validCloudState(state) {
  if (!object(state) || !['kg', 'lb'].includes(state.unit) || !records(state.workouts) || !records(state.routines)) return false
  let nodes = 0
  function safe(x, depth = 0) {
    if (++nodes > 250000 || depth > 50) return false
    if (typeof x === 'number') return Number.isFinite(x)
    if (!x || typeof x !== 'object') return true
    for (const [key, value] of Object.entries(x)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) return false
      if (['_ts', '_rev', 'resetAt'].includes(key) && (typeof value !== 'number' || value < 0)) return false
      if (['_f', 'edited'].includes(key) && (!object(value) || Object.values(value).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0))) return false
      if (key === 'unitSet' && (!object(value) || typeof value.at !== 'number' || !Number.isFinite(value.at) || value.at < 0 ||
        !optional(value, 'convert', v => typeof v === 'boolean'))) return false
      if (key === 'deleted' && (!object(value) || Object.values(value).some(map => !object(map) ||
        Object.values(map).some(v => typeof v !== 'number' || !Number.isFinite(v))))) return false
      if (['_u', 'undone'].includes(key) && (!object(value) || Object.values(value).some(tuple => !Array.isArray(tuple) ||
        tuple.length !== 3 || tuple.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0)))) return false
      if (!safe(value, depth + 1)) return false
    }
    return true
  }
  if (!safe(state)) return false
  const text = v => v === null || typeof v === 'string'
  const number = v => v === null || (typeof v === 'number' && Number.isFinite(v))
  for (const key of ['theme', 'lang', 'accent', 'accentLight', 'accentDark', 'body', 'gifSize', 'heatmapMetric', 'workoutView', 'exerciseView', 'effort', 'speedUnit', 'scheduleMode', 'activeEquipId', 'startFrom']) {
    if (!optional(state, key, text)) return false
  }
  for (const key of ['restSec', 'restPauseSec', 'targetW', 'weekStart', 'wdec']) if (!optional(state, key, number)) return false
  for (const key of ['sound', 'soundOnSilent', 'vibrateOnSilent', 'timerFlash', 'timedSetOvertime', 'keepAwake', 'collapseCompleted', 'autoBackup', 'equipFilterOn', 'weighIn', 'connStatus', 'shareMap', 'connLocal']) {
    if (!optional(state, key, v => typeof v === 'boolean')) return false
  }
  const sets = list => records(list) && list.every(s => optional(s, 'drops', records) &&
    optional(s, 'sides', v => object(v) && object(v.L) && object(v.R)) &&
    ['r', 'w', 'dur'].every(k => optional(s, k, number)))
  for (const w of state.workouts) {
    if (!optional(w, 'id', id) || !optional(w, 'd', v => typeof v === 'string') || !records(w.entries) ||
        !w.entries.every(e => optional(e, 'id', id) && sets(e.sets) && optional(e, 'note', text)) ||
        !optional(w, 'media', records) || !optional(w, 'note', text)) return false
  }
  for (const r of state.routines) if (!id(r.id) || !optional(r, 'name', v => typeof v === 'string') ||
    !Array.isArray(r.ex) || !r.ex.every(e => typeof e === 'string' || typeof e === 'number' || object(e))) return false
  for (const key of ['customEx', 'equipProfiles', 'gymCards', 'bodyweight', 'measurements', 'customMeasurements']) {
    if (!optional(state, key, records)) return false
  }
  for (const key of ['customEx', 'equipProfiles', 'gymCards', 'customMeasurements']) for (const entry of state[key] || []) {
    if (!id(entry.id) || !optional(entry, 'name', text)) return false
  }
  for (const key of ['bodyweight', 'measurements']) for (const entry of state[key] || []) {
    if (typeof entry.d !== 'string' || !optional(entry, 't', number)) return false
  }
  for (const key of ['favEx', 'measurementEnabled']) if (!optional(state, key, v => v === null || (Array.isArray(v) && v.every(id)))) return false
  for (const key of ['week', 'dayPlan', 'exNotes', 'barWeights', 'exWeights', 'balanceOverrides', 'loadKind', 'plates', 'dbLoad', 'dumbbells', 'dayNotes', 'edited', 'deleted', 'resetIds', 'hints', 'wc', 'reminder', 'undone']) {
    if (!optional(state, key, v => v === null || object(v))) return false
  }
  return true
}
