import { beforeEach, expect, it, vi } from 'vitest'
const save = vi.hoisted(() => vi.fn())
vi.mock('./useStore.js', () => ({ useStore: { getState: () => ({ saveForUpdate: save }) } }))
import { useAppUpdates, applyAppUpdate, startAppUpdates } from './useAppUpdates.js'
beforeEach(() => { save.mockReset(); save.mockResolvedValue(); useAppUpdates.setState({ waiting: null, busy: false, error: '', dismissed: false }) })
it('never activates or reloads if the local save fails', async () => {
  const postMessage = vi.fn(), reload = vi.fn(); save.mockRejectedValue(new Error('Storage full'))
  useAppUpdates.setState({ waiting: { postMessage } })
  await applyAppUpdate({}, reload)
  expect(postMessage).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled(); expect(useAppUpdates.getState().error).toBe('Storage full')
})
it('waits for actual activation and reloads only after explicit acceptance', async () => {
  const sw = new EventTarget(), reload = vi.fn()
  const postMessage = vi.fn(() => sw.dispatchEvent(new Event('controllerchange')))
  useAppUpdates.setState({ waiting: { state: 'installed', postMessage } })
  await applyAppUpdate(sw, reload)
  expect(save).toHaveBeenCalledTimes(2); expect(postMessage).toHaveBeenCalledWith({ type: 'UPLIFT_ACTIVATE' }); expect(reload).toHaveBeenCalledOnce()
})
it('detects an already waiting update without activating or reloading another tab', async () => {
  const sw = new EventTarget(), worker = { postMessage: vi.fn() }, reg = new EventTarget()
  reg.waiting = worker; sw.controller = {}; sw.register = vi.fn().mockResolvedValue(reg)
  await startAppUpdates(sw)
  expect(useAppUpdates.getState().waiting).toBe(worker); expect(worker.postMessage).not.toHaveBeenCalled()
  sw.dispatchEvent(new Event('controllerchange')); expect(useAppUpdates.getState().waiting).toBe(null)
})

it('does not reload if changes made during activation cannot be saved', async () => {
  const sw = new EventTarget(), reload = vi.fn()
  save.mockResolvedValueOnce().mockRejectedValueOnce(new Error('Storage full after activation'))
  useAppUpdates.setState({ waiting: { state: 'installed', postMessage: () => sw.dispatchEvent(new Event('controllerchange')) } })
  await applyAppUpdate(sw, reload)
  expect(save).toHaveBeenCalledTimes(2); expect(reload).not.toHaveBeenCalled()
  expect(useAppUpdates.getState().error).toBe('Storage full after activation')
})
