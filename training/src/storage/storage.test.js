import { afterEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { syntheticCatalog } from '../../fixtures/catalog.js'
import { createSession, reduceSession, selectCurrentAssignment } from '../domain/index.js'
import { createTrainingRepository, emptyProgress, exportProgress, mergeProgress, parseProgressExport, ProgressConflictError, validateProgress } from './index.js'
const repositories = []
afterEach(async () => { await Promise.all(repositories.splice(0).map(repo => repo.close())) })
const repository = (indexedDB = new IDBFactory()) => {
  const result = createTrainingRepository({ indexedDB }); repositories.push(result); return result
}
function activeState() {
  return { ...emptyProgress(), activeSession: createSession(selectCurrentAssignment(syntheticCatalog), { id: 'persist-test', now: 0 }) }
}
function finishedState() {
  const state = activeState()
  const session = reduceSession(state.activeSession, { type: 'FINISH', id: 'finish-command', sessionId: 'persist-test', now: 1000 })
  return { ...state, activeSession: null, sessions: [session] }
}
describe('isolated atomic local persistence', () => {
  it('writes and reopens the active session and timer together', async () => {
    const factory = new IDBFactory(); const first = repository(factory)
    let state = activeState()
    const timed = structuredClone(selectCurrentAssignment(syntheticCatalog))
    timed.drills = [timed.drills.find(drill => drill.mode === 'time')]
    state.activeSession = createSession(timed, { id: 'persist-timed', now: 0 })
    state.activeSession = reduceSession(state.activeSession, { type: 'START', id: 'start-timer', sessionId: 'persist-timed', rowId: state.activeSession.currentRowId, now: 0 })
    state = await first.save(state)
    expect(state.revision).toBe(1)
    await first.close()
    expect(await repository(factory).load()).toEqual(state)
  })
  it('serializes saves and refuses stale revisions from a second tab', async () => {
    const factory = new IDBFactory(); const a = repository(factory); const b = repository(factory)
    const stale = await b.load()
    const saved = await a.save(activeState())
    await expect(b.save(stale)).rejects.toBeInstanceOf(ProgressConflictError)
    expect(await b.load()).toEqual(saved)
    await expect(a.save(saved)).resolves.toMatchObject({ revision: 2 })
  })
  it('does not silently rewrite or delete saved history', async () => {
    const repo = repository(); const saved = await repo.save(finishedState())
    const changed = structuredClone(saved); changed.sessions[0].assignment.title = 'Synthetic changed title'
    await expect(repo.save(changed)).rejects.toThrow('immutable')
    await expect(repo.save({ ...saved, sessions: [] })).rejects.toThrow('immutable')
    expect(await repo.load()).toEqual(saved)
  })
  it('does not claim save success when IndexedDB is unavailable', async () => {
    const repo = repository(null)
    await expect(repo.save(activeState())).rejects.toThrow('not been saved')
  })
  it('preserves the active snapshot when finalizing, and refuses silent replacement', async () => {
    const repo = repository(); const saved = await repo.save(activeState())
    const final = reduceSession(saved.activeSession, { type: 'FINISH', id: 'finish', sessionId: saved.activeSession.id, now: 1000 })
    const changed = structuredClone(final); changed.assignment.title = 'Synthetic rewritten snapshot'
    await expect(repo.save({ ...saved, activeSession: null, sessions: [changed] })).rejects.toThrow('immutable')
    await expect(repo.save({ ...saved, activeSession: null })).rejects.toThrow('without finishing')
    await expect(repo.save({ ...saved, activeSession: null, sessions: [final] })).resolves.toMatchObject({ activeSession: null, sessions: [final] })
  })
  it('rejects unknown data schema without resetting or modifying input', () => {
    const unknown = { ...activeState(), schemaVersion: 999 }
    expect(() => validateProgress(unknown)).toThrow('Unsupported progress schema')
    expect(unknown.schemaVersion).toBe(999)
  })
})
describe('portable private progress exports', () => {
  it('round trips populated history and rejects broken formats and snapshots', () => {
    const state = finishedState()
    expect(parseProgressExport(exportProgress(state, { now: 2000 }))).toEqual(state)
    expect(() => parseProgressExport('{')).toThrow('not valid JSON')
    const data = JSON.parse(exportProgress(state)); data.schemaVersion = 99
    expect(() => parseProgressExport(JSON.stringify(data))).toThrow('Unsupported export')
    data.schemaVersion = 1; data.progress.sessions[0].rows[0].target = 999
    expect(() => parseProgressExport(JSON.stringify(data))).toThrow('prescription changed')
  })
  it('merges new immutable sessions and refuses collisions and active-work replacement', () => {
    const finished = finishedState()
    const merged = mergeProgress(emptyProgress(), finished)
    expect(merged.sessions).toEqual(finished.sessions)
    expect(mergeProgress(merged, finished).sessions).toHaveLength(1)
    const collision = structuredClone(finished); collision.sessions[0].endedAt = 9999
    expect(() => mergeProgress(merged, collision)).toThrow('immutable session')
    expect(() => mergeProgress(activeState(), finished)).toThrow('active session')
  })
  it('does not import inconsistent timer ownership or false completion', () => {
    const state = activeState()
    state.activeSession.rows[0].status = 'done'; state.activeSession.rows[0].prescriptionMet = true
    expect(() => validateProgress(state)).toThrow('actual quantity')
    const another = finishedState(); another.sessions[0].status = 'completed'
    expect(() => validateProgress(another)).toThrow('Partial work')
  })
  it('validates restored undo checkpoints before they can install invalid repetitions', () => {
    const state = activeState()
    const send = (type, now) => { state.activeSession = reduceSession(state.activeSession, { type, now, id: `${type}-${now}`, sessionId: state.activeSession.id, rowId: state.activeSession.currentRowId }) }
    send('START', 0); send('DONE', 1000)
    const backup = JSON.parse(exportProgress(state))
    backup.progress.activeSession.lastCompletion.before.actual = 0.5
    expect(() => parseProgressExport(JSON.stringify(backup))).toThrow('reps must be whole')
    const valid = parseProgressExport(exportProgress(state))
    valid.activeSession = reduceSession(valid.activeSession, { type: 'UNDO', id: 'undo-restored', now: 2000, sessionId: valid.activeSession.id, rowId: valid.activeSession.currentRowId })
    expect(() => validateProgress(valid)).not.toThrow()
    expect(valid.activeSession.rows[0].status).toBe('pending')
  })
  it('rejects restored pending quantities and watch-only athletic results before any action', () => {
    const state = activeState()
    const backup = JSON.parse(exportProgress(state))
    backup.progress.activeSession.rows[0].actual = 2
    expect(() => parseProgressExport(JSON.stringify(backup))).toThrow('inconsistent')
    backup.progress.activeSession.rows[0].actual = null
    backup.progress.activeSession.rows.find(row => row.mode === 'watch').actual = 0
    expect(() => parseProgressExport(JSON.stringify(backup))).toThrow('inconsistent')
  })
})
