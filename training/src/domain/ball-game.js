export const BALL_RADIUS = 22
export const goalWidth = (width) => Math.min(140, Math.max(88, width * 0.44))
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export const centeredBall = ({ width, height }) => ({ x: width / 2, y: height / 2, vx: 0, vy: 0, angle: 0 })

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
    const speed = Math.hypot(ball.vx, ball.vy)
    const damping = Math.exp(-1.35 * dt) * Math.min(1, 900 / (speed || 1))
    ball.vx *= damping
    ball.vy *= damping
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

// A contact pushes away from the touched side. A centered touch rolls toward
// the available field instead of creating an arbitrary sideways impulse.
export function shoveBall(ball, contact, size) {
  let dx = ball.x - contact.x,
    dy = ball.y - contact.y
  const distance = Math.hypot(dx, dy)
  if (distance < 3) {
    dx = size.width / 2 - ball.x
    dy = size.height / 2 - ball.y
  }
  const length = Math.hypot(dx, dy) || 1
  return {
    ...ball,
    vx: ball.vx + (dx / length) * 420,
    vy: ball.vy + (dx === 0 && dy === 0 ? -420 : (dy / length) * 420)
  }
}

export function aimFromContact(center, start, contact, size) {
  if (Math.hypot(contact.x - start.x, contact.y - start.y) < 6) return null
  const dx = center.x - contact.x,
    dy = center.y - contact.y
  const distance = Math.hypot(dx, dy),
    stretch = distance - BALL_RADIUS
  if (stretch < 6) return null
  const x = dx / distance,
    y = dy / distance
  const room = Math.min(
    x < 0 ? (size.width - center.x) / -x : x > 0 ? center.x / x : Infinity,
    y < 0 ? (size.height - center.y) / -y : y > 0 ? center.y / y : Infinity
  )
  const maxPull = Math.max(6, Math.min(108, room - BALL_RADIUS))
  return { x, y, stretch, maxPull, power: Math.min(1, stretch / maxPull) }
}
