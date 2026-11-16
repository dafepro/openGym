import { useLayoutEffect, useId, useRef, useState } from 'react'
import Dialog from './Dialog.jsx'
import SoccerBall from './SoccerBall.jsx'
import useBallTilt from '../controllers/useBallTilt.js'
import { advanceBall, BALL_RADIUS, centeredBall, kickFromPull } from '../domain/ball-game.js'
import '../styles/ball-game.css'

const directions = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
const sensorMessage = {
  off: 'Flat pitch. Pull back and release, or use the arrows.',
  requesting: 'Waiting for motion permission…',
  waiting: 'Hold the phone comfortably while tilt connects…',
  active: 'Tilt to roll. Set level again whenever you change your hold.',
  denied: 'Motion access was declined. Pull back or use the arrows to play.',
  unavailable: 'Tilt is unavailable here. Pull back or use the arrows to play.'
}

export default function BallGame({ score, setScore, onClose }) {
  const field = useRef(null),
    ball = useRef(null),
    body = useRef(null)
  const size = useRef({ width: 0, height: 0 }),
    pull = useRef(null),
    dragged = useRef(false)
  const pausedRef = useRef(false),
    resetAt = useRef(0)
  const [paused, setPaused] = useState(false),
    [aim, setAim] = useState(null),
    [goal, setGoal] = useState('')
  const tilt = useBallTilt(),
    tiltRef = useRef(tilt)
  tiltRef.current = tilt
  const guideId = useId()
  const paint = () => {
    if (!body.current || !ball.current) return
    const current = body.current
    const rotation = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : current.angle
    ball.current.style.transform = `translate(${current.x - BALL_RADIUS}px, ${current.y - BALL_RADIUS}px) rotate(${rotation}deg)`
    ball.current.dataset.moving = String(Math.hypot(current.vx, current.vy) > 0)
  }
  const center = () => {
    body.current = centeredBall(size.current)
    paint()
  }
  const pause = (value) => {
    pausedRef.current = value
    setPaused(value)
    pull.current = null
    setAim(null)
    if (body.current) {
      body.current.vx = 0
      body.current.vy = 0
      paint()
    }
    if (value) tiltRef.current.disable()
  }
  const kick = (x, y, power = 0.7) => {
    if (!body.current || pausedRef.current || resetAt.current || document.hidden) return
    body.current.vx = x * power * 900
    body.current.vy = y * power * 900
    paint()
  }
  useLayoutEffect(() => {
    let frame,
      last = performance.now()
    const resize = () => {
      size.current = { width: field.current.clientWidth, height: field.current.clientHeight }
      pull.current = null
      setAim(null)
      center()
      tiltRef.current.calibrate()
      last = performance.now()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(field.current)
    resize()
    const tick = (now) => {
      if (document.hidden) return
      const elapsed = (now - last) / 1000
      last = now
      if (resetAt.current && now >= resetAt.current) {
        resetAt.current = 0
        setGoal('')
      }
      if (!pausedRef.current && !pull.current && !resetAt.current && size.current.width > BALL_RADIUS * 2) {
        const next = advanceBall(body.current, elapsed, size.current, tiltRef.current.read(now))
        body.current = next.ball
        if (next.goal) {
          setScore((previous) => ({ ...previous, [next.goal]: previous[next.goal] + 1 }))
          setGoal(`${next.goal === 'blue' ? 'Blue' : 'Gold'} goal!`)
          resetAt.current = now + 800
        }
        paint()
      }
      frame = requestAnimationFrame(tick)
    }
    const visibility = () => {
      cancelAnimationFrame(frame)
      if (document.hidden) pause(true)
      else {
        last = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', visibility)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [setScore])

  const beginPull = (event) => {
    if (!event.isPrimary || event.button !== 0 || pausedRef.current || resetAt.current) return
    dragged.current = false
    body.current.vx = 0
    body.current.vy = 0
    pull.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    paint()
  }
  const showPull = (event) => {
    if (pull.current?.id !== event.pointerId) return
    const next = kickFromPull(event.clientX - pull.current.x, event.clientY - pull.current.y)
    if (next) dragged.current = true
    setAim(next)
  }
  const endPull = (event, canceled = false) => {
    if (pull.current?.id !== event.pointerId) return
    const next = canceled ? null : kickFromPull(event.clientX - pull.current.x, event.clientY - pull.current.y)
    pull.current = null
    setAim(null)
    if (canceled) dragged.current = true
    if (next) {
      dragged.current = true
      kick(next.x, next.y, next.power)
    }
  }
  const reset = () => {
    setScore({ blue: 0, gold: 0 })
    setGoal('')
    resetAt.current = 0
    pull.current = null
    setAim(null)
    center()
  }

  return (
    <Dialog title="Pocket pitch" className="pb-ball-dialog" onClose={onClose}>
      <div
        className="pb-game"
        onKeyDown={(event) => {
          const direction = directions[event.key]
          if (direction) {
            event.preventDefault()
            kick(...direction)
          }
        }}
      >
        <div className="pb-game-score" role="group" aria-label="Goal tally">
          <span className="pb-score-blue">
            Blue goal <strong>{score.blue}</strong>
          </span>
          <span className="pb-game-score-label">GOALS</span>
          <span className="pb-score-gold">
            Gold goal <strong>{score.gold}</strong>
          </span>
        </div>
        <div className="pb-game-pitch" ref={field} role="group" aria-label="Soccer pitch" data-paused={paused}>
          <div className="pb-game-net pb-game-net--blue" aria-hidden="true">
            <span>BLUE</span>
          </div>
          <div className="pb-game-net pb-game-net--gold" aria-hidden="true">
            <span>GOLD</span>
          </div>
          <svg className="pb-game-aim" aria-hidden="true">
            <defs>
              <marker
                id={guideId}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {aim && body.current && (
              <line
                x1={body.current.x + aim.x * 27}
                y1={body.current.y + aim.y * 27}
                x2={body.current.x + aim.x * (36 + aim.power * 70)}
                y2={body.current.y + aim.y * (36 + aim.power * 70)}
                stroke="currentColor"
                strokeWidth="3"
                markerEnd={`url(#${guideId})`}
              />
            )}
          </svg>
          <button
            ref={ball}
            type="button"
            className="pb-kick-ball pb-game-ball"
            aria-label="Soccer ball"
            aria-description="Pull back and release to kick. Tap or press Enter to kick upward. Arrow keys also kick."
            disabled={paused}
            onPointerDown={beginPull}
            onPointerMove={showPull}
            onPointerUp={endPull}
            onPointerCancel={(event) => endPull(event, true)}
            onLostPointerCapture={(event) => endPull(event, true)}
            onClick={(event) => {
              if (event.detail === 0 || !dragged.current) kick(0, -1)
            }}
          >
            <SoccerBall />
          </button>
          <div className="pb-game-announcement" role="status" aria-live="polite">
            {paused ? 'Paused' : goal}
          </div>
        </div>
        <p className="pb-game-help" role="status">
          {paused ? 'Resume when you’re ready.' : sensorMessage[tilt.status]}
        </p>
        <div className="pb-game-controls">
          <div className="pb-game-arrows" role="group" aria-label="Kick direction">
            {[
              ['left', '←', -1, 0],
              ['up', '↑', 0, -1],
              ['down', '↓', 0, 1],
              ['right', '→', 1, 0]
            ].map(([name, glyph, x, y]) => (
              <button key={name} type="button" aria-label={`Kick ${name}`} disabled={paused} onClick={() => kick(x, y)}>
                {glyph}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => pause(!paused)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
        <div className="pb-game-settings">
          {tilt.status === 'active' || tilt.status === 'waiting' ? (
            <>
              <button type="button" onClick={tilt.calibrate}>
                Set level
              </button>
              <button type="button" onClick={tilt.disable}>
                Turn tilt off
              </button>
            </>
          ) : (
            <button type="button" disabled={paused || tilt.status === 'requesting'} onClick={tilt.enable}>
              Enable tilt
            </button>
          )}
          <button type="button" onClick={reset}>
            Reset score
          </button>
        </div>
        <p className="pb-game-footnote">Just for fun. Motion readings stay on your device.</p>
      </div>
    </Dialog>
  )
}
