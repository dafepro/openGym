import { validateSession } from '../domain/session.js'

export const DATABASE_NAME = 'quicktrack-training'
const FORMAT = 'quicktrack-training-progress'
const MAX_EXPORT_BYTES = 10 * 1024 * 1024
const copy = value => structuredClone(value)
export const emptyProgress = () => ({ schemaVersion: 1, revision: 0, activeSession: null, sessions: [] })
export function validateProgress(state) {
  if (!state || state.schemaVersion !== 1) throw new Error('Unsupported progress schema; keep the original export for recovery')
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.sessions) || state.sessions.length > 10000) throw new Error('Invalid progress structure')
  const ids = new Set()
  for (const session of state.sessions) {
    validateSession(session)
    if (session.status === 'active' || ids.has(session.id)) throw new Error('History must contain distinct finished sessions')
    ids.add(session.id)
  }
  if (state.activeSession !== null) {
    validateSession(state.activeSession)
    if (state.activeSession.status !== 'active' || ids.has(state.activeSession.id)) throw new Error('Active session conflicts with history')
  }
  return copy(state)
}
export function exportProgress(state, { now = Date.now() } = {}) {
  const checked = validateProgress(state)
  if (!Number.isFinite(now) || now < 0) throw new Error('Export needs a valid timestamp')
  return JSON.stringify({ format: FORMAT, schemaVersion: 1, exportedAt: now, progress: checked }, null, 2)
}
export function parseProgressExport(source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_EXPORT_BYTES) throw new Error('Progress export is too large')
  let data
  try { data = JSON.parse(source) } catch { throw new Error('Progress export is not valid JSON') }
  if (data?.format !== FORMAT || data.schemaVersion !== 1) throw new Error('Unsupported export format; original file has not been changed')
  return validateProgress(data.progress)
}
export function mergeProgress(existing, imported) {
  const result = validateProgress(existing)
  const source = validateProgress(imported)
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  for (const session of source.sessions) {
    const old = result.sessions.find(item => item.id === session.id)
    if (old && !same(old, session)) throw new Error('Import conflicts with an existing immutable session')
    if (result.activeSession?.id === session.id) throw new Error('Import conflicts with the active session; finish or export it first')
    if (!old) result.sessions.push(copy(session))
  }
  if (source.activeSession) {
    if (result.sessions.some(item => item.id === source.activeSession.id)) throw new Error('Imported active session conflicts with saved history')
    if (result.activeSession && !same(result.activeSession, source.activeSession)) throw new Error('Import contains a different active session; export current work first')
    result.activeSession = copy(source.activeSession)
  }
  return validateProgress(result)
}
export class ProgressConflictError extends Error {
  constructor() { super('Training progress changed in another tab. Reload before saving.'); this.name = 'ProgressConflictError' }
}
function openDatabase(indexedDB, name) {
  return new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('Local storage is unavailable; progress has not been saved')); return }
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('progress')
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
    request.onerror = () => reject(request.error || new Error('Cannot open training storage'))
    request.onblocked = () => reject(new Error('Another tab is blocking training storage; close it and retry'))
  })
}
export function createTrainingRepository({ indexedDB = globalThis.indexedDB, name = DATABASE_NAME } = {}) {
  let database
  let queue = Promise.resolve()
  const db = () => database ||= openDatabase(indexedDB, name).catch(error => { database = null; throw error })
  const serialize = task => {
    const next = queue.then(task)
    queue = next.catch(() => {})
    return next
  }
  return {
    load: () => serialize(async () => {
      const handle = await db()
      return new Promise((resolve, reject) => {
        const tx = handle.transaction('progress', 'readonly')
        const get = tx.objectStore('progress').get('state')
        let value
        get.onsuccess = () => { value = get.result ?? emptyProgress() }
        tx.oncomplete = () => { try { resolve(validateProgress(value)) } catch (error) { reject(error) } }
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('Cannot read saved training progress'))
      })
    }),
    save: (state, expectedRevision = state.revision) => serialize(async () => {
      const checked = validateProgress(state)
      const handle = await db()
      return new Promise((resolve, reject) => {
        const tx = handle.transaction('progress', 'readwrite')
        const store = tx.objectStore('progress')
        const get = store.get('state')
        let result, failure
        get.onsuccess = () => {
          try {
            const previous = validateProgress(get.result ?? emptyProgress())
            if (previous.revision !== expectedRevision) throw new ProgressConflictError()
            if (previous.activeSession) {
              const successor = checked.activeSession?.id === previous.activeSession.id ? checked.activeSession : checked.sessions.find(item => item.id === previous.activeSession.id)
              if (!successor) throw new Error('Active session cannot be replaced without finishing it')
              if (JSON.stringify(previous.activeSession.assignment) !== JSON.stringify(successor.assignment)) throw new Error('Active assignment snapshot is immutable')
            }
            for (const saved of previous.sessions) {
              const next = checked.sessions.find(item => item.id === saved.id)
              if (!next || JSON.stringify(saved) !== JSON.stringify(next)) throw new Error('Saved history is immutable; export before recovery')
            }
            result = { ...checked, revision: previous.revision + 1 }
            store.put(result, 'state')
          } catch (error) { failure = error; tx.abort() }
        }
        tx.oncomplete = () => resolve(copy(result))
        tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('Training progress was not saved'))
      })
    }),
    close: () => serialize(async () => { if (database) (await database).close(); database = null }),
  }
}
