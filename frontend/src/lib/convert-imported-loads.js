import { convertExact } from './units.js'
import { stampWorkout } from './sync-merge.js'
import { workoutVolume } from './history.js'
import { isWarmupRow, syncSideAggregate } from './workout-model.js'

const copy = x => JSON.parse(JSON.stringify(x))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
// Importers use cyrb53 encoded in base36, with iw (CSV/Hevy) or sl (StrongLifts).
// A display name such as "Imported" is not provenance. Ordinary uid() ids are not this shape.
export function isImportedSession(w) {
  const m = /^(iw|sl)([0-9a-z]{1,11})$/.exec(String(w?.id || ''))
  if (!m || (m[1] === 'sl' && w.source !== 'StrongLifts')) return false
  const n = parseInt(m[2], 36)
  return Number.isSafeInteger(n) && n >= 0 && n.toString(36) === m[2]
}
const eligible = (S, w) => isImportedSession(w) && w.id !== S.active?.id &&
  !(w.prs?.length || w.e1prs?.length) // imported records start empty; don't rewrite later earned records
const atPath = (object, path) => path.reduce((value, key) => value?.[key], object)

export function importedLoadRows(S, from) {
  if (!['kg', 'lb'].includes(from) || !['kg', 'lb'].includes(S.unit) || from === S.unit) return []
  const rows = []
  for (const w of S.workouts || []) {
    if (!eligible(S, w)) continue
    for (const [ei, e] of (w.entries || []).entries()) {
      for (const [si, set] of (e.sets || []).entries()) {
        const root = ['entries', ei, 'sets', si]
        const add = (node, path, detail) => {
          if (typeof node?.w !== 'number' || !Number.isFinite(node.w) || node.w <= 0) return
          rows.push({ key: JSON.stringify([w.id, ...path]), id: w.id, d: w.d, name: w.name,
            exercise: e.id, set: si + 1, detail, path: [...path, 'w'], before: node.w,
            after: convertExact(node.w, from, S.unit) })
        }
        const leaf = (node, path, detail) => {
          add(node, path, detail)
          for (const [di, drop] of (node?.drops || []).entries()) add(drop, [...path, 'drops', di], `${detail} / ${di + 1}`)
        }
        if (set.sides) {
          if (![set.sides.L, set.sides.R].every(side => side && typeof side.w === 'number' && Number.isFinite(side.w) && side.w >= 0)) continue
          leaf(set.sides.L, [...root, 'sides', 'L'], 'L')
          leaf(set.sides.R, [...root, 'sides', 'R'], 'R')
        } else leaf(set, root, '')
      }
    }
  }
  return rows
}
export function previewImportedLoads(S, from, selected) {
  const rows = importedLoadRows(S, from).filter(r => selected.includes(r.key))
  return { unit: S.unit, from, rows, days: copy((S.workouts || []).filter(w => rows.some(r => r.id === w.id))) }
}
export function applyImportedLoads(S, preview) {
  if (S.unit !== preview.unit || !preview.rows.length) return null
  if (preview.days.some(w => !eligible(S, w) || !same(S.workouts.find(x => x.id === w.id), w))) return null
  const before = copy(preview.days)
  for (const old of before) {
    const w = S.workouts.find(w => w.id === old.id)
    const selected = preview.rows.filter(r => r.id === w.id)
    for (const row of selected) atPath(w, row.path.slice(0, -1)).w = row.after
    for (const ei of new Set(selected.map(r => r.path[1]))) {
      const e = w.entries[ei]
      for (const si of new Set(selected.filter(r => r.path[1] === ei).map(r => r.path[3]))) {
        const set = e.sets[si]
        if (set.sides) set.w = syncSideAggregate(set).w
      }
      if (Object.hasOwn(e, 'topW')) e.topW = Math.max(0, ...e.sets.filter(s => !isWarmupRow(s)).map(s => s.w || 0)) || null
    }
    if (Number.isFinite(w.vol)) w.vol = workoutVolume(w)
    stampWorkout(w, Math.max(Date.now(), Number(old._ts || 0) + 1))
  }
  return { unit: S.unit, before, after: copy(S.workouts.filter(w => before.some(b => b.id === w.id))) }
}
export function undoImportedLoads(S, receipt) {
  if (S.unit !== receipt.unit || receipt.after.some(w => w.id === S.active?.id || !same(S.workouts.find(x => x.id === w.id), w))) return false
  for (const before of receipt.before) {
    const i = S.workouts.findIndex(w => w.id === before.id)
    const restored = copy(before)
    stampWorkout(restored, Math.max(Date.now(), Number(S.workouts[i]._ts || 0) + 1))
    S.workouts[i] = restored
  }
  return true // store stampChange re-stamps restored history, retaining logical identity
}
