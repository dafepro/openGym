// Versioned editorial labels, not a measure of skill, mastery, recovery or safety.
export const SKILL_REGISTRY_VERSION = 1
export const SKILL_REGISTRY = Object.freeze({
  'futbol:agility': Object.freeze([]),
  'futbol:endurance': Object.freeze(['futbol:stamina']),
  'futbol:balance': Object.freeze([]),
  'futbol:coordination': Object.freeze([]),
  'futbol:acceleration': Object.freeze(['futbol:speed']),
  'futbol:mobility': Object.freeze([]),
  'futbol:ball-control': Object.freeze(['futbol:control', 'futbol:ball-mastery']),
  'futbol:dribbling': Object.freeze(['futbol:dribble']),
  'futbol:first-touch': Object.freeze(['futbol:receiving', 'futbol:first_touch']),
  'futbol:passing': Object.freeze(['futbol:pass']),
  'futbol:shooting': Object.freeze(['futbol:finishing', 'futbol:shoot']),
  'futbol:defending': Object.freeze(['futbol:defence', 'futbol:defense']),
  'futbol:scanning': Object.freeze(['futbol:awareness']),
  'futbol:weak-foot': Object.freeze(['futbol:weak_foot']),
  'futbol:goalkeeping': Object.freeze(['futbol:goalkeeper']),
  'futbol:aerial-control': Object.freeze(['futbol:aerial']),
  'futbol:change-of-direction': Object.freeze(['futbol:turning']),
})
const aliases = new Map(Object.entries(SKILL_REGISTRY).flatMap(([canonical, values]) => [canonical, ...values].map(value => [value, canonical])))
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
function object(value, label, fields) {
  if (!plain(value) || Object.keys(value).some(key => !fields.includes(key))) throw new Error(`${label} contains unsupported fields or is not an object`)
}
export function normalizeTrainingTag(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 64 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Training labels must contain 1–64 printable characters')
  const token = value.normalize('NFKC').trim().toLowerCase()
  if (token.length > 64) throw new Error('Normalized training labels must be at most 64 characters')
  return aliases.get(token) || token
}
export function normalizeTrainingTags(values, { max = 32 } = {}) {
  if (!Array.isArray(values) || values.length > max) throw new Error(`Training labels must be a list of at most ${max} items`)
  return [...new Set(values.map(normalizeTrainingTag))]
}
function labelList(values, label, max = 16) {
  try { normalizeTrainingTags(values, { max }) } catch { throw new Error(`${label} must be a bounded list of printable labels`) }
}
function count(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum || value > 64) throw new Error(`${label} must be an integer from ${minimum} to 64`)
}
function dimension(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 200) throw new Error(`${label} must be between 0 and 200 metres`)
}
export function validateDrillMetadata(metadata) {
  object(metadata, 'Drill metadata', ['version', 'registryVersion', 'tags', 'requirements', 'physicalEmphasis'])
  if (metadata.version !== 1 || metadata.registryVersion !== SKILL_REGISTRY_VERSION) throw new Error('Unsupported drill metadata or skill registry version')
  if (metadata.tags !== undefined) labelList(metadata.tags, 'Tags', 32)
  if (metadata.physicalEmphasis !== undefined) labelList(metadata.physicalEmphasis, 'Physical emphasis', 16)
  if (metadata.requirements !== undefined) {
    const requirements = metadata.requirements
    object(requirements, 'Context requirements', ['settings', 'equipment', 'participants', 'space'])
    if (requirements.settings !== undefined) labelList(requirements.settings, 'Settings', 8)
    if (requirements.equipment !== undefined) labelList(requirements.equipment, 'Equipment')
    if (requirements.participants !== undefined) {
      const participants = requirements.participants
      object(participants, 'Participant requirements', ['min', 'max', 'roles'])
      count(participants.min, 'Minimum participants', 1)
      if (participants.max !== undefined) { count(participants.max, 'Maximum participants', 1); if (participants.max < participants.min) throw new Error('Maximum participants cannot be below minimum') }
      labelList(participants.roles, 'Participant roles')
    }
    if (requirements.space !== undefined) {
      object(requirements.space, 'Space requirements', ['lengthM', 'widthM'])
      dimension(requirements.space.lengthM, 'Space length'); dimension(requirements.space.widthM, 'Space width')
    }
  }
  return structuredClone(metadata)
}
export function canonicalSkillTags(metadata) {
  if (!metadata) return []
  const checked = validateDrillMetadata(metadata)
  return normalizeTrainingTags(checked.tags || []).filter(tag => Object.hasOwn(SKILL_REGISTRY, tag))
}
export function validateTrainingContext(context) {
  object(context, 'Training context', ['setting', 'equipment', 'participants', 'space'])
  if (context.setting !== undefined) normalizeTrainingTag(context.setting)
  if (context.equipment !== undefined) labelList(context.equipment, 'Available equipment')
  if (context.participants !== undefined) {
    object(context.participants, 'Available participants', ['count', 'roles'])
    count(context.participants.count, 'Participant count', 1)
    if (context.participants.roles !== undefined) labelList(context.participants.roles, 'Available roles')
  }
  if (context.space !== undefined) {
    object(context.space, 'Available space', ['lengthM', 'widthM'])
    dimension(context.space.lengthM, 'Available length'); dimension(context.space.widthM, 'Available width')
  }
  return structuredClone(context)
}
export function drillFeasibility(drill, context = {}) {
  validateTrainingContext(context)
  const metadata = drill.metadata ? validateDrillMetadata(drill.metadata) : null
  const requirements = metadata?.requirements
  const issues = []
  const fail = (field, code) => issues.push({ field, code })
  if (context.setting !== undefined) {
    if (requirements?.settings === undefined) fail('setting', 'unknown-setting')
    else if (requirements.settings.length && !normalizeTrainingTags(requirements.settings).includes(normalizeTrainingTag(context.setting))) fail('setting', 'setting-mismatch')
  }
  if (context.equipment !== undefined) {
    if (requirements?.equipment === undefined) fail('equipment', 'unknown-equipment')
    else {
      const available = new Set(normalizeTrainingTags(context.equipment))
      if (!normalizeTrainingTags(requirements.equipment).every(item => available.has(item))) fail('equipment', 'missing-equipment')
    }
  }
  if (context.participants !== undefined) {
    if (!requirements?.participants) fail('participants', 'unknown-participants')
    else {
      const needed = requirements.participants
      if (context.participants.count < needed.min || needed.max !== undefined && context.participants.count > needed.max) fail('participants', 'participant-count-mismatch')
      if (needed.roles.length) {
        if (context.participants.roles === undefined) fail('participants', 'unknown-participant-roles')
        else {
          const roles = new Set(normalizeTrainingTags(context.participants.roles))
          if (!normalizeTrainingTags(needed.roles).every(role => roles.has(role))) fail('participants', 'missing-participant-role')
        }
      }
    }
  }
  if (context.space !== undefined) {
    if (!requirements?.space) fail('space', 'unknown-space')
    else {
      const needed = requirements.space, available = context.space
      const direct = available.lengthM >= needed.lengthM && available.widthM >= needed.widthM
      const rotated = available.widthM >= needed.lengthM && available.lengthM >= needed.widthM
      if (!direct && !rotated) fail('space', 'insufficient-space')
    }
  }
  return { eligible: issues.length === 0, issues, metadataKnown: metadata !== null }
}
