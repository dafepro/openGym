import { readingsOf, settleDay, dailyModeOf } from './weigh-ins.js'

const copy = value => JSON.parse(JSON.stringify(value))
const factor = (from, to) => from === 'kg' && to === 'lb' ? 2.2046226218487757 : from === 'lb' && to === 'kg' ? 1 / 2.2046226218487757 : null
const keyOf = (d, id) => JSON.stringify([d, id])

// Units are explicitly supplied by the person repairing the data, never guessed from weight.
export function conversionRows(S, from) {
  const f = factor(from, S.unit)
  if (!f) return []
  return (S.bodyweight || []).flatMap(day => readingsOf(day).map(r => ({
    key: keyOf(day.d, r.id), d: day.d, id: r.id, at: r.at, src: r.src,
    ambiguous: readingsOf(day).some(other => other.id !== r.id && other.at === r.at),
    before: r.w, after: Math.round(r.w * f * 100) / 100,
  })))
}

export function previewConversion(S, from, selected) {
  const rows = conversionRows(S, from).filter(r => selected.includes(r.key))
  const dates = new Set(rows.map(r => r.d))
  return { unit: S.unit, mode: dailyModeOf(S), rows, days: copy((S.bodyweight || []).filter(d => dates.has(d.d))) }
}

// Fail closed if anything shown in the preview changed (including another device's edit).
export function applyConversion(S, preview, now = Date.now()) {
  if (preview.rows.some(r => r.ambiguous) || !preview.rows.length || S.unit !== preview.unit || dailyModeOf(S) !== preview.mode) return null
  if (preview.days.some(before => JSON.stringify((S.bodyweight || []).find(d => d.d === before.d)) !== JSON.stringify(before))) return null
  const before = copy(preview.days)
  for (const snapshot of before) {
    const day = S.bodyweight.find(d => d.d === snapshot.d)
    const rows = preview.rows.filter(r => r.d === day.d)
    const stamp = Math.max(now, Number(day.t || 0) + 1, ...(day.ins || []).map(r => Number(r.t || 0) + 1))
    if (Array.isArray(day.ins)) {
      for (const row of rows) {
        const r = day.ins.find(r => String(r.id) === row.id)
        r.w = row.after
        r.t = stamp // edit stamp only; retain time, source and source id
      }
      settleDay(day, preview.mode, { absorb: false })
    } else {
      const r = readingsOf(day)[0]
      if (day.sid) r.sid = day.sid
      day.ins = [{ ...r, w: rows[0].after, t: stamp }]
      settleDay(day, preview.mode, { absorb: false })
    }
  }
  return { unit: S.unit, mode: preview.mode, before, after: copy(S.bodyweight.filter(d => before.some(b => b.d === d.d))) }
}

export function undoConversion(S, receipt, now = Date.now()) {
  if (!receipt || S.unit !== receipt.unit || dailyModeOf(S) !== receipt.mode) return false
  if (receipt.after.some(after => JSON.stringify(S.bodyweight.find(d => d.d === after.d)) !== JSON.stringify(after))) return false
  for (const before of receipt.before) {
    const i = S.bodyweight.findIndex(d => d.d === before.d)
    const current = S.bodyweight[i]
    const restored = copy(before)
    const stamp = Math.max(now, Number(current.t || 0) + 1)
    if (Array.isArray(restored.ins)) {
      for (const r of restored.ins) {
        const changed = current.ins.find(x => String(x.id) === String(r.id))
        if (changed && changed.w !== r.w) r.t = stamp
      }
      settleDay(restored, receipt.mode, { absorb: false })
    } else {
      const r = readingsOf(before)[0]
      if (before.sid) r.sid = before.sid
      restored.ins = [{ ...r, t: stamp }]
      settleDay(restored, receipt.mode, { absorb: false })
    }
    S.bodyweight[i] = restored
  }
  return true
}

// Suggestions identify provenance, not whether a number is wrong. An intervening manual
// reading or a different source starts a new stretch. Selection still requires user review.
export function importedStretches(rows) {
  const groups = []
  let group = null
  for (const row of [...rows].sort((a, b) => a.d.localeCompare(b.d) || (a.at || '').localeCompare(b.at || ''))) {
    if (row.src !== 'import' || row.ambiguous) { group = null; continue }
    if (!group || group.source !== row.src) {
      group = { source: row.src, rows: [] }
      groups.push(group)
    }
    group.rows.push(row)
  }
  return groups
}
