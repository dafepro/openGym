// Monotonic timestamps only. Wall-clock dates are metadata, never timer input.
export const ROUND_SECONDS = [15, 30, 45, 60, 90, 120]
export function createRound({ id, drillId, durationSeconds, date = new Date().toISOString() }) {
  if (!id || !drillId || !Number.isFinite(durationSeconds) || durationSeconds < 10 || durationSeconds > 600) throw new Error('Choose a round between 10 and 600 seconds.')
  return { id, drillId, date, durationSeconds, phase: 'ready', elapsedMs: 0, startedAt: null, manualRepetitions: null, targetArrivals: 0, cameraUsed: false }
}
export function elapsedMs(round, now) {
  return Math.min(round.durationSeconds * 1000, round.elapsedMs + (round.phase === 'working' ? Math.max(0, now - round.startedAt) : 0))
}
export function transitionRound(round, action, now) {
  if (!Number.isFinite(now)) throw new Error('A monotonic timestamp is required.')
  if (action === 'start' && round.phase === 'ready' || action === 'resume' && round.phase === 'paused') return { ...round, phase: 'working', startedAt: now }
  if (action === 'pause' && round.phase === 'working') return { ...round, phase: 'paused', elapsedMs: elapsedMs(round, now), startedAt: null }
  if (action === 'finish' && ['working', 'paused'].includes(round.phase)) return { ...round, phase: 'finished', elapsedMs: elapsedMs(round, now), startedAt: null }
  return round
}
export function summarizeRound(round) {
  if (round.phase !== 'finished') throw new Error('Finish this round before saving.')
  return { schemaVersion: 1, id: round.id, drillId: round.drillId, date: round.date, plannedSeconds: round.durationSeconds, practiceSeconds: Math.floor(round.elapsedMs) / 1000, completedDuration: round.elapsedMs >= round.durationSeconds * 1000, manualRepetitions: round.manualRepetitions, cameraUsed: round.cameraUsed, targetArrivals: round.cameraUsed ? round.targetArrivals : null, metricSources: { practiceSeconds: 'observed-timer', manualRepetitions: 'manual', targetArrivals: round.cameraUsed ? 'experimental-camera' : null } }
}
// Camera frames may arrive between timer ticks. Enforce the deadline here too.
export function observeRound(round, { arrivalIncrement = 0, cameraObserved = false }, timestamp) {
  if (round.phase !== 'working') return round
  if (elapsedMs(round, timestamp) >= round.durationSeconds * 1000) return transitionRound(round, 'finish', timestamp)
  if (!Number.isInteger(arrivalIncrement) || arrivalIncrement < 0) return round
  if (!arrivalIncrement && (!cameraObserved || round.cameraUsed)) return round
  return { ...round, cameraUsed: round.cameraUsed || cameraObserved || arrivalIncrement > 0, targetArrivals: round.targetArrivals + arrivalIncrement }
}
