import { requireId, validateAssignment } from './content.js'
import { normalizeTrainingTags, SKILL_REGISTRY_VERSION } from './metadata.js'

export const MAX_CUSTOM_DRILLS = 100
const MAX_SOURCE_LENGTH = 2_000_000
const allowed = ['title', 'instructions', 'setup', 'mode', 'sets', 'reps', 'durationSec', 'side', 'restSec', 'tags', 'equipment', 'setting', 'participants', 'space']
const validate = drill => {
  if (!drill?.id?.startsWith('custom-')) throw new Error('Personal drills need their own stable identifier.')
  const checked = validateAssignment({ id: 'custom-validation', revision: 'v1', title: 'Personal drill', status: 'current', drills: [drill] }).drills[0]
  if (checked.mode === 'watch' || checked.media.status !== 'unavailable' || checked.media.id !== checked.id || checked.media.path !== undefined) throw new Error('Personal drills use written instructions and recorded practice, not an unapproved video.')
  return checked
}

/** Make a reusable drill. Setup is retained in its portable instructions. */
export function createCustomDrill(fields, { id = `custom-${crypto.randomUUID()}` } = {}) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).some(key => !allowed.includes(key))) throw new Error('Personal drill details contain unsupported fields.')
  requireId(id, 'Personal drill ID')
  if (!id.startsWith('custom-')) throw new Error('Personal drills need their own stable identifier.')
  const mode = fields.mode ?? 'practice'
  if (!['practice', 'time', 'reps'].includes(mode)) throw new Error('Choose time, repetitions, or self-paced tracking.')
  if (typeof fields.title !== 'string' || typeof fields.instructions !== 'string') throw new Error('Give your drill a name and instructions.')
  if (fields.setup !== undefined && typeof fields.setup !== 'string') throw new Error('Setup must be written instructions.')
  const setup = fields.setup?.trim()
  const instructions = fields.instructions.trim()
  if (!instructions) throw new Error('Write how to do your drill.')
  const requirements = {}
  if (fields.equipment !== undefined) requirements.equipment = normalizeTrainingTags(fields.equipment, { max: 16 })
  if (fields.setting !== undefined) {
    if (!['indoor', 'outdoor', 'either'].includes(fields.setting)) throw new Error('Choose indoors, outdoors, or either.')
    requirements.settings = fields.setting === 'either' ? ['indoor', 'outdoor'] : [fields.setting]
  }
  if (fields.participants !== undefined) requirements.participants = { min: fields.participants, max: fields.participants, roles: [] }
  if (fields.space !== undefined) requirements.space = structuredClone(fields.space)
  return validate({
    id, title: fields.title.trim(), instructions: setup ? `Setup: ${setup}\n\n${instructions}` : instructions,
    mode, sets: mode === 'practice' ? 1 : fields.sets ?? 1,
    ...(mode === 'time' ? { durationSec: fields.durationSec } : {}),
    ...(mode === 'reps' ? { reps: fields.reps } : {}),
    side: mode === 'practice' ? 'both' : fields.side ?? 'both',
    restSec: mode === 'practice' ? null : fields.restSec ?? 0,
    media: { id, status: 'unavailable' },
    metadata: { version: 1, registryVersion: SKILL_REGISTRY_VERSION, tags: normalizeTrainingTags(fields.tags || []), ...(Object.keys(requirements).length ? { requirements } : {}) },
  })
}

/** Recover editable fields without changing the saved drill or historical rows. */
export function customDrillFields(drill) {
  const checked = validate(drill)
  let setup = '', instructions = checked.instructions
  if (instructions.startsWith('Setup: ')) {
    // Setup or instructions may themselves contain paragraphs. Use a boundary
    // that can reconstruct the exact saved text, never trim away internal data.
    for (let split = instructions.indexOf('\n\n', 7); split >= 0; split = instructions.indexOf('\n\n', split + 2)) {
      const before = instructions.slice(7, split).trim(), after = instructions.slice(split + 2).trim()
      if (before && after && `Setup: ${before}\n\n${after}` === instructions) { setup = before; instructions = after; break }
    }
  }
  const fields = {
    title: checked.title, setup, instructions,
    mode: checked.mode, sets: checked.sets, reps: checked.reps ?? 10,
    durationSec: checked.durationSec ?? 45, side: checked.side,
    restSec: checked.restSec ?? (checked.mode === 'practice' ? 20 : 0),
    tags: structuredClone(checked.metadata?.tags || []),
  }
  const requirements = checked.metadata?.requirements
  if (requirements?.equipment !== undefined) fields.equipment = structuredClone(requirements.equipment)
  if (requirements?.settings !== undefined) {
    const settings = requirements.settings
    if (settings.length === 1 && ['indoor', 'outdoor'].includes(settings[0])) fields.setting = settings[0]
    else if (settings.length === 2 && settings.includes('indoor') && settings.includes('outdoor')) fields.setting = 'either'
  }
  if (requirements?.participants !== undefined) fields.participants = requirements.participants.min
  if (requirements?.space !== undefined) fields.space = structuredClone(requirements.space)
  // Future data must never be silently reduced to what this editor understands.
  // Sort object keys for comparison; semantic array order remains unchanged.
  const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
  if (canonical(createCustomDrill(fields, { id: checked.id })) !== canonical(checked)) throw new Error('This saved drill contains details this editor cannot preserve. Keep it saved and create a new drill instead.')
  return fields
}

export function readCustomDrills(source) {
  if (source === null || source === undefined) return []
  if (typeof source !== 'string' || source.length > MAX_SOURCE_LENGTH) throw new Error('Personal drills could not be read. Keep this device’s data for recovery.')
  let data
  try { data = JSON.parse(source) } catch { throw new Error('Personal drills could not be read. Keep this device’s data for recovery.') }
  if (!data || Object.keys(data).some(key => !['version', 'drills'].includes(key)) || data.version !== 1 || !Array.isArray(data.drills) || data.drills.length > MAX_CUSTOM_DRILLS) throw new Error('Personal drills use an unsupported format.')
  const drills = data.drills.map(validate)
  if (new Set(drills.map(item => item.id)).size !== drills.length) throw new Error('Personal drill identifiers conflict.')
  return drills
}

function write(storage, key, expectedSource, update) {
  if (storage.getItem(key) !== expectedSource) throw new Error('Your personal drills changed in another tab. Reload before saving; your draft is still here.')
  const drills = update(readCustomDrills(expectedSource))
  if (drills.length > MAX_CUSTOM_DRILLS) throw new Error('This device already has 100 personal drills.')
  const source = JSON.stringify({ version: 1, drills })
  if (source.length > MAX_SOURCE_LENGTH) throw new Error('Personal drill storage is full. Your draft is still here.')
  storage.setItem(key, source)
  return { drills: structuredClone(drills), source }
}

export function saveCustomDrill(storage, key, expectedSource, drill) {
  const checked = validate(drill)
  return write(storage, key, expectedSource, drills => [checked, ...drills.filter(item => item.id !== checked.id)])
}

export function removeCustomDrill(storage, key, expectedSource, id) {
  requireId(id, 'Personal drill ID')
  return write(storage, key, expectedSource, drills => {
    if (!drills.some(item => item.id === id)) throw new Error('This personal drill is no longer saved.')
    return drills.filter(item => item.id !== id)
  })
}
