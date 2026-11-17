import { describe, expect, it } from 'vitest'
import { conversionRows, importedStretches, previewConversion, applyConversion, undoConversion } from './convert-weigh-ins.js'
import { weeklyWeights } from './bodyweight.js'
const fixture = () => ({ unit: 'lb', bwDaily: 'last', bodyweight: [
  { d: '2026-09-15', w: 91.6, t: 1, src: 'import', sid: 'legacy' },
  { d: '2026-11-16', w: 197.5, t: 3, ins: [
    { id: 'a', at: '07:00', w: 90, t: 2, src: 'health', sid: 'original' },
    { id: 'b', at: '09:00', w: 197.5, t: 3 },
  ] },
], workouts: [{ weight: 100 }], bwGoal: 190 })
describe('selective weigh-in conversion', () => {
  it('preserves newer lb readings, provenance, times and other data; recomputes daily/weekly values', () => {
    const s = fixture(), rows = conversionRows(s, 'kg')
    const p = previewConversion(s, 'kg', rows.slice(0, 2).map(r => r.key))
    const receipt = applyConversion(s, p, 100)
    expect(s.bodyweight[0]).toMatchObject({ w: 201.94, src: 'import', sid: 'legacy', t: 100 })
    expect(s.bodyweight[1].ins[0]).toEqual({ id: 'a', at: '07:00', w: 198.42, t: 100, src: 'health', sid: 'original' })
    expect(s.bodyweight[1].ins[1]).toEqual(fixture().bodyweight[1].ins[1])
    expect(s.bodyweight[1].w).toBe(197.5)
    expect(weeklyWeights(s.bodyweight)[0].avg).toBe(197.5)
    expect(s.unit).toBe('lb'); expect(s.bwGoal).toBe(190); expect(s.workouts).toEqual([{ weight: 100 }])
    expect(applyConversion(s, p, 101)).toBeNull() // repeated click is not double conversion
    expect(undoConversion(s, receipt, 102)).toBe(true)
    expect(s.bodyweight[0].w).toBe(91.6); expect(s.bodyweight[1].ins[0].w).toBe(90)
    expect(s.bodyweight[1].ins[0].sid).toBe('original')
    expect(undoConversion(s, receipt, 103)).toBe(false)
  })
  it('recomputes average and first daily mirrors', () => {
    for (const mode of ['first', 'avg']) {
      const s = fixture(); s.bwDaily = mode
      const rows = conversionRows(s, 'kg')
      applyConversion(s, previewConversion(s, 'kg', [rows[1].key]), 100)
      expect(s.bodyweight[1].w).toBe(mode === 'first' ? 198.42 : 197.96)
    }
  })
  it('rejects stale previews, changed units and stale undo without partial changes', () => {
    for (const change of [s => { s.bodyweight[1].ins[1].w = 199 }, s => { s.unit = 'kg' }, s => { s.bwDaily = 'avg' }]) {
      const s = fixture(), p = previewConversion(s, 'kg', conversionRows(s, 'kg').map(r => r.key))
      change(s); const saved = JSON.stringify(s)
      expect(applyConversion(s, p)).toBeNull(); expect(JSON.stringify(s)).toBe(saved)
    }
    const s = fixture(), r = applyConversion(s, previewConversion(s, 'kg', conversionRows(s, 'kg').map(r => r.key)))
    s.bodyweight[0].w = 205
    const saved = JSON.stringify(s)
    expect(undoConversion(s, r)).toBe(false); expect(JSON.stringify(s)).toBe(saved)
  })
  it('requires explicit selection and direction; supports lb to kg', () => {
    const s = fixture()
    expect(conversionRows(s, '')).toEqual([])
    expect(applyConversion(s, previewConversion(s, 'kg', []))).toBeNull()
    s.unit = 'kg'
    const rows = conversionRows(s, 'lb')
    expect(rows[2].after).toBe(89.58)
  })
  it('suggests source-tagged stretches, splitting at manual readings and source changes', () => {
    const rows = [ { d: '1', src: 'import' }, { d: '2', src: 'import' }, { d: '3' }, { d: '4', src: 'import' }, { d: '5', src: 'health' }, { d: '6' } ]
    expect(importedStretches(rows).map(g => g.rows.map(r => r.d))).toEqual([['1', '2'], ['4']])
  })
})
it('blocks ambiguous same-time readings rather than changing first/last ordering', () => {
  const s = fixture(); s.bodyweight[1].ins[1].at = '07:00'
  const rows = conversionRows(s, 'kg')
  expect(rows[1].ambiguous).toBe(true)
  const before = JSON.stringify(s)
  expect(applyConversion(s, previewConversion(s, 'kg', [rows[1].key]), 100)).toBeNull()
  expect(JSON.stringify(s)).toBe(before)
})
it('retains legacy observed time and source id across conversion and exact undo', () => {
  const s = fixture(); s.bodyweight[0].t = new Date('2026-09-15T08:23:00').getTime()
  const p = previewConversion(s, 'kg', [conversionRows(s, 'kg')[0].key])
  const receipt = applyConversion(s, p)
  expect(s.bodyweight[0].ins[0]).toMatchObject({id:'0',at:'08:23',sid:'legacy'})
  undoConversion(s,receipt)
  expect(s.bodyweight[0].ins[0]).toMatchObject({at:'08:23',w:91.6,sid:'legacy'})
})
