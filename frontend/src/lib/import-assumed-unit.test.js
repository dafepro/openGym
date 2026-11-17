import { describe, expect, it } from 'vitest'
import { parseImport, parseWorkoutRows, parseCSV } from './import-csv.js'
import { parseImportFile } from './import-apps.js'
const head = 'Date,Exercise,Weight,Unit,Reps'
const mixed = [head, '2026-09-01,Bench Press,100,kg,5', '2026-09-01,Bench Press,100,,5', '2026-09-01,Bench Press,100,lb,5'].join('\n')
const weights = p => p.workouts.flatMap(w => w.entries.flatMap(e => e.sets.map(s => s.w)))

describe('source unit assumption is separate from destination profile', () => {
  it.each([
    ['kg', 'lb', [100, 45.36, 45.36]],
    ['lb', 'kg', [220.46, 220.46, 100]]
  ])('changes only unlabelled positive workout loads for %s profiles', (unit, assumedMassUnit, expected) => {
    const p = parseImportFile(mixed, { unit, assumedMassUnit })
    expect(weights(p)).toEqual(expected)
    expect(p.unknownMassRows).toBe(1)
    expect(p.massAssumption).toBe(assumedMassUnit)
    expect(weights(parseImportFile(mixed, { unit }))[1]).toBe(100)
  })
  it('preserves sole-file-unit inference until a choice is made', () => {
    const csv = [head, '2026-09-01,Bench Press,100,lb,5', '2026-09-01,Bench Press,100,,5'].join('\n')
    expect(weights(parseImport(csv, { unit: 'kg' }))).toEqual([45.36, 45.36])
    expect(parseImport(csv, { unit: 'kg' }).massAssumption).toBe('lb')
    expect(weights(parseImport(csv, { unit: 'kg', assumedMassUnit: 'kg' }))).toEqual([45.36, 100])
  })
  it.each([['kg', 'lb', 36.29], ['lb', 'kg', 176.37]])('supports unitless body weights into %s', (unit, assumedMassUnit, expected) => {
    const csv = 'Date,Weight\n2026-09-01,80'
    const p = parseImport(csv, { unit, assumedMassUnit })
    expect(p.bodyweight[0].w).toBe(expected)
    expect(p.unknownMassRows).toBe(1)
    expect(parseImport(csv, { unit }).bodyweight[0].w).toBe(80)
  })
  it('does not override explicit bodyweight or turn ambiguity into an assumption', () => {
    expect(parseImport('Date,Weight,Unit\n2026-09-01,80,kg', { unit: 'kg', assumedMassUnit: 'lb' }).bodyweight[0].w).toBe(80)
    expect(parseImport('Date,Weight,Unit\n2026-09-01,80,', { assumedMassUnit: 'lb' }).error).toBe('units')
  })
  it('does not offer zero/bodyweight-only sets or change cardio distances', () => {
    const p = parseImport([head, '2026-09-01,Push Up,0,,5'].join('\n'), { assumedMassUnit: 'lb' })
    expect(p.unknownMassRows).toBe(0)
    const csv = 'Date,Exercise,Weight,Reps,Distance (km),Seconds\n2026-09-01,Running,0,,5,1800'
    expect(parseImport(csv, { assumedMassUnit: 'lb' }).workouts).toEqual(parseImport(csv).workouts)
    expect(parseImport(csv).unknownMassRows).toBe(0)
  })
  it('does not enable assumptions for a provider row adapter', () => {
    const rows = parseCSV(mixed)
    const p = parseWorkoutRows(rows, { date: 0, exercise: 1, weight: 2, weightUnit: 3, reps: 4 }, 'Liftoff', { unit: 'kg', assumedMassUnit: 'lb' })
    expect(p.unknownMassRows).toBe(0)
    expect(weights(p)[1]).toBe(100)
  })
  it('does not offer unknown declared units as though they were blank', () => {
    const csv = [head, '2026-09-01,Bench Press,100,stone,5'].join('\n')
    expect(parseImport(csv, { assumedMassUnit: 'lb' }).unknownMassRows).toBe(0)
    expect(weights(parseImport(csv, { assumedMassUnit: 'lb' }))).toEqual([100])
  })
})
