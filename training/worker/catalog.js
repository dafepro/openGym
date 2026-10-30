import { HASH, digest, readLimited, safeId } from './http.js'

export const TYPES = new Set(['video/mp4'])
const MAX_CATALOG = 1024 * 1024
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const requireValue = value => { if (!value) throw new Error('Invalid private catalog') }
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max

// Projection prevents server-only provenance/registry fields leaking into the child payload.
function childCatalog(raw, revision) {
  requireValue(object(raw) && raw.schemaVersion === 1 && raw.revision === revision && safeId(raw.currentAssignmentId))
  requireValue(Array.isArray(raw.assignments) && raw.assignments.length > 0 && raw.assignments.length <= 1000)
  const assignments = raw.assignments.map(assignment => {
    requireValue(object(assignment) && safeId(assignment.id) && safeId(assignment.revision) && text(assignment.title, 240) && ['current', 'archived'].includes(assignment.status))
    requireValue(Array.isArray(assignment.drills) && assignment.drills.length > 0 && assignment.drills.length <= 100)
    const drills = assignment.drills.map(drill => {
      requireValue(object(drill) && safeId(drill.id) && text(drill.title, 240) && text(drill.instructions, 2000))
      requireValue(['reps', 'time', 'watch'].includes(drill.mode) && ['both', 'each'].includes(drill.side) && Number.isInteger(drill.sets) && drill.sets >= 1 && drill.sets <= 100)
      requireValue(drill.restSec === null || Number.isFinite(drill.restSec) && drill.restSec >= 0 && drill.restSec <= 3600)
      requireValue(object(drill.media) && safeId(drill.media.id) && ['approved', 'unavailable'].includes(drill.media.status))
      if (drill.media.path != null) requireValue(drill.media.path === '/media/' + drill.media.id)
      if (drill.media.status === 'approved') requireValue(drill.media.path === '/media/' + drill.media.id)
      if (drill.mode === 'reps') requireValue(Number.isInteger(drill.reps) && drill.reps >= 1 && drill.reps <= 10000)
      if (drill.mode === 'time') requireValue(Number.isFinite(drill.durationSec) && drill.durationSec > 0 && drill.durationSec <= 86400)
      if (drill.mode === 'watch') requireValue(drill.sets === 1 && drill.side === 'both')
      return { id: drill.id, title: drill.title, instructions: drill.instructions, mode: drill.mode, sets: drill.sets,
        ...(drill.mode === 'reps' ? { reps: drill.reps } : {}), ...(drill.mode === 'time' ? { durationSec: drill.durationSec } : {}),
        side: drill.side, restSec: drill.restSec, media: { id: drill.media.id, status: drill.media.status, ...(drill.media.path ? { path: drill.media.path } : {}) } }
    })
    requireValue(new Set(drills.map(drill => drill.id)).size === drills.length)
    if (assignment.assignedOn != null) requireValue(/^\d{4}-\d{2}-\d{2}$/.test(assignment.assignedOn) && new Date(assignment.assignedOn + 'T00:00:00Z').toISOString().slice(0, 10) === assignment.assignedOn)
    return { id: assignment.id, revision: assignment.revision, title: assignment.title, status: assignment.status,
      ...(assignment.assignedOn ? { assignedOn: assignment.assignedOn } : {}), drills }
  })
  requireValue(new Set(assignments.map(assignment => assignment.id + ':' + assignment.revision)).size === assignments.length)
  if (raw.currentAssignmentRevision != null) requireValue(safeId(raw.currentAssignmentRevision))
  const selected = assignments.filter(assignment => assignment.id === raw.currentAssignmentId && (!raw.currentAssignmentRevision || assignment.revision === raw.currentAssignmentRevision))
  requireValue(selected.length === 1 && selected[0].status === 'current')
  return { schemaVersion: 1, revision, currentAssignmentId: raw.currentAssignmentId,
    ...(raw.currentAssignmentRevision ? { currentAssignmentRevision: raw.currentAssignmentRevision } : {}), assignments }
}

export async function loadCatalog(env) {
  if (!safeId(env.CATALOG_REVISION) || !HASH.test(env.CATALOG_SHA256) || typeof env.TRAINING_CONTENT?.get !== 'function') throw new Error('Catalog unavailable')
  const stored = await env.TRAINING_CONTENT.get(`catalogs/${env.CATALOG_REVISION}.json`)
  if (!stored?.body || !Number.isInteger(stored.size) || stored.size < 1 || stored.size > MAX_CATALOG) throw new Error('Catalog unavailable')
  const bytes = await readLimited(stored.body, MAX_CATALOG)
  if (bytes.length !== stored.size || await digest(bytes) !== env.CATALOG_SHA256) throw new Error('Catalog unavailable')
  const envelope = JSON.parse(new TextDecoder().decode(bytes))
  requireValue(object(envelope) && envelope.schemaVersion === 1 && envelope.revision === env.CATALOG_REVISION)
  const catalog = childCatalog(envelope.catalog, envelope.revision)
  requireValue(Array.isArray(envelope.media) && envelope.media.length <= 10000)
  const registry = new Map()
  for (const entry of envelope.media) {
    requireValue(object(entry) && safeId(entry.id) && HASH.test(entry.sha256) && Number.isSafeInteger(entry.byteLength) && entry.byteLength > 0 && TYPES.has(entry.contentType) && !registry.has(entry.id))
    registry.set(entry.id, { id: entry.id, sha256: entry.sha256, byteLength: entry.byteLength, contentType: entry.contentType })
  }
  const approved = new Set(catalog.assignments.flatMap(assignment => assignment.drills.filter(drill => drill.media.status === 'approved').map(drill => drill.media.id)))
  for (const id of approved) requireValue(registry.has(id))
  return { catalog, media: new Map([...registry].filter(([id]) => approved.has(id))) }
}
