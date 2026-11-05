import { afterEach, describe, expect, it, vi } from 'vitest'
import { transitionView } from './motion.js'
function surface({ copy = true, children = {} } = {}) {
  const node = { classList: { add: vi.fn(), remove: vi.fn() }, getBoundingClientRect: vi.fn(() => ({ left: 12, top: 100, width: 366, height: 400 })), animate: vi.fn(), remove: vi.fn(), removeAttribute: vi.fn(), setAttribute: vi.fn(), matches: vi.fn(() => false), querySelectorAll: selector => children[selector] || [], style: {} }
  if (copy) { node.copy = surface({ copy: false, children }); node.cloneNode = vi.fn(() => node.copy) }
  return node
}
function environment(reduced = false) {
  let content = surface(), dock = null
  const original = content, main = surface()
  vi.stubGlobal('document', { documentElement: { dataset: {} }, visibilityState: 'visible', body: { append: vi.fn() }, querySelector: vi.fn(selector => selector === '.qt-workout-controls' ? dock : selector === '#training-main' ? main : content) })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) })
  return { content: original, main, setDock: value => { dock = value }, setContent: value => { content = value } }
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
    expect(content.copy.inert).toBe(true)
    expect(content.copy.style.pointerEvents).toBe('none')
    expect(document.body.append).toHaveBeenCalledWith(content.copy)
    vi.runAllTimers()
    expect(content.classList.remove).toHaveBeenCalledWith('qt-content-enter', 'qt-dock-enter')
    expect(content.copy.remove).toHaveBeenCalledOnce()
  })
  it('cleans interrupted navigation and reverses direction', () => {
    vi.useFakeTimers()
    const env = environment(), next = surface()
    transitionView(() => env.setContent(next))
    transitionView(() => {}, 'back')
    expect(env.content.copy.remove).toHaveBeenCalledOnce()
    expect(next.classList.remove).toHaveBeenCalledWith('qt-content-enter', 'qt-dock-enter')
    expect(document.documentElement.dataset.motion).toBe('back')
    vi.runAllTimers()
    expect(next.copy.remove).toHaveBeenCalledOnce()
  })
  it('honors reduced motion without taking snapshots or delaying updates', () => {
    vi.useFakeTimers()
    const { content } = environment(true), update = vi.fn()
    transitionView(update)
    expect(update).toHaveBeenCalledOnce()
    expect(content.classList.add).not.toHaveBeenCalled()
    expect(content.cloneNode).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('slides docks without locking live controls and cleans the departing visual', () => {
    vi.useFakeTimers()
    const env = environment(), old = surface(), next = surface()
    env.setDock(old)
    transitionView(() => env.setDock(next))
    expect(old.copy.inert).toBe(true)
    expect(next.inert).not.toBe(true)
    expect(next.classList.add).toHaveBeenCalledWith('qt-dock-enter')
    expect(document.body.append).toHaveBeenCalledWith(old.copy)
    vi.runAllTimers()
    expect(old.copy.remove).toHaveBeenCalledOnce()
  })
  it('leaves a persistent workout dock stationary through drill changes', () => {
    vi.useFakeTimers()
    const env = environment(), dock = surface()
    env.setDock(dock)
    transitionView(() => {}, 'forward', '.qt-drill-card')
    expect(dock.classList.add).not.toHaveBeenCalled()
    expect(dock.cloneNode).not.toHaveBeenCalled()
  })
  it('strips duplicate IDs, native modals, and playable media from departing visuals', () => {
    vi.useFakeTimers()
    const id = surface(), modal = surface(), source = surface(), video = surface({ children: { source: [source] } })
    const env = environment(), content = surface({ children: { '[id]': [id], dialog: [modal], 'video, audio': [video] } })
    env.setContent(content)
    transitionView(() => {})
    expect(id.removeAttribute).toHaveBeenCalledWith('id')
    expect(modal.remove).toHaveBeenCalledOnce()
    expect(video.removeAttribute).toHaveBeenCalledWith('src')
    expect(video.removeAttribute).toHaveBeenCalledWith('autoplay')
    expect(source.remove).toHaveBeenCalledOnce()
  })
})
