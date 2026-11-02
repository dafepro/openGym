import { describe, expect, it } from 'vitest'
import { createTargetCounter, validateTargets } from './targets.js'

const zones = [{ x: 0.25, y: 0.5, radius: 0.09 }, { x: 0.75, y: 0.5, radius: 0.09 }]
const ball = (x, y = 0.5, confidence = 0.95) => ({ x, y, radius: 0.04, confidence })
const stable = (counter, x, start, y = 0.5) => [0, 100, 200].map(offset => counter.update(ball(x, y), start + offset)).at(-1)
function transit(counter, from, to, start) {
  counter.update(ball(from + (to - from) / 3), start)
  counter.update(ball(from + (to - from) * 2 / 3), start + 100)
  return stable(counter, to, start + 200)
}

describe('alternating observed target arrivals', () => {
  it('arms stationary at either initial target, then counts only stable alternating arrivals', () => {
    const counter = createTargetCounter(zones)
    expect(stable(counter, 0.25, 0)).toEqual({ count: 0, expectedTarget: 1, tracking: 'tracking' })
    expect(transit(counter, 0.25, 0.75, 300)).toEqual({ count: 1, expectedTarget: 0, tracking: 'tracking' })
    expect(transit(counter, 0.75, 0.25, 800).count).toBe(2)
    counter.reset()
    expect(stable(counter, 0.75, 0).expectedTarget).toBe(0)
    expect(transit(counter, 0.75, 0.25, 300).count).toBe(1)
  })

  it('does not count stationary jitter, repeated wrong targets, brief target passes or one exit frame', () => {
    const counter = createTargetCounter(zones)
    stable(counter, 0.25, 0)
    for (let t = 300; t <= 3000; t += 100) expect(counter.update(ball(0.25 + Math.sin(t) * 0.02), t).count).toBe(0)
    counter.update(ball(0.39), 3100)
    counter.update(ball(0.25), 3200)
    counter.update(ball(0.75), 3300)
    expect(counter.update(ball(0.25), 3400).count).toBe(0)
    expect(stable(counter, 0.25, 3500).count).toBe(0)
    counter.update(ball(0.5), 3800)
    counter.update(ball(0.6), 3900)
    counter.update(ball(0.75), 4000)
    expect(counter.update(ball(0.5), 4100).count).toBe(0)
  })

  it('requires elapsed dwell, three observed frames and the minimum interval', () => {
    const counter = createTargetCounter(zones, { minIntervalMs: 800 })
    counter.update(ball(0.25), 0)
    expect(counter.update(ball(0.25), 200).tracking).toBe('acquiring')
    expect(counter.update(ball(0.25), 210).tracking).toBe('tracking')
    counter.update(ball(0.5), 300)
    counter.update(ball(0.6), 400)
    expect(stable(counter, 0.75, 500).count).toBe(0)
    expect(counter.update(ball(0.75), 900).count).toBe(0)
    expect(counter.update(ball(0.75), 1010).count).toBe(1)
  })

  it.each(['occlusion', 'low confidence', 'long frame gap'])('requires a fresh unscored arm after %s', kind => {
    const counter = createTargetCounter(zones)
    stable(counter, 0.25, 0)
    if (kind === 'occlusion') expect(counter.update(null, 300).tracking).toBe('lost')
    if (kind === 'low confidence') expect(counter.update(ball(0.5, 0.5, 0.2), 300).tracking).toBe('lost')
    const start = kind === 'long frame gap' ? 1000 : 400
    expect(stable(counter, 0.75, start)).toEqual({ count: 0, expectedTarget: 0, tracking: 'tracking' })
    expect(transit(counter, 0.75, 0.25, start + 300).count).toBe(1)
    expect(counter.update(null, start + 800).count).toBe(1)
    expect(stable(counter, 0.75, start + 900).count).toBe(1)
  })

  it('does not bridge dwell across loss and cannot earn a point during reacquisition', () => {
    const counter = createTargetCounter(zones)
    stable(counter, 0.25, 0)
    counter.update(ball(0.5), 300)
    counter.update(ball(0.6), 400)
    counter.update(ball(0.75), 500)
    counter.update(ball(0.75), 600)
    counter.update(null, 650)
    expect(counter.update(ball(0.75), 700)).toMatchObject({ count: 0, expectedTarget: null, tracking: 'acquiring' })
    expect(counter.update(ball(0.75), 800).expectedTarget).toBeNull()
    expect(counter.update(ball(0.75), 900)).toMatchObject({ count: 0, expectedTarget: 0 })
  })

  it('rejects stale/repeated/invalid timestamps instead of accumulating frame evidence', () => {
    for (const invalid of [NaN, Infinity, -1, 200, 100]) {
      const counter = createTargetCounter(zones)
      stable(counter, 0.25, 0)
      expect(counter.update(ball(0.75), invalid)).toEqual({ count: 0, expectedTarget: null, tracking: 'lost' })
      expect(stable(counter, 0.75, 300).count).toBe(0)
    }
  })

  it('uses image aspect ratio for circular targets and verifies actual camera geometry', () => {
    const vertical = [{ x: 0.5, y: 0.25, radius: 0.08 }, { x: 0.5, y: 0.75, radius: 0.08 }]
    const counter = createTargetCounter(vertical, { aspectRatio: 2 })
    expect(stable(counter, 0.5, 0, 0.39).expectedTarget).toBe(1) // 0.14 height = 0.07 image widths.
    expect(stable(counter, 0.5, 300, 0.5).count).toBe(0)
    expect(stable(counter, 0.5, 600, 0.75).count).toBe(1)
    expect(() => createTargetCounter(vertical, { aspectRatio: 4 })).toThrow(/inside/)
    const portrait = createTargetCounter(vertical, { aspectRatio: 0.5 })
    expect(stable(portrait, 0.5, 0, 0.3).expectedTarget).toBeNull() // 0.05 height = 0.10 image widths.
  })

  it('validates calibration, configuration and malformed detections, and copies target inputs', () => {
    for (const invalid of [null, [], [zones[0]], [...zones, zones[0]], [zones[0], zones[0]], [{ ...zones[0], x: NaN }, zones[1]], [{ ...zones[0], radius: -1 }, zones[1]]]) {
      expect(validateTargets(invalid)).toBe(false)
      expect(() => createTargetCounter(invalid)).toThrow(/target/)
    }
    expect(validateTargets(zones)).toBe(true)
    expect(() => createTargetCounter([{ ...zones[0], x: 0.01 }, zones[1]])).toThrow(/inside/)
    for (const options of [{ aspectRatio: 0 }, { minConfidence: NaN }, { dwellMs: -1 }, { maxGapMs: Infinity }, { minIntervalMs: 1 }]) expect(() => createTargetCounter(zones, options)).toThrow(/settings/)
    const mutable = zones.map(z => ({ ...z })), counter = createTargetCounter(mutable)
    mutable[0].x = 0.6
    expect(stable(counter, 0.25, 0).expectedTarget).toBe(1)
    const invalidDetections = [{ ...ball(0.5), x: 2 }, { ...ball(0.5), radius: NaN }, { ...ball(0.5), confidence: Infinity }]
    invalidDetections.forEach((invalid, index) => expect(counter.update(invalid, 300 + index * 100)).toMatchObject({ count: 0, tracking: 'lost' }))
    expect(counter.reset()).toEqual({ count: 0, expectedTarget: null, tracking: 'acquiring' })
  })
})
