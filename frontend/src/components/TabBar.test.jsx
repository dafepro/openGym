// @vitest-environment happy-dom
// The tab bar is fixed on screen and re-renders on every store write — once a second for the
// whole of a rest. Its buttons must survive that: a component declared inside the render body is
// a new function each time, which React reads as a different type and rebuilds from scratch.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar.jsx'
import { useUI } from '../store/useUI.js'
import { DEF, useStore } from '../store/useStore.js'

vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: '/home' }),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, originalS, originalUser

beforeEach(() => {
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  const store = useStore.getState()
  originalS = store.S
  originalUser = store.user
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: { id: 1, name: 'test' } })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useStore.setState({ S: originalS, user: originalUser })
})

const tabs = () => [...host.querySelectorAll('#tabbar button')]

describe('the tab bar across a store write', () => {
  it('hands off color only on phase changes and keeps the face, glyph and timer through ticks and pause', () => {
    vi.useFakeTimers()
    const originalAnimate = Element.prototype.animate
    const playing = []
    Element.prototype.animate = vi.fn(() => { const animation = { cancel: vi.fn() }; playing.push(animation); return animation })
    try {
      act(() => root.render(<TabBar onStart={() => {}} />))
      const start = tabs()[2], face = start.querySelector('.cir'), glyph = face.querySelector('.icn')
      expect(Element.prototype.animate).not.toHaveBeenCalled() // no arrival flourish on reload
      act(() => useStore.getState().update(s => { s.active = { id: 'motion', entries: [], cur: 0, start: Date.now() } }, false))
      expect(face.dataset.state).toBe('active')
      expect(Element.prototype.animate).toHaveBeenCalled()
      const firstHandoff = [...playing]
      act(() => useUI.getState().startRest(60, 0))
      expect(face.dataset.state).toBe('rest')
      firstHandoff.forEach(animation => expect(animation.cancel).toHaveBeenCalledOnce())
      const calls = Element.prototype.animate.mock.calls.length
      const ring = face.querySelector('.workout-timer-ring')
      act(() => vi.advanceTimersByTime(10_000))
      act(() => useUI.getState().pauseRest())
      act(() => vi.advanceTimersByTime(10_000))
      expect(Number(ring.querySelector('.wtr-arc').getAttribute('stroke-dashoffset'))).toBeCloseTo(100 * 50 / 60)
      act(() => useUI.getState().resumeRest())
      expect(Element.prototype.animate).toHaveBeenCalledTimes(calls)
      expect(start.querySelector('.cir')).toBe(face)
      expect(face.querySelector('.icn')).toBe(glyph)
      expect(face.querySelector('.workout-timer-ring')).toBe(ring)
      act(() => useUI.getState().stopRest())
      expect(face.dataset.state).toBe('active')
      expect(face.querySelector('.workout-timer-ring')).toBeNull()
      expect(Element.prototype.animate.mock.calls.length).toBeGreaterThan(calls)
      expect(tabs()[2]).toBe(start)
    } finally {
      if (originalAnimate) Element.prototype.animate = originalAnimate
      else delete Element.prototype.animate
      useUI.getState().stopRest(); vi.useRealTimers()
    }
  })

  it('honors reduced motion while retaining the real rest ring and state colors', () => {
    const originalAnimate = Element.prototype.animate
    Element.prototype.animate = vi.fn()
    const preference = { matches: true }
    const media = vi.spyOn(window, 'matchMedia').mockReturnValue(preference)
    try {
      act(() => root.render(<TabBar onStart={() => {}} />))
      act(() => useStore.getState().update(s => { s.active = { id: 'motion', entries: [], cur: 0, start: Date.now() } }, false))
      const face = tabs()[2].querySelector('.cir')
      expect(face.dataset.state).toBe('active')
      act(() => useUI.getState().startRest(60, 0))
      expect(face.dataset.state).toBe('rest')
      expect(face.querySelector('.workout-timer-ring')).toBeTruthy()
      expect(Element.prototype.animate).not.toHaveBeenCalled()
    } finally {
      media.mockRestore()
      if (originalAnimate) Element.prototype.animate = originalAnimate
      else delete Element.prototype.animate
      useUI.getState().stopRest()
    }
  })

  it('keeps the very same buttons instead of rebuilding them every tick', () => {
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    const before = tabs()
    expect(before).toHaveLength(5)

    // What a rest does once a second: S is replaced, so everything reading it re-renders.
    act(() => { useStore.getState().update(s => { s.restSec = 91 }, false) })

    const after = tabs()
    expect(after).toHaveLength(before.length)
    after.forEach((el, i) => expect(el).toBe(before[i]))
  })

  it('still lights the tab for the route it is on, and follows a change of state', () => {
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    expect(tabs()[0].className).toBe('on')
    expect(tabs()[1].className).toBe('')
    expect(tabs()[2].className).toBe('start')

    act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0 } }, false) })
    expect(tabs()[2].className).toBe('start')
    expect(tabs()[0].className).toBe('on')
  })
})

// Settings → "Show connection status" off (#369, #330): a stuck sync shows as a dot on Home, the
// tab Settings opens from, and the tab's name says it.
describe('the connection dot on Home', () => {
  const home = () => tabs()[0]
  it('is there for a sync problem only while the banner is switched off', () => {
    const original = useStore.getState().sync
    try {
      useStore.setState({ sync: { status: 'error', lastError: { status: 502 }, pending: true } })
      act(() => { root.render(<TabBar onStart={() => {}} />) })
      expect(home().querySelector('.tab-dot')).toBeNull()
      act(() => { useStore.getState().update(s => { s.connStatus = false }, false) })
      expect(home().querySelector('.tab-dot')).not.toBeNull()
      expect(home().getAttribute('aria-label')).toBe('Home, Connection problem')
      act(() => { useStore.setState({ sync: { status: 'ok', lastError: null, pending: false } }) })
      expect(home().querySelector('.tab-dot')).toBeNull()
      expect(home().getAttribute('aria-label')).toBeNull()
    } finally { useStore.setState({ sync: original }) }
  })
})

// v1.3.11 icon sweep: one icon per concept. Every tab carries its name under the icon, Start is a
// play button whether or not a session runs, and Exercises is the dumbbell (no more generic list).
describe('the tab icons and labels', () => {
  const icon = el => el.querySelector('svg')?.getAttribute('data-icon')
  const label = el => el.querySelector(':scope > span:last-child').textContent
  it('labels every tab and uses one icon per concept', () => {
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    expect(tabs().map(icon)).toEqual(['house', 'calendar', 'play', 'chart', 'dumbbell'])
    expect(tabs().map(label)).toEqual(['Home', 'Plan', 'Start', 'Stats', 'Exercises'])

    act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0 } }, false) })
    expect(icon(tabs()[2])).toBe('play')
    expect(label(tabs()[2])).toBe('Resume')
  })

  it('restores the orange active signal outside rest and keeps saved editing normal', () => {
    act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0, start: Date.now() - 754_000 } }, false) })
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    const start = tabs()[2]
    expect(label(start)).toBe('Resume')
    expect(start.className).toBe('start rec')
    expect(start.querySelector('.workout-timer-ring')).toBeNull()
    act(() => { useStore.getState().update(s => { s.active.editingWorkoutId = 'w1' }, false) })
    expect(label(tabs()[2])).toBe('Edit workout')
    expect(tabs()[2]).toBe(start)
    expect(start.className).toBe('start')
    expect(start.querySelector('.workout-timer-ring')).toBeNull()
    act(() => { useStore.getState().update(s => { delete s.active.editingWorkoutId; s.active.backfill = { date: '2026-10-09' } }, false) })
    expect(start.className).toBe('start')
    act(() => { useStore.getState().update(s => { s.active = null }, false) })
    expect(start.className).toBe('start')
    expect(label(start)).toBe('Start')
  })

  it('shows blue progress only during rest, freezes while paused and resets when rest ends', () => {
    vi.useFakeTimers()
    try {
      act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0, start: Date.now() } }, false) })
      act(() => { root.render(<TabBar onStart={() => {}} />) })
      const start = tabs()[2]
      expect(start.querySelector('.workout-timer-ring')).toBeNull()
      act(() => useUI.getState().startRest(100, 0))
      const ring = start.querySelector('.workout-timer-ring')
      const offset = () => Number(ring.querySelector('.wtr-arc').getAttribute('stroke-dashoffset'))
      expect(start.classList.contains('resting')).toBe(true)
      expect(start.classList.contains('rec')).toBe(false)
      expect(ring.dataset.mode).toBe('rest')
      expect(offset()).toBe(100)
      act(() => vi.advanceTimersByTime(20_000))
      expect(offset()).toBe(80)
      act(() => useUI.getState().pauseRest())
      expect(ring.dataset.mode).toBe('paused')
      act(() => vi.advanceTimersByTime(10_000))
      expect(offset()).toBe(80)
      act(() => useUI.getState().resumeRest())
      act(() => vi.advanceTimersByTime(80_000))
      expect(start.querySelector('.workout-timer-ring')).toBeNull()
      expect(start.classList.contains('resting')).toBe(false)
      expect(start.classList.contains('rec')).toBe(true)
      act(() => { useUI.getState().stopRest(); useUI.getState().startWork(50, 'Hold', () => {}) })
      act(() => vi.advanceTimersByTime(25_000))
      expect(start.classList.contains('resting')).toBe(false)
      expect(start.classList.contains('rec')).toBe(true)
      expect(tabs()[2]).toBe(start)
      expect(start.querySelector('.workout-timer-ring')).toBeNull()
      expect(label(start)).toBe('Resume')
    } finally { useUI.getState().stopRest(); useUI.getState().stopWork(); vi.useRealTimers() }
  })
})
