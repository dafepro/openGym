// Preserve elapsed foreground time when the operating system's wall clock changes.
export function createObservedClock({ wall = Date.now, monotonic = () => performance.now() } = {}) {
  const wallAnchor = wall(), monotonicAnchor = monotonic()
  let acceptedOffset = 0
  let recoveredRestTime = 0
  const now = () => wallAnchor + Math.max(0, monotonic() - monotonicAnchor) + recoveredRestTime
  return {
    now,
    reconcileTime(session) {
      let timestamp = now()
      const offset = wall() - timestamp
      const jumped = Math.abs(offset - acceptedOffset) > 2500
      const timer = session?.timer
      if (timer?.kind === 'rest' && offset - acceptedOffset > 2500) {
        // Some platforms pause performance.now during sleep. Rest can expire without crediting work.
        recoveredRestTime += offset - acceptedOffset
        timestamp = now()
      } else if (jumped) acceptedOffset = offset
      const backwardsCheckpoint = timer?.kind === 'work' && timestamp < timer.observedAt
      // RECONCILE at the deadline enters review; it can never grant completion credit.
      return { now: timer?.kind === 'work' && (jumped || backwardsCheckpoint) ? Math.max(timestamp, timer.deadline) : timestamp, clockChanged: jumped || backwardsCheckpoint }
    },
  }
}
