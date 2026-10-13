import { useUI } from '../store/useUI.js'

// Rest progress is decorative: the tab keeps its name, DOM node and press location.
export default function WorkoutTimerRing() {
  const timer = useUI(s => s.timer)
  if (!timer || timer.ready) return null
  const progress = timer.total > 0 ? Math.max(0, Math.min(1, 1 - timer.left / timer.total)) : 0
  return <svg className="workout-timer-ring" viewBox="0 0 64 64" aria-hidden="true" data-mode={timer.paused ? 'paused' : 'rest'}>
    <circle className="wtr-track" cx="32" cy="32" r="29" />
    <circle className="wtr-arc" cx="32" cy="32" r="29" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100} />
    <circle className="wtr-tip" cx="32" cy="32" r="29" pathLength="100" strokeDasharray="0.1 99.9" strokeDashoffset={-progress * 100} />
  </svg>
}
