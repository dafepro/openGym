// Editorial defaults for optional work, not a strength test or a diagnosis. Saved exercise
// settings and recent performed work take precedence. Similar-load transfer is deliberately
// limited to the same free-weight movement and equipment, never just a shared muscle.
export function recommendationProfile(ex) {
  const name = (ex?.n || '').toLowerCase()
  const isolation = /\b(raise|curl|extension|fly|flyes|flys|kickback|shrug|calf|adduction|abduction)\b/.test(name)
  const compound = !isolation && /\b(squat|deadlift|press|row|pulldown|pull-up|chin-up|lunge|dip)\b/.test(name)
  const hold =
    /^(?:(?:one arm|bodyweight|lateral|kneeling|bear|front|side|reverse|iron cross) )*plank(?: \([^)]*\))?$/.test(
      name
    ) || /\b(wall sit|dead hang|isometric hold)\b/.test(name)
  let family = null
  for (const [key, pattern] of [
    ['front-raise', /\bfront raise\b/],
    ['lateral-raise', /\b(lateral|side) raise\b/],
    ['hammer-curl', /\bhammer curl\b/],
    ['biceps-curl', /\bbiceps? curl\b/],
    ['shoulder-press', /\b(shoulder|overhead) press\b/],
    ['bench-press', /\bbench press\b/]
  ])
    if (pattern.test(name)) {
      family = key
      break
    }
  if (/\b(to|and|catch|swing|clean|snatch|rotation|push[- ]?up)\b/.test(name)) family = null
  return { reps: isolation ? 12 : compound ? 8 : 10, restSec: compound ? 150 : 90, hold, family }
}

export const recommendationName = (ex) =>
  (ex?.n || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
