import { describe, expect, it } from 'vitest'
import { advanceBall, centeredBall, kickFromPull, tiltForce } from './ball-game.js'

const size = { width: 320, height: 440 }
describe('flat-pitch ball physics', () => {
  it('has no downward gravity when no tilt or kick is applied', () => {
    const start = centeredBall(size)
    expect(advanceBall(start, 0.05, size)).toEqual({ ball: start, goal: null })
  })
  it('slows a kicked ball and bounces off a side wall', () => {
    const start = { ...centeredBall(size), x: 297, vx: 500 }
    const next = advanceBall(start, 0.05, size)
    expect(next.goal).toBeNull()
    expect(next.ball.vx).toBeLessThan(0)
    expect(Math.abs(next.ball.vx)).toBeLessThan(500)
    expect(next.ball.x).toBeLessThanOrEqual(298)
    expect(start.vx).toBe(500)
  })
  it.each([
    ['blue', 23, -900],
    ['gold', 417, 900]
  ])('scores once in the %s goal, then resets with no residual velocity', (goal, y, vy) => {
    const next = advanceBall({ ...centeredBall(size), y, vy }, 0.05, size)
    expect(next).toEqual({ ball: centeredBall(size), goal })
    expect(advanceBall(next.ball, 0.05, size).goal).toBeNull()
  })
  it('bounces outside the mouth and does not count a ball that clips a post', () => {
    for (const x of [23, 100]) {
      const next = advanceBall({ ...centeredBall(size), x, y: 23, vy: -900 }, 0.05, size)
      expect(next.goal).toBeNull()
      expect(next.ball.vy).toBeGreaterThan(0)
    }
  })
  it('limits elapsed time so returning to a background tab cannot simulate unseen play', () => {
    const body = { ...centeredBall(size), vx: 400, vy: 100 }
    expect(advanceBall(body, 20, size)).toEqual(advanceBall(body, 0.05, size))
  })
  it('pulls in the opposite direction and caps kick strength', () => {
    expect(kickFromPull(0, 3)).toBeNull()
    expect(kickFromPull(0, 200)).toEqual({ x: -0, y: -1, power: 1 })
    expect(kickFromPull(-50, 0)).toMatchObject({ x: 1, power: 0.5 })
  })
})

describe('calibrated screen-relative tilt', () => {
  const neutral = { beta: 30, gamma: 5 }
  it('treats the current hold as flat and ignores small sensor noise', () => {
    expect(tiltForce(30, 5, neutral)).toEqual({ x: 0, y: 0 })
    expect(tiltForce(31, 5.5, neutral)).toEqual({ x: 0, y: 0 })
    expect(tiltForce(null, 5, neutral)).toEqual({ x: 0, y: 0 })
  })
  it('maps rightward portrait tilt to the correct landscape direction', () => {
    expect(tiltForce(30, 15, neutral)).toEqual({ x: 260, y: 0 })
    const rotated = tiltForce(30, 15, neutral, 90)
    expect(rotated.x).toBeCloseTo(0)
    expect(rotated.y).toBeCloseTo(-260)
  })
  it('bounds extreme tilt and handles the beta angle wrapping around', () => {
    expect(tiltForce(90, 85, neutral)).toEqual({ x: 520, y: 520 })
    expect(tiltForce(-179, 0, { beta: 179, gamma: 0 }).y).toBe(52)
  })
})
