import { validateAssignment, validateCatalog } from '../domain/content.js'
import { readSavedPractices } from '../domain/practice-builder.js'

export const CATALOG_CACHE_KEY = 'quicktrack-training:catalog-cache-v1'
const MAX_BYTES = 2 * 1024 * 1024

export function readCatalogCache(storage) {
  const source = storage.getItem(CATALOG_CACHE_KEY)
  if (!source) return null
  if (source.length > MAX_BYTES || new TextEncoder().encode(source).byteLength > MAX_BYTES)
    throw new Error('Saved library is too large')
  const value = JSON.parse(source)
  if (value.version !== 1 || !Number.isSafeInteger(value.savedAt) || value.savedAt < 0)
    throw new Error('Unsupported saved library')
  return { catalog: validateCatalog(value.catalog), savedAt: value.savedAt }
}

export function writeCatalogCache(storage, catalog, now = Date.now()) {
  const source = JSON.stringify({ version: 1, savedAt: now, catalog: validateCatalog(catalog) })
  if (source.length > MAX_BYTES || new TextEncoder().encode(source).byteLength > MAX_BYTES)
    throw new Error('Library is too large to keep offline')
  // setItem is atomic. A quota failure preserves the last valid catalog.
  storage.setItem(CATALOG_CACHE_KEY, source)
}

export function recoveryCatalog(progress, storage, databaseName) {
  let saved = []
  try {
    saved = readSavedPractices(storage.getItem(`${databaseName}:saved-practices-v1`))
  } catch {
    /* Keep recoverable progress accessible. */
  }
  const candidates = [
    progress.activeSession?.assignment,
    ...saved,
    ...progress.sessions
      .slice()
      .reverse()
      .map((s) => s.assignment)
  ]
  const unique = new Map()
  for (const candidate of candidates) {
    try {
      const practice = validateAssignment(candidate)
      const key = `${practice.id}:${practice.revision}`
      if (!unique.has(key)) unique.set(key, practice)
    } catch {
      /* Invalid local content must not block other valid snapshots. */
    }
  }
  const assignments = [...unique.values()].slice(0, 1000)
  if (!assignments.length) return null
  // Only the temporary catalog projection changes. Stored session snapshots stay exact.
  assignments[0] = { ...assignments[0], status: 'current' }
  return validateCatalog({
    schemaVersion: 1,
    revision: 'local-recovery',
    currentAssignmentId: assignments[0].id,
    currentAssignmentRevision: assignments[0].revision,
    assignments
  })
}
