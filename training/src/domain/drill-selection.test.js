import { describe, expect, it } from 'vitest'
import { toggleDrillSelection, isDrillSelected, compactTarget, practiceSummary } from './drill-selection.js'
import { changePrescription } from './practice-builder.js'
const drill = {
  id: 'source',
  title: 'Wall touch',
  instructions: 'Receive and return.',
  mode: 'practice',
  sets: 1,
  side: 'both',
  restSec: null,
  media: { id: 'wall', status: 'approved', path: '/media/wall' },
  metadata: { version: 1, registryVersion: 1, tags: ['futbol:passing'] }
}
const empty = () => ({ id: null, title: '', drills: [] })
describe('drill selection', () => {
  it('creates an independent editable instance and gives an unnamed practice a usable name', () => {
    const selected = toggleDrillSelection(empty(), drill, () => 'instance')
    expect(selected.title).toBe('My soccer practice')
    expect(selected.drills[0].id).toBe('instance')
    selected.drills[0].metadata.tags.push('custom')
    expect(drill.metadata.tags).toEqual(['futbol:passing'])
  })
  it('recognizes a selected drill after its ID, time, sets, and feet have changed', () => {
    const draft = toggleDrillSelection(empty(), drill, () => 'instance')
    draft.drills[0] = changePrescription(draft.drills[0], { mode: 'time', sets: 2, durationSec: 60, side: 'each' })
    expect(isDrillSelected(draft, drill)).toBe(true)
    expect(toggleDrillSelection(draft, drill).drills).toEqual([])
  })
  it('preserves distinct instructions even when demonstrations are shared', () => {
    const first = toggleDrillSelection(empty(), drill, () => 'first')
    const variation = { ...drill, instructions: 'Use your weaker foot.' }
    expect(isDrillSelected(first, variation)).toBe(false)
    expect(toggleDrillSelection(first, variation, () => 'second').drills).toHaveLength(2)
  })
  it('does not lose an existing practice name, identity, or other drills when toggled', () => {
    const other = { ...drill, media: { ...drill.media, id: 'other' } }
    const draft = { id: 'saved', title: 'Tuesday touches', drills: [other] }
    const selected = toggleDrillSelection(draft, drill, () => 'instance')
    expect(toggleDrillSelection(selected, drill)).toEqual(draft)
  })
  it('enforces the assignment limit but still allows removal at the limit', () => {
    const full = { ...empty(), drills: Array.from({ length: 100 }, (_, i) => ({ ...drill, id: `copy-${i}` })) }
    expect(toggleDrillSelection(full, { ...drill, title: 'Another drill' })).toBe(full)
    expect(toggleDrillSelection(full, drill).drills).toHaveLength(0)
  })
  it('summarizes timed work honestly without guessing the duration of reps or self-paced drills', () => {
    const timed = { ...drill, mode: 'time', sets: 2, durationSec: 45, side: 'each' }
    expect(compactTarget(timed)).toBe('2 × 45 sec · each foot')
    expect(practiceSummary([timed])).toEqual({ allTimed: true, timedSeconds: 180, videoCount: 1 })
    expect(practiceSummary([timed, { ...drill, mode: 'reps', reps: 10 }]).allTimed).toBe(false)
    expect(practiceSummary([]).allTimed).toBe(false)
  })
})

describe('saved draft comparison', () => {
  it('recognizes the exact saved draft and notices changes in order or targets', async () => {
    const { draftMatchesPractice } = await import('./drill-selection.js')
    const other = { ...drill, id: 'second', title: 'Second drill' }
    const saved = { id: 'saved', title: 'Tuesday', revision: 'one', drills: [drill, other] }
    const draft = { id: 'saved', title: 'Tuesday', drills: structuredClone(saved.drills) }
    expect(draftMatchesPractice(draft, saved)).toBe(true)
    expect(draftMatchesPractice({ ...draft, title: 'Wednesday' }, saved)).toBe(false)
    expect(draftMatchesPractice({ ...draft, drills: [...draft.drills].reverse() }, saved)).toBe(false)
    expect(draftMatchesPractice({ ...draft, drills: [{ ...drill, sets: 2 }, other] }, saved)).toBe(false)
    expect(draftMatchesPractice(draft, undefined)).toBe(false)
  })
})

describe('practice focus', () => {
  it('counts labelled drills once per skill, without treating sets or free-form labels as skill scores', async () => {
    const { practiceFocus } = await import('./drill-selection.js')
    const multi = {
      ...drill,
      sets: 5,
      metadata: { ...drill.metadata, tags: ['futbol:passing', 'futbol:pass', 'futbol:first-touch', 'wall'] }
    }
    expect(practiceFocus([multi, drill, { ...drill, metadata: undefined }])).toEqual([
      { tag: 'futbol:passing', label: 'passing', count: 2 },
      { tag: 'futbol:first-touch', label: 'first touch', count: 1 }
    ])
  })
})

describe('soccer drill search', () => {
  it('matches ordinary words across names, skill tags, equipment and instructions', async () => {
    const { drillMatchesSearch } = await import('./drill-selection.js')
    const labelled = {
      ...drill,
      metadata: {
        ...drill.metadata,
        tags: ['futbol:first-touch', 'futbol:weak-foot'],
        requirements: { equipment: ['cones'] }
      }
    }
    expect(drillMatchesSearch(labelled, ' FIRST touch cones ')).toBe(true)
    expect(drillMatchesSearch(labelled, 'weak foot')).toBe(true)
    expect(drillMatchesSearch(labelled, 'wall shooting')).toBe(false)
    expect(drillMatchesSearch(labelled, '   ')).toBe(true)
    expect(drillMatchesSearch({ ...drill, metadata: undefined }, 'receive')).toBe(true)
  })
})
