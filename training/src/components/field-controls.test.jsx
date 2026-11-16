// @vitest-environment happy-dom

import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import FieldControls from './FieldControls.jsx'
import { fieldCue } from '../domain/field-cues.js'
const state = { phase: 'working', paused: false, visible: true, countdown: true, seconds: 4, identity: 'set1' }
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('field cues', () => {
  it('ticks final seconds once, without catching up missed ticks or changed sets', () => {
    expect(fieldCue(state, { ...state, seconds: 3 })).toBe('count')
    expect(fieldCue(state, state)).toBeNull()
    expect(fieldCue(state, { ...state, seconds: 1 })).toBeNull()
    expect(fieldCue(state, { ...state, seconds: 3, identity: 'set2' })).toBeNull()
  })
  it('suppresses hidden, paused and initial cues', () => {
    expect(fieldCue(null, state)).toBeNull()
    expect(fieldCue(state, { ...state, seconds: 3, visible: false })).toBeNull()
    expect(fieldCue(state, { ...state, seconds: 3, paused: true })).toBeNull()
    expect(fieldCue({ ...state, visible: false }, state)).toBeNull()
  })
  it('distinguishes work, rest and return-to-phone cues', () => {
    expect(fieldCue({ ...state, phase: 'ready' }, state)).toBe('work')
    expect(fieldCue(state, { ...state, phase: 'rest' })).toBe('rest')
    expect(fieldCue(state, { ...state, phase: 'review' })).toBe('end')
    expect(fieldCue({ ...state, phase: 'rest' }, { ...state, phase: 'ready' })).toBe('end')
  })
})
describe('screen awake lifecycle', () => {
  it('requests only on opt-in and releases on completion', async () => {
    const held = { release: vi.fn().mockResolvedValue(), addEventListener: vi.fn() }
    const request = vi.fn().mockResolvedValue(held)
    vi.stubGlobal('navigator', { wakeLock: { request } })
    const props = { ...state, large: false, onLarge: vi.fn(), active: true }
    const view = render(<FieldControls {...props} />)
    expect(request).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Keep screen awake'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Screen kept awake'))
    expect(request).toHaveBeenCalledWith('screen')
    view.rerender(<FieldControls {...props} active={false} />)
    expect(held.release).toHaveBeenCalledOnce()
  })
  it('releases a pending request resolved after unmount', async () => {
    let resolve
    const release = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', {
      wakeLock: {
        request: () =>
          new Promise((done) => {
            resolve = done
          })
      }
    })
    const view = render(<FieldControls {...state} active onLarge={() => {}} />)
    fireEvent.click(screen.getByText('Keep screen awake'))
    view.unmount()
    resolve({ release })
    await waitFor(() => expect(release).toHaveBeenCalledOnce())
  })
  it('reports unsupported and denied requests accurately', async () => {
    vi.stubGlobal('navigator', {})
    const view = render(<FieldControls {...state} active onLarge={() => {}} />)
    fireEvent.click(screen.getByText('Keep screen awake'))
    expect(screen.getByRole('status').textContent).toContain('unsupported')
    view.unmount()
    vi.stubGlobal('navigator', { wakeLock: { request: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<FieldControls {...state} active onLarge={() => {}} />)
    fireEvent.click(screen.getByText('Keep screen awake'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('unavailable'))
  })
})

describe('browser resource cleanup', () => {
  it('releases while hidden and reacquires only after returning', async () => {
    let visibility = 'visible'
    const getter = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    const held = { release: vi.fn().mockResolvedValue(), addEventListener: vi.fn() }
    const request = vi.fn().mockResolvedValue(held)
    vi.stubGlobal('navigator', { wakeLock: { request } })
    render(<FieldControls {...state} active onLarge={() => {}} />)
    fireEvent.click(screen.getByText('Keep screen awake'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Screen kept awake'))
    visibility = 'hidden'
    fireEvent(document, new Event('visibilitychange'))
    expect(held.release).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledOnce()
    visibility = 'visible'
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    getter.mockRestore()
  })
  it('unlocks audio only on a tap, cancels queued tones when hidden and closes on exit', async () => {
    const oscillators = []
    const context = {
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: vi.fn().mockResolvedValue(),
      close: vi.fn().mockResolvedValue(),
      createOscillator: () => {
        const tone = { frequency: {}, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }
        oscillators.push(tone)
        return tone
      },
      createGain: () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
      })
    }
    const Audio = vi.fn(function () {
      return context
    })
    vi.stubGlobal('AudioContext', Audio)
    const view = render(<FieldControls {...state} active onLarge={() => {}} />)
    expect(Audio).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Audible cues'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Sound ready'))
    expect(oscillators).toHaveLength(2)
    fireEvent(document, new Event('visibilitychange'))
    expect(oscillators[0].stop).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByText('Audible cues'))
    expect(screen.getByRole('status').textContent).toContain('Sound off')
    view.unmount()
    expect(context.close).toHaveBeenCalledOnce()
  })
})
