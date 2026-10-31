import { afterEach, describe, expect, it, vi } from 'vitest'
import { transitionView } from './motion.js'

const animation = () => ({ finished: new Promise(() => {}), cancel: vi.fn() })
function environment(reduced = false) {
  const events = []
  const incoming = animation(), outgoing = animation()
  const snapshot = { removeAttribute: vi.fn(), setAttribute: vi.fn(), classList: { add: vi.fn() }, querySelectorAll: () => [], style: {}, remove: vi.fn(), animate: vi.fn(() => { events.push('outgoing'); return outgoing }) }
  const root = { getBoundingClientRect: () => ({ left: 16, top: 70, width: 358, height: 400 }), cloneNode: () => snapshot, parentElement: { append: vi.fn() }, animate: vi.fn(() => { events.push('incoming'); return incoming }) }
  vi.stubGlobal('document', { documentElement: { dataset: {} }, visibilityState: 'visible', body: { append: vi.fn() }, querySelector: vi.fn(selector => selector.startsWith('.qt-workout-controls') ? null : root) })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) })
  return { root, snapshot, incoming, outgoing, events }
}
afterEach(() => { vi.runAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })
describe('navigation animation ownership', () => {
  it('hides the incoming card before commit and cleans up both surfaces once', () => {
    vi.useFakeTimers()
    const { events, root, snapshot, incoming, outgoing } = environment()
    transitionView(() => events.push('commit'), 'forward', '.qt-drill-card')
    expect(events).toEqual(['incoming', 'commit', 'outgoing'])
    expect(document.querySelector).toHaveBeenCalledWith('.qt-drill-card')
    expect(root.animate.mock.calls[0][0][0]).toEqual({ opacity: 0, transform: 'translateX(20px)' })
    vi.runAllTimers()
    expect(snapshot.remove).toHaveBeenCalledOnce()
    expect(incoming.cancel).toHaveBeenCalledOnce()
    expect(outgoing.cancel).toHaveBeenCalledOnce()
  })
  it('reverses both surfaces and finishes an interrupted transition before updating again', () => {
    vi.useFakeTimers()
    const old = environment()
    transitionView(() => {}, 'forward')
    expect(document.querySelector).toHaveBeenCalledWith('#training-main')
    const next = environment()
    transitionView(() => {}, 'back')
    expect(old.snapshot.remove).toHaveBeenCalledOnce()
    expect(next.root.animate.mock.calls[0][0][0].transform).toBe('translateX(-20px)')
    expect(next.snapshot.animate.mock.calls[0][0][1].transform).toBe('translateX(20px)')
  })
  it('clips scrolled outgoing content below the new header boundary', () => {
    vi.useFakeTimers()
    const { root, snapshot } = environment()
    root.getBoundingClientRect = vi.fn()
      .mockReturnValueOnce({ left: 16, top: -400, width: 358, height: 1400 })
      .mockReturnValue({ left: 16, top: 143, width: 358, height: 1200 })
    transitionView(() => {})
    expect(snapshot.style.clipPath).toBe('inset(543px 0 0 0)')
  })
  it('commits immediately without animations when reduced motion is requested', () => {
    vi.useFakeTimers()
    const { root } = environment(true), update = vi.fn()
    transitionView(update)
    expect(update).toHaveBeenCalledOnce()
    expect(root.animate).not.toHaveBeenCalled()
  })
})

function controlSurface(top = 700) {
  const ghostAnimation = animation(), liveAnimation = animation()
  const bounds = { left: 12, top, width: 366, height: 134 }
  const ghost = {
    removeAttribute: vi.fn(), setAttribute: vi.fn(), classList: { add: vi.fn() },
    querySelectorAll: () => [], style: {}, remove: vi.fn(),
    getBoundingClientRect: () => bounds, animate: vi.fn(() => ghostAnimation),
  }
  const live = { inert: false, getBoundingClientRect: () => bounds, cloneNode: vi.fn(() => ghost), animate: vi.fn(() => liveAnimation) }
  return { live, ghost, ghostAnimation, liveAnimation }
}
function dockEnvironment(initial = null) {
  const env = environment()
  let current = initial
  document.querySelector.mockImplementation(selector => selector.startsWith('.qt-workout-controls') ? current : env.root)
  window.getComputedStyle = element => ({ opacity: element.testOpacity || '1' })
  return { ...env, setDock: next => { current = next } }
}
describe('bottom control handoff', () => {
  it('reveals newly mounted controls after navigation begins leaving and keeps them inert until finished', () => {
    vi.useFakeTimers()
    const env = dockEnvironment(), next = controlSurface()
    transitionView(() => env.setDock(next.live))
    expect(next.live.animate).toHaveBeenCalledOnce()
    expect(next.live.animate.mock.calls[0][0]).toEqual([{ opacity: 0, translate: '0 24px' }, { opacity: 1, translate: '0 0' }])
    expect(next.live.animate.mock.calls[0][1]).toMatchObject({ delay: 80, duration: 240, fill: 'both' })
    expect(next.live.inert).toBe(true)
    vi.advanceTimersByTime(300)
    expect(next.liveAnimation.cancel).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(next.live.inert).toBe(false)
    expect(next.liveAnimation.cancel).toHaveBeenCalledOnce()
  })
  it('animates only a noninteractive snapshot when controls are removed', () => {
    vi.useFakeTimers()
    const old = controlSurface(), env = dockEnvironment(old.live)
    transitionView(() => env.setDock(null), 'back')
    expect(document.body.append).toHaveBeenCalledWith(old.ghost)
    expect(old.ghost.inert).toBe(true)
    expect(old.ghost.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true')
    expect(old.ghost.style).toMatchObject({ pointerEvents: 'none', top: '700px', bottom: 'auto', transform: 'none' })
    expect(old.ghost.animate.mock.calls[0][1]).toMatchObject({ duration: 180 })
    expect(old.live.animate).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(old.ghost.remove).toHaveBeenCalledOnce()
  })
  it('never replays a dock entrance for ordinary page updates or drill transitions', () => {
    vi.useFakeTimers()
    const dock = controlSurface()
    dockEnvironment(dock.live)
    transitionView(() => {})
    transitionView(() => {}, 'forward', '.qt-drill-card')
    expect(dock.live.animate).not.toHaveBeenCalled()
    expect(document.body.append).not.toHaveBeenCalled()
    expect(dock.live.inert).toBe(false)
  })
  it('hands an interrupted exit back to the new live dock without a fresh hidden frame', () => {
    vi.useFakeTimers()
    const old = controlSurface(714), env = dockEnvironment(old.live)
    transitionView(() => env.setDock(null), 'back')
    old.ghost.testOpacity = '.4'
    const next = controlSurface(700)
    transitionView(() => env.setDock(next.live), 'forward')
    expect(old.ghost.remove).toHaveBeenCalledOnce()
    expect(old.ghostAnimation.cancel).toHaveBeenCalledOnce()
    expect(next.live.animate.mock.calls[0][0][0]).toEqual({ opacity: '.4', translate: '0 14px' })
    expect(next.live.animate.mock.calls[0][1].delay).toBe(0)
    vi.runAllTimers()
    expect(next.live.inert).toBe(false)
  })
  it('skips both dock snapshots and entrance animation with reduced motion', () => {
    vi.useFakeTimers()
    const old = controlSurface(), next = controlSurface(), env = dockEnvironment(old.live)
    window.matchMedia = () => ({ matches: true })
    transitionView(() => env.setDock(next.live))
    expect(document.body.append).not.toHaveBeenCalled()
    expect(next.live.animate).not.toHaveBeenCalled()
    expect(next.live.inert).toBe(false)
  })
})
