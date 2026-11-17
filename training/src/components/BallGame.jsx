import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import KickGuide from './KickGuide.jsx'
import SoccerBall from './SoccerBall.jsx'
import { advanceBall, BALL_RADIUS, centeredBall, aimFromContact, shoveBall } from '../domain/ball-game.js'
import '../styles/ball-game.css'

function GoalNet() {
  return (
    <svg className="pb-goal-net" viewBox="0 0 140 72" preserveAspectRatio="none" aria-hidden="true">
      <path className="pb-net-back" d="M16 2 H124 L138 70 H2 Z" />
      <g className="pb-net-mesh">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <path key={n} d={`M${16 + n * 10.8} 2 L${2 + n * 13.6} 70`} />
        ))}
        {[12, 23, 35, 48, 61].map((y) => (
          <path key={y} d={`M${16 - (y * 14) / 70} ${y} H${124 + (y * 14) / 70}`} />
        ))}
        <path d="M2 70 V14 L16 2 M138 70 V14 L124 2 M2 14 H138" />
      </g>
      <path className="pb-net-posts" d="M2 70 V14 H138 V70" />
    </svg>
  )
}

export default function BallGame({ launch, score, setScore, onClose }) {
  const field = useRef(null),
    ball = useRef(null),
    body = useRef(null),
    pull = useRef(null)
  const size = useRef({ width: 0, height: 0 }),
    cooldown = useRef(0),
    dragged = useRef(false)
  const [aim, setAim] = useState(null)
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
      if (!body.current) {
        const start = {
          ...centeredBall(size.current),
          x: Math.max(BALL_RADIUS, Math.min(size.current.width - BALL_RADIUS, launch.x)),
          y: Math.max(BALL_RADIUS, Math.min(size.current.height - BALL_RADIUS, launch.y))
        }
        body.current = launch.shot
          ? { ...start, vx: launch.shot.x * launch.shot.power * 1500, vy: launch.shot.y * launch.shot.power * 1500 }
          : shoveBall(start, { x: launch.touchX, y: launch.touchY }, size.current)
      } else {
        body.current.x = Math.max(BALL_RADIUS, Math.min(size.current.width - BALL_RADIUS, body.current.x))
        body.current.y = Math.max(BALL_RADIUS, Math.min(size.current.height - BALL_RADIUS, body.current.y))
      }
      setAim(null)
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
  }, [setScore, launch])
  useLayoutEffect(() => {
    if (!closing) return
    const timer = setTimeout(onClose, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320)
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
        if (event.key === 'Tab') {
          event.preventDefault()
          const target =
            document.activeElement === ball.current ? field.current.querySelector('.pb-game-close') : ball.current
          target?.focus()
        }
      }}
    >
      <div className="pb-night-goal pb-night-goal--blue" aria-label={`Blue goal: ${score.blue}`}>
        <GoalNet />
        <strong key={score.blue}>{score.blue}</strong>
      </div>
      <div className="pb-night-goal pb-night-goal--gold" aria-label={`Gold goal: ${score.gold}`}>
        <GoalNet />
        <strong key={score.gold}>{score.gold}</strong>
      </div>
      <button className="pb-game-close" aria-label="Close soccer game" onClick={close}>
        ×
      </button>
      <KickGuide aim={aim} center={body.current} />
      <button
        ref={ball}
        className="pb-kick-ball pb-night-ball"
        aria-label="Soccer ball: tap to nudge, pull to aim and kick"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return
          dragged.current = false
          body.current.vx = 0
          body.current.vy = 0
          pull.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (pull.current?.id !== event.pointerId) return
          const next = aimFromContact(body.current, pull.current, { x: event.clientX, y: event.clientY }, size.current)
          if (next) dragged.current = true
          setAim(next)
        }}
        onPointerUp={(event) => {
          if (pull.current?.id !== event.pointerId) return
          const shot = aimFromContact(body.current, pull.current, { x: event.clientX, y: event.clientY }, size.current)
          pull.current = null
          setAim(null)
          if (shot && dragged.current) {
            body.current.vx = shot.x * shot.power * 1500
            body.current.vy = shot.y * shot.power * 1500
          } else if (!dragged.current) {
            body.current = shoveBall(body.current, { x: event.clientX, y: event.clientY }, size.current)
          }
        }}
        onPointerCancel={() => {
          pull.current = null
          dragged.current = true
          setAim(null)
        }}
        onClick={(event) => {
          if (event.detail === 0) body.current = shoveBall(body.current, body.current, size.current)
        }}
      >
        <SoccerBall />
      </button>
    </div>,
    document.body
  )
}
