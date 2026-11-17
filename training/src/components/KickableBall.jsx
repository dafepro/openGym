import { useLayoutEffect, useRef, useState } from 'react'
import BallGame from './BallGame.jsx'
import KickGuide from './KickGuide.jsx'
import { aimFromContact } from '../domain/ball-game.js'
import SoccerBall from './SoccerBall.jsx'

export default function KickableBall() {
  const pull = useRef(null)
  const home = useRef(null)
  const wasOpen = useRef(false)
  const [aim, setAim] = useState(null)
  const [open, setOpen] = useState(null)
  const [score, setScore] = useState({ blue: 0, gold: 0 })
  useLayoutEffect(() => {
    if (!open && wasOpen.current) home.current?.focus({ preventScroll: true })
    wasOpen.current = Boolean(open)
  }, [open])
  return (
    <span className="pb-ball-home">
      <button
        ref={home}
        type="button"
        className="pb-kick-ball"
        style={open ? { visibility: 'hidden' } : undefined}
        aria-label="Play soccer ball game"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return
          event.currentTarget.focus({ preventScroll: true })
          const rect = event.currentTarget.getBoundingClientRect()
          pull.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const start = pull.current
          if (start?.id !== event.pointerId) return
          setAim(
            aimFromContact(
              start.center,
              start,
              { x: event.clientX, y: event.clientY },
              { width: innerWidth, height: innerHeight }
            )
          )
        }}
        onPointerUp={(event) => {
          const start = pull.current
          if (start?.id !== event.pointerId) return
          const shot = aimFromContact(
            start.center,
            start,
            { x: event.clientX, y: event.clientY },
            { width: innerWidth, height: innerHeight }
          )
          setOpen({ ...start.center, touchX: start.x, touchY: start.y, shot })
          pull.current = null
          setAim(null)
        }}
        onPointerCancel={() => {
          pull.current = null
          setAim(null)
        }}
        onClick={(event) => {
          if (event.detail !== 0) return
          const rect = event.currentTarget.getBoundingClientRect()
          setOpen({
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            touchX: rect.x + rect.width / 2,
            touchY: rect.y + rect.height / 2
          })
        }}
      >
        <SoccerBall />
      </button>
      <KickGuide aim={aim} center={pull.current?.center} />
      {open && <BallGame launch={open} score={score} setScore={setScore} onClose={() => setOpen(null)} />}
    </span>
  )
}
