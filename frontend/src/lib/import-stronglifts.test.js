import { describe, expect, it } from 'vitest'
import { parseImport, mergeImport } from './import-csv.js'
import { modeForEntry } from './workout-model.js'
import { buildPlannedEntry } from './session-start.js'
import { parsePlan, mergePlan, buildPlanBundle } from './plan-share.js'

const header = 'Date (yyyy/mm/dd),Workout,Workout Name,Program Name,Exercise,Duration (hours),Start Time (h:mm),End Time (h:mm),Notes,Set 1 (Reps),Set 1 (LBS),Set 1 (Time),Set 2 (Reps),Set 2 (LBS),Set 2 (Time)'
const csv = header + '\n2026/10/11,1,Upper,Test,Bench Press,1,11:30 PM,12:30 AM,"note, retained",0,135,,,135,\n2026/10/11,1,Upper,Test,Plank,1,11:30 PM,12:30 AM,,,,00:30,,,'
const base = () => ({ unit: 'lb', workouts: [], routines: [], customEx: [], bodyweight: [], exWeights: {}, week: {} })
describe('StrongLifts history', () => {
  it('preserves zero, unknown, timed rows, notes and midnight crossing without prescriptions', () => {
    const parsed = parseImport(csv, { unit: 'lb' })
    expect(parsed.source).toBe('StrongLifts'); expect(parsed.workouts).toHaveLength(1)
    const w = parsed.workouts[0]
    expect(w.end - w.start).toBe(3600000)
    expect(w.note).toBe('note, retained')
    expect(w.entries[0].sets).toEqual([{ r: 0, w: 135, done: true }, { r: null, w: 135, done: false }])
    expect(w.entries[1].sets[0]).toMatchObject({ sec: 30, done: true })
    expect(modeForEntry(w.entries[1])).toBe('time')
    const s = base(); mergeImport(s, parsed); expect(s.exWeights).toEqual({})
    expect(mergeImport(s, parsed).added).toBe(0)
  })
  it('keeps distinct same-day sessions and converts each recorded load', () => {
    const text = csv + '\n2026/10/11,2,Lower,Test,Squat,1,3:00 PM,4:00 PM,,5,100,,,,'
    const parsed = parseImport(text, { unit: 'kg' })
    expect(parsed.workouts).toHaveLength(2)
    expect(parsed.workouts.find(w => w.name === 'Lower').entries[0].sets[0].w).toBe(45.4)
    const s = base(); expect(mergeImport(s, parsed).added).toBe(2)
  })
  it('refuses malformed dates, fractional reps, ambiguous set semantics and invalid durations', () => {
    for (const text of [csv.replace('2026/10/11', '2026/02/31'), csv.replace(',0,135,', ',1.5,135,'), csv.replace('00:30', '1:'), csv.replace('00:30', '86400:59:59'), csv.replace(',0,135,', ',0,135,00:30')]) expect(() => parseImport(text)).toThrow()
  })
  it('imports converted daily body weight independently and preserves existing measurements', () => {
    const withBody = csv.split('\n').map((line, i) => i ? line.replace(',Test,', ',Test,200,') : line.replace(',Exercise,', ',Body Weight (LBS),Exercise,')).join('\n')
    const parsed = parseImport(withBody, { unit: 'kg' })
    expect(parsed.bodyweight).toEqual([{ d: '2026-10-11', w: 90.7, t: parsed.workouts[0].start }])
    const st = base(); st.workouts = parsed.workouts
    expect(mergeImport(st, parsed)).toMatchObject({ added: 0, bodyweightAdded: 1 })
    expect(mergeImport(st, parsed)).toMatchObject({ added: 0, bodyweightAdded: 0 })
    st.bodyweight[0].w = 91
    mergeImport(st, parsed); expect(st.bodyweight[0].w).toBe(91)
    expect(st.exWeights).toEqual({})
    expect(() => parseImport(withBody.replace('Test,200,Plank', 'Test,201,Plank'))).toThrow(/Conflicting/)
    expect(() => parseImport(withBody.replace('Test,200,Bench', 'Test,-200,Bench'))).toThrow()
    expect(parseImport(withBody.replaceAll('Test,200,', 'Test,0,')).bodyweight).toEqual([])
    const later = withBody + '\n2026/10/11,2,Later,Test,202,Squat,1,11:40 PM,12:40 AM,,5,100,,,,'
    expect(parseImport(later, { unit: 'lb' }).bodyweight[0].w).toBe(202)
  })
  it('does not borrow imported records or shared weights for a routine-scoped plan', () => {
    const st = base(), parsed = parseImport(csv, { unit: 'lb' }); mergeImport(st, parsed)
    const id = parsed.workouts[0].entries[0].id
    st.exWeights[id] = { w: 200, d: '2026-10-10' }
    const data = { opengym_plan: 1, unit: 'lb', routines: [{ id: 'new', prog: 'off', ex: [{ id, sets: 2, reps: 8, historyScope: 'routine' }] }], customEx: [], week: {} }
    const bundle = parsePlan(JSON.stringify(data), 'lb'); mergePlan(st, bundle)
    const routine = st.routines[0], cfg = routine.ex[0]
    expect(buildPlannedEntry(st, cfg, routine).sets.every(s => !s.w)).toBe(true)
    expect(buildPlanBundle(st).routines[0].ex[0].historyScope).toBe('routine')
    st.workouts.push({ id: 'own', d: '2026-10-12', routineId: routine.id, entries: [{ id, sets: [{ w: 50, r: 8, done: true }] }] })
    expect(buildPlannedEntry(st, cfg, routine).sets[0].w).toBe(50)
  })
})
