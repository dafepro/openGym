// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkoutFocus from './WorkoutFocus.jsx'
import useFocusHistory from './useFocusHistory.js'
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
  .filter(el => !el.closest('[inert]') && !el.closest('[aria-hidden="true"]'))
  .find(el => (el.getAttribute('aria-label') || el.textContent.trim()).toLowerCase() === name.toLowerCase())
const tap = name => {
  const el = button(name)
  expect(el, `Expected button ${name}`).toBeTruthy()
  act(() => el.click())
  return el
}
const open = () => expect(document.querySelector('.wf-page')).toBeTruthy()
const tapRow = prefix => {
  const el = [...document.body.querySelectorAll('.wf-row-toggle')].find(el =>
    !el.closest('[inert]') && el.getAttribute('aria-label').startsWith(prefix))
  expect(el).toBeTruthy()
  act(() => el.click())
  return el
}
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
    const open = useUI(s => s.focusDetailsOpen)
    useFocusHistory(open, () => useUI.getState().dismissFocus())
    return <WorkoutFocus entryIdx={active.cur} unit={unitOf(supersetUnits(active.entries), active.cur)} {...calls} />
  }
  act(() => root.render(strict ? <React.StrictMode><Harness /></React.StrictMode> : <Harness />))
}

beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState(null, '')
  vi.spyOn(window.history, 'back').mockImplementation(() => {})
  localStorage.clear()
  originalStore = useStore.getState()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], toastMsg: '', focusDetailsOpen: false, focusPrepared: null, focusSkippedWarmups: null, focusView: 'live', focusPane: null, focusLastSet: null })
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
  useUI.setState({ sheets: [], toastMsg: '', focusDetailsOpen: false, focusPrepared: null, focusSkippedWarmups: null, focusView: 'live', focusPane: null, focusLastSet: null })
  useStore.setState(originalStore)
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the workout focus layout', () => {
  it('keeps the current action while switching flat views and shows only three rail controls', () => {
    mount(); open(); prepare()
    const rail = document.querySelector('.wf-actions')
    const action = button('Done')
    expect([...rail.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Workout', 'Done'])
    tap('Workout')
    expect(button('Live')).toBeTruthy()
    expect(button('Done')).toBe(action)
    expect(button('Back')).toBeUndefined()
    expect(button('Close')).toBeUndefined()
    tap('Live')
    expect(button('Done')).toBe(action)
    expect(row().done).toBe(false)
  })

  it('edits the next load during rest without shortening, restarting or recording anything', () => {
    mount([squat([{ w: 95, r: 5, done: true, at: 1 }, { w: 95, r: 5, done: false }])])
    act(() => useUI.getState().startRest(90, 0, { forSet: 0 }))
    open()
    const rest = clone(useUI.getState().timer)
    const anchor = tapRow('Load')
    tap('Increase load')
    expect(row(0, 1)).toMatchObject({ w: 105, done: false })
    expect(row().w).toBe(95)
    expect(useUI.getState().timer).toEqual(rest)
    expect(button('Pause')).toBeTruthy()
    expect(document.querySelector('.wf-timer-strip').textContent).toContain('1:30')
    tapRow('Load')
    expect(anchor.getAttribute('aria-expanded')).toBe('false')
  })

  it('corrects completed reps and optional effort on the previous row while rest continues', () => {
    mount([squat([{ w: 95, r: 5, done: true, at: 1 }, { w: 95, r: 5, done: false }])], { effort: 'rir' })
    act(() => useUI.getState().startRest(90, 0, { forSet: 0 }))
    open(); tapRow('Last set')
    const rest = clone(useUI.getState().timer)
    tap('Increase reps'); tap('Increase RIR')
    expect(row()).toMatchObject({ r: 6, rir: 0, done: true, at: 1 })
    expect(row(0, 1)).toMatchObject({ r: 5, done: false })
    expect(Object.hasOwn(row(0, 1), 'rir')).toBe(false)
    expect(useUI.getState().timer).toEqual(rest)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('undoes the last log and its own rest without logging or unchecking another row', () => {
    mount([squat([{ w: 95, r: 0, done: true, at: 1 }, { w: 95, r: 5, done: false }])])
    act(() => useUI.getState().startRest(90, 0, { forSet: 0 }))
    open(); tapRow('Last set'); tap('Undo')
    expect(row()).toMatchObject({ r: 0, done: false })
    expect(row(0, 1).done).toBe(false)
    expect(useUI.getState().timer).toBeNull()
    expect(calls.onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows Max, drop and burst instructions directly in Live with no More disclosure', () => {
    mount([squat([{ w: 95, r: 5, max: true, type: 'dropset', drops: [{ w: 65, r: 8 }], done: false }])])
    open(); prepare()
    expect(document.querySelector('.wf-phase').textContent).toContain('Max: as many reps as you can')
    expect(button('Increase drop 1 reps')).toBeTruthy()
    tap('Increase drop 1 reps')
    expect(row().drops[0].r).toBe(9)
    expect(row().done).toBe(false)
    act(() => changeActive(active => {
      active.entries[0].sets[0] = { w: 95, r: 8, type: 'restpause', clusters: [{ r: 3, restSec: 15 }], done: false }
    }))
    expect(document.querySelector('.wf-phase').textContent).toContain('Total reps')
    tap('Increase burst 1 reps')
    expect(row()).toMatchObject({ r: 9, clusters: [{ r: 4, restSec: 15 }], done: false })
  })

  it('Back closes details or the overview while keeping the focus page available', () => {
    mount(); tap('Details')
    const pop = () => act(() => window.dispatchEvent(new PopStateEvent('popstate')))
    pop()
    expect(useUI.getState().focusPane).toBeNull()
    expect(useUI.getState().focusDetailsOpen).toBe(false)
    tap('Workout'); pop()
    expect(useUI.getState().focusView).toBe('live')
    expect(useUI.getState().focusDetailsOpen).toBe(false)
    expect(document.querySelector('.wf-page')).toBeTruthy()
    expect(row().done).toBe(false)
  })

  it('keeps a captured last-set editor attached to its original row as another log arrives', () => {
    mount([squat([{ w: 95, r: 5, done: true, at: 1 }, { w: 95, r: 5, done: false }])], { effort: 'rir' })
    open(); tapRow('Last set')
    act(() => changeActive(active => { active.entries[0].sets[1].done = true; active.entries[0].sets[1].at = 2 }))
    tap('Increase RIR')
    expect(row().rir).toBe(0)
    expect(Object.hasOwn(row(0, 1), 'rir')).toBe(false)
  })

  it('renders a page in StrictMode without a floating launcher or a modal focus trap', () => {
    mount([squat()], {}, true)
    expect(document.querySelector('.wf-page')).toBeTruthy()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(button('Minimize')).toBeUndefined()
    expect(button('Focus')).toBeUndefined()
    expect(host.inert).not.toBe(true)
    expect(row().done).toBe(false)
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
    act(() => root.render(<WorkoutFocus entryIdx={0} unit={[0]} {...calls} />))
    expect(button('Start')).toBeUndefined()
    expect(button('Done')).toBeTruthy()
    expect(row()).toEqual(before)
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
    prepare()
    tap('More')
    const effort = document.querySelector('input[aria-label="RIR"]')
    expect(effort.value).toBe('')
    expect(Object.hasOwn(row(), 'rir')).toBe(false)
    expect(calls.onField).not.toHaveBeenCalled()
    tap('Increase RIR')
    expect(row().rir).toBe(0)
    expect(effort.value).toBe('0')
    tap('Decrease RIR')
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
    prepare()
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
    tap('Skip rest')
    expect(useUI.getState().timer).toBeNull()
    expect(row(0, 1).done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('rejects a rapid second press when Skip changes into Done', () => {
    mount([squat([{ w: 95, r: 5, done: false }, { w: 95, r: 5, done: false }])])
    open()
    prepare()
    act(() => useUI.getState().startRest(60, 0))
    tap('Skip rest')
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
    tap('Next set')
    expect(useUI.getState().timer).toBeNull()
    expect(row(0, 1).done).toBe(false)
    expect(calls.onToggle).not.toHaveBeenCalled()
  })

  it('holds and resumes rest at the same control while preserving the pending set', () => {
    mount([squat([{ w: 95, r: 5, done: true }, { w: 95, r: 5, done: false }])])
    act(() => useUI.getState().startRest(60, 0, { forSet: 0 }))
    open()
    expect(document.querySelector('.wf-primary').textContent).toBe('Skip rest')
    const anchor = tap('Pause')
    expect(anchor.closest('.wf-rest-adjust')).toBeTruthy()
    expect(anchor.closest('.wf-actions')).toBeTruthy()
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
    tap('Workout')
    act(() => vi.advanceTimersByTime(10_000))
    tap('Live')
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
    act(() => useUI.setState({ focusPrepared: { sessionId: 'dock-test', entries: ['0:0043', '1:0292'] } }))
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

  it.each(['Details', 'More'])('toggles %s with the same anchored button', name => {
    mount()
    open()
    prepare()
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

  it('closes a disclosure with Escape while keeping the base focus layout', () => {
    mount(); tap('Details')
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(button('Details').getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('.wf-page')).toBeTruthy()
    expect(useUI.getState().focusDetailsOpen).toBe(false)
    expect(row()).toMatchObject({ r: 5, done: false })
  })

  it('lets Tab reach app navigation instead of trapping it inside Focus', () => {
    mount()
    const tab = document.createElement('button'); tab.textContent = 'Home'; host.append(tab)
    act(() => tab.focus())
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    act(() => document.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(tab)
    tab.remove()
  })


  it('skips remaining warm-ups without recording them or changing an earned rest', () => {
    const entries = [squat([
      { w: 20, r: 8, done: true, phase: 'warmup', at: 1 },
      { w: 40, r: 5, done: false, phase: 'warmup' },
      { w: 95, r: 5, done: false },
    ])]
    mount(entries)
    act(() => useUI.getState().startRest(60, 0, { forSet: 0 }))
    const rest = clone(useUI.getState().timer)
    const before = clone(useStore.getState().S.active.entries[0].sets)
    expect(button('Skip warm-ups').closest('.wf-actions')).toBeTruthy()
    tap('Skip warm-ups')
    expect(useStore.getState().S.active.entries[0].sets).toEqual(before)
    expect(useUI.getState().timer).toEqual(rest)
    expect(document.querySelector('.wf-phase .wf-next-label').textContent).toContain('Set 3')
    expect(button('Skip warm-ups')).toBeUndefined()
    tap('Skip rest'); prepare(); tap('Done')
    expect(row(0, 0).done).toBe(true)
    expect(row(0, 1).done).toBe(false)
    expect(row(0, 2).done).toBe(true)
    expect(button('Finish')).toBeTruthy()
  })

  it('advances through the real workout controller and finishes after work sets with warm-ups unrecorded', () => {
    mount([squat([{ w: 20, r: 8, done: false, phase: 'warmup' }, { w: 95, r: 5, done: false }]),
      { ...squat([{ w: 40, r: 5, done: false }]), id: '0025' }])
    act(() => changeActive(active => { active.workoutView = 'focus' }))
    act(() => root.render(<MemoryRouter initialEntries={['/workout']}><Workout /></MemoryRouter>))
    tap('Skip warm-ups'); prepare(); tap('Done')
    expect(useStore.getState().S.active.cur).toBe(1)
    expect(row(0, 0)).toMatchObject({ done: false, r: 8 })
    expect(row(0, 0).at).toBeUndefined()
    expect(row(0, 1).done).toBe(true)
    tap('Skip rest'); prepare(); tap('Done')
    expect(useUI.getState().timer).toBeNull()
    expect(row(1, 0).done).toBe(true)
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(document.querySelector('.wf-page').dataset.phase).toBe('complete')
  })

  it('keeps superset rounds and rest intact after both members bypass warm-ups', () => {
    const sets = () => [{ w: 20, r: 8, done: false, phase: 'warmup' }, { w: 40, r: 5, done: false }]
    mount([{ ...squat(sets()), sg: 'pair' }, { ...squat(sets()), id: '0025', sg: 'pair' },
      { ...squat(), id: '0289' }])
    act(() => changeActive(active => { active.workoutView = 'focus' }))
    act(() => root.render(<MemoryRouter initialEntries={['/workout']}><Workout /></MemoryRouter>))
    tap('Skip warm-ups'); prepare(); tap('Done')
    expect(useStore.getState().S.active.cur).toBe(1)
    expect(useUI.getState().timer).toBeNull()
    tap('Skip warm-ups'); prepare(); tap('Done')
    expect(useStore.getState().S.active.cur).toBe(2)
    expect(row(0, 0).done).toBe(false)
    expect(row(1, 0).done).toBe(false)
    expect(row(0, 1).done).toBe(true)
    expect(row(1, 1).done).toBe(true)
    expect(useUI.getState().timer).toMatchObject({ forIdx: 1, forSet: 1 })
  })

  it('does not offer warm-up bypass when there are no pending work sets', () => {
    mount([squat([{ w: 20, r: 8, done: false, phase: 'warmup' }])])
    expect(button('Skip warm-ups')).toBeUndefined()
  })

  it('gives the current phase the blank-space shortcut without bypassing prep or rest', () => {
    mount([squat([{ w: 95, r: 5, done: false }, { w: 95, r: 5, done: false }])])
    changeActive(active => { active.workoutView = 'focus' })
    act(() => root.render(<MemoryRouter initialEntries={['/workout']}><Workout /></MemoryRouter>))
    const space = () => act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })))
    space()
    expect(useStore.getState().S.active.entries[0].sets.map(set => set.done)).toEqual([false, false])
    act(() => vi.advanceTimersByTime(601))
    space()
    expect(useStore.getState().S.active.entries[0].sets.map(set => set.done)).toEqual([true, false])
    space()
    expect(useUI.getState().timer).toBeNull()
    expect(useStore.getState().S.active.entries[0].sets[1].done).toBe(false)
  })
})
