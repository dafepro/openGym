const unit = value => Number.isFinite(value) && value >= 0 && value <= 1
const distance = (a, b, aspectRatio) => Math.hypot(a.x - b.x, (a.y - b.y) / aspectRatio)
const validTarget = target => target && unit(target.x) && unit(target.y) && Number.isFinite(target.radius) && target.radius > 0 && target.radius <= 0.5

export function validateTargets(targets) {
  return Array.isArray(targets) && targets.length === 2 && targets.every(validTarget) &&
    distance(targets[0], targets[1], 1) > (targets[0].radius + targets[1].radius) * 1.25
}

export function createTargetCounter(targets, options = {}) {
  const config = { aspectRatio: 1, dwellMs: 180, minIntervalMs: 350, minConfidence: 0.65, maxGapMs: 250, ...options }
  if (!Number.isFinite(config.aspectRatio) || config.aspectRatio <= 0 ||
    !Number.isFinite(config.dwellMs) || config.dwellMs < 100 ||
    !Number.isFinite(config.minIntervalMs) || config.minIntervalMs < config.dwellMs ||
    !Number.isFinite(config.minConfidence) || config.minConfidence < 0.5 || config.minConfidence > 1 ||
    !Number.isFinite(config.maxGapMs) || config.maxGapMs < 50 || config.maxGapMs > 1000) {
    throw new Error('Use a valid camera aspect ratio and positive tracking timing settings.')
  }
  if (!validateTargets(targets) || distance(targets[0], targets[1], config.aspectRatio) <= (targets[0].radius + targets[1].radius) * 1.25 ||
    targets.some(t => t.x < t.radius || t.x + t.radius > 1 || t.y < t.radius * config.aspectRatio || t.y + t.radius * config.aspectRatio > 1)) {
    throw new Error('Place two separated target circles fully inside the camera image.')
  }
  // Copy calibration so external mutation cannot move targets during a round.
  const zones = targets.map(target => ({ ...target }))
  let count, anchor, candidate, lastTimestamp, lastArrival, exitFrames, hasExited
  const view = tracking => ({ count, expectedTarget: anchor === null ? null : 1 - anchor, tracking })
  function clearObservation() { anchor = null; candidate = null; exitFrames = 0; hasExited = false }
  function reset() {
    count = 0; lastTimestamp = null; lastArrival = null; clearObservation()
    return view('acquiring')
  }
  reset()
  function update(detection, timestampMs) {
    if (!Number.isFinite(timestampMs) || timestampMs < 0 || (lastTimestamp !== null && timestampMs <= lastTimestamp)) {
      clearObservation()
      return view('lost')
    }
    const gap = lastTimestamp !== null && timestampMs - lastTimestamp > config.maxGapMs
    lastTimestamp = timestampMs
    if (gap) clearObservation()
    if (!detection || !unit(detection.x) || !unit(detection.y) || !Number.isFinite(detection.radius) || detection.radius <= 0 || detection.radius > 0.5 ||
      !unit(detection.confidence) || detection.confidence < config.minConfidence) {
      clearObservation()
      return view('lost')
    }
    const zone = zones.findIndex(target => distance(target, detection, config.aspectRatio) <= target.radius)
    if (anchor !== null && !hasExited) {
      if (distance(zones[anchor], detection, config.aspectRatio) > zones[anchor].radius * 1.25) exitFrames++
      else exitFrames = 0
      hasExited = exitFrames >= 2
    }
    const eligible = zone >= 0 && (anchor === null || (zone === 1 - anchor && hasExited))
    if (!eligible) { candidate = null; return view(anchor === null ? 'acquiring' : 'tracking') }
    if (!candidate || candidate.zone !== zone) candidate = { zone, since: timestampMs, frames: 1 }
    else candidate.frames++
    if (timestampMs - candidate.since >= config.dwellMs && candidate.frames >= 3 &&
      (lastArrival === null || timestampMs - lastArrival >= config.minIntervalMs)) {
      if (anchor !== null) count++
      anchor = zone; lastArrival = timestampMs; candidate = null; exitFrames = 0; hasExited = false
    }
    return view(anchor === null ? 'acquiring' : 'tracking')
  }
  return { update, reset }
}
