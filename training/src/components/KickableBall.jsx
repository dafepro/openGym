import { useState } from 'react'
import BallGame from './BallGame.jsx'
import SoccerBall from './SoccerBall.jsx'

export default function KickableBall() {
  const [open, setOpen] = useState(false)
  const [score, setScore] = useState({ blue: 0, gold: 0 })
  return (
    <span className="pb-ball-home">
      <button
        type="button"
        className="pb-kick-ball"
        aria-label="Play soccer ball game"
        onClick={(event) => {
          // Safari does not focus buttons on pointer activation. Give the dialog
          // a reliable return target for keyboard and assistive-technology users.
          event.currentTarget.focus({ preventScroll: true })
          setOpen(true)
        }}
      >
        <SoccerBall />
      </button>
      {open && <BallGame score={score} setScore={setScore} onClose={() => setOpen(false)} />}
    </span>
  )
}
