import { expect, it, vi } from 'vitest'
import { prepareOfflineShell } from './offline-shell.js'

it('reports a failed install instead of treating registration as offline readiness', async () => {
  const worker = new EventTarget()
  worker.state = 'installing'
  const serviceWorker = { register: vi.fn(async () => ({ installing: worker })) }
  const pending = expect(prepareOfflineShell(serviceWorker)).rejects.toThrow('installation failed')
  await Promise.resolve()
  worker.state = 'redundant'
  worker.dispatchEvent(new Event('statechange'))
  await pending
})
it('keeps an existing active shell usable while a newer worker waits', async () => {
  const postMessage = vi.fn()
  await prepareOfflineShell({ register: async () => ({ active: {}, waiting: { postMessage } }) })
  expect(postMessage).not.toHaveBeenCalled()
})
