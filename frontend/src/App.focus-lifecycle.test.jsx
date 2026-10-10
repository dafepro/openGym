// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

vi.mock('./lib/sound.js', () => ({
  beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(),
  setPlayOnSilent: vi.fn(), setVibrate: vi.fn(), setAlarmBuzzer: vi.fn(),
}))
vi.mock('./lib/api.js', async importOriginal => ({
  ...await importOriginal(), api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(),
}))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host, originalStore
const tap = async (scope, name) => {
  const control = [...scope.querySelectorAll('button')].find(el =>
    !el.closest('[inert]') && !el.closest('[aria-hidden="true"]') && (el.getAttribute('aria-label') || el.textContent.trim()) === name)
  expect(control, name).toBeTruthy()
  await act(async () => control.click())
}
beforeEach(() => {
  vi.useFakeTimers()
  originalStore = useStore.getState()
  window.history.replaceState(null, '', '/#/workout')
  vi.spyOn(window.history, 'back').mockImplementation(() => {})
  window.scrollTo = vi.fn()
  const S = JSON.parse(JSON.stringify(DEF))
  S.sound = false
  S.active = { id: 'focus-lifecycle', name: 'Hold', start: Date.now(), cur: 0, entries: [{
    id: '0043', target: { mode: 'time', sec: 45, sets: 2, weight: 40 },
    sets: [{ w: 40, sec: 45, done: false }, { w: 40, sec: 45, done: false }],
  }] }
  useStore.setState({ S, user: null, ready: true, needsMobileOnboarding: false, isGuest: () => true, boot: vi.fn() })
  useUI.getState().stopRest(); useUI.getState().stopWork()
  useUI.setState({ sheets: [], focusOverlayOpen: false, focusOverlayPrepared: null, focusOverlayView: 'live', focusOverlayPane: null, focusLastSet: null })
  host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useUI.getState().stopRest(); useUI.getState().stopWork()
  useUI.setState({ sheets: [], focusOverlayOpen: false, focusOverlayPrepared: null, focusOverlayView: 'live', focusOverlayPane: null, focusLastSet: null })
  useStore.setState(originalStore)
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})

describe('the focus workspace across routes', () => {
  it('keeps a timed hold owned by its original row when minimized onto Home and completed there', async () => {
    await act(async () => root.render(<App />))
    const dock = document.querySelector('.wf-dock')
    await tap(dock, 'Focus'); await tap(dock, 'Start')
    const endsAt = useUI.getState().work.endsAt
    act(() => vi.advanceTimersByTime(4000))
    await tap(dock, 'Minimize')
    await tap(document.getElementById('app'), 'Minimize')
    expect(window.location.hash).toBe('#/home')
    expect(useUI.getState().work.endsAt).toBe(endsAt)
    expect(document.querySelector('.wf-dock')).toBe(dock)
    await tap(dock, 'Focus')
    expect(window.location.hash).toBe('#/home')
    act(() => vi.advanceTimersByTime(4000))
    await tap(dock, 'Done')
    expect(useStore.getState().S.active.entries[0].sets).toMatchObject([
      { sec: 8, done: true }, { sec: 45, done: false },
    ])
    expect(useUI.getState().work).toBeNull()
    expect(useUI.getState().timer).toMatchObject({ forIdx: 0, forSet: 0 })
  })

  it('keeps a stopped hold unrecorded and preserves both elapsed time and the retry plan', async () => {
    await act(async () => root.render(<App />))
    const dock = document.querySelector('.wf-dock')
    await tap(dock, 'Focus'); await tap(dock, 'Start')
    act(() => vi.advanceTimersByTime(8000))
    await tap(dock, 'Stop')
    expect(useStore.getState().S.active.entries[0].sets[0]).toMatchObject({ sec: 8, planSec: 45, done: false })
    expect(useUI.getState().work).toBeNull()
    expect(useUI.getState().timer).toBeNull()
    await tap(dock, 'Start')
    expect(useUI.getState().work).toMatchObject({ total: 45, owner: { idx: 0, i: 0 } })
  })
})
