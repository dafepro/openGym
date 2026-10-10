// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from '../store/useUI.js'
import useFocusHistory from './useFocusHistory.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host, push, back
function Harness() {
  const open = useUI(s => s.focusOverlayOpen)
  useFocusHistory(open, () => useUI.getState().dismissFocus())
  return null
}
const set = patch => act(() => useUI.setState(patch))
const pop = state => act(() => window.dispatchEvent(new PopStateEvent('popstate', { state })))
const mount = strict => act(() => root.render(strict ? <React.StrictMode><Harness /></React.StrictMode> : <Harness />))

beforeEach(() => {
  window.history.replaceState(null, '')
  useUI.setState({ focusOverlayOpen: false, focusOverlayView: 'live', focusOverlayPane: null, sheets: [] })
  push = vi.spyOn(window.history, 'pushState')
  // Rewinds are asynchronous in a browser. Each test delivers the corresponding pop.
  back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  window.history.replaceState(null, '')
  useUI.setState({ focusOverlayOpen: false, focusOverlayView: 'live', focusOverlayPane: null, sheets: [] })
})

describe('focus workspace history ownership', () => {
  it('adds only one entry, including a StrictMode effect replay', () => {
    set({ focusOverlayOpen: true })
    mount(true)
    expect(push).toHaveBeenCalledTimes(1)
    set({ focusOverlayPane: 'info', focusOverlayView: 'workout' })
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss focus when a sheet button rewinds onto its entry', () => {
    mount(); set({ focusOverlayOpen: true, focusOverlayView: 'workout' })
    set({ sheets: [{ id: 'finish' }] })
    set({ sheets: [] })
    pop({ openGymFocus: true })
    expect(useUI.getState().focusOverlayOpen).toBe(true)
    expect(useUI.getState().focusOverlayView).toBe('workout')
    expect(back).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('leaves browser Back to the owning sheet before unwinding focus', () => {
    mount(); set({ focusOverlayOpen: true, focusOverlayPane: 'load' })
    set({ sheets: [{ id: 'finish' }] })
    pop(null)
    expect(useUI.getState().focusOverlayPane).toBe('load')
    set({ sheets: [] })
    pop(null)
    expect(useUI.getState().focusOverlayPane).toBeNull()
    expect(useUI.getState().focusOverlayOpen).toBe(true)
  })

  it('waits for a pending rewind before rearming a fast reopen', () => {
    mount(); set({ focusOverlayOpen: true })
    set({ focusOverlayOpen: false })
    expect(back).toHaveBeenCalledTimes(1)
    set({ focusOverlayOpen: true })
    expect(push).toHaveBeenCalledTimes(1)
    pop(null)
    expect(push).toHaveBeenCalledTimes(2)
    expect(useUI.getState().focusOverlayOpen).toBe(true)
    pop(null)
    expect(useUI.getState().focusOverlayOpen).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('reuses a surviving open marker on remount instead of stacking one', () => {
    window.history.replaceState({ openGymFocus: true }, '')
    set({ focusOverlayOpen: true })
    mount()
    expect(push).not.toHaveBeenCalled()
    pop(null)
    expect(useUI.getState().focusOverlayOpen).toBe(false)
    expect(back).not.toHaveBeenCalled()
  })

  it('consumes a stale marker when a reload starts with focus closed', () => {
    window.history.replaceState({ openGymFocus: true }, '')
    mount()
    expect(back).toHaveBeenCalledTimes(1)
    pop(null)
    expect(push).not.toHaveBeenCalled()
    expect(useUI.getState().focusOverlayOpen).toBe(false)
  })

  it('waits for the finishing sheet to release its entry before removing focus', () => {
    mount(); set({ focusOverlayOpen: true })
    set({ sheets: [{ id: 'finish' }] })
    window.history.replaceState({ openGymSheet: true }, '')
    set({ focusOverlayOpen: false })
    set({ sheets: [] })
    expect(back).not.toHaveBeenCalled()
    window.history.replaceState({ openGymFocus: true }, '')
    pop({ openGymFocus: true })
    expect(back).toHaveBeenCalledTimes(1)
    pop(null)
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('skips a moved-on stale marker rather than spending a Back press on it', () => {
    mount()
    pop({ openGymFocus: true })
    expect(back).toHaveBeenCalledTimes(1)
    pop(null)
    expect(back).toHaveBeenCalledTimes(1)
    expect(useUI.getState().focusOverlayOpen).toBe(false)
  })
})
