import { create } from 'zustand'
import { useStore } from './useStore.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { authorizeDrive, googleDriveProvider, validClientId } from '../lib/google-drive.js'
import { cloudContent, cloudError, syncSnapshots } from '../lib/cloud-sync.js'

const KEY = 'gym_cloud_sync_v1'
const BUILD_CLIENT = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || ''
function readSettings() {
  try {
    const x = JSON.parse(localStorage.getItem(KEY))
    return x && validClientId(x.clientId) ? x : { clientId: BUILD_CLIENT }
  } catch { return { clientId: BUILD_CLIENT } }
}
// Public client ID + consented account/owner binding only. Never tokens or history.
function saveSettings(value) { localStorage.setItem(KEY, JSON.stringify(value)) }
let provider = null, controller = null, generation = 0, running = null, timer = null, started = false
let acknowledged = null
const deviceOwner = () => useStore.getState().cloudSyncOwner()
const available = () => !DEMO && !MOBILE && useStore.getState().ready && deviceOwner() !== null

const initial = readSettings()
export const useCloudSync = create((set, get) => ({
  ...initial, status: initial.connection ? 'auth' : 'off', lastSynced: 0, error: null,
  setClientId(clientId) {
    if (get().connection) throw cloudError('google-connected')
    if (!validClientId(clientId)) throw cloudError('client-id')
    saveSettings({ clientId })
    set({ clientId, error: null })
  },
  async connect(confirm) {
    if (!available()) throw cloudError('google-paused')
    generation++; controller?.abort(); provider = null; acknowledged = null
    const owner = deviceOwner(), before = generation
    // authorizeDrive requests the popup synchronously, while this is still a tap.
    const authorization = authorizeDrive(get().clientId)
    set({ status: 'connecting', error: null })
    try {
      const auth = await authorization
      if (before !== generation || owner !== deviceOwner() || !available()) throw cloudError('cancelled')
      const next = googleDriveProvider(auth)
      const account = await next.account()
      const connection = get().connection
      if (connection && (connection.owner !== owner || connection.account.id !== account.id)) throw cloudError('google-account')
      if (!connection && !await confirm(account)) { set({ status: 'off' }); return }
      if (before !== generation || owner !== deviceOwner() || !available()) throw cloudError('cancelled')
      const settings = { clientId: get().clientId, connection: { owner, account } }
      saveSettings(settings)
      generation++
      controller?.abort(); controller = new AbortController()
      provider = next; acknowledged = null
      set({ ...settings, status: 'pending', error: null })
      await get().syncNow()
    } catch (e) {
      if (before === generation) set({ status: get().connection ? 'auth' : 'off', error: e.code || 'google-network' })
      throw e
    }
  },
  disconnect() {
    // Even if storage refuses, the connection is stopped in memory first.
    generation++; controller?.abort(); controller = null; provider = null; acknowledged = null
    clearTimeout(timer); timer = null
    set({ connection: null, status: 'off', lastSynced: 0, error: null })
    saveSettings({ clientId: get().clientId })
  },
  async syncNow() {
    if (!get().connection) return get()
    if (get().connection.owner !== deviceOwner() || !available()) { set({ status: 'paused' }); return get() }
    if (!provider) { set({ status: 'auth' }); return get() }
    if (running) { await running; if (get().status === 'pending') return get().syncNow(); return get() }
    clearTimeout(timer); timer = null
    const epoch = generation, active = provider, signal = controller.signal
    const current = () => epoch === generation && active === provider && available() && get().connection?.owner === deviceOwner()
    set({ status: 'syncing', error: null })
    running = (async () => {
      try {
        const result = await syncSnapshots(active, {
          signal, current, getState: () => useStore.getState().S,
          apply: remote => useStore.getState().mergeCloudState(remote),
        })
        if (!current()) return
        acknowledged = result.content
        set({ status: result.pending ? 'pending' : 'ok', lastSynced: Date.now(), error: null })
        if (result.pending) schedule()
      } catch (e) {
        if (!current()) return
        const code = e.code || 'google-network'
        if (code === 'google-auth') { provider = null; controller.abort() }
        set({ status: code === 'google-auth' ? 'auth' : code === 'google-network' ? 'offline' : 'error', error: code })
      } finally { running = null }
    })()
    await running
    return get()
  },
}))

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(() => { timer = null; useCloudSync.getState().syncNow() }, 2000)
}
// Started once by main.jsx, alongside media sync. Server sync remains available;
// Drive can also serve a guest browser/PWA without a passkey or openGym server.
export function startCloudSync() {
  if (started || DEMO || MOBILE) return
  started = true
  useStore.subscribe((now, prev) => {
    const cloud = useCloudSync.getState()
    if (!cloud.connection) return
    if (cloud.connection.owner !== deviceOwner() || !available()) {
      generation++; controller?.abort(); provider = null; acknowledged = null
      clearTimeout(timer); timer = null
      useCloudSync.setState({ status: 'paused' })
      return
    }
    if (!provider) { if (cloud.status === 'paused') useCloudSync.setState({ status: 'auth' }); return }
    if (now.S !== prev.S && cloudContent(now.S) !== acknowledged) {
      if (!running) useCloudSync.setState({ status: 'pending' })
      schedule()
    }
  })
  const resume = () => {
    if (document.visibilityState !== 'hidden') useCloudSync.getState().syncNow()
  }
  window.addEventListener('online', resume)
  window.addEventListener('focus', resume)
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('storage', e => {
    if (e.key !== KEY && e.key !== 'gym_owner') return
    generation++; controller?.abort(); provider = null; acknowledged = null
    clearTimeout(timer); timer = null
    const saved = readSettings()
    useCloudSync.setState({ ...saved, connection: saved.connection || null, status: saved.connection ? 'auth' : 'off', error: null })
  })
  setInterval(resume, 30000)
}
