import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const GRAVITY = 1500
const DEAD_ZONE = 6
const HOME_ANGLE = -12
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)')

function bounds() {
  const viewport = window.visualViewport
  const left = (viewport?.offsetLeft ?? 0) + 6
  const top = (viewport?.offsetTop ?? 0) + 6
  const width = viewport?.width ?? innerWidth
  const height = viewport?.height ?? innerHeight
  return {
    left,
    top,
    right: left + width - 56,
    floor: top + height - 64,
    width,
    height,
  }
}

// Distance to the visible edge along this direction. A pull from the floor
// or a side wall can still reach full power on a touchscreen.
function edgeDistance(x, y, dx, dy, { left, top, width, height }) {
  return Math.min(
    dx > 0 ? (left + width - 12 - x) / dx : dx < 0 ? (left - x) / dx : Infinity,
    dy > 0 ? (top + height - 12 - y) / dy : dy < 0 ? (top - y) / dy : Infinity,
  )
}

function aimFrom(drag, event) {
  const dx = drag.x - event.clientX
  const dy = drag.y - event.clientY
  const distance = Math.hypot(dx, dy)
  if (distance < DEAD_ZONE) return null
  const x = dx / distance
  const y = dy / distance
  const room = edgeDistance(drag.x, drag.y, -x, -y, bounds())
  const maxPull = Math.max(16, Math.min(108, room))
  return { x, y, power: Math.min(1, distance / maxPull) }
}

export default function KickableBall() {
  const home = useRef(null)
  const parked = useRef(null)
  const ball = useRef(null)
  const arrow = useRef(null)
  const drag = useRef(null)
  const dragged = useRef(false)
  const motion = useRef(null)
  const frame = useRef(0)
  const restoreFocus = useRef(false)
  const [loose, setLoose] = useState(false)

  const paint = () => {
    const m = motion.current
    if (!ball.current || !m) return
    ball.current.style.transform = `translate3d(${m.x}px, ${m.y}px, 0) rotate(${m.angle}deg)`
    ball.current.dataset.moving = String(m.moving)
  }

  const tick = (now) => {
    const m = motion.current
    if (!m) return
    const dt = Math.min((now - m.last) / 1000, 0.032)
    m.last = now
    const { left, top, right, floor } = bounds()
    m.vy += GRAVITY * dt
    m.x += m.vx * dt
    m.y += m.vy * dt
    if (m.x < left || m.x > right) {
      m.x = Math.max(left, Math.min(right, m.x))
      m.vx *= -0.72
    }
    if (m.y < top) {
      m.y = top
      m.vy = Math.abs(m.vy) * 0.65
    }
    if (m.y >= floor) {
      m.y = floor
      m.vy = Math.abs(m.vy) < 100 ? 0 : -Math.abs(m.vy) * 0.5
      m.vx *= Math.exp(-3.4 * dt)
    } else m.vx *= Math.exp(-0.15 * dt)
    m.angle += ((m.vx * dt) / 22) * (180 / Math.PI)
    m.moving = !(m.y === floor && m.vy === 0 && Math.abs(m.vx) < 8)
    paint()
    if (m.moving) frame.current = requestAnimationFrame(tick)
  }

  const hideArrow = () => {
    if (arrow.current) arrow.current.style.visibility = 'hidden'
  }

  const reset = () => {
    cancelAnimationFrame(frame.current)
    motion.current = null
    drag.current = null
    hideArrow()
    setLoose(false)
  }

  const returnHome = () => {
    const m = motion.current
    if (!m || m.returning) return
    restoreFocus.current = document.activeElement === ball.current
    cancelAnimationFrame(frame.current)
    const origin = home.current.getBoundingClientRect()
    if (
      reducedMotion().matches ||
      origin.bottom < 0 ||
      origin.top > innerHeight
    ) {
      reset()
      return
    }
    const start = performance.now()
    const { x, y, angle } = m
    // Unwind to the resting angle by the shortest path.
    const angleDelta = ((((HOME_ANGLE - angle) % 360) + 540) % 360) - 180
    m.returning = true
    m.moving = true
    ball.current.dataset.returning = 'true'
    const slide = (now) => {
      const progress = Math.min(1, (now - start) / 300)
      const eased = 1 - (1 - progress) ** 3
      const destination = home.current.getBoundingClientRect()
      m.x = x + (destination.left - x) * eased
      m.y = y + (destination.top - y) * eased
      m.angle = angle + angleDelta * eased
      paint()
      if (progress < 1) frame.current = requestAnimationFrame(slide)
      else reset()
    }
    frame.current = requestAnimationFrame(slide)
  }

  const launch = (target, { x, y, power }, keyboard = false) => {
    if (reducedMotion().matches) {
      target.animate?.(
        [
          { transform: 'rotate(-12deg)' },
          { transform: 'rotate(8deg)' },
          { transform: 'rotate(-12deg)' },
        ],
        { duration: 180 },
      )
      return
    }
    const origin = home.current.getBoundingClientRect()
    const previous = motion.current
    const { floor, top } = bounds()
    // A straight, full-power shot can hit the ceiling even from the floor.
    const speed = power * Math.sqrt(2 * GRAVITY * (floor - top + 100))
    cancelAnimationFrame(frame.current)
    motion.current = {
      x: previous?.x ?? origin.left,
      y: previous?.y ?? origin.top,
      angle: previous?.angle ?? HOME_ANGLE,
      vx: x * speed,
      vy: y * speed,
      moving: true,
      last: performance.now(),
    }
    if (loose) {
      paint()
      frame.current = requestAnimationFrame(tick)
    } else {
      restoreFocus.current = keyboard
      setLoose(true)
    }
  }

  useLayoutEffect(() => {
    if (loose) {
      paint()
      if (restoreFocus.current) ball.current?.focus({ preventScroll: true })
      frame.current = requestAnimationFrame(tick)
    } else if (restoreFocus.current)
      parked.current?.focus({ preventScroll: true })
    restoreFocus.current = false
    return () => cancelAnimationFrame(frame.current)
  }, [loose])

  useEffect(() => {
    const preference = reducedMotion()
    window.addEventListener('resize', reset)
    preference.addEventListener('change', reset)
    return () => {
      cancelAnimationFrame(frame.current)
      window.removeEventListener('resize', reset)
      preference.removeEventListener('change', reset)
    }
  }, [])

  const beginPull = (event) => {
    if (!event.isPrimary || event.button !== 0 || motion.current?.returning)
      return
    dragged.current = false
    const rect = event.currentTarget.getBoundingClientRect()
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    cancelAnimationFrame(frame.current)
  }

  const showPull = (event) => {
    const pull = drag.current
    if (pull?.id !== event.pointerId) return
    const aim = aimFrom(pull, event)
    if (!aim) {
      hideArrow()
      return
    }
    const { x, y, power } = aim
    const length = 26 + 84 * power
    const room = edgeDistance(pull.centerX, pull.centerY, x, y, bounds())
    const start = Math.min(16, room - length)
    const guide = arrow.current
    guide.style.width = `${length}px`
    guide.style.left = `${pull.centerX + x * start}px`
    guide.style.top = `${pull.centerY + y * start - 9}px`
    guide.style.transform = `rotate(${Math.atan2(y, x)}rad)`
    guide.style.color = `hsl(${118 * (1 - power)} 73% ${34 + 11 * power}%)`
    guide.style.visibility = 'visible'
  }

  const endPull = (event, canceled = false) => {
    const pull = drag.current
    if (pull?.id !== event.pointerId) return
    drag.current = null
    hideArrow()
    const aim = canceled ? null : aimFrom(pull, event)
    if (aim) {
      dragged.current = true
      launch(event.currentTarget, aim)
    } else if (motion.current?.moving) {
      motion.current.last = performance.now()
      frame.current = requestAnimationFrame(tick)
    }
  }

  const control = (floating) => (
    <button
      ref={floating ? ball : parked}
      type="button"
      className={`pb-kick-ball${floating ? ' is-loose' : ''}`}
      aria-label={floating ? 'Return soccer ball' : 'Kick the soccer ball'}
      aria-description={
        floating
          ? 'Tap to return it, or pull back and release to kick again.'
          : 'Pull back and release to kick.'
      }
      onPointerDown={beginPull}
      onPointerMove={showPull}
      onPointerUp={endPull}
      onPointerCancel={(event) => endPull(event, true)}
      onLostPointerCapture={(event) => endPull(event, true)}
      onClick={(event) => {
        // Returning on pointerup can send the touch's click to the UI underneath.
        if (floating && (event.detail === 0 || !dragged.current)) returnHome()
        else if (!floating && event.detail === 0)
          launch(event.currentTarget, { x: -0.7, y: -0.7, power: 0.55 }, true)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && floating) returnHome()
      }}
    >
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".3"
        />
        <g fill="currentColor">
          <path d="m22 13 8.6 6.3-3.3 10.2H16.7l-3.3-10.2ZM18 2.4h8L28 7l-6 3-6-3ZM3.5 13l4.8-.5 1.2 6.7L4 22.5 2 18ZM40.5 13l1.5 5-2 4.5-5.5-3.3 1.2-6.7ZM9 37l2-5 6 1 1.5 7.5-5-1ZM35 37l-4.5 2.5-5 1L27 33l6-1Z" />
        </g>
        <path
          d="m22 10v3M9.5 19.2l3.9.1m17.2 0 3.9-.1M17 33l-.3-3.5m10.6 0L27 33M8.3 12.5 16 7m12 0 7.7 5.5M4 22.5 11 32m22 0 7-9.5M18.5 40.5h7"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".45"
          strokeWidth="1.2"
        />
      </svg>
    </button>
  )

  return (
    <span className="pb-ball-home" ref={home}>
      {!loose && control(false)}
      {loose && createPortal(control(true), document.body)}
      {typeof document !== 'undefined' &&
        createPortal(
          <svg
            ref={arrow}
            className="pb-kick-aim"
            viewBox="0 0 110 18"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 5.5h89V0l21 9-21 9v-5.5H0Z" fill="currentColor" />
          </svg>,
          document.body,
        )}
    </span>
  )
}
