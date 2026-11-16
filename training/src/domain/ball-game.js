export const BALL_RADIUS = 22
export const goalWidth = (width) => Math.min(140, Math.max(88, width * 0.44))
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export const centeredBall = ({ width, height }) => ({ x: width / 2, y: height / 2, vx: 0, vy: 0, angle: 0 })

export function kickFromPull(dx, dy) {
  const distance = Math.hypot(dx, dy)
  if (distance < 6) return null
  const power = Math.min(1, distance / 100)
  return { x: -dx / distance, y: -dy / distance, power }
}

// Small bounded steps prevent fast shots tunnelling through a wall or goal.
// A goal requires the whole ball's width to fit between the posts.
export function advanceBall(previous, elapsed, size) {
  const ball = { ...previous }
  const radius = BALL_RADIUS
  const mouthLeft = (size.width - goalWidth(size.width)) / 2 + radius
  const mouthRight = (size.width + goalWidth(size.width)) / 2 - radius
  const total = clamp(elapsed, 0, 0.05)
  const steps = Math.max(1, Math.ceil(total / (1 / 120)))
  const dt = total / steps
  for (let step = 0; step < steps; step++) {
    ball.vx = clamp(ball.vx * Math.exp(-1.35 * dt), -900, 900)
    ball.vy = clamp(ball.vy * Math.exp(-1.35 * dt), -900, 900)
    if (Math.abs(ball.vx) < 2) ball.vx = 0
    if (Math.abs(ball.vy) < 2) ball.vy = 0
    const oldX = ball.x,
      oldY = ball.y
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
    if (ball.y < radius || ball.y > size.height - radius) {
      const top = ball.y < radius
      const line = top ? radius : size.height - radius
      const t = clamp((line - oldY) / (ball.y - oldY), 0, 1)
      const crossingX = oldX + (ball.x - oldX) * t
      if (crossingX >= mouthLeft && crossingX <= mouthRight)
        return { ball: centeredBall(size), goal: top ? 'blue' : 'gold' }
      ball.y = line
      ball.vy = (top ? 1 : -1) * Math.abs(ball.vy) * 0.72
    }
    if (ball.x < radius || ball.x > size.width - radius) {
      ball.x = clamp(ball.x, radius, size.width - radius)
      ball.vx *= -0.72
    }
    ball.angle += (Math.hypot(ball.x - oldX, ball.y - oldY) * (ball.vx < 0 ? -1 : 1) * 180) / (Math.PI * radius)
  }
  return { ball, goal: null }
}
