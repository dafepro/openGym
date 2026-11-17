import { describe, expect, it } from 'vitest'
import { importedLoadRows, previewImportedLoads, applyImportedLoads, undoImportedLoads, isImportedSession } from './convert-imported-loads.js'
import { parseWorkoutCSV, importId } from './import-csv.js'
import { convertExact } from './units.js'
import { workoutVolume } from './history.js'
import { stampChange, mergeStates } from './sync-merge.js'
const copy = x => structuredClone(x)
function fixture() {
  const w = { id: importId('iw', 'synthetic'), d: '2026-09-15', start: 100, end: 200, name: 'Imported session', prs: [], note: 'retain', entries: [{
    id: '0025', note: 'note', topW: 200, target: { weight: 100 }, planned: { weight: 100 }, sets: [
      { w: 90, r: 5, done: true }, { w: 200, r: 5, done: true },
      { w: 50, r: 5, done: true, phase: 'warmup' },
      { w: 80, r: 6, done: true, type: 'dropset', drops: [{ w: 60, r: 3, done: true }] },
      { w: 40, r: 8, done: true, sides: { L: { w: 40, r: 4, done: true }, R: { w: 35, r: 4, done: true } } },
      { w: 0, r: 10, done: true }, { km: 2, sec: 600, done: true },
    ] }] }
  w.vol = workoutVolume(w)
  return { unit: 'lb', _ts: 500, workouts: [w, { id: 'manual', d: '2026-10-01', entries: [{ id:'0025',sets:[{w:200,r:5,done:true}]}] }], active: { id:'active' }, exWeights: { '0025': { w:200,d:'2026-10-01'} }, routines:[{id:'routine',ex:[{id:'0025',weight:200}]}], bodyweight: [{ d:'2026-09-15',w:90,t:1 }] }
}
const applyThroughStore = (S, preview) => {
  const next = copy(S), receipt = applyImportedLoads(next, preview)
  next._ts = stampChange(S, next, 100)
  if (receipt) receipt.after = copy(next.workouts.filter(w => receipt.before.some(b => b.id === w.id)))
  return { next, receipt }
}
describe('imported historical load repair', () => {
  it('recognizes real CSV imports, not names, manual ids or malformed hashes', () => {
    const parsed = parseWorkoutCSV('Date,Exercise,Weight,Reps\n2026-09-15,Bench Press,90,5', {unit:'lb'})
    expect(isImportedSession(parsed.workouts[0])).toBe(true)
    for (const id of ['manual', 'iw', 'iw0123', 'iwzzzzzzzzzzz', 'iw123456789012', 'sl123']) expect(isImportedSession({id,name:'Imported'})).toBe(false)
    expect(isImportedSession({id:importId('sl','test'),source:'StrongLifts'})).toBe(true)
  })
  it('converts only explicitly selected set/drop/side loads and preserves all unrelated data', () => {
    const s = fixture(), original = copy(s), rows = importedLoadRows(s,'kg')
    expect(rows).toHaveLength(7)
    const chosen = rows.filter(r => (r.set === 1) || (r.set === 4 && r.detail.includes('/')) || (r.set === 5 && r.detail === 'R'))
    const {next,receipt} = applyThroughStore(s,previewImportedLoads(s,'kg',chosen.map(r=>r.key)))
    const e = next.workouts[0].entries[0]
    expect(e.sets[0].w).toBe(convertExact(90,'kg','lb'))
    expect(e.sets[1]).toEqual(original.workouts[0].entries[0].sets[1])
    expect(e.sets[3].w).toBe(80); expect(e.sets[3].drops[0].w).toBe(convertExact(60,'kg','lb'))
    expect(e.sets[4].sides.L.w).toBe(40); expect(e.sets[4].sides.R.w).toBe(convertExact(35,'kg','lb')); expect(e.sets[4].w).toBe(convertExact(35,'kg','lb'))
    expect(e.sets[4].r).toBe(8); expect(e.topW).toBe(200)
    expect(next.workouts[0].vol).toBe(workoutVolume(next.workouts[0]))
    for (const key of ['active','exWeights','routines','bodyweight','unit']) expect(next[key]).toEqual(original[key])
    expect(e.target).toEqual(original.workouts[0].entries[0].target); expect(e.planned).toEqual(original.workouts[0].entries[0].planned)
    expect(next.workouts[1]).toEqual(original.workouts[1]); expect(e.sets[6]).toEqual(original.workouts[0].entries[0].sets[6])
    const prior = copy(next)
    expect(undoImportedLoads(next,receipt)).toBe(true)
    next._ts = stampChange(prior,next,101)
    expect(next.workouts[0].entries).toEqual(original.workouts[0].entries)
    expect(next.workouts[0].vol).toBe(original.workouts[0].vol)
    expect(next.workouts[0]._ts).toBeGreaterThan(prior.workouts[0]._ts)
  })
  it('rejects repeated apply, stale previews/undo, unit changes and resumed active sessions atomically', () => {
    for (const mutate of [s=>{s.workouts[0].note='edited'},s=>{s.unit='kg'},s=>{s.active.id=s.workouts[0].id}]) {
      const s=fixture(),p=previewImportedLoads(s,'kg',[importedLoadRows(s,'kg')[0].key]);mutate(s)
      const before=copy(s);expect(applyImportedLoads(s,p)).toBeNull();expect(s).toEqual(before)
    }
    const s=fixture(),p=previewImportedLoads(s,'kg',[importedLoadRows(s,'kg')[0].key])
    const {next,receipt}=applyThroughStore(s,p)
    expect(applyImportedLoads(next,p)).toBeNull()
    next.workouts[0].note='new edit';const before=copy(next)
    expect(undoImportedLoads(next,receipt)).toBe(false);expect(next).toEqual(before)
  })
  it('does not touch earned record snapshots, zero/bodyweight or current workouts; supports lb to kg', () => {
    const s=fixture(); s.workouts[0].prs=['0025'];expect(importedLoadRows(s,'kg')).toEqual([])
    s.workouts[0].prs=[];s.workouts[0].e1prs=[{id:'0025',w:100}];expect(importedLoadRows(s,'kg')).toEqual([])
    s.workouts[0].e1prs=[];s.active.id=s.workouts[0].id;expect(importedLoadRows(s,'kg')).toEqual([])
    s.active.id='active';s.unit='kg';const rows=importedLoadRows(s,'lb')
    expect(rows[0].after).toBe(convertExact(90,'lb','kg'));expect(rows.some(r=>r.before===0)).toBe(false)
    expect(importedLoadRows(s,'')).toEqual([])
    expect(applyImportedLoads(s,previewImportedLoads(s,'lb',[]))).toBeNull()
  })
})

it('preserves untouched side-set mirrors byte-for-byte and skips malformed side sets', () => {
  const s=fixture(), e=s.workouts[0].entries[0]
  e.sets[4].w=123 // untouched legacy mirror must not be silently normalized
  e.sets.push({w:40,r:5,done:true,sides:{L:{w:40,r:5,done:true}}})
  const before=copy(e.sets), rows=importedLoadRows(s,'kg')
  expect(rows.some(r=>r.set===8)).toBe(false)
  applyImportedLoads(s,previewImportedLoads(s,'kg',[rows[0].key]))
  expect(e.sets.slice(1)).toEqual(before.slice(1))
})
it('keeps repaired history across sync with a newer stale profile', () => {
  const s=fixture(), p=previewImportedLoads(s,'kg',[importedLoadRows(s,'kg')[0].key])
  const {next}=applyThroughStore(s,p)
  const stale=copy(s);stale._ts=next._ts+1000
  for (const merged of [mergeStates(next,stale),mergeStates(stale,next)])
    expect(merged.workouts.find(w=>w.id===s.workouts[0].id).entries[0].sets[0].w).toBe(convertExact(90,'kg','lb'))
})
