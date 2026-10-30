import { validateAssignment, requireId } from './content.js'

const FORMAT = 'quicktrack-practice'
export const MAX_SHARE_LENGTH = 12000
export const SHARED_PREFIX = '#/shared/'
const copy = value => structuredClone(value)

export function drillLibrary(catalog) {
  const seen = new Set()
  return catalog.assignments.flatMap(assignment => assignment.drills).filter(drill => {
    // One demonstration can occur in several assigned sessions. Keep the first
    // current prescription while retaining distinct custom/no-video exercises.
    const key = drill.media.status === 'approved' ? drill.media.id : drill.id
    if (seen.has(key)) return false
    seen.add(key); return true
  }).map(copy)
}

export function createPractice(title, drills, { id, revision } = {}) {
  requireId(id, 'Practice ID'); requireId(revision, 'Practice revision')
  return validateAssignment({ id, revision, title: title.trim(), status: 'current', drills: copy(drills) })
}

export function changePrescription(drill, values) {
  const next = { ...copy(drill), ...values }
  if (next.mode === 'watch') {
    next.sets = 1; next.side = 'both'; next.restSec = null
    delete next.reps; delete next.durationSec
  } else if (next.mode === 'reps') delete next.durationSec
  else if (next.mode === 'time') delete next.reps
  return next
}

// A share is a practice snapshot only. Never serialize controller state, browser
// storage, cookies or credentials. Encoding is portability, not authentication.
export function encodePractice(assignment) {
  const checked = validateAssignment(assignment)
  const bytes = new TextEncoder().encode(JSON.stringify({ format: FORMAT, version: 1, assignment: checked }))
  const token = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  if (token.length > MAX_SHARE_LENGTH) throw new Error('This practice is too large for a link. Share fewer drills or shorten the instructions.')
  return token
}

export function decodePractice(token, catalog) {
  if (typeof token !== 'string' || !token.length || token.length > MAX_SHARE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('This practice link is incomplete or unsupported.')
  let data
  try {
    const bytes = Uint8Array.from(atob(token.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0))
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch { throw new Error('This practice link could not be read. Ask for a new link.') }
  if (!data || Object.keys(data).some(key => !['format', 'version', 'assignment'].includes(key)) || data.format !== FORMAT || data.version !== 1) throw new Error('This practice link uses an unsupported version.')
  const assignment = validateAssignment(data.assignment)
  const available = new Set(catalog.assignments.flatMap(item => item.drills).filter(drill => drill.media.status === 'approved').map(drill => drill.media.id))
  for (const drill of assignment.drills) {
    // A shared payload cannot authorize or introduce a new media endpoint.
    if (!available.has(drill.media.id)) drill.media = { id: drill.media.id, status: 'unavailable' }
  }
  return assignment
}

export function practiceLink(assignment, origin) {
  const base = new URL(origin)
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) throw new Error('Use the training site to create a practice link.')
  return `${base.origin}/${SHARED_PREFIX}${encodePractice(assignment)}`
}

export function readSavedPractices(source) {
  if (source == null) return []
  if (typeof source !== 'string' || source.length > 2_000_000) throw new Error('Saved practices could not be read. Keep this device’s data for recovery.')
  const data = JSON.parse(source)
  if (data?.version !== 1 || !Array.isArray(data.practices) || data.practices.length > 100) throw new Error('Saved practices use an unsupported format.')
  const checked = data.practices.map(validateAssignment)
  if (new Set(checked.map(item => item.id)).size !== checked.length) throw new Error('Saved practice identifiers conflict.')
  return checked
}

export function savePractice(storage, key, expected, assignment) {
  if (storage.getItem(key) !== expected) throw new Error('Your saved practices changed in another tab. Reload before saving; your draft is still here.')
  const practices = readSavedPractices(expected)
  const checked = validateAssignment(assignment)
  const next = [checked, ...practices.filter(item => item.id !== checked.id)]
  if (next.length > 100) throw new Error('This device already has 100 saved practices.')
  const source = JSON.stringify({ version: 1, practices: next })
  if (source.length > 2_000_000) throw new Error('Saved practice storage is full. Your draft is still available to share.')
  storage.setItem(key, source)
  return { practices: next, source }
}
