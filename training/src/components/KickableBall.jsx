import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

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
  }}><Icon name="ball" size={34}/></button>
  return <span className="pb-ball-home">{!loose && control(false)}{loose && createPortal(control(true), document.body)}</span>
}
