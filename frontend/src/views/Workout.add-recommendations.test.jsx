// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import WorkoutExerciseSuggestion from '../components/WorkoutExerciseSuggestion.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXIDX } from '../lib/exercises.js'
import { cloudState } from '../lib/cloud-sync.js'
import { buildCompletedWorkout } from '../lib/finish-workout.js'
import { bindWatchLayout, watchSnapshot } from '../lib/garmin.js'
import { isWatchSnapshot } from '../../../shared/garmin.ts'
import { readBackupFile } from '../lib/backup-media.js'

vi.mock('../lib/sound.js', () => ({
  beep: vi.fn(),
  chime: vi.fn(),
  vibrate: vi.fn(),
  alertBuzz: vi.fn(),
  unlock: vi.fn()
}))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), appBase: () => '/' }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const NOW = Date.UTC(2026, 9, 22, 12)
const clone = (value) => JSON.parse(JSON.stringify(value))
const entry = (id, extra = {}) => ({
  id,
  target: { sets: 1, reps: 5, weight: 40 },
  sets: [
    { w: 40, r: 0, done: true },
    { w: 40, r: null, skipped: true, done: false },
    { w: 40, r: 5, done: false }
  ],
  ...extra
})
let root, host
function render(extra = {}) {
  const S = {
    ...clone(DEF),
    routines: [{ id: 'r', name: 'Main', ex: [{ id: '0025', sets: 4, reps: 8, weight: 60 }] }],
    workouts: [],
    ...extra
  }
  S.active = {
    id: 'addition-test',
    d: '2026-10-22',
    name: 'Main',
    routineIds: ['r'],
    routineId: 'r',
    start: NOW - 600000,
    cur: 0,
    entries: [entry('0027')],
    ...extra.active
  }
  useStore.setState({ S, user: null })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() =>
    root.render(
      <MemoryRouter>
        <Workout />
      </MemoryRouter>
    )
  )
}
function openAdd() {
  const add = [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add exercise')
  if (add) act(() => add.click())
  else {
    const more = host.querySelector('button[aria-label="Workout options"]')
    expect(more).toBeTruthy()
    act(() => more.click())
    const menu = useUI
      .getState()
      .sheets.at(-1)
      .render(() => {})
    const item = (menu.props.sections || [{ items: menu.props.items }])
      .flatMap((s) => s.items)
      .find((i) => i?.label === 'Add exercise')
    expect(item).toBeTruthy()
    act(() => item.onClick())
  }
  const sheet = useUI.getState().sheets.at(-1)
  return sheet.render(() => useUI.getState().closeSheet(sheet.id))
}
const active = () => useStore.getState().S.active
const proposal = { id: '0025', sets: 2, reps: 8, weight: 35, restSec: 180 }
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
})
afterEach(() => {
  if (root) act(() => root.unmount())
  host?.remove()
  root = null
  useUI.getState().stopRest()
  vi.clearAllTimers()
  vi.useRealTimers()
})
describe('workout Add controller seam', () => {
  it.each(['cards', 'focus'])(
    'uses recommendations in %s and commits after the whole superset without losing timer ownership',
    (view) => {
      render({
        active: {
          workoutView: view,
          entries: [
            entry('0027', { sg: 'pair', rid: 'r' }),
            entry('0043', { sg: 'pair', rid: 'r' }),
            entry('0031', { rid: 'r' })
          ]
        }
      })
      const before = clone(useStore.getState().S)
      const timer = { forIdx: 2, forSet: 2, endsAt: NOW + 180000, total: 180, left: 180, paused: false }
      act(() => useUI.setState({ timer }))
      const picker = openAdd()
      expect(picker.type).toBe(WorkoutExerciseSuggestion)
      expect(active().entries).toEqual(before.active.entries)
      act(() => picker.props.onPick(EXIDX['0025'], true, proposal))
      expect(active().entries.map((e) => e.id)).toEqual(['0027', '0043', '0025', '0031'])
      expect(active().cur).toBe(2)
      expect(active().entries[2]).toMatchObject({
        rid: 'r',
        noProg: true,
        target: proposal,
        sets: [
          { w: 35, r: 8, done: false },
          { w: 35, r: 8, done: false }
        ]
      })
      expect(active().entries.filter((_, i) => i !== 2)).toEqual(before.active.entries)
      expect(useUI.getState().timer).toEqual({ ...timer, forIdx: 3 })
      expect(useStore.getState().S.routines).toEqual(before.routines)
      expect(useStore.getState().S.workouts).toEqual(before.workouts)
      expect(JSON.parse(localStorage.getItem('gym_state_v1')).active).toEqual(active())
    }
  )
  it('opens configuration for a missing weight, then builds only the explicit edits', () => {
    render()
    const picker = openAdd()
    act(() => picker.props.onPick(EXIDX['0025'], false, { ...proposal, weight: 0 }))
    const sheet = useUI.getState().sheets.at(-1)
    const config = sheet.render(() => useUI.getState().closeSheet(sheet.id))
    expect(active().entries).toHaveLength(1)
    act(() => config.props.onSave({ ...proposal, weight: 25, reps: 6 }))
    expect(active().entries[1].sets).toEqual([
      { w: 25, r: 6, done: false },
      { w: 25, r: 6, done: false }
    ])
  })
  it('keeps manual browsing and historical edits on their deliberate picker paths', () => {
    render()
    const suggestion = openAdd()
    act(() => suggestion.props.onBrowse())
    const manual = useUI
      .getState()
      .sheets.at(-1)
      .render(() => {})
    expect(manual.type).not.toBe(WorkoutExerciseSuggestion)
    act(() => manual.props.onPick(EXIDX['0025'], true))
    expect(active().entries[1].noProg).toBeUndefined()
    for (const flag of ['backfill', 'editingWorkoutId']) {
      act(() => useStore.setState(({ S }) => ({ S: { ...S, active: { ...S.active, [flag]: 'past' } } })))
      expect(openAdd().type).not.toBe(WorkoutExerciseSuggestion)
    }
  })
  it('rejects a delayed configuration commit after the active session changes', () => {
    render()
    const picker = openAdd()
    act(() => picker.props.onPick(EXIDX['0025'], false, proposal))
    const config = useUI
      .getState()
      .sheets.at(-1)
      .render(() => {})
    act(() => useStore.setState(({ S }) => ({ S: { ...S, active: { ...S.active, id: 'replacement' } } })))
    act(() => config.props.onSave(proposal))
    expect(active().entries).toHaveLength(1)
  })
  it('retains ordinary backup, Drive and Garmin representations for the new entry', async () => {
    render({ active: { entries: [] } })
    const picker = openAdd()
    act(() => picker.props.onPick(EXIDX['0025'], true, proposal))
    const S = clone(useStore.getState().S)
    const backup = await readBackupFile(
      new File([JSON.stringify(S)], 'synthetic-backup.json', { type: 'application/json' })
    )
    expect(backup.state.active.entries).toEqual(S.active.entries)
    bindWatchLayout(S)
    const snapshot = watchSnapshot(S)
    expect(isWatchSnapshot(snapshot)).toBe(true)
    expect(snapshot.workout.sets.map((tuple) => [tuple[3], tuple[4]])).toEqual([
      [35, 8],
      [35, 8]
    ])
    // Drive intentionally omits the live session; the completed record travels normally.
    expect(cloudState(S).active).toBeUndefined()
    S.active.entries[0].sets[0].done = true
    const completed = buildCompletedWorkout(S.active, { end: NOW })
    const remote = JSON.parse(JSON.stringify(cloudState({ ...S, active: null, workouts: [completed] })))
    expect(remote.workouts[0].entries[0]).toMatchObject({
      id: '0025',
      noProg: true,
      target: proposal,
      sets: [
        { w: 35, r: 8, done: true },
        { w: 35, r: 8, done: false }
      ]
    })
  })
})
