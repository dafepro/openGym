// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
let store
beforeEach(async () => {
  localStorage.clear(); vi.resetModules()
  store = (await import('./useStore.js')).useStore
  store.setState({ ready: true })
})
afterEach(() => vi.restoreAllMocks())
it('refuses an update when current workout changes cannot be saved, then recovers without losing them', async () => {
  const original = Storage.prototype.setItem
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
    if (key === 'gym_state_v1') throw new Error('quota')
    return original.call(this, key, value)
  })
  store.getState().update(s => { s.active = { id: 'unsaved-session', entries: [] } }, false)
  await expect(store.getState().saveForUpdate()).rejects.toThrow('Could not save locally')
  expect(store.getState().S.active.id).toBe('unsaved-session')
  blocked.mockRestore()
  await store.getState().saveForUpdate()
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.id).toBe('unsaved-session')
})
it('never saves or permits update reload under an unresolved account owner', async () => {
  store.setState({ user: { id: 'different-account' } })
  await expect(store.getState().saveForUpdate()).rejects.toThrow('Finish switching profiles')
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
