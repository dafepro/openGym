import { it, expect } from 'vitest'
import { mergeStates } from './sync-merge.js'
import { cloudContent, syncSnapshots } from './cloud-sync.js'
const s = x => ({ unit: 'kg', workouts: [], routines: [], _ts: 100, ...x })
const merge = (a, b) => mergeStates(a, b, { deterministic: true })

it('converges for tied settings regardless of document clocks or merge grouping', () => {
  const a = s({ theme: 'light', edited: { theme: 100 } })
  const b = s({ _ts: 200, theme: 'dark', edited: { theme: 50 } })
  const c = s({ _ts: 150, theme: 'system', edited: { theme: 100 } })
  const first = merge(merge(a, b), c), second = merge(a, merge(b, c))
  expect(first.theme).toBe(second.theme)
  expect(cloudContent(first)).toBe(cloudContent(second))
  expect(cloudContent(merge(a, c))).toBe(cloudContent(merge(c, a)))
})
it('retains unstamped field provenance after an unrelated newer document is merged', () => {
  const a = s({ theme: 'light', restSec: 60 })
  const b = s({ _ts: 200, theme: 'dark', edited: { theme: 50 }, restSec: 90, editedExtra: 1 })
  const c = s({ _ts: 150, theme: 'system', restSec: 75 })
  expect(merge(merge(a, b), c).theme).toBe(merge(a, merge(b, c)).theme)
})
it('never promotes an unrelated document/entry clock over an explicit field edit', () => {
  const remote = s({ theme: 'light', edited: { theme: 100 }, routines: [{ id: 'a', ex: ['edited'], _f: { ex: 100 }, _ts: 100 }] })
  const local = s({ _ts: 200, theme: 'dark', restSec: 120, edited: { restSec: 200 }, routines: [{ id: 'a', ex: ['old'], name: 'Renamed', _f: { name: 200 }, _ts: 200 }] })
  const result = merge(local, remote)
  expect(result.theme).toBe('light'); expect(result.restSec).toBe(120)
  expect(result.routines[0].ex).toEqual(['edited']); expect(result.routines[0].name).toBe('Renamed')
})
it('resolves tied record fields, weigh-ins, maps, unit choices and routine order symmetrically', () => {
  const a = s({ routines: [{ id: 'a', name: 'A', ex: [], _ts: 100, _f: { name: 100 } }, { id: 'b', ex: [] }],
    bodyweight: [{ d: '2026-01-01', t: 100, w: 70 }], dayNotes: { today: { text: 'A', _ts: 100 } } })
  const b = s({ routines: [{ id: 'b', ex: [] }, { id: 'a', name: 'B', ex: [], _ts: 100, _f: { name: 100 } }],
    bodyweight: [{ d: '2026-01-01', t: 100, w: 75 }], dayNotes: { today: { text: 'B', _ts: 100 } } })
  expect(cloudContent(merge(a, b))).toBe(cloudContent(merge(b, a)))
  const kg = s({ unitSet: { at: 100, convert: true } }), lb = s({ unit: 'lb', unitSet: { at: 100, convert: true } })
  expect(cloudContent(merge(kg, lb))).toBe(cloudContent(merge(lb, kg)))
})
it('stops writing after opposite-order peers with tied edits agree', async () => {
  let remote = s({ theme: 'light', edited: { theme: 100 } }), writes = 0
  const p = { read: async () => [{ id: 'head', state: remote }], append: async state => { remote = structuredClone(state); writes++ } }
  let a = s({ theme: 'light', edited: { theme: 100 } }), b = s({ theme: 'dark', edited: { theme: 100 } })
  const run = async which => syncSnapshots(p, { getState: () => which === 'a' ? a : b,
    apply: x => { if (which === 'a') a = merge(a, x); else b = merge(b, x) }, current: () => true })
  for (let i = 0; i < 4; i++) { await run('a'); await run('b') }
  expect(a.theme).toBe(b.theme)
  const before = writes
  await run('b'); await run('a')
  expect(writes).toBe(before)
})

it.each(['first', 'last', 'avg'])('converges multi-reading weigh-ins and deletions in %s mode', mode => {
  const day = { d: '2026-11-15', t: 100, w: 70, ins: [
    { id: 'morning', at: '08:00', w: 70, t: 100 },
    { id: 'evening', at: '20:00', w: 72, t: 100 },
  ] }
  const a = s({ bwDaily: mode, bodyweight: [day] })
  const b = structuredClone(a)
  b.bodyweight[0].ins[0].w = 71
  const c = structuredClone(a)
  c.bodyweight[0].gone = { evening: 101 }
  c.bodyweight[0].t = 101
  const ab = merge(a, b), ba = merge(b, a)
  expect(cloudContent(ab)).toBe(cloudContent(ba))
  const left = merge(ab, c), right = merge(c, ba)
  expect(cloudContent(left)).toBe(cloudContent(right))
  expect(left.bodyweight[0].ins.map(x => x.id)).toEqual(['morning'])
  expect(left.bodyweight[0].gone.evening).toBe(101)
})
