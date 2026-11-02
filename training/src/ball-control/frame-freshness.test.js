import { describe, expect, it } from 'vitest'
import { createFrameFreshness } from './frame-freshness.js'
describe('camera frame freshness', () => {
  it('does not turn repeated render ticks into camera observations', () => {
    const frame = createFrameFreshness()
    expect(frame.observe(8, 100)).toEqual({ fresh: true, lost: false })
    expect(frame.observe(8, 190)).toEqual({ fresh: false, lost: false })
    expect(frame.observe(8, 280)).toEqual({ fresh: false, lost: false })
    expect(frame.observe(8, 370)).toEqual({ fresh: false, lost: true })
    expect(frame.observe(9, 460)).toEqual({ fresh: true, lost: false })
  })
  it('requires advancing media time, rejecting invalid and backwards tokens', () => {
    const frame = createFrameFreshness()
    expect(frame.observe(null, 0).lost).toBe(true)
    expect(frame.observe(.1, 100).fresh).toBe(true)
    expect(frame.observe(.1, 200).fresh).toBe(false)
    expect(frame.observe(.05, 400).lost).toBe(true)
    expect(frame.observe(.2, 500).fresh).toBe(true)
  })
})
