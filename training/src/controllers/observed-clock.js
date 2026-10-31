// Preserve elapsed foreground time when the operating system's wall clock changes.
export function createObservedClock({ wall = Date.now, monotonic = () => performance.now() } = {}) {
  const wallAnchor = wall(), monotonicAnchor = monotonic()
  let recoveredTime = 0
  let sessionId = null, nextRevision = 0
  const now = () => wallAnchor + Math.max(0, monotonic() - monotonicAnchor) + recoveredTime
  return {
    now,
    reconcileTime(session) {
      const storedRevision = session?.clockRevision || 0
      if ((session?.id || null) !== sessionId) { sessionId = session?.id || null; nextRevision = storedRevision }
      else nextRevision = Math.max(nextRevision, storedRevision)
      const clockRevision = nextRevision
      let timestamp = now()
      let previousNow = timestamp
      const offset = wall() - timestamp
      const jumped = Math.abs(offset) > 2500
      const timer = session?.timer
      if (jumped) {
        // Persist future commands in the new wall epoch. Work still requires explicit review.
        recoveredTime += offset
        timestamp = now()
      }
      const checkpoint = Math.max(session?.lastActionAt || 0, timer?.kind === 'work' ? timer.observedAt : 0, session?.practiceTimer?.startedAt || 0)
      const backwardsCheckpoint = !jumped && timestamp < checkpoint && nextRevision === storedRevision
      // On reload the previous monotonic anchor is gone. Preserve only the last known checkpoint.
      if (backwardsCheckpoint) previousNow = checkpoint
      const clockChanged = jumped || backwardsCheckpoint
      if (clockChanged) nextRevision++
      return { now: timestamp, previousNow, clockShiftMs: timestamp - previousNow, clockRevision, clockChanged }
    },
  }
}
