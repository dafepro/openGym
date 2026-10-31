import { afterEach, describe, expect, it, vi } from 'vitest'
import { transitionView } from './motion.js'

const animation = () => ({ finished: new Promise(() => {}), cancel: vi.fn() })
function environment(reduced = false) {
  const events = []
  const incoming = animation(), outgoing = animation()
  const snapshot = { removeAttribute: vi.fn(), setAttribute: vi.fn(), classList: { add: vi.fn() }, querySelectorAll: () => [], style: {}, remove: vi.fn(), animate: vi.fn(() => { events.push('outgoing'); return outgoing }) }
  const root = { getBoundingClientRect: () => ({ left: 16, top: 70, width: 358, height: 400 }), cloneNode: () => snapshot, parentElement: { append: vi.fn() }, animate: vi.fn(() => { events.push('incoming'); return incoming }) }
  vi.stubGlobal('document', { documentElement: { dataset: {} }, visibilityState: 'visible', querySelector: vi.fn(() => root) })
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
    const next = environment()
    transitionView(() => {}, 'back')
    expect(old.snapshot.remove).toHaveBeenCalledOnce()
    expect(next.root.animate.mock.calls[0][0][0].transform).toBe('translateX(-20px)')
    expect(next.snapshot.animate.mock.calls[0][0][1].transform).toBe('translateX(20px)')
  })
  it('commits immediately without animations when reduced motion is requested', () => {
    vi.useFakeTimers()
    const { root } = environment(true), update = vi.fn()
    transitionView(update)
    expect(update).toHaveBeenCalledOnce()
    expect(root.animate).not.toHaveBeenCalled()
  })
})
