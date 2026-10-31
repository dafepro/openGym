import { afterEach, describe, expect, it, vi } from 'vitest'
import { transitionView } from './motion.js'
function surface() { return { classList: { add: vi.fn(), remove: vi.fn() }, getBoundingClientRect: vi.fn(() => ({ left: 12, top: 700, width: 366 })), animate: vi.fn(), remove: vi.fn(), removeAttribute: vi.fn(), setAttribute: vi.fn(), querySelectorAll: () => [], style: {} } }
function environment(reduced = false) {
  const content = surface(), main = surface()
  let dock = null
  vi.stubGlobal('document', { documentElement: { dataset: {} }, visibilityState: 'visible', body: { append: vi.fn() }, querySelector: vi.fn(selector => selector === '.qt-workout-controls' ? dock : selector === '#training-main' ? main : content) })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) })
  return { content, main, setDock: value => { dock = value } }
}
afterEach(() => { vi.runAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })
describe('interactive view transitions', () => {
  it('animates content without transforming or disabling the persistent main landmark', () => {
    vi.useFakeTimers()
    const { content, main } = environment(), update = vi.fn()
    transitionView(update)
    expect(update).toHaveBeenCalledOnce()
    expect(main.animate).not.toHaveBeenCalled()
    expect(main.classList.add).not.toHaveBeenCalled()
    expect(content.classList.add).toHaveBeenCalledWith('qt-content-enter')
    expect(content.inert).not.toBe(true)
    expect(document.body.append).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(content.classList.remove).toHaveBeenCalledWith('qt-content-enter', 'qt-dock-enter')
  })
  it('cleans interrupted navigation and reverses direction', () => {
    vi.useFakeTimers()
    const { content } = environment()
    transitionView(() => {})
    transitionView(() => {}, 'back')
    expect(content.classList.remove).toHaveBeenCalledWith('qt-content-enter', 'qt-dock-enter')
    expect(document.documentElement.dataset.motion).toBe('back')
  })
  it('honors reduced motion', () => {
    vi.useFakeTimers()
    const { content } = environment(true), update = vi.fn()
    transitionView(update)
    expect(update).toHaveBeenCalledOnce()
    expect(content.classList.add).not.toHaveBeenCalled()
  })
  it('slides docks without locking live controls and cleans the departing visual', () => {
    vi.useFakeTimers()
    const env = environment(), old = surface(), ghost = surface(), next = surface()
    old.cloneNode = () => ghost
    env.setDock(old)
    transitionView(() => env.setDock(next))
    expect(ghost.inert).toBe(true)
    expect(next.inert).not.toBe(true)
    expect(next.classList.add).toHaveBeenCalledWith('qt-dock-enter')
    expect(document.body.append).toHaveBeenCalledWith(ghost)
    vi.runAllTimers()
    expect(ghost.remove).toHaveBeenCalledOnce()
  })
})
