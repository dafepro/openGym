// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const NOW = Date.UTC(2026, 9, 10, 12)
let full = false
const realSet = Storage.prototype.setItem
vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
  if (full && key === 'gym_state_v1') throw new DOMException('quota', 'QuotaExceededError')
  return realSet.call(this, key, value)
})
const credential = { id: 'ABCDEFGH', token: 'b'.repeat(64), owner: '', revision: 0, claimed: true }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
let m, bridge, ui, fetcher
async function open() {
  m = await import('./useStore.js'); ui = (await import('./useUI.js')).useUI
  m.useStore.setState({ ready: true, user: null })
  m.useStore.getState().update(s => { s.active = { id: 'test-watch', start: NOW - 60000, d: '2026-10-10', name: 'Test', cur: 0,
    entries: [{ id: '0043', _watchPhase: 'work', target: { reps: 5 }, sets: [{ w: 40, r: 5, done: false }, { w: 40, r: 5, done: false }] }] } })
  bridge = (await import('./useGarminSync.js')).useGarminSync
  return bridge
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(NOW); full = false; localStorage.clear()
  localStorage.setItem('gym_garmin_device_v1', JSON.stringify({ connection: credential, preferences: { vibrate: true, restAlert: true, weightStep: 2.5 } }))
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name, _options, cb) => cb({}) } })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
})
afterEach(() => { ui?.getState().stopRest(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })
function watchEvent() { return { id: 'test-watch:0:0:1', session: 'test-watch', lift: 0, set: 0, scope: 'work', expected: [40, 5], reps: 0, weight: 40, exercise: 'barbell full squat', unit: 'kg', at: NOW / 1000 } }
it('saves a result and its receipt in the same durable write before the next acknowledgment POST', async () => {
  await open()
  fetcher.mockImplementation(async (_url, init) => {
    const data = JSON.parse(init.body)
    if (!data.receipts.length) return json({ phase: 'paired', events: [watchEvent()], commands: [], revision: 1 })
    const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.active.entries[0].sets[0]).toMatchObject({ done: true, r: 0 })
    expect(saved._watch.receipts).toContainEqual({ id: watchEvent().id, status: 'saved' })
    return json({ phase: 'paired', events: [], commands: [], revision: 2 })
  })
  await bridge.getState().transfer()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(bridge.getState().error).toBe('')
})
it('withholds acknowledgments and leaves the live row untouched when local storage is full', async () => {
  await open(); m.useStore.getState().commitWatch(s => { s.active._watchLayout = undefined; const a = s.active; a.entries.forEach(e => { e._watchKey = 'entry'; e.sets.forEach((s, i) => { s._watchKey = String(i) }) }); a._watchLayout = JSON.stringify(a.entries.map(e => [e._watchKey, e.id, e.rid, e.sets.map(s => [s._watchKey, false])])) })
  fetcher.mockResolvedValue(json({ phase: 'paired', events: [watchEvent()], commands: [], revision: 1 }))
  full = true; await bridge.getState().transfer()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(m.useStore.getState().S.active.entries[0].sets[0].done).toBe(false)
  expect(JSON.parse(localStorage.getItem('gym_state_v1'))._watch).toBeUndefined()
  expect(bridge.getState().error).toMatch(/could not save/)
})
it('retries a lost claim with its durable token and keeps confirmation digits', async () => {
  await open(); bridge.setState({ device: { ...bridge.getState().device, connection: { ...credential, claimed: false } } })
  fetcher.mockImplementation(async (url, init) => url.endsWith('/claim') ? json({ phase: 'confirm', challenge: '1234' }) : json({ phase: 'confirm', challenge: '1234' }))
  await bridge.getState().transfer()
  expect(fetcher.mock.calls[0][0]).toMatch(/claim$/)
  expect(JSON.parse(fetcher.mock.calls[0][1].body).token).toBe(credential.token)
  expect(bridge.getState().device.connection.challenge).toBe('1234')
})
it('cancels results after ownership changes while the relay request is in flight', async () => {
  await open(); let resolve
  fetcher.mockImplementation(() => new Promise(r => { resolve = r }))
  const running = bridge.getState().transfer(); await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
  localStorage.setItem('gym_owner', 'other')
  resolve(json({ phase: 'paired', events: [watchEvent()], commands: [], revision: 1 }))
  await running
  expect(m.useStore.getState().S.active.entries[0].sets[0].done).toBe(false)
  expect(m.useStore.getState().S._watch).toBeUndefined()
})
it('does not erase a replacement pairing when another tab disconnects an older connection', async () => {
  await open(); const module = await import('./useGarminSync.js'); module.startGarminSync()
  let resolve; fetcher.mockImplementation(() => new Promise(r => { resolve = r }))
  const disconnect = bridge.getState().disconnect(); await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
  const replacement = { ...bridge.getState().device, connection: { ...credential, id: 'JKLMNPQR', token: 'c'.repeat(64) } }
  localStorage.setItem('gym_garmin_device_v1', JSON.stringify(replacement))
  window.dispatchEvent(new StorageEvent('storage', { key: 'gym_garmin_device_v1' }))
  resolve(json({ ok: true })); await disconnect
  expect(JSON.parse(localStorage.getItem('gym_garmin_device_v1')).connection.token).toBe(replacement.connection.token)
})
it('a stale tab cannot overwrite an acknowledged watch result with a later ordinary edit', async () => {
  await open()
  vi.resetModules(); const stale = (await import('./useStore.js')).useStore
  stale.setState({ ready: true, user: null })
  m.useStore.getState().commitWatch(s => {
    s.active.entries[0].sets[0].done = true; s.active.entries[0].sets[0].r = 0
    s._watch = { owner: '', receipts: [{ id: 'test-watch:0:0:1', status: 'saved' }], review: [] }
  })
  stale.getState().update(s => { s.active.entries[0].sets[1].w = 60 })
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.active.entries[0].sets[0]).toMatchObject({ done: true, r: 0 })
  expect(saved._watch.receipts[0].status).toBe('saved')
  expect(stale.getState().S.active.entries[0].sets[0].done).toBe(true)
})
