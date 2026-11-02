import { describe, expect, it } from 'vitest'
import { detectBall, sampleBallColor } from './tracker.js'
import { createTargetCounter } from './targets.js'

const ORANGE = [245, 110, 20]
function frame(width = 160, height = 100, background = [55, 60, 65]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set([...background, 255], i)
  return { width, height, data }
}
function paint(image, cx, cy, radius, color = ORANGE) {
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (Math.hypot(x - cx, y - cy) <= radius) image.data.set([...color, 255], (y * image.width + x) * 4)
    }
  }
  return image
}
const profile = () => sampleBallColor(paint(frame(), 40, 50, 10), { x: 40 / 159, y: 50 / 99 })

describe('sampled-color image tracker', () => {
  it('finds the observed compact region with normalized coordinates and width-relative radius', () => {
    const detected = detectBall(paint(frame(), 80, 60, 10), profile())
    expect(detected.x).toBeCloseTo(80.5 / 160, 4)
    expect(detected.y).toBeCloseTo(60.5 / 100, 4)
    expect(detected.radius).toBeCloseTo(10 / 160, 2)
    expect(detected.confidence).toBeGreaterThan(0.9)
    expect(detectBall(frame(), profile(), detected)).toBeNull()
  })

  it('supports hue wraparound, serializable calibration and moderate lighting change', () => {
    const redProfile = JSON.parse(JSON.stringify(sampleBallColor(paint(frame(), 40, 50, 10, [230, 20, 26]), { x: 0.25, y: 0.5 })))
    expect(detectBall(paint(frame(), 50, 50, 10, [130, 15, 10]), redProfile)).not.toBeNull()
    expect(detectBall(paint(frame(), 50, 50, 10, [15, 130, 10]), redProfile)).toBeNull()
  })

  it('rejects gray, dark, transparent, mixed-color and invalid samples with actionable feedback', () => {
    for (const color of [[180, 180, 180], [20, 10, 0], [0, 0, 0]]) {
      expect(() => sampleBallColor(frame(160, 100, color), { x: 0.5, y: 0.5 })).toThrow(/bright|colored/)
    }
    const mixed = frame(160, 100, ORANGE)
    for (let y = 0; y < 100; y++) for (let x = 80; x < 160; x++) mixed.data.set([20, 240, 50, 255], (y * 160 + x) * 4)
    expect(() => sampleBallColor(mixed, { x: 0.5, y: 0.5 })).toThrow(/mixes colors/)
    expect(() => sampleBallColor(frame(), { x: NaN, y: 0.5 })).toThrow(/inside/)
    expect(() => sampleBallColor({ width: 10, height: 10, data: [] }, { x: 0.5, y: 0.5 })).toThrow(/unavailable/)
    const transparent = paint(frame(), 50, 50, 10)
    for (let i = 3; i < transparent.data.length; i += 4) transparent.data[i] = 0
    expect(() => sampleBallColor(transparent, { x: 0.3, y: 0.5 })).toThrow(/colored/)
    expect(detectBall(transparent, profile())).toBeNull()
  })

  it('ignores isolated noise, broad matching floors, thin stripes and clipped regions', () => {
    const noisy = frame()
    for (let i = 0; i < 15; i++) noisy.data.set([...ORANGE, 255], ((i * 17 % 90) * 160 + i * 11 % 150) * 4)
    expect(detectBall(noisy, profile())).toBeNull()
    expect(detectBall(frame(160, 100, ORANGE), profile())).toBeNull()
    const stripe = frame()
    for (let y = 48; y < 52; y++) for (let x = 20; x < 140; x++) stripe.data.set([...ORANGE, 255], (y * 160 + x) * 4)
    expect(detectBall(stripe, profile())).toBeNull()
    expect(detectBall(paint(frame(), 2, 50, 10), profile())).toBeNull()
  })

  it('refuses ambiguous matching objects and uses continuity without inventing missing pixels', () => {
    const previous = detectBall(paint(frame(), 40, 50, 10), profile())
    const two = paint(paint(frame(), 45, 50, 10), 125, 50, 10)
    expect(detectBall(two, profile())).toBeNull()
    expect(detectBall(two, profile(), previous).x).toBeCloseTo(45.5 / 160, 4)
    expect(detectBall(paint(frame(), 125, 50, 10), profile(), previous)).toBeNull()
    // The caller clears previous after loss; reacquisition is real pixels at a new location.
    expect(detectBall(paint(frame(), 125, 50, 10), profile(), null)).not.toBeNull()
    expect(detectBall(frame(), profile(), previous)).toBeNull()
    expect(detectBall(paint(frame(), 45, 50, 25), profile(), previous)).toBeNull()
  })

  it('computes continuity in physical image pixels on portrait and landscape frames', () => {
    for (const [width, height] of [[100, 180], [180, 100]]) {
      const initial = paint(frame(width, height), 50, 50, 8)
      const color = sampleBallColor(initial, { x: 50 / (width - 1), y: 50 / (height - 1) })
      const first = detectBall(initial, color)
      expect(detectBall(paint(frame(width, height), 50, 58, 8), color, first)).not.toBeNull()
      expect(detectBall(paint(frame(width, height), 50, 90, 8), color, first)).toBeNull()
    }
  })

  it('fails closed on malformed profiles and frames', () => {
    expect(detectBall(null, profile())).toBeNull()
    expect(detectBall(frame(), { ...profile(), hue: NaN })).toBeNull()
    expect(detectBall(frame(), { ...profile(), hueTolerance: 1 })).toBeNull()
  })

  it('feeds only visible image observations into alternating arrivals and rearms after occlusion', () => {
    const counter = createTargetCounter([{ x: 0.25, y: 0.5, radius: 0.1 }, { x: 0.75, y: 0.5, radius: 0.1 }], { aspectRatio: 1.6 })
    const color = profile()
    let previous = null, timestamp = 0
    const observe = x => {
      const image = x === null ? frame() : paint(frame(), x, 50, 10)
      previous = detectBall(image, color, previous)
      const result = counter.update(previous, timestamp)
      timestamp += 100
      return result
    }
    for (const x of [40, 40, 40]) expect(observe(x).count).toBe(0)
    for (const x of [56, 72, 88, 104, 120]) expect(observe(x).count).toBe(0)
    expect(observe(120).count).toBe(1)
    expect(observe(120)).toMatchObject({ count: 1, expectedTarget: 0 })
    expect(observe(null)).toMatchObject({ count: 1, expectedTarget: null, tracking: 'lost' })
    for (const x of [40, 40, 40]) expect(observe(x).count).toBe(1)
    for (const x of [56, 72, 88, 104, 120, 120]) observe(x)
    expect(observe(120)).toMatchObject({ count: 2, expectedTarget: 0 })
  })
})
