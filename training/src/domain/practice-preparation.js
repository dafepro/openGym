import { canonicalSkillTags, normalizeTrainingTags } from './metadata.js'

export const preparationLabel = (value) => {
  const text = value.replace(/^futbol:/, '').replace(/[-_]/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Summarize the supplied prescription only. Repetitions and self-paced work
// have no known duration; missing setup metadata must never imply no needs.
export function practicePreparation(practice) {
  const drills = practice.drills
  const reviewOnly = drills.every((drill) => drill.mode === 'watch')
  const rows = drills.flatMap((drill) =>
    Array.from({ length: drill.sets * (drill.side === 'each' ? 2 : 1) }, () => drill)
  )
  const workSeconds = rows.reduce((total, drill) => total + (drill.mode === 'time' ? drill.durationSec : 0), 0)
  const restSeconds = rows.slice(0, -1).reduce((total, drill) => total + (drill.restSec || 0), 0)
  const openEnded = drills.some((drill) => drill.mode !== 'time')
  const requirements = drills.filter((drill) => drill.mode !== 'watch').map((drill) => drill.metadata?.requirements)
  const missing = (key) => requirements.some((item) => item?.[key] === undefined)
  const equipment = normalizeTrainingTags(
    requirements.flatMap((item) => item?.equipment || []),
    { max: 1600 }
  ).map(preparationLabel)
  const spaces = requirements.flatMap((item) => (item?.space ? [item.space] : []))
  // Each rectangle may rotate, as in drillFeasibility. This envelope fits all
  // listed drills without assuming separate areas are required simultaneously.
  const space = spaces.length
    ? {
        lengthM: Math.max(...spaces.map((item) => Math.max(item.lengthM, item.widthM))),
        widthM: Math.max(...spaces.map((item) => Math.min(item.lengthM, item.widthM)))
      }
    : null
  const groups = requirements.flatMap((item) => (item?.participants ? [item.participants] : []))
  const min = groups.length ? Math.max(...groups.map((item) => item.min)) : null
  const max = groups.length ? Math.min(...groups.map((item) => item.max ?? Infinity)) : null
  const participants =
    min === null
      ? null
      : {
          min,
          max,
          varies: min > max,
          roles: normalizeTrainingTags(
            groups.flatMap((item) => item.roles),
            { max: 1600 }
          ).map(preparationLabel)
        }
  const focus = [...new Set(drills.flatMap((drill) => canonicalSkillTags(drill.metadata)))].map(preparationLabel)
  return {
    reviewOnly,
    workSeconds,
    restSeconds,
    openEnded,
    equipment,
    space,
    participants,
    focus,
    missing: { equipment: missing('equipment'), space: missing('space'), participants: missing('participants') }
  }
}
