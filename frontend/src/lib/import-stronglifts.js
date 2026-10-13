// StrongLifts exports one row per exercise, with a column per set. This is
// intentionally separate from Strong's one-row-per-set dialect. Never infer
// completed reps from Sets x Reps, total volume, or a top-set summary.
export const isStrongLiftsHeader = h => h.some(x => /^Date \(yyyy\/mm\/dd\)$/i.test(x.trim())) && h.some(x => /^Set \d+ \((Reps|LBS|KG|Time)\)$/i.test(x.trim()))

export function parseStrongLifts(rows, { unit = 'kg', customEx = [] } = {}, helpers) {
  const header = rows[0].map(x => x.trim())
  const names = header.map(x => x.toLowerCase())
  const fail = message => { throw new Error(message) }
  if (new Set(names).size !== names.length) fail('Duplicate StrongLifts columns.')
  const at = (row, key) => String(row[names.indexOf(key.toLowerCase())] ?? '').trim()
  const sourceUnit = header.some(x => /^Set \d+ \(LBS\)$/i.test(x)) ? 'lb' : 'kg'
  if (header.some(x => /^Set \d+ \(LBS\)$/i.test(x)) && header.some(x => /^Set \d+ \(KG\)$/i.test(x))) fail('Mixed StrongLifts set units.')
  if (!names.includes('exercise') || !names.includes('workout')) fail('Missing StrongLifts workout columns.')
  const indices = [...new Set(header.flatMap(h => { const m = /^Set (\d+) \(/i.exec(h); return m ? [+m[1]] : [] }))].sort((a, b) => a - b)
  if (!indices.length || indices.length > 100) fail('Unsupported StrongLifts set columns.')
  const numeric = (v, max, signed = false) => {
    if (!v) return null
    if (!/^-?\d+(?:\.\d+)?$/.test(v)) fail('Invalid StrongLifts number.')
    const n = Number(v)
    if (!Number.isFinite(n) || Math.abs(n) > max || (!signed && n < 0)) fail('Invalid StrongLifts number.')
    return n
  }
  const weight = w => w == null ? null : sourceUnit === unit ? w : Math.round(w * (sourceUnit === 'lb' ? .45359237 : 1 / .45359237) * 10) / 10
  const clock = (d, value) => {
    if (!value) return null
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(value)
    if (!m || +m[2] > 59 || +(m[3] || 0) > 59 || +m[1] > (m[4] ? 12 : 23) || (m[4] && +m[1] < 1)) fail('Invalid StrongLifts time.')
    const hour = m[4] ? +m[1] % 12 + (/pm/i.test(m[4]) ? 12 : 0) : +m[1]
    const [year, month, day] = d.split('-').map(Number)
    return new Date(year, month - 1, day, hour, +m[2], +(m[3] || 0)).getTime()
  }
  const seconds = value => {
    if (!value) return null
    const parts = value.split(':')
    if (parts.length > 3 || parts.some(x => !/^\d+$/.test(x)) || (parts.length > 1 && parts.slice(1).some(x => +x >= 60))) fail('Invalid StrongLifts set time.')
    const sec = parts.reduce((n, x) => n * 60 + numeric(x, 86400), 0)
    if (sec > 86400) fail('Invalid StrongLifts set time.')
    return sec
  }
  const bodyUnit = names.includes('body weight (lbs)') ? 'lb' : 'kg'
  if (names.includes('body weight (lbs)') && names.includes('body weight (kg)')) fail('Mixed StrongLifts body-weight units.')
  const sessions = new Map(), created = new Map(), matched = new Set(), weighIns = new Map()
  let sets = 0
  for (const row of rows.slice(1)) {
    if (row.length !== header.length) fail('Invalid StrongLifts row length.')
    const d = at(row, 'Date (yyyy/mm/dd)').replaceAll('/', '-')
    const date = new Date(d + 'T12:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== d) fail('Invalid StrongLifts date.')
    const name = at(row, 'Exercise'), no = at(row, 'Workout')
    if (!name || !no) fail('Missing StrongLifts exercise or workout.')
    const key = JSON.stringify([d, no, at(row, 'Program Name'), at(row, 'Start Time (h:mm)')])
    let w = sessions.get(key)
    if (!w) {
      const start = clock(d, at(row, 'Start Time (h:mm)')) ?? new Date(d + 'T12:00:00').getTime()
      let end = clock(d, at(row, 'End Time (h:mm)'))
      if (end != null && end < start) { const next = new Date(end); next.setDate(next.getDate() + 1); end = +next }
      const hours = numeric(at(row, 'Duration (hours)'), 24)
      w = { id: helpers.importId('sl', key), source: 'StrongLifts', d, start, end: end ?? start + (hours || 0) * 3600000,
        name: at(row, 'Workout Name') || 'StrongLifts', routineId: null, entries: [], prs: [], vol: 0, note: '' }
      sessions.set(key, w)
    }
    const body = numeric(at(row, `Body Weight (${bodyUnit === 'lb' ? 'LBS' : 'KG'})`), bodyUnit === 'lb' ? 650 / .45359237 : 650)
    if (body > 0) {
      const value = bodyUnit === unit ? body : Math.round(body * (bodyUnit === 'lb' ? .45359237 : 1 / .45359237) * 10) / 10
      const old = weighIns.get(d)
      if (old?.t === w.start && old.w !== value) fail('Conflicting StrongLifts body weights for the same workout.')
      // The profile stores one weigh-in per day; the latest logged session wins.
      if (!old || w.start > old.t) weighIns.set(d, { d, w: value, t: w.start })
    }
    const note = at(row, 'Notes')
    if (note && !w.note.split('\n').includes(note)) w.note = [w.note, note].filter(Boolean).join('\n')
    let id = helpers.matchExercise(name)
    if (id) matched.add(id)
    else {
      const own = customEx.find(e => e.n?.toLowerCase() === name.toLowerCase())
      id = own?.id || helpers.importId('im', 'StrongLifts|' + name.toLowerCase())
      if (!own && !created.has(id)) created.set(id, { id, n: name.toLowerCase(), custom: true, eq: 'custom', bp: null, tg: '', desc: '' })
    }
    const ss = indices.map(n => {
      const r = numeric(at(row, `Set ${n} (Reps)`), 1000)
      if (r != null && !Number.isInteger(r)) fail('StrongLifts reps must be whole numbers.')
      const sec = seconds(at(row, `Set ${n} (Time)`))
      const load = weight(numeric(at(row, `Set ${n} (${sourceUnit === 'lb' ? 'LBS' : 'KG'})`), 10000, true))
      const done = r != null || sec != null
      if (done) sets++
      if (r != null && sec != null && sec > 0) fail('A StrongLifts set has both reps and time. Separate these in the export before importing.')
      return sec != null && r == null ? { sec, w: load, done } : { r, w: load, done }
    })
    const timed = ss.some(s => s.sec != null)
    if (timed) ss.forEach(s => { if (s.r != null) fail('A StrongLifts exercise mixes timed and rep sets. Separate these before importing.'); s.mode = 'time'; if (!('sec' in s)) { delete s.r; s.sec = null } })
    const e = { id, sets: ss, ...(timed ? { target: { mode: 'time' } } : {}), topW: Math.max(0, ...ss.filter(s => s.done).map(s => s.w || 0)) || null }
    w.entries.push(e)
    w.vol += ss.reduce((v, s) => v + (s.done ? Math.max(0, s.w || 0) * (s.r || 0) : 0), 0)
  }
  const workouts = [...sessions.values()].sort((a, b) => a.start - b.start)
  return { kind: 'workouts', source: 'StrongLifts', workouts, bodyweight: [...weighIns.values()].sort((a, b) => a.d.localeCompare(b.d)), customEx: [...created.values()], matched: matched.size,
    created: created.size, unmatchedNames: [...created.values()].map(e => e.n), sets, skipped: 0, warmups: 0,
    fileUnit: sourceUnit, mixedUnits: false, converted: sourceUnit !== unit, rpeSets: 0, rirSets: 0,
    from: workouts[0]?.d || null, to: workouts.at(-1)?.d || null }
}
