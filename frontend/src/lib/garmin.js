// Adapter for Uplift's existing Connect IQ v1 companion. Wire values are epoch seconds.
import { defaultWatchPreferences, isWatchSnapshot, isWatchEvent, isWatchCommand } from '../../../shared/garmin.ts'
import { exOr } from './exercises.js'
import { exerciseNameFor } from './i18n.js'
import { modeOf, isPerSide } from './history.js'
import { isSideSet, isWarmupRow, dropsOf, clustersOf } from './workout-model.js'
import { focusRest, focusEntryKey } from './workout-focus.js'
import { baseWeightFor, inventoryFor, loadKindFor, rowLoad } from './plates.js'
import { entryDbLoad, bellsIn } from './dumbbells.js'
import { completeLiveWorkout } from './complete-live-workout.js'
const seconds = n => Math.max(0, Math.floor((n || 0) / 1000))
const copy = x => structuredClone(x)
const nameOf = e => exerciseNameFor(exOr(e.id)).slice(0, 32)
const rows = (e, warmup = false) => e.sets.filter(s => isWarmupRow(s) === warmup)
const result = s => s.skipped ? -2 : s.done ? (s.sec != null ? -3 : s.r ?? 0) : -1
const layout = a => JSON.stringify(a.entries.map(e => [e._watchKey, e.id, e.rid, e.sets.map(s => [s._watchKey, isWarmupRow(s)])]))
export function bindWatchLayout(S) {
  const a = S.active
  if (!a || a._watchLayout) return
  for (const e of a.entries) {
    e._watchKey = crypto.randomUUID()
    for (const s of e.sets) s._watchKey = crypto.randomUUID()
  }
  a._watchLayout = layout(a)
}
export function watchPhase(a, i, ui = {}) {
  const e = a.entries[i]
  if (e._watchPhase === 'setup') return 'setup'
  const prepared = ui.focusPrepared?.sessionId === a.id && ui.focusPrepared.entries.includes(i + ':' + e.id)
  const skipped = ui.focusSkippedWarmups?.sessionId === a.id && ui.focusSkippedWarmups.entries.includes(focusEntryKey(a, i))
  if (e._watchPhase === 'work' || prepared && (skipped || e._watchSkipWarmups)) return 'work'
  if (e._watchPhase === 'warmup' || prepared) return rows(e, true).some(s => !s.done) ? 'warmup' : 'work'
  return e.sets.some(s => s.done) ? (rows(e, true).some(s => !s.done) ? 'warmup' : 'work') : 'setup'
}
export function watchSnapshot(S, preferences = defaultWatchPreferences, ui = {}) {
  const snapshot = { v: 1, controls: true, skipExercise: true, preparation: true, workout: null, preferences, issue: '' }
  const a = S.active
  if (!a) return snapshot
  const reject = () => ({ ...snapshot, issue: 'Use phone for this workout' })
  // A frozen identity map catches even reordering two occurrences of the same exercise.
  // Unsupported row semantics cannot be represented by this firmware's manual rep logger.
  if (a.editingWorkoutId || a.backfill || !a._watchLayout || a._watchLayout !== layout(a) ||
    a.entries.some(e => e.sg || modeOf({ ...e.target, id: e.id }) !== 'reps' || isPerSide({ ...e.target, id: e.id }) ||
      (exOr(e.id).eq === 'dumbbell' && (bellsIn({ ...e.target, id: e.id }) !== 2 || entryDbLoad(e) !== 'each')) ||
      e.sets.some(s => isSideSet(s) || s.side || dropsOf(s).length || clustersOf(s).length || s.type && s.type !== 'straight'))) return reject()
  const sets = a.entries.flatMap((e, lift) => rows(e).map((s, index) =>
    [lift, index, nameOf(e), s.w ?? 0, s.r ?? 0, focusRest(a, lift, e.sets.indexOf(s), S.restSec), result(s)]))
  const timer = ui.timer
  const stations = a.entries.map((e, lift) => {
    const cfg = { ...e.target, id: e.id }, kind = loadKindFor(S, cfg), eq = exOr(e.id).eq
    const equipment = kind === 'pairs' ? 'barbell' : eq === 'dumbbell' ? 'dumbbell' : eq === 'body weight' || cfg.bodyweight ? 'bodyweight' : 'machine'
    const loads = [...new Set(e.sets.map(s => s.w ?? 0))].map(w => {
      const guide = rowLoad(kind, w, baseWeightFor(S, e.id), inventoryFor(S))
      const stack = guide?.kind === 'pairs' ? guide.plates : []
      const counts = new Map()
      for (const plate of stack) counts.set(plate, (counts.get(plate) || 0) + 1)
      return [w, w - (guide?.missing || 0) * (kind === 'pairs' ? 2 : 1), [...counts]]
    })
    return { lift, equipment, label: equipment === 'dumbbell' ? 'Load per hand' : equipment === 'barbell' ? 'Total bar load' : 'Load',
      phase: watchPhase(a, lift, ui), warmups: rows(e, true).map((s, i) => [i, s.w ?? 0, s.r ?? 0, result(s)]), loads }
  })
  // Firmware has one bar setting. Different per-exercise bars and single-stack plates stay on phone.
  const bars = a.entries.filter(e => loadKindFor(S, { ...e.target, id: e.id }) === 'pairs').map(e => baseWeightFor(S, e.id))
  if (bars.some(b => b <= 0) || new Set(bars).size > 1 || a.entries.some(e => loadKindFor(S, { ...e.target, id: e.id }) === 'single' && e.sets.some(s => s.w > 0))) return reject()
  snapshot.workout = { id: a.id, name: (a.name || '').slice(0, 40), unit: S.unit, start: seconds(a.start), paused: timer?.paused ? seconds(timer.pausedAt || timer.endsAt - timer.left * 1000) : 0,
    pauseSeconds: 0, rest: watchRestDeadline(a, a.cur || 0, ui), sets, focus: a.cur || 0,
    rests: a.entries.map((_, i) => [i, watchRestDeadline(a, i, ui)]),
    prep: { bar: bars[0] || (S.unit === 'lb' ? 45 : 20), stations } }
  if (!isWatchSnapshot(snapshot) || new TextEncoder().encode(JSON.stringify(snapshot)).length > 14000) return reject()
  return snapshot
}
export function watchRestDeadline(a, lift, ui = {}) {
  if (ui.timer?.forIdx === lift) return ui.timer.ready ? 0 : seconds(ui.timer.endsAt)
  return seconds(a._watchRests?.[lift])
}
export const withoutWatch = S => {
  const { _watch, ...rest } = S
  return rest
}
const pendingSets = (snapshot, lift) => snapshot.workout?.sets.filter(s => s[0] === lift && s[6] === -1) || []
function advance(a, from, resetPreparation = false) {
  const order = a.entries.map((_, i) => i)
  // Firmware currentSet() picks the first pending work station after a completed
  // station; its explicit Next exercise command instead cycles through work stations.
  const choices = resetPreparation ? order : [...order.slice(from + 1), ...order.slice(0, from)]
  const next = choices.find(i => rows(a.entries[i]).some(s => !s.done && !s.skipped))
  if (next !== undefined) {
    a.cur = next
    if (resetPreparation) a.entries[next]._watchPhase = 'setup'
  }
}
// A pure draft plus UI effects. The store persists results AND receipts before effects or relay ack.
export function applyWatchOperations(state, events, commands, ui = {}, now = Date.now()) {
  if (!Array.isArray(events) || !events.every(isWatchEvent) || !Array.isArray(commands) || !commands.every(isWatchCommand)) throw new Error('Invalid watch data')
  const S = copy(state), effects = []
  S._watch ||= { receipts: [], review: [] }
  if (events.length > 60 || commands.length > 1 || events.length && commands.length) throw new Error('Invalid watch data')
  for (const operation of [...events, ...commands]) {
    if (S._watch.receipts.some(r => r.id === operation.id)) continue
    if (S._watch.review.length >= 60) break // Keep unacknowledged work on the watch when review is full.
    const a = S.active, snap = watchSnapshot(S, defaultWatchPreferences, ui), w = snap.workout
    let saved = false
    const valid = w && a.id === operation.session && !ui.work && !ui.timer?.paused && operation.at * 1000 >= a.start - 1000 && operation.at * 1000 <= now + 30000
    if (valid && !operation.kind) {
      const e = a.entries[operation.lift], warmup = operation.scope === 'warmup', s = e && rows(e, warmup)[operation.set]
      const expected = operation.expected
      const phase = e && watchPhase(a, operation.lift, ui)
      if (s && !s.done && !s.skipped && operation.unit === S.unit && operation.exercise === nameOf(e) &&
        operation.lift === (a.cur || 0) && (warmup ? phase === 'warmup' : phase === 'work') &&
        expected && expected[0] === (s.w ?? 0) && expected[1] === (s.r ?? 0)) {
        s.done = true; s.r = operation.reps; s.w = operation.weight; s.at = operation.at * 1000
        s.weightOrigin = 'manual'; delete s.skipped
        if (warmup && rows(e, true).every(s => s.done)) e._watchPhase = 'work'
        // Warm-up rest follows openGym's prescription; old transfers cannot restart elapsed rest.
        const deadline = s.at + focusRest(a, operation.lift, e.sets.indexOf(s), S.restSec) * 1000
        a._watchRests ||= {}; a._watchRests[operation.lift] = deadline
        effects.push({ kind: 'logged', lift: operation.lift, set: e.sets.indexOf(s), at: s.at, deadline })
        if (!warmup && rows(e).every(s => s.done || s.skipped)) {
          advance(a, operation.lift, true)
          if (a.cur !== operation.lift) effects.push({ kind: 'station', lift: a.cur, deadline: a._watchRests[a.cur] || 0 })
        }
        saved = true
      }
    } else if (valid) {
      const c = operation, e = a.entries[c.lift]
      const matches = e && JSON.stringify(pendingSets(snap, c.lift)) === JSON.stringify(c.expected) && c.expected?.length
      if (c.kind === 'prepare' && e && c.lift === (a.cur || 0) && watchPhase(a, c.lift, ui) === c.from && matches &&
        (c.to === 'work' || c.to === 'warmup' && rows(e, true).some(s => !s.done))) {
        e._watchPhase = c.to; if (c.to === 'work') { a._watchRests ||= {}; a._watchRests[c.lift] = 0 }
        effects.push({ kind: 'prepare', lift: c.lift, phase: c.to }); saved = true
      } else if (c.kind === 'station' && e && c.from === (a.cur || 0) && matches) {
        a._watchRests ||= {}
        if (ui.timer && !ui.timer.ready) a._watchRests[ui.timer.forIdx] = ui.timer.endsAt
        a.cur = c.lift; effects.push({ kind: 'station', lift: c.lift, deadline: a._watchRests[c.lift] || 0 }); saved = true
      } else if (c.kind === 'skip-rest' && c.lift === (a.cur || 0) && c.until > 0 && c.until === watchRestDeadline(a, c.lift, ui)) {
        a._watchRests ||= {}; a._watchRests[c.lift] = 0
        effects.push({ kind: 'stop-rest', lift: c.lift }); saved = true
      } else if (c.kind === 'skip-exercise' && e && c.lift === (a.cur || 0) && matches) {
        for (const s of rows(e)) if (!s.done) { s.skipped = true; s.done = false; s.r = null; s.at = c.at * 1000 }
        e._watchSkipWarmups = true
        advance(a, c.lift); a._watchRests ||= {}; a._watchRests[c.lift] = 0
        effects.push({ kind: 'stop-rest', lift: c.lift }); saved = true
      } else if (c.kind === 'finish' && c.recorded + (c.warmups ?? 0) > 0 && c.total === w.sets.length && c.recorded === w.sets.filter(s => s[6] >= 0 || s[6] === -3).length &&
        (c.warmups ?? 0) === w.prep.stations.flatMap(s => s.warmups).filter(s => s[3] >= 0 || s[3] === -3).length &&
        !S._watch.review.some(r => r.operation.session === a.id)) {
        const record = completeLiveWorkout(S, c.at * 1000); if (c.recorded === 0) record.warmupOnly = true; effects.push({ kind: 'finish' }); saved = true
      }
      // Legacy undo queues request review rather than rewriting a phone result.
    }
    const status = saved ? 'saved' : 'review'
    if (!saved) S._watch.review.push({ operation, received: now })
    S._watch.receipts.push({ id: operation.id, status })
    S._watch.receipts = S._watch.receipts.slice(-600)
  }
  return { state: S, effects }
}
