import { beforeEach, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { legacyWatchConnection, releaseLegacyWatch } from './legacy-watch.js'
let factory
const connection = { id: 'ABCDEFGH', token: 'a'.repeat(64) }
beforeEach(() => { factory = new IDBFactory(); vi.stubGlobal('indexedDB', factory) })
async function seed(c = connection) {
  const db = await new Promise((resolve, reject) => {
    const r = factory.open('uplift-garmin', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('device')
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
  })
  await new Promise((resolve, reject) => {
    const tx = db.transaction('device', 'readwrite'); tx.objectStore('device').put({ connection: c }, 'config')
    tx.oncomplete = resolve; tx.onerror = reject
  }); db.close()
}
it('does not create an old app database when none exists', async () => {
  expect(await legacyWatchConnection()).toBeNull()
  expect(await factory.databases()).toEqual([])
})
it('reads the original device config without changing it', async () => {
  await seed(); expect(await legacyWatchConnection()).toEqual(connection)
  expect(await factory.databases()).toEqual([{ name: 'uplift-garmin', version: 1 }])
})
it('only revokes on an explicit call, preserves original config and surfaces auth errors', async () => {
  await seed(); const request = vi.fn().mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
  await expect(releaseLegacyWatch(request)).rejects.toThrow('Unauthorized')
  expect(request).toHaveBeenCalledWith('ABCDEFGH/revoke', {}, connection.token)
  expect(await legacyWatchConnection()).toEqual(connection)
  request.mockRejectedValue(Object.assign(new Error('Expired'), { status: 410 }))
  await releaseLegacyWatch(request)
  expect(await legacyWatchConnection()).toEqual(connection)
})
it('rejects malformed legacy credentials without requests', async () => {
  await seed({ id: '../../outside', token: connection.token })
  const request = vi.fn(); await expect(releaseLegacyWatch(request)).rejects.toThrow('No old pairing')
  expect(request).not.toHaveBeenCalled()
})
