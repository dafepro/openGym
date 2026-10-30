// Preserve elapsed foreground time when the operating system's wall clock changes.
export function createObservedClock({ wall = Date.now, monotonic = () => performance.now() } = {}) {
  const wallAnchor = wall(), monotonicAnchor = monotonic()
  let recoveredTime = 0
  const now = () => wallAnchor + Math.max(0, monotonic() - monotonicAnchor) + recoveredTime
  return {
    now,
    reconcileTime(session) {
      let timestamp = now()
      const offset = wall() - timestamp
      const jumped = Math.abs(offset) > 2500
      const timer = session?.timer
      if (jumped) {
        // Persist future commands in the new wall epoch. Work still requires explicit review.
        recoveredTime += offset
        timestamp = now()
      }
      const backwardsCheckpoint = timer?.kind === 'work' && timestamp < timer.observedAt
      // RECONCILE at the deadline enters review; it can never grant completion credit.
      return { now: timer?.kind === 'work' && (jumped || backwardsCheckpoint) ? Math.max(timestamp, timer.deadline) : timestamp, clockChanged: jumped || backwardsCheckpoint }
    },
  }
}
