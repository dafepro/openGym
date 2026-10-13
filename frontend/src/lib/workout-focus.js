import { isBw, supersetUnits, unitOf } from './history.js'
import { bellsIn, entryDbLoad } from './dumbbells.js'
import { isSideSet, isWarmupRow } from './workout-model.js'
import { pyramidRestFor } from './pyramid.js'
import { restSecFor, warmupRestSecFor } from './supersetFlow.js'

// The dock reads the same rows and meanings as the full workout; it owns no training plan.
export function focusEntryKey(active, entryIdx) {
  const entry = active?.entries?.[entryIdx]
  const occurrence = active?.entries?.slice(0, entryIdx).filter(e => e.id === entry?.id && e.rid === entry?.rid).length || 0
  return entry?.id + ':' + (entry?.rid || '') + ':' + occurrence
}

const workOnly = (active, entryIdx, skipped) => active?.entries?.[entryIdx]?._watchPhase === 'work' || active?.entries?.[entryIdx]?._watchSkipWarmups || skipped?.sessionId === (active?.id ?? active?.start) &&
  skipped?.entries?.includes(focusEntryKey(active, entryIdx))

// Presentation-only bypass. Original warm-up rows stay unrecorded in the session/history.
// The projection is used only for pending-work, navigation and rest decisions.
export function focusFlowEntries(active, skipped) {
  return (active?.entries || []).map((entry, index) => workOnly(active, index, skipped)
    ? { ...entry, sets: entry.sets.filter(set => !isWarmupRow(set)).map(s => s.skipped ? { ...s, done: true } : s) } : { ...entry, sets: entry.sets.map(s => s.skipped ? { ...s, done: true } : s) })
}

export function focusSet(active, entryIdx, skipped) {
  const entry = active?.entries?.[entryIdx]
  const setIdx = entry?.sets.findIndex(set => !set.done && !set.skipped && (!workOnly(active, entryIdx, skipped) || !isWarmupRow(set))) ?? -1
  const row = entry?.sets[setIdx]
  const side = isSideSet(row) ? (!row.sides.L.done ? 'L' : 'R') : null
  return { entryIdx, setIdx, entry, row, side, set: side ? row.sides[side] : row }
}

export function focusRest(active, entryIdx, setIdx, fallback) {
  const entry = active?.entries?.[entryIdx]
  const unit = unitOf(supersetUnits(active?.entries || []), entryIdx)
  const sec = pyramidRestFor(entry?.target, entry?.sets || [], setIdx)
  return warmupRestSecFor(entry, setIdx, restSecFor(active?.entries, unit, fallback, { idx: entryIdx, sec }))
}

export function focusLoadLabel(entry, unit) {
  const cfg = { ...entry?.target, id: entry?.id }
  if (isBw(cfg)) return ['Added ({0})', unit]
  const meaning = bellsIn(cfg) === 2 ? entryDbLoad(entry) : 'as'
  return [meaning === 'each' ? 'Each ({0})' : meaning === 'total' ? 'Both ({0})' : 'Load ({0})', unit]
}

// A timestamp and exercise ID follow the logged row through a reorder. Legacy rows without
// timestamps can still be corrected; they simply cannot override an explicitly tracked log.
export function lastFocusSet(active, tracked, timer) {
  const candidates = []
  for (const [entryIdx, entry] of (active?.entries || []).entries()) {
    for (const [setIdx, row] of entry.sets.entries()) {
      const sides = isSideSet(row) ? ['L', 'R'].filter(side => row.sides[side].done) : row.done ? [null] : []
      for (const side of sides) candidates.push({ entryIdx, setIdx, entry, row, side, set: side ? row.sides[side] : row, at: row.at || 0 })
    }
  }
  const owned = tracked?.sessionId === (active?.id ?? active?.start) && candidates.find(c =>
    c.entry.id === tracked.id && c.at === tracked.at && c.side === tracked.side)
  if (owned) return owned
  const rested = candidates.findLast(c => c.entryIdx === timer?.forIdx && c.setIdx === timer?.forSet)
  return rested || candidates.sort((a, b) => b.at - a.at || b.entryIdx - a.entryIdx || b.setIdx - a.setIdx)[0] || null
}
