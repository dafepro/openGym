import { canonicalSkillTags } from './metadata.js'
import { hasDemonstration } from './drill-library.js'

// Prescriptions and instance IDs can change while the underlying drill stays the same.
export const drillSelectionKey = (drill) => JSON.stringify([drill.media.id, drill.title, drill.instructions])
export const isDrillSelected = (draft, drill) =>
  draft.drills.some((item) => drillSelectionKey(item) === drillSelectionKey(drill))
export function toggleDrillSelection(draft, drill, makeId = () => `drill-${crypto.randomUUID()}`) {
  if (isDrillSelected(draft, drill))
    return { ...draft, drills: draft.drills.filter((item) => drillSelectionKey(item) !== drillSelectionKey(drill)) }
  if (draft.drills.length >= 100) return draft
  return {
    ...draft,
    title: draft.title || 'My soccer practice',
    drills: [...draft.drills, { ...structuredClone(drill), id: makeId() }]
  }
}
export function compactTarget(drill) {
  if (drill.mode === 'practice') return 'Self-paced'
  if (drill.mode === 'watch') return 'Video review'
  const target = drill.mode === 'time' ? `${drill.durationSec || '—'} sec` : `${drill.reps || '—'} reps`
  return `${drill.sets || '—'} × ${target}${drill.side === 'each' ? ' · each foot' : ''}`
}
export function drillSetup(drill) {
  const equipment = drill.metadata?.requirements?.equipment || []
  const useful = equipment.filter((item) => item !== 'ball').map((item) => item.replaceAll('-', ' '))
  return [useful.slice(0, 2).join(' + '), compactTarget(drill)].filter(Boolean).join(' · ')
}
export function practiceSummary(drills) {
  const timedSeconds = drills
    .filter((drill) => drill.mode === 'time')
    .reduce(
      (total, drill) =>
        total + (Number(drill.durationSec) || 0) * (Number(drill.sets) || 0) * (drill.side === 'each' ? 2 : 1),
      0
    )
  const allTimed = drills.length > 0 && drills.every((drill) => drill.mode === 'time')
  return { videoCount: drills.filter(hasDemonstration).length, timedSeconds, allTimed }
}

export function draftMatchesPractice(draft, practice) {
  return (
    !!practice &&
    draft.id === practice.id &&
    draft.title === practice.title &&
    JSON.stringify(draft.drills) === JSON.stringify(practice.drills)
  )
}

export function practiceFocus(drills) {
  const counts = new Map()
  drills.forEach((drill) =>
    canonicalSkillTags(drill.metadata).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1))
  )
  return [...counts]
    .map(([tag, count]) => ({ tag, count, label: tag.slice(7).replaceAll('-', ' ') }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export function drillMatchesSearch(drill, query) {
  const normalize = (value) =>
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[-_:]+/g, ' ')
  const source = normalize(
    [
      drill.title,
      drill.instructions,
      ...(drill.metadata?.tags || []),
      ...(drill.metadata?.requirements?.equipment || [])
    ].join(' ')
  )
  return normalize(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => source.includes(word))
}
