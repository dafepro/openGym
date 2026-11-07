import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// A single small hit target: the rest of the page remains fully interactive.
export default function KickableBall() {
  const home = useRef(null), ball = useRef(null), motion = useRef(null), frame = useRef(0)
  const [loose, setLoose] = useState(false)
  const keyboard = useRef(false)
  const paint = () => {
    const m = motion.current
    if (!ball.current || !m) return
    ball.current.style.transform = `translate3d(${m.x}px, ${m.y}px, 0) rotate(${m.angle}deg)`
    ball.current.dataset.moving = String(m.moving)
  }
  const tick = now => {
    const m = motion.current
    const dt = Math.min((now - m.last) / 1000, 0.032)
    m.last = now
    const viewport = window.visualViewport
    const left = (viewport?.offsetLeft || 0) + 6, top = (viewport?.offsetTop || 0) + 6
    const right = left + (viewport?.width || innerWidth) - 56
    const floor = top + (viewport?.height || innerHeight) - 64
    m.vy += 1500 * dt
    m.x += m.vx * dt; m.y += m.vy * dt
    if (m.x < left || m.x > right) { m.x = Math.max(left, Math.min(right, m.x)); m.vx *= -0.72 }
    if (m.y < top) { m.y = top; m.vy = Math.abs(m.vy) * 0.65 }
    if (m.y >= floor) {
      m.y = floor
      m.vy = Math.abs(m.vy) < 100 ? 0 : -Math.abs(m.vy) * 0.5
      m.vx *= Math.exp(-3.4 * dt)
    } else m.vx *= Math.exp(-0.15 * dt)
    m.angle += m.vx * dt / 22 * 180 / Math.PI
    m.moving = !(m.y === floor && m.vy === 0 && Math.abs(m.vx) < 8)
    paint()
    if (m.moving) frame.current = requestAnimationFrame(tick)
  }
  const kick = event => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      event.currentTarget.animate?.([{ transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }, { transform: 'rotate(-12deg)' }], { duration: 180 })
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    keyboard.current = event.detail === 0
    const direction = rect.x + rect.width / 2 < innerWidth / 2 ? 1 : -1
    cancelAnimationFrame(frame.current)
    motion.current = { x: rect.x, y: rect.y, vx: direction * (320 + Math.random() * 180), vy: -650, angle: motion.current?.angle || -12, last: performance.now(), moving: true }
    if (!loose) setLoose(true)
    else { paint(); frame.current = requestAnimationFrame(tick) }
  }
  useLayoutEffect(() => {
    if (!loose) return
    paint()
    if (keyboard.current) ball.current?.focus({ preventScroll: true })
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [loose])
  useEffect(() => {
    const reset = () => { cancelAnimationFrame(frame.current); motion.current = null; setLoose(false) }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    window.addEventListener('resize', reset)
    reduced.addEventListener('change', reset)
    return () => { cancelAnimationFrame(frame.current); window.removeEventListener('resize', reset); reduced.removeEventListener('change', reset) }
  }, [])
  const control = floating => <button ref={floating ? ball : home} type="button" className={`pb-kick-ball${floating ? ' is-loose' : ''}`} aria-label="Kick the soccer ball" onClick={kick} onKeyDown={event => {
    if (event.key === 'Escape' && loose) { cancelAnimationFrame(frame.current); setLoose(false); requestAnimationFrame(() => home.current?.focus({ preventScroll: true })) }
  }}><svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeOpacity=".3"/><g fill="currentColor"><path d="m22 13 8.6 6.3-3.3 10.2H16.7l-3.3-10.2ZM18 2.4h8L28 7l-6 3-6-3ZM3.5 13l4.8-.5 1.2 6.7L4 22.5 2 18ZM40.5 13l1.5 5-2 4.5-5.5-3.3 1.2-6.7ZM9 37l2-5 6 1 1.5 7.5-5-1ZM35 37l-4.5 2.5-5 1L27 33l6-1Z"/></g><path d="m22 10v3M9.5 19.2l3.9.1m17.2 0 3.9-.1M17 33l-.3-3.5m10.6 0L27 33M8.3 12.5 16 7m12 0 7.7 5.5M4 22.5 11 32m22 0 7-9.5M18.5 40.5h7" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.2"/></svg></button>
  return <span className="pb-ball-home">{!loose && control(false)}{loose && createPortal(control(true), document.body)}</span>
}
