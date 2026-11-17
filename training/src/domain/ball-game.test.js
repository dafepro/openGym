import { describe, expect, it } from 'vitest'
import { advanceBall, centeredBall, aimFromContact, shoveBall } from './ball-game.js'

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
  it('caps a strong diagonal kick without bending its direction', () => {
    const next = advanceBall({ ...centeredBall(size), vx: 1200, vy: -600 }, 0.01, size)
    expect(next.ball.vx / next.ball.vy).toBeCloseTo(-2)
    expect(Math.hypot(next.ball.vx, next.ball.vy)).toBeLessThanOrEqual(900)
  })
  it('limits elapsed time so returning to a background tab cannot simulate unseen play', () => {
    const body = { ...centeredBall(size), vx: 400, vy: 100 }
    expect(advanceBall(body, 20, size)).toEqual(advanceBall(body, 0.05, size))
  })
  it('aims opposite the pull and reaches full force near a screen edge', () => {
    const center = { x: 160, y: 400 }
    expect(aimFromContact(center, center, { x: 160, y: 403 }, size)).toBeNull()
    expect(aimFromContact(center, center, { x: 160, y: 439 }, size)).toMatchObject({
      x: 0,
      y: -1,
      power: expect.any(Number)
    })
    expect(aimFromContact(center, center, { x: 160, y: 440 }, size).power).toBe(1)
  })
})

describe('contact nudges', () => {
  it('pushes away from either touched side without relocating the ball', () => {
    const ball = { ...centeredBall(size), vx: 50 }
    const left = shoveBall(ball, { x: ball.x - 15, y: ball.y }, size)
    const right = shoveBall(ball, { x: ball.x + 15, y: ball.y }, size)
    expect(left).toMatchObject({ x: ball.x, y: ball.y, vx: 470, vy: 0 })
    expect(right.vx).toBe(-370)
    expect(ball.vx).toBe(50)
  })
  it('gives a centered touch a usable direction', () => {
    const center = centeredBall(size)
    expect(shoveBall(center, center, size).vy).toBeLessThan(0)
    const corner = { ...center, x: 280, y: 60 }
    expect(shoveBall(corner, corner, size)).toMatchObject({ vx: expect.any(Number), vy: expect.any(Number) })
    expect(shoveBall(corner, corner, size).vx).toBeLessThan(0)
    expect(shoveBall(corner, corner, size).vy).toBeGreaterThan(0)
  })
})
