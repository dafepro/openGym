import { expect, it } from 'vitest'
import { syntheticCatalog } from '../../fixtures/catalog.js'
import { createSession, selectCurrentAssignment } from '../domain/index.js'
import { emptyProgress } from './index.js'
import { CATALOG_CACHE_KEY, readCatalogCache, writeCatalogCache, recoveryCatalog } from './catalog-cache.js'

const storage = () => {
  const data = new Map()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}
it('retains the last validated catalog when validation or quota prevents replacement', () => {
  const local = storage()
  writeCatalogCache(local, syntheticCatalog, 100)
  const saved = local.getItem(CATALOG_CACHE_KEY)
  expect(() => writeCatalogCache(local, { assignments: [] })).toThrow()
  expect(local.getItem(CATALOG_CACHE_KEY)).toBe(saved)
  expect(() =>
    writeCatalogCache(
      {
        ...local,
        setItem() {
          throw new Error('quota')
        }
      },
      syntheticCatalog
    )
  ).toThrow('quota')
  expect(readCatalogCache(local)).toEqual({ catalog: syntheticCatalog, savedAt: 100 })
})
it('rejects damaged and future-version cache data', () => {
  for (const source of [
    '{broken',
    JSON.stringify({ version: 2, savedAt: 1, catalog: syntheticCatalog }),
    JSON.stringify({ version: 1, savedAt: 1, catalog: {} })
  ])
    expect(() => readCatalogCache({ getItem: () => source })).toThrow()
})
it('recovers active work before saved/history snapshots without rewriting any snapshot', () => {
  const practice = { ...selectCurrentAssignment(syntheticCatalog), status: 'archived' }
  const progress = { ...emptyProgress(), activeSession: createSession(practice, { id: 'recover', now: 100 }) }
  const before = structuredClone(progress)
  const recovered = recoveryCatalog(progress, { getItem: () => '{broken' }, 'test')
  expect(recovered.currentAssignmentId).toBe(practice.id)
  expect(recovered.assignments[0].status).toBe('current')
  expect(progress).toEqual(before)
  expect(recovered.synthetic).not.toBe(true)
})
it('opens a saved practice without a catalog or active session and leaves empty devices empty', () => {
  const local = storage(),
    practice = selectCurrentAssignment(syntheticCatalog)
  expect(recoveryCatalog(emptyProgress(), local, 'test')).toBeNull()
  local.setItem('test:saved-practices-v1', JSON.stringify({ version: 1, practices: [practice] }))
  expect(recoveryCatalog(emptyProgress(), local, 'test').assignments).toEqual([practice])
})
