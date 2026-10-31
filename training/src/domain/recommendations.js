// Adapted from openGym's deterministic optional-add ranking pattern. No gym imports,
// inferred prescriptions, strength transfer, physiological fatigue or history writes.
import { canonicalSkillTags, drillFeasibility, normalizeTrainingTags, SKILL_REGISTRY, SKILL_REGISTRY_VERSION, validateDrillMetadata, validateTrainingContext } from './metadata.js'

const DAY = 86400000
const HISTORY_WINDOW = 90 * DAY
const STRATEGIES = Object.freeze({
  balanced: { coverage: 12, reinforcement: 14 },
  reinforce: { coverage: 4, reinforcement: 24 },
  diversify: { coverage: 24, reinforcement: 4 },
})
const mean = (skills, values) => skills.length ? skills.reduce((sum, skill) => sum + (values[skill] || 0), 0) / skills.length : 0
const round = value => Math.round(value * 10000) / 10000
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value)
const candidateIdentifier = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,383}$/.test(value)
const fingerprint = drill => JSON.stringify([drill.id, drill.title, drill.instructions, drill.mode, drill.sets, drill.reps ?? null, drill.durationSec ?? null, drill.side, drill.restSec, drill.media?.id, canonicalSkillTags(drill.metadata).sort()])
const positiveWork = row => row?.mode === 'practice' && row.status === 'done' && row.actual === null && row.target === null || ['done', 'stopped'].includes(row?.status) && ['reps', 'time'].includes(row.mode) && Number.isFinite(row.actual) && row.actual > 0 && (row.mode === 'reps' ? Number.isInteger(row.actual) && row.actual <= 10000 : row.actual <= 86400)
const addSkills = (target, skills, weight) => {
  for (const skill of skills) target[skill] = (target[skill] || 0) + weight / skills.length
}
function sessionAt(session, now, active) {
  if (!Number.isFinite(session?.startedAt) || session.startedAt > now) return null
  if (active) return session.status === 'active' ? session.startedAt : null
  if (!['completed', 'partial'].includes(session.status) || !Number.isFinite(session.endedAt) || session.endedAt < session.startedAt || session.endedAt > now) return null
  return session.endedAt
}
function exposures(history, activeSession, now) {
  const performed = {}, recent = {}, pending = {}, familiarity = {}
  const seen = new Set()
  for (const [session, active] of [...history.map(item => [item, false]), ...(activeSession ? [[activeSession, true]] : [])]) {
    const at = sessionAt(session, now, active)
    if (at === null || !active && now - at > HISTORY_WINDOW || seen.has(session.id)) continue
    seen.add(session.id)
    const drills = session.assignment?.drills
    if (!Array.isArray(drills) || !Array.isArray(session.rows)) continue
    for (const drill of drills) {
      const rows = session.rows.filter(row => row.drillId === drill.id)
      // A record in the snapshot is evidence, not today's edited catalog. Watch review,
      // zero actuals, future timestamps and pending rows are never performed exposure.
      const practiced = now - at <= HISTORY_WINDOW && drill.mode !== 'watch' && rows.some(row => row.mode === drill.mode && positiveWork(row) && (row.completedAt === undefined || Number.isFinite(row.completedAt) && row.completedAt <= now))
      const skills = canonicalSkillTags(drill.metadata)
      if (practiced) {
        const age = now - at
        addSkills(performed, skills, 1)
        addSkills(recent, skills, Math.exp(-age / (14 * DAY)))
        familiarity[fingerprint(drill)] = (familiarity[fingerprint(drill)] || 0) + Math.exp(-age / (45 * DAY))
      }
      if (active && rows.some(row => row.status !== 'done' && row.mode !== 'watch')) addSkills(pending, skills, 1)
    }
  }
  return { performed, recent, pending, familiarity }
}
/** Pure ranking of supplied, prescribed drills; nothing is inserted or prescribed. */
export function rankTrainingDrills(drills, {
  now, history = [], activeSession = null, context = {}, focusSkills = [], requiredTags = [], excludedIds = [],
  strategy = 'balanced', includeIneligible = false, plannedDrills = [],
} = {}) {
  if (!Number.isFinite(now) || now < 0) throw new Error('Recommendation ranking requires an explicit valid timestamp')
  if (!Array.isArray(drills) || drills.length > 10000 || !Array.isArray(history) || history.length > 10000) throw new Error('Recommendation inputs must be bounded lists')
  if (!Object.hasOwn(STRATEGIES, strategy)) throw new Error('Unknown recommendation strategy')
  validateTrainingContext(context)
  const requested = normalizeTrainingTags(focusSkills)
  const focus = requested.filter(skill => Object.hasOwn(SKILL_REGISTRY, skill))
  const filters = normalizeTrainingTags(requiredTags)
  if (!Array.isArray(excludedIds) || excludedIds.some(id => !candidateIdentifier(id))) throw new Error('Excluded drill IDs must be valid identifiers')
  const omitted = new Set(excludedIds)
  const evidence = exposures(history, activeSession, now)
  if (!Array.isArray(plannedDrills) || plannedDrills.length > 100) throw new Error('Planned drills must be a bounded list')
  for (const drill of plannedDrills) {
    if (!drill || !['watch', 'reps', 'time', 'practice'].includes(drill.mode)) throw new Error('Planned drill mode is unsupported')
    if (drill.mode !== 'watch') addSkills(evidence.pending, canonicalSkillTags(drill.metadata), 1)
  }
  const seen = new Set()
  const ranked = []
  for (const input of drills) {
    const drill = input?.drill || input
    const candidateId = input?.drill ? input.candidateId : drill?.id
    if (!identifier(drill?.id) || !candidateIdentifier(candidateId) || seen.has(candidateId)) throw new Error('Candidates need unique suggestion IDs; wrap assignment editions as { candidateId, drill } without changing snapshot IDs')
    seen.add(candidateId)
    if (omitted.has(candidateId)) continue
    if (drill.metadata !== undefined) validateDrillMetadata(drill.metadata)
    const tags = normalizeTrainingTags(drill.metadata?.tags || [])
    if (!filters.every(tag => tags.includes(tag))) continue
    const feasibility = drillFeasibility(drill, context)
    if (!includeIneligible && !feasibility.eligible) continue
    const skills = canonicalSkillTags(drill.metadata)
    const coverage = Object.fromEntries(skills.map(skill => [skill, 1 / (1 + (evidence.recent[skill] || 0))]))
    const recent = Object.fromEntries(skills.map(skill => [skill, Math.min(1, evidence.recent[skill] || 0)]))
    const planned = Object.fromEntries(skills.map(skill => [skill, Math.min(1, (evidence.pending[skill] || 0) / 2)]))
    const familiarity = evidence.familiarity[fingerprint(drill)] || 0
    const breakdown = {
      focus: focus.length ? 40 * focus.filter(skill => skills.includes(skill)).length / focus.length : 0,
      coverage: STRATEGIES[strategy].coverage * mean(skills, coverage),
      reinforcement: STRATEGIES[strategy].reinforcement * mean(skills, recent),
      planned: -20 * mean(skills, planned),
      familiarity: Math.min(4, familiarity * 2),
      variety: familiarity ? -Math.min(3, familiarity) : 2,
    }
    for (const key of Object.keys(breakdown)) breakdown[key] = round(breakdown[key])
    ranked.push({
      candidateId, drill: structuredClone(drill), eligible: feasibility.eligible, issues: feasibility.issues,
      metadataKnown: feasibility.metadataKnown, registryVersion: SKILL_REGISTRY_VERSION,
      score: round(Object.values(breakdown).reduce((sum, value) => sum + value, 0)), breakdown,
      skills, ignoredFocusTags: requested.filter(tag => !Object.hasOwn(SKILL_REGISTRY, tag)),
      exposure: {
        performed: Object.fromEntries(skills.map(skill => [skill, evidence.performed[skill] || 0])),
        recent: Object.fromEntries(skills.map(skill => [skill, round(evidence.recent[skill] || 0)])),
        pending: Object.fromEntries(skills.map(skill => [skill, evidence.pending[skill] || 0])),
      },
    })
  }
  return ranked.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0))
}
