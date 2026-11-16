// Cues describe the timer, never certify work. No queued audio after suspension.
export function fieldCue(previous, current) {
  if (!previous || !current.visible || !previous.visible || current.paused) return null
  if (current.phase !== previous.phase) {
    if (current.phase === 'working') return 'work'
    if (current.phase === 'rest') return 'rest'
    if (current.phase === 'review' || (previous.phase === 'rest' && current.phase === 'ready')) return 'end'
  }
  if (
    current.identity === previous.identity &&
    current.phase === previous.phase &&
    !previous.paused &&
    current.countdown &&
    ['working', 'rest'].includes(current.phase) &&
    current.seconds >= 1 &&
    current.seconds <= 3 &&
    previous.seconds === current.seconds + 1
  )
    return 'count'
  return null
}
