import { validateDrillMetadata } from './metadata.js'

// AGPL-3.0-or-later. Training content is deliberately separate from public app code.
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
export const clone = value => structuredClone(value)
export function requireId(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`${label} must be a stable identifier`)
}
const text = (value, label, max = 2000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} is required (maximum ${max} characters)`)
}
export function quantity(value, label, max = 86400) {
  if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label} must be between 0 and ${max}`)
}
function fields(value, allowed, label) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`${label} contains unsupported fields; publish a child-safe projection`)
}
function unique(items, label) {
  const ids = items.map(item => item.id)
  if (new Set(ids).size !== ids.length) throw new Error(`${label} must have unique IDs`)
}
export function validateAssignment(assignment) {
  if (!plain(assignment)) throw new Error('Assignment must be an object')
  fields(assignment, ['id', 'revision', 'title', 'assignedOn', 'status', 'drills'], 'Assignment')
  requireId(assignment.id, 'Assignment ID'); requireId(assignment.revision, 'Assignment revision')
  text(assignment.title, 'Assignment title', 240)
  if (!['current', 'archived'].includes(assignment.status)) throw new Error('Assignment status must be current or archived')
  if (assignment.assignedOn != null && (!/^\d{4}-\d{2}-\d{2}$/.test(assignment.assignedOn) || new Date(`${assignment.assignedOn}T00:00:00Z`).toISOString().slice(0, 10) !== assignment.assignedOn)) throw new Error('Assignment date must be a valid YYYY-MM-DD')
  if (!Array.isArray(assignment.drills) || !assignment.drills.length || assignment.drills.length > 100) throw new Error('Assignment needs 1–100 drills')
  unique(assignment.drills, 'Drill occurrences')
  for (const drill of assignment.drills) {
    if (!plain(drill)) throw new Error('Drill must be an object')
    fields(drill, ['id', 'title', 'instructions', 'mode', 'sets', 'reps', 'durationSec', 'side', 'restSec', 'media', 'metadata'], 'Drill')
    if (drill.metadata !== undefined) validateDrillMetadata(drill.metadata)
    requireId(drill.id, 'Drill occurrence ID'); text(drill.title, 'Drill title', 240)
    text(drill.instructions, 'Drill instructions')
    if (!['reps', 'time', 'watch'].includes(drill.mode)) throw new Error('Drill mode must be reps, time or watch')
    if (!['both', 'each'].includes(drill.side)) throw new Error('Drill side must be both or each')
    if (!Number.isInteger(drill.sets) || drill.sets < 1 || drill.sets > 100) throw new Error('Sets must be an integer from 1 to 100')
    if (drill.mode === 'reps') {
      quantity(drill.reps, 'Repetitions', 10000)
      if (!Number.isInteger(drill.reps) || drill.reps < 1) throw new Error('Repetitions must be a positive integer')
    }
    if (drill.mode === 'time') {
      quantity(drill.durationSec, 'Duration')
      if (drill.durationSec <= 0) throw new Error('Duration must be positive')
    }
    if (drill.mode === 'watch' && (drill.sets !== 1 || drill.side !== 'both')) throw new Error('Watch-only content has one review, without sides')
    if (drill.restSec !== null) quantity(drill.restSec, 'Rest duration', 3600)
    if (!plain(drill.media)) throw new Error('Media availability must be explicit')
    fields(drill.media, ['id', 'status', 'path'], 'Media')
    requireId(drill.media.id, 'Media ID')
    if (!['approved', 'unavailable'].includes(drill.media.status)) throw new Error('Media must be approved or unavailable')
    if (drill.media.path != null && !/^\/media\/[a-zA-Z0-9._/-]+$/.test(drill.media.path)) throw new Error('Media path must be an approved same-origin /media/ path')
    if (drill.media.path?.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Media path cannot traverse directories')
    if (drill.media.status === 'approved' && drill.media.path !== `/media/${drill.media.id}`) throw new Error('Approved media path must match its manifest media ID')
  }
  return clone(assignment)
}
export function validateCatalog(catalog) {
  if (!plain(catalog) || catalog.schemaVersion !== 1) throw new Error('Unsupported catalog schema')
  fields(catalog, ['schemaVersion', 'revision', 'synthetic', 'currentAssignmentId', 'currentAssignmentRevision', 'assignments'], 'Catalog')
  if (catalog.synthetic != null && typeof catalog.synthetic !== 'boolean') throw new Error('Synthetic marker must be boolean')
  requireId(catalog.revision, 'Catalog revision')
  if (!Array.isArray(catalog.assignments) || catalog.assignments.length > 1000) throw new Error('Catalog assignments must be a bounded list')
  const editions = catalog.assignments.map(item => `${item.id}:${item.revision}`)
  if (new Set(editions).size !== editions.length) throw new Error('Assignment editions must have unique ID/revision pairs')
  catalog.assignments.forEach(validateAssignment)
  requireId(catalog.currentAssignmentId, 'Current assignment')
  if (catalog.currentAssignmentRevision != null) requireId(catalog.currentAssignmentRevision, 'Current assignment revision')
  const matches = catalog.assignments.filter(item => item.id === catalog.currentAssignmentId && (!catalog.currentAssignmentRevision || item.revision === catalog.currentAssignmentRevision))
  if (matches.length !== 1) throw new Error('Current selection must identify one exact assignment edition')
  const selected = matches[0]
  if (!selected || selected.status !== 'current') throw new Error('Current selection must reference an available current assignment')
  if (catalog.synthetic === true && !catalog.assignments.every(item => item.title.startsWith('Synthetic'))) throw new Error('Synthetic assignments must be visibly labeled')
  return clone(catalog)
}
export function selectCurrentAssignment(catalog) {
  const checked = validateCatalog(catalog)
  return checked.assignments.find(item => item.id === checked.currentAssignmentId && (!checked.currentAssignmentRevision || item.revision === checked.currentAssignmentRevision))
}
