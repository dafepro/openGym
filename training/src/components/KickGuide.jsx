import { useId } from 'react'
import { createPortal } from 'react-dom'
import { BALL_RADIUS } from '../domain/ball-game.js'

// Preserve the owner's curved, radial green-to-red force guide from PR #38.
export default function KickGuide({ aim, center }) {
  const id = useId()
  if (!aim || !center) return null
  const length = Math.max(1, Math.min(aim.stretch, aim.maxPull) - 3)
  const height = Math.min(26, 7 + length * 0.19)
  const tail = BALL_RADIUS + 2 + length
  return createPortal(
    <svg
      className="pb-kick-aim pb-restored-kick-aim"
      viewBox="0 -12 100 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        width: length,
        height,
        left: center.x - aim.x * tail,
        top: center.y - aim.y * tail - height / 2,
        transform: `rotate(${Math.atan2(aim.y, aim.x)}rad)`
      }}
    >
      <defs>
        <radialGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          cy="0"
          fr={BALL_RADIUS}
          cx={tail}
          r={BALL_RADIUS + aim.maxPull}
          gradientTransform={`scale(${100 / length} ${24 / height})`}
        >
          <stop offset="0" stopColor="#3d8d39" />
          <stop offset="32%" stopColor="#70a232" />
          <stop offset="55%" stopColor="#c49a28" />
          <stop offset="78%" stopColor="#e5732b" />
          <stop offset="100%" stopColor="#d83828" />
        </radialGradient>
      </defs>
      <path
        d="M2-10C17-11 40-5 64-3.5Q74-3 78-4Q76-7 75-9Q74-12 78-11C86-9 94-5 99-1Q101 0 99 1C94 5 86 9 78 11Q74 12 75 9Q76 7 78 4Q74 3 64 3.5C40 5 17 11 2 10Q-1 10 1 6Q5 0 1-6Q-1-10 2-10Z"
        fill={`url(#${id})`}
      />
    </svg>,
    document.body
  )
}
