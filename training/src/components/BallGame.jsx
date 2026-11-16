import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SoccerBall from './SoccerBall.jsx'
import { advanceBall, BALL_RADIUS, centeredBall, kickFromPull } from '../domain/ball-game.js'
import '../styles/ball-game.css'

export default function BallGame({ score, setScore, onClose }) {
  const field = useRef(null),
    ball = useRef(null),
    body = useRef(null),
    pull = useRef(null)
  const size = useRef({ width: 0, height: 0 }),
    cooldown = useRef(0),
    dragged = useRef(false)
  const [closing, setClosing] = useState(false)
  const close = () => setClosing(true)
  useLayoutEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow
    const root = document.getElementById('root')
    const wasInert = root?.inert
    if (root) root.inert = true
    document.body.style.overflow = 'hidden'
    ball.current.focus()
    let frame,
      last = performance.now()
    const paint = () => {
      const b = body.current
      ball.current.style.transform = `translate(${b.x - BALL_RADIUS}px, ${b.y - BALL_RADIUS}px) rotate(${b.angle}deg)`
    }
    const resize = () => {
      size.current = { width: field.current.clientWidth, height: field.current.clientHeight }
      body.current = centeredBall(size.current)
      pull.current = null
      paint()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(field.current)
    const tick = (now) => {
      const dt = document.hidden ? 0 : (now - last) / 1000
      last = now
      if (!pull.current && now > cooldown.current) {
        const next = advanceBall(body.current, dt, size.current)
        body.current = next.ball
        if (next.goal) {
          setScore((old) => ({ ...old, [next.goal]: old[next.goal] + 1 }))
          cooldown.current = now + 700
        }
        paint()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.body.style.overflow = overflow
      if (root) root.inert = wasInert
      previous?.focus?.({ preventScroll: true })
    }
  }, [setScore])
  useLayoutEffect(() => {
    if (!closing) return
    const timer = setTimeout(onClose, 320)
    return () => clearTimeout(timer)
  }, [closing, onClose])
  return createPortal(
    <div
      ref={field}
      className={`pb-night-game${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Soccer game"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
      }}
    >
      <div className="pb-night-goal pb-night-goal--blue" aria-label={`Blue goal: ${score.blue}`}>
        <strong>{score.blue}</strong>
      </div>
      <div className="pb-night-goal pb-night-goal--gold" aria-label={`Gold goal: ${score.gold}`}>
        <strong>{score.gold}</strong>
      </div>
      <button
        ref={ball}
        className="pb-kick-ball pb-night-ball"
        aria-label="Soccer ball: drag to kick, tap to close"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return
          dragged.current = false
          body.current.vx = 0
          body.current.vy = 0
          pull.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (
            pull.current?.id === event.pointerId &&
            Math.hypot(event.clientX - pull.current.x, event.clientY - pull.current.y) > 6
          )
            dragged.current = true
        }}
        onPointerUp={(event) => {
          if (pull.current?.id !== event.pointerId) return
          const shot = kickFromPull(event.clientX - pull.current.x, event.clientY - pull.current.y)
          pull.current = null
          if (shot && dragged.current) {
            body.current.vx = shot.x * shot.power * 1500
            body.current.vy = shot.y * shot.power * 1500
          }
        }}
        onPointerCancel={() => {
          pull.current = null
          dragged.current = true
        }}
        onClick={(event) => {
          if (event.detail === 0 || !dragged.current) close()
        }}
      >
        <SoccerBall />
      </button>
    </div>,
    document.body
  )
}
