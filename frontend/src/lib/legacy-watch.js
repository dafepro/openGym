// Read only the original app's device-local pairing, never its workout database.
// Opening an absent database aborts its creation. Tokens never leave this module
// except for the authenticated request to the existing relay on this origin.
export function legacyWatchConnection(dbFactory = globalThis.indexedDB) {
  if (!dbFactory) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const request = dbFactory.open('uplift-garmin')
    let absent = false
    request.onupgradeneeded = () => { absent = true; request.transaction.abort() }
    request.onerror = () => absent ? resolve(null) : reject(new Error('Could not read the old watch pairing.'))
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('device')) { db.close(); resolve(null); return }
      const tx = db.transaction('device', 'readonly')
      const get = tx.objectStore('device').get('config')
      get.onsuccess = () => {
        const c = get.result?.connection
        resolve(c && /^[A-HJ-NP-Z2-9]{8}$/.test(c.id) && /^[a-f0-9]{64}$/.test(c.token) ? { id: c.id, token: c.token } : null)
      }
      get.onerror = () => reject(new Error('Could not read the old watch pairing.'))
      tx.oncomplete = tx.onabort = () => db.close()
    }
  })
}

export async function releaseLegacyWatch(request) {
  const c = await legacyWatchConnection()
  if (!c) throw new Error('No old pairing on this browser. Use the phone that originally paired the watch.')
  try { await request(c.id + '/revoke', {}, c.token) }
  catch (e) { if (e.status !== 410) throw e }
  // Leave the original database intact for recovery. The old companion retains
  // its outbox and displays Pair again after its next authenticated poll.
}
