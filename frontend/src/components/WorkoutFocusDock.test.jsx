// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkoutFocusDock from './WorkoutFocusDock.jsx'
import Workout from '../views/Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { supersetUnits, unitOf } from '../lib/history.js'
import { nextUnfinishedUnit, supersetFlowStep } from '../lib/supersetFlow.js'
import { toggleSide } from '../lib/workout-model.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), appBase: () => '/', beacon: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const squat = (sets = [{ w: 95, r: 5, done: false }]) => ({
  id: '0043', target: { mode: 'reps', sets: sets.length, reps: 5, weight: 95 }, sets,
})

let root, host, originalStore, calls
const changeActive = produce => {
  const S = clone(useStore.getState().S)
  produce(S.active)
  useStore.setState({ S })
}
const row = (entryIdx = 0, setIdx = 0) => useStore.getState().S.active.entries[entryIdx].sets[setIdx]
const button = name => [...document.body.querySelectorAll('button')]
  .find(el => (el.getAttribute('aria-label') || el.textContent.trim()).toLowerCase() === name.toLowerCase())
const tap = name => {
  const el = button(name)
  expect(el, `Expected button ${name}`).toBeTruthy()
  act(() => el.click())
  return el
}
const open = () => tap('Focus')
// The preparation action is intentionally separate from recording a set.
const prepare = () => {
  if (!button('Start')) return
  tap('Start')
  act(() => vi.advanceTimersByTime(601))
}

function mount(entries = [squat()], state = {}, strict = false) {
  const S = { ...clone(DEF), sound: false, unit: 'lb', ...state }
  S.active = {
    id: 'dock-test', d: '2026-10-09', start: Date.now(), name: 'Training',
    routineId: null, bw: null, cur: 0, entries,
  }
  useStore.setState({ S, user: null })
  calls = {
    onSelectEntry: vi.fn(idx => changeActive(active => { active.cur = idx })),
    onAdvanceUnit: vi.fn(() => changeActive(active => {
      const next = nextUnfinishedUnit(active.entries, supersetUnits(active.entries), active.cur)
      if (next) active.cur = next[0]
    })),
    onToggle: vi.fn((i, onProgress) => {
      const idx = useStore.getState().S.active.cur
      changeActive(active => { active.entries[idx].sets[i].done = !active.entries[idx].sets[i].done })
      const active = useStore.getState().S.active
      const unit = unitOf(supersetUnits(active.entries), idx)
      const step = supersetFlowStep(active.entries, unit, idx)
      if (step?.nextIdx != null) changeActive(current => { current.cur = step.nextIdx })
      onProgress?.({ unitDone: unit.every(index => active.entries[index].sets.every(set => set.done)) })
    }),
    onToggleSide: vi.fn((i, side, onProgress) => {
      const idx = useStore.getState().S.active.cur
      changeActive(active => { active.entries[idx].sets[i] = toggleSide(active.entries[idx].sets[i], side) })
      const active = useStore.getState().S.active
      onProgress?.({ unitDone: active.entries[idx].sets.every(set => set.done) })
    }),
    onField: vi.fn((i, field, value) => changeActive(active => {
      if (value == null) delete active.entries[active.cur].sets[i][field]
      else active.entries[active.cur].sets[i][field] = value
    })),
    onMutateSet: vi.fn((i, mutate) => changeActive(active => {
      const entry = active.entries[active.cur]
      entry.sets[i] = mutate(entry.sets[i])
    })),
    onStartTimed: vi.fn((i, onProgress) => {
      const active = useStore.getState().S.active
      const idx = active.cur
      const set = active.entries[idx].sets[i]
      useUI.getState().startWork(set.sec, 'Hold', elapsed => {
        changeActive(current => { current.entries[idx].sets[i].sec = elapsed })
        calls.onToggle(i, onProgress)
      }, { idx, i, id: active.entries[idx].id })
    }),
    onFinish: vi.fn(),
  }
  function Harness() {
    const active = useStore(s => s.S.active)
    return <WorkoutFocusDock entryIdx={active.cur} unit={unitOf(supersetUnits(active.entries), active.cur)} {...calls} />
  }
  act(() => root.render(strict ? <React.StrictMode><Harness /></React.StrictMode> : <Harness />))
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  originalStore = useStore.getState()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], toastMsg: '', focusOverlayOpen: false, focusOverlayPrepared: null })
  host = document.createElement('div')
  host.id = 'app'
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], toastMsg: '', focusOverlayOpen: false, focusOverlayPrepared: null })
  useStore.setState(originalStore)
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('the workout focus dock', () => {
  it('retains a launcher-opened overlay through StrictMode effect replay', () => {
    useUI.setState({ focusOverlayOpen: true })
    mount([squat()], {}, true)
    expect(useUI.getState().focusOverlayOpen).toBe(true)
    expect(button('Close').getAttribute('aria-expanded')).toBe('true')
    expect(host.inert).toBe(true)
    expect(row().done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('opens and closes at the same button without recording or editing a set', () => {
    mount()
    const before = clone(row())
    const anchor = button('Focus')
    expect(anchor.getAttribute('aria-expanded')).toBe('false')
    open()
    expect(host.inert).toBe(true)
    expect(button('Close')).toBe(anchor)
    expect(anchor.getAttribute('aria-expanded')).toBe('true')
    tap('Close')
    expect(host.inert).not.toBe(true)
    expect(button('Focus')).toBe(anchor)
    expect(row()).toEqual(before)
    expect(calls.onToggle).not.toHaveBeenCalled()
    expect(calls.onField).not.toHaveBeenCalled()
  })

  it('keeps the load check acknowledged across route remounts and starts it again for a new session', () => {
    mount()
    open()
    tap('Increase load')
    tap('Start')
    const before = clone(row())
    const checkedWeight = before.w
    expect(button('Done')).toBeTruthy()
    act(() => root.render(null))
    act(() => root.render(<WorkoutFocusDock entryIdx={0} unit={[0]} {...calls} />))
    expect(button('Start')).toBeUndefined()
    expect(button('Done')).toBeTruthy()
    expect(row()).toEqual(before)
    tap('Close')
    open()
    expect(button('Done')).toBeTruthy()
    expect(row().w).toBe(checkedWeight)
    expect(calls.onToggle).not.toHaveBeenCalled()
    act(() => changeActive(active => { active.id = 'new-session' }))
    expect(button('Start')).toBeTruthy()
    expect(button('Done')).toBeUndefined()
    expect(row().w).toBe(checkedWeight)
    expect(row().done).toBe(false)
  })

  it('rejects a rapid second press when the load-check Start changes into Done', () => {
    mount()
    open()
    tap('Start')
    tap('Done')
    expect(row().done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(601))
    tap('Done')
    expect(row().done).toBe(true)
    expect(calls.onToggle).toHaveBeenCalledTimes(1)
  })

  it('edits reps separately from the explicit Done action', () => {
    mount()
    open()
    prepare()
    tap('Increase reps')
    expect(row().r).toBe(6)
    expect(row().done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
    tap('Done')
    expect(row()).toMatchObject({ r: 6, done: true })
    expect(calls.onToggle).toHaveBeenCalledTimes(1)
  })

  it('preserves a zero-rep attempt when Done records it', () => {
    mount([squat([{ w: 95, r: 1, done: false }])])
    open()
    prepare()
    tap('Decrease reps')
    expect(row().r).toBe(0)
    tap('Done')
    expect(row()).toMatchObject({ r: 0, done: true })
    expect(calls.onToggle).toHaveBeenCalledTimes(1)
  })

  it('accepts directly typed reps without recording until Done', () => {
    mount()
    open()
    prepare()
    const input = document.querySelector('input[aria-label="Reps"]')
    expect(input).toBeTruthy()
    act(() => {
      Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set.call(input, '12')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(row()).toMatchObject({ r: 12, done: false })
    expect(calls.onToggle).not.toHaveBeenCalled()
    tap('Done')
    expect(row()).toMatchObject({ r: 12, done: true })
  })

  it('keeps optional RIR unrecorded until explicitly entered, preserving zero and clearing the key', () => {
    mount([squat()], { effort: 'rir' })
    open()
    tap('More')
    const effort = document.querySelector('input[aria-label="RIR"]')
    expect(effort.value).toBe('')
    expect(Object.hasOwn(row(), 'rir')).toBe(false)
    expect(calls.onField).not.toHaveBeenCalled()
    tap('Increase')
    expect(row().rir).toBe(0)
    expect(effort.value).toBe('0')
    tap('Decrease')
    expect(Object.hasOwn(row(), 'rir')).toBe(false)
    act(() => {
      Object.getOwnPropertyDescriptor(effort.constructor.prototype, 'value').set.call(effort, '2')
      effort.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(row().rir).toBe(2)
    act(() => {
      Object.getOwnPropertyDescriptor(effort.constructor.prototype, 'value').set.call(effort, '')
      effort.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(Object.hasOwn(row(), 'rir')).toBe(false)
    expect(row().done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('edits the failure flag without recording and ignores a stale edit on completed work', () => {
    mount([squat()], { effort: 'none' })
    open()
    tap('More')
    const failure = tap('Taken to failure')
    expect(row()).toMatchObject({ failure: true, done: false })
    expect(failure.getAttribute('aria-pressed')).toBe('true')
    expect(calls.onToggle).not.toHaveBeenCalled()
    tap('Taken to failure')
    expect(Object.hasOwn(row(), 'failure')).toBe(false)
    expect(calls.onMutateSet).toHaveBeenCalledTimes(2)
    act(() => {
      changeActive(active => { active.entries[0].sets[0].done = true })
      failure.click()
    })
    expect(row().done).toBe(true)
    expect(Object.hasOwn(row(), 'failure')).toBe(false)
    expect(calls.onMutateSet).toHaveBeenCalledTimes(2)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('ignores a second click from the same stale Done button', () => {
    mount([squat([{ w: 95, r: 5, done: false }, { w: 95, r: 5, done: false }])])
    open()
    prepare()
    const done = button('Done')
    expect(done).toBeTruthy()
    // Both events happen before React has committed the first completion render.
    act(() => { done.click(); done.click() })
    expect(calls.onToggle).toHaveBeenCalledTimes(1)
    expect(row(0, 0).done).toBe(true)
    expect(row(0, 1).done).toBe(false)
  })

  it('skips an active rest without completing the next set', () => {
    mount([squat([{ w: 95, r: 5, done: true }, { w: 95, r: 5, done: false }])])
    act(() => useUI.getState().startRest(60, 0, { forSet: 0 }))
    open()
    tap('Skip')
    expect(useUI.getState().timer).toBeNull()
    expect(row(0, 1).done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('rejects a rapid second press when Skip changes into Done', () => {
    mount([squat([{ w: 95, r: 5, done: false }, { w: 95, r: 5, done: false }])])
    open()
    prepare()
    act(() => useUI.getState().startRest(60, 0))
    tap('Skip')
    tap('Done')
    expect(useUI.getState().timer).toBeNull()
    expect(row().done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(600))
    tap('Done')
    expect(row().done).toBe(true)
    expect(calls.onToggle).toHaveBeenCalledTimes(1)
  })

  it('moves on from a finished rest without recording the next set', () => {
    mount([squat([{ w: 95, r: 5, done: true }, { w: 95, r: 5, done: false }])])
    act(() => useUI.getState().startRest(1, 0, { forSet: 0 }))
    open()
    act(() => vi.advanceTimersByTime(1000))
    expect(useUI.getState().timer.ready).toBe(true)
    tap('Next')
    expect(useUI.getState().timer).toBeNull()
    expect(row(0, 1).done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('holds and resumes rest at the same control while preserving the pending set', () => {
    mount([squat([{ w: 95, r: 5, done: true }, { w: 95, r: 5, done: false }])])
    act(() => useUI.getState().startRest(60, 0, { forSet: 0 }))
    open()
    const anchor = tap('Pause')
    expect(button('Resume')).toBe(anchor)
    expect(useUI.getState().timer).toMatchObject({ paused: true, left: 60 })
    act(() => vi.advanceTimersByTime(10_000))
    expect(useUI.getState().timer.left).toBe(60)
    tap('Resume')
    expect(button('Pause')).toBe(anchor)
    act(() => vi.advanceTimersByTime(1000))
    expect(useUI.getState().timer.left).toBe(59)
    expect(row(0, 1).done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('keeps one running rest across collapse, adjustment and reopening', () => {
    mount([squat([{ w: 95, r: 5, done: true }, { w: 95, r: 5, done: false }])])
    act(() => useUI.getState().startRest(60, 0, { forSet: 0 }))
    open()
    tap('More time')
    const adjustedEnd = useUI.getState().timer.endsAt
    expect(useUI.getState().timer).toMatchObject({ left: 75, forIdx: 0, forSet: 0 })
    tap('Close')
    act(() => vi.advanceTimersByTime(10_000))
    open()
    expect(useUI.getState().timer).toMatchObject({ left: 65, endsAt: adjustedEnd, forIdx: 0, forSet: 0 })
    tap('Less time')
    expect(useUI.getState().timer.left).toBe(50)
    expect(row(0, 1).done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('records unilateral sides independently before completing the whole row', () => {
    mount([{
      id: '0292', target: { mode: 'reps', side: true, sets: 1, reps: 10, weight: 20 },
      sets: [{ w: 20, r: 10, done: false, sides: { L: { w: 20, r: 5, done: false }, R: { w: 20, r: 5, done: false } } }],
    }])
    open()
    prepare()
    tap('Done')
    expect(row().sides.L.done).toBe(true)
    expect(row().sides.R.done).toBe(false)
    expect(row().done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(700))
    tap('Done')
    expect(row().done).toBe(true)
    expect(calls.onToggleSide.mock.calls.map(call => call.slice(0, 2))).toEqual([[0, 'L'], [0, 'R']])
  })

  it('lets the shared superset flow select its partner and advances only when the unit finishes', () => {
    mount([
      { ...squat(), sg: 'paired' },
      { ...squat(), id: '0292', sg: 'paired' },
      { ...squat(), id: '0289' },
    ])
    open()
    prepare()
    tap('Done')
    expect(row(0).done).toBe(true)
    expect(useStore.getState().S.active.cur).toBe(1)
    expect(calls.onAdvanceUnit).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(700))
    prepare()
    tap('Done')
    expect(row(1).done).toBe(true)
    expect(useStore.getState().S.active.cur).toBe(2)
    expect(row(2).done).toBe(false)
    expect(calls.onAdvanceUnit).toHaveBeenCalledTimes(1)
  })

  it('rejects a rapid Done bounce when the superset partner becomes current', () => {
    mount([{ ...squat(), sg: 'paired' }, { ...squat(), id: '0292', sg: 'paired' }])
    act(() => useUI.setState({ focusOverlayPrepared: { sessionId: 'dock-test', entries: ['0:0043', '1:0292'] } }))
    open()
    tap('Done')
    expect(useStore.getState().S.active.cur).toBe(1)
    tap('Done')
    expect(row(0).done).toBe(true)
    expect(row(1).done).toBe(false)
    expect(calls.onToggle).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(601))
    tap('Done')
    expect(row(1).done).toBe(true)
    expect(calls.onToggle).toHaveBeenCalledTimes(2)
  })

  it('finishes a timed set through its timer callback with the elapsed duration', () => {
    mount([{ id: '1001', target: { mode: 'time', sets: 1, sec: 30 }, sets: [{ w: 0, sec: 30, done: false }] }])
    open()
    tap('Start')
    // Preparation may precede the action that starts timing the hold.
    if (!useUI.getState().work) tap('Start')
    expect(calls.onStartTimed).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(4000))
    tap('Done')
    expect(useUI.getState().work).toBeNull()
    expect(row()).toMatchObject({ sec: 4, done: true })
    expect(calls.onToggle).toHaveBeenCalledTimes(1)
  })

  it('rejects a rapid second press when a timed Start changes into Done', () => {
    mount([{ id: '1001', target: { mode: 'time', sets: 1, sec: 30 }, sets: [{ w: 0, sec: 30, done: false }] }])
    open()
    tap('Start')
    tap('Done')
    expect(useUI.getState().work).not.toBeNull()
    expect(row()).toMatchObject({ sec: 30, done: false })
    expect(calls.onToggle).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(600))
    tap('Done')
    expect(useUI.getState().work).toBeNull()
    expect(row()).toMatchObject({ sec: 1, done: true })
    expect(calls.onToggle).toHaveBeenCalledTimes(1)
  })

  it.each(['Details', 'Exercises', 'Load', 'More'])('toggles %s with the same anchored button', name => {
    mount()
    open()
    const anchor = button(name)
    expect(anchor).toBeTruthy()
    expect(anchor.getAttribute('aria-expanded')).toBe('false')
    tap(name)
    expect(button(name)).toBe(anchor)
    expect(anchor.getAttribute('aria-expanded')).toBe('true')
    tap(name)
    expect(button(name)).toBe(anchor)
    expect(anchor.getAttribute('aria-expanded')).toBe('false')
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('shows a previously pinned note in Details without treating the note object as renderable text', () => {
    mount([squat()], {
      workouts: [{ d: '2026-10-08', entries: [{ id: '0043', note: 'Keep the bar level', notePin: true, sets: [] }] }],
    })
    open()
    tap('Details')
    expect(document.body.textContent).toContain('Keep the bar level')
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('closes a disclosure first and the overlay second with Escape, preserving set data', () => {
    mount()
    open()
    tap('Details')
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(button('Details').getAttribute('aria-expanded')).toBe('false')
    expect(button('Close')).toBeTruthy()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(button('Focus')).toBeTruthy()
    expect(row()).toMatchObject({ r: 5, done: false })
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('keeps keyboard focus inside its controls while the overlay is open', () => {
    mount()
    open()
    const first = button('Decrease load')
    const last = button('Close')
    expect(first).toBeTruthy()
    act(() => last.focus())
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(first)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(last)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('gives an open overlay the keyboard and restores the workout shortcut when it closes', () => {
    mount([squat([{ w: 95, r: 5, done: false }, { w: 95, r: 5, done: false }])])
    act(() => root.render(<MemoryRouter initialEntries={['/workout']}><Workout /></MemoryRouter>))
    open()
    prepare()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })))
    expect(useStore.getState().S.active.entries[0].sets.map(set => set.done)).toEqual([false, false])
    tap('Close')
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })))
    expect(useStore.getState().S.active.entries[0].sets.map(set => set.done)).toEqual([true, false])
    expect(useUI.getState().timer).toMatchObject({ forIdx: 0, forSet: 0 })
  })
})
