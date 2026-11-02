// A render tick is not evidence of a new camera frame. Tokens come from video
// presentation metadata, or advancing video.currentTime on older browsers.
export function createFrameFreshness(maxAgeMs = 250) {
  let previous = null, observedAt = null
  return {
    observe(token, timestamp) {
      const valid = Number.isFinite(token) && Number.isFinite(timestamp)
      if (valid && (previous === null || token > previous)) {
        previous = token; observedAt = timestamp
        return { fresh: true, lost: false }
      }
      return { fresh: false, lost: observedAt === null || !Number.isFinite(timestamp) || timestamp - observedAt >= maxAgeMs }
    },
  }
}
