import { validateAssignment } from './content.js'
import { canonicalSkillTags, drillFeasibility, validateTrainingContext } from './metadata.js'
import { rankTrainingDrills } from './recommendations.js'
import { hasDemonstration } from './drill-library.js'
import { drillSelectionKey } from './drill-selection.js'
import { createPractice } from './practice-builder.js'

// A visible starting suggestion for the picker, never an inferred user context.
export const DEFAULT_RANDOM_CONTEXT = Object.freeze({
  setting: 'outdoor', equipment: Object.freeze(['ball', 'cones']),
  participants: Object.freeze({ count: 1, roles: Object.freeze([]) }),
  space: Object.freeze({ lengthM: 6, widthM: 6 }),
})

const ballSkills = new Set(['futbol:ball-control', 'futbol:dribbling', 'futbol:first-touch', 'futbol:passing', 'futbol:shooting', 'futbol:weak-foot', 'futbol:goalkeeping', 'futbol:aerial-control'])
function seedValue(seed) {
  if (!['string', 'number'].includes(typeof seed) || typeof seed === 'number' && !Number.isFinite(seed) || String(seed).length > 256) throw new Error('Choose a valid shuffle seed.')
  return hashText(String(seed))
}
function hashText(text) {
  let value = 2166136261
  for (const character of text) { value ^= character.codePointAt(0); value = Math.imul(value, 16777619) }
  return value >>> 0
}
function seededRandom(seed) {
  let state = seedValue(seed)
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}
const phase = drill => /-warmup$/.test(drill.id) ? -1 : /-cooldown$/.test(drill.id) ? 1 : 0

/** A disposable proposal from compatible existing drills, not a new stock workout. */
export function generateRandomPractice(library, {
  context, seed = Math.random().toString(36).slice(2), count = 3, videoOnly = false, allowUnknownSpace = false,
  focusSkills = [], history = [], now = Date.now(), id, revision,
} = {}) {
  if (!context || ['setting', 'equipment', 'participants', 'space'].some(key => context[key] === undefined)) throw new Error('Choose a space, equipment, and number of players before mixing a practice.')
  const checkedContext = validateTrainingContext(context)
  if (!Array.isArray(library) || library.length > 10000) throw new Error('The drill library could not be read.')
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('Choose between 1 and 10 drills.')
  if (typeof videoOnly !== 'boolean') throw new Error('Choose whether demonstrations are required.')
  if (typeof allowUnknownSpace !== 'boolean') throw new Error('Choose whether to check unmeasured space yourself.')
  const random = seededRandom(seed)
  const seen = new Set(), candidates = []
  for (const input of library) {
    const drill = validateAssignment({ id: 'candidate', revision: 'v1', title: 'Candidate', status: 'current', drills: [input] }).drills[0]
    if (drill.mode === 'watch' || videoOnly && !hasDemonstration(drill)) continue
    const key = drillSelectionKey(drill)
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({ candidateId: `candidate-${candidates.length}`, drill })
  }
  // Missing metadata is excluded unless the player explicitly accepts checking
  // unmeasured space. That opt-in never waives a known dimension or other need.
  const rankOptions = { now, history, context: checkedContext, focusSkills, strategy: 'balanced', includeIneligible: allowUnknownSpace }
  const permitted = item => item.eligible || allowUnknownSpace && item.issues.every(issue => issue.code === 'unknown-space')
  const eligible = rankTrainingDrills(candidates, rankOptions).filter(permitted)
  if (!eligible.length) {
    const unmeasuredOnly = !allowUnknownSpace && candidates.some(({ drill }) => {
      const issues = drillFeasibility(drill, checkedContext).issues
      return issues.length > 0 && issues.every(issue => issue.code === 'unknown-space')
    })
    throw new Error(unmeasuredOnly
      ? 'These drills have unlisted space needs. Include them only if you can check their setup, or choose other drills.'
      : videoOnly
        ? 'No video drills fit this setup. Try adding equipment, allowing written instructions, or changing your space.'
        : 'No drills fit this setup yet. Try changing your equipment or space, or make your own drill.')
  }
  const selected = [], excludedIds = []
  while (selected.length < Math.min(count, eligible.length)) {
    const remaining = rankTrainingDrills(candidates, { ...rankOptions, plannedDrills: selected, excludedIds }).filter(permitted)
    const covered = new Set(selected.flatMap(drill => canonicalSkillTags(drill.metadata)))
    const addsCoverage = remaining.filter(item => item.skills.some(skill => !covered.has(skill)))
    const ballOptions = remaining.filter(item => item.skills.some(skill => ballSkills.has(skill)))
    // Prefer a new skill when one fits; history still ranks choices within that pool.
    const ranked = !selected.length && ballOptions.length ? ballOptions : addsCoverage.length ? addsCoverage : remaining
    // Weighted sampling preserves coverage/reinforcement while offering real shuffles.
    const top = ranked[0].score
    const weights = ranked.map(item => Math.exp((item.score - top) / 12))
    let ticket = random() * weights.reduce((sum, value) => sum + value, 0)
    let pick = ranked.length - 1
    for (let index = 0; index < weights.length; index++) {
      ticket -= weights[index]
      if (ticket < 0) { pick = index; break }
    }
    selected.push(ranked[pick].drill); excludedIds.push(ranked[pick].candidateId)
  }
  // Retain sensible placement for explicitly identified preparation/recovery items.
  selected.sort((a, b) => phase(a) - phase(b))
  const skills = [...new Set(selected.flatMap(drill => canonicalSkillTags(drill.metadata)))]
  const hasBallWork = skills.some(skill => ballSkills.has(skill))
  const title = hasBallWork ? 'Your soccer mix' : 'Quick movement practice'
  // A setup or target change must not reuse the identity of a different recipe.
  const hash = hashText(JSON.stringify([String(seed), checkedContext, selected])).toString(36)
  const drills = selected.map((drill, index) => ({ ...drill, id: `mix-${hash}-${index + 1}` }))
  const uncheckedSpaceIds = drills.filter(drill => drillFeasibility(drill, checkedContext).issues.some(issue => issue.code === 'unknown-space')).map(drill => drill.id)
  const warnings = uncheckedSpaceIds.length ? [`Check the space for ${uncheckedSpaceIds.length === 1 ? '1 drill' : `${uncheckedSpaceIds.length} drills`} before starting; their space requirements are not recorded.`] : []
  const assignment = createPractice(title, drills, { id: id || `mix-${hash}`, revision: revision || 'v1' })
  return {
    assignment, context: checkedContext, seed: String(seed), skills,
    warnings, uncheckedSpaceIds,
    eligibleCount: eligible.length, requestedCount: count, selectedCount: selected.length,
    explanation: `${selected.length} ${selected.length === 1 ? 'drill selected' : 'drills selected'}${selected.length < count ? ` (${count} requested)` : ''}. ${uncheckedSpaceIds.length ? 'Equipment and players match; some space needs must be checked.' : 'All match your setup.'} ${hasBallWork ? 'A mix of ball skills' : 'Movement and coordination'} using the existing drill targets.`,
  }
}
