// @vitest-environment happy-dom
// These tests simulate native media notifications; real playback is covered by e2e/media.spec.js.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import DrillDemonstration from './DrillDemonstration.jsx'

const media = { id: 'touches', status: 'approved', path: '/media/touches' }
const button = name => screen.getByRole('button', { name, exact: true })
const mount = () => {
  const result = render(<DrillDemonstration media={media} title="Close touches" />)
  return { ...result, player: result.container.querySelector('video') }
}
beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('demonstration mute intent', () => {
  it.each(['volumechange', 'ratechange', 'seeked'])('retains mute when a native %s notification resets the pipeline', event => {
    const { player } = mount()
    expect(player.muted).toBe(true)
    expect(player.defaultMuted).toBe(true)
    act(() => {
      player.muted = false
      player.dispatchEvent(new Event(event))
    })
    expect(player.muted).toBe(true)
    expect(player.defaultMuted).toBe(true)
    expect(button('Unmute video')).toBeTruthy()
  })

  it('keeps explicit unmute across native changes, and remutes only when requested', () => {
    const { player } = mount()
    fireEvent.click(button('Unmute video'))
    expect(player.muted).toBe(false)
    expect(player.defaultMuted).toBe(false)
    act(() => player.dispatchEvent(new Event('ratechange')))
    expect(player.muted).toBe(false)
    expect(button('Mute video')).toBeTruthy()
    fireEvent.click(button('Mute video'))
    act(() => { player.muted = false; player.dispatchEvent(new Event('volumechange')) })
    expect(player.muted).toBe(true)
    expect(button('Unmute video')).toBeTruthy()
  })

  it('honors native fullscreen audio changes but starts the next demonstration muted', () => {
    const { player, rerender } = mount()
    Object.defineProperty(player, 'webkitDisplayingFullscreen', { configurable: true, value: true })
    act(() => { player.muted = false; player.dispatchEvent(new Event('volumechange')) })
    expect(button('Mute video')).toBeTruthy()
    expect(player.defaultMuted).toBe(false)
    Object.defineProperty(player, 'webkitDisplayingFullscreen', { configurable: true, value: false })
    act(() => player.dispatchEvent(new Event('seeked')))
    expect(player.muted).toBe(false)
    rerender(<DrillDemonstration media={media} title="Next demonstration" />)
    expect(player.muted).toBe(true)
    expect(player.defaultMuted).toBe(true)
    expect(button('Unmute video')).toBeTruthy()
  })
})
