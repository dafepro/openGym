import { create } from 'zustand'
import { useStore } from './useStore.js'
import { useUI } from './useUI.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { bindWatchLayout, watchSnapshot, applyWatchOperations } from '../lib/garmin.js'
import { defaultWatchPreferences, isWatchSnapshot } from '../../../shared/garmin.ts'

import { t } from '../lib/i18n.js'
const KEY = 'gym_garmin_device_v1'
const owner = () => useStore.getState().cloudSyncOwner()
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
function load() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY))
    const c = value?.connection
    if (c && (!/^[A-HJ-NP-Z2-9]{8}$/.test(c.id) || !/^[a-f0-9]{64}$/.test(c.token) || typeof c.owner !== 'string')) return null
    if (!value || typeof value !== 'object') return null
    const preferences = isWatchSnapshot({ v: 1, workout: null, issue: '', preferences: value.preferences }) ? value.preferences : { ...defaultWatchPreferences }
    return { ...value, preferences }
  } catch { return null }
}
let applyingEffects = false
let generation = 0, running = null, controller = null, timer = null, started = false
function persist(device) { localStorage.setItem(KEY, JSON.stringify(device)) }
export async function garminRequest(path, data, credential, signal) {
  const ctl = new AbortController()
  const abort = () => ctl.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) ctl.abort()
  const timeout = setTimeout(abort, 15000)
  try {
    const reply = await fetch('/api/garmin/' + path, { method: data === undefined ? 'GET' : 'POST', credentials: 'omit',
      cache: 'no-store', redirect: 'error', headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(credential ? { Authorization: 'Bearer ' + credential } : {}) }, body: data === undefined ? undefined : JSON.stringify(data), signal: ctl.signal })
    if (!reply.headers.get('content-type')?.includes('application/json')) throw new Error('Watch connection is not available on this host yet.')
    const text = await reply.text()
    if (text.length > 100000) throw new Error('Unexpected watch data.')
    const value = JSON.parse(text)
    if (!reply.ok) throw Object.assign(new Error(value.error || 'Watch transfer failed.'), { status: reply.status })
    return value
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
}
function stop() { generation++; controller?.abort(); controller = null; clearTimeout(timer); timer = null }
function effectsAfterSave(effects) {
  applyingEffects = true
  try { for (const e of effects) {
    const ui = useUI.getState(), a = useStore.getState().S.active
    if (e.kind === 'finish') { ui.stopRest(); ui.stopWork(); useStore.getState().autoBackupNow(); ui.toast(t('Workout saved on this device.')); continue }
    if (e.kind === 'prepare' && a) {
      useUI.setState({ focusPrepared: { sessionId: a.id, entries: [e.lift + ':' + a.entries[e.lift].id] } })
      if (e.phase === 'work') ui.stopRest()
    }
    if (e.kind === 'stop-rest' && ui.timer?.forIdx === e.lift) ui.stopRest()
    if (e.kind === 'station') {
      const left = Math.ceil((e.deadline - Date.now()) / 1000)
      if (left > 0) ui.startRest(left, e.lift); else ui.stopRest()
    }
    if (e.kind === 'logged' && a) {
      useUI.setState({ focusLastSet: { sessionId: a.id, id: a.entries[e.lift].id, at: e.at, side: null } })
      const pending = a.entries.some(entry => entry.sets.some(s => !s.done && !s.skipped && !(entry._watchPhase === 'work' && (s.warmup || s.phase === 'warmup'))))
      const left = Math.ceil((e.deadline - Date.now()) / 1000)
      if (pending && left > 0 && (!ui.timer || ui.timer.endsAt < e.deadline)) ui.startRest(left, e.lift, { forSet: e.set })
    }
  } } finally { applyingEffects = false }
}
const initial = load() || { preferences: { ...defaultWatchPreferences } }
export const useGarminSync = create((set, get) => ({
  device: initial, available: false, checked: false, phase: initial.connection ? 'confirm' : 'idle', busy: false,
  error: '', seen: 0, handoff: null, now: Date.now(),
  async checkServer() {
    if (DEMO || MOBILE) { set({ checked: true }); return }
    try {
      const reply = await garminRequest('config')
      set({ available: reply.v === 1 && reply.available === true, checked: true, error: '' })
    } catch { set({ available: false, checked: true }) }
  },
  async pair(raw) {
    if (get().busy || owner() === null) return
    const id = raw.toUpperCase().replace(/[\s-]/g, '')
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(id)) throw new Error('Enter the eight characters shown on your watch.')
    const previous = get().device.connection
    if (previous && (previous.id !== id || previous.owner !== owner())) throw new Error('Disconnect the current watch before pairing another.')
    stop(); const epoch = generation
    set({ busy: true, error: '' })
    try {
      const connection = previous || { id, token: token(), owner: owner(), revision: 0 }
      // Save BEFORE claim, so retries after lost responses reuse the same credential.
      const device = { ...get().device, connection }
      persist(device); set({ device })
      controller = new AbortController()
      const reply = await garminRequest(id + '/claim', { token: connection.token }, undefined, controller.signal)
      if (epoch !== generation || connection.owner !== owner()) return
      device.connection = { ...connection, challenge: reply.challenge, claimed: true }
      persist(device); set({ device, phase: 'confirm' })
    } catch (e) { if (epoch === generation) set({ error: e.message }); throw e }
    finally { if (epoch === generation) { set({ busy: false }); schedule(200) } }
  },
  async disconnect() {
    if (get().busy) return
    stop(); const epoch = generation, c = get().device.connection
    set({ busy: true })
    controller = new AbortController()
    try {
      if (c) {
        try { await garminRequest(c.id + '/revoke', {}, c.token, controller.signal) }
        catch (e) { if (![401, 410].includes(e.status)) throw e }
      }
      if (epoch !== generation || get().device.connection?.token !== c?.token) return
      const device = { preferences: get().device.preferences }
      persist(device)
      if (epoch === generation) set({ device, phase: 'idle', seen: 0, handoff: null, error: '' })
    } catch (e) { if (epoch === generation) set({ error: e.message }); throw e }
    finally { if (epoch === generation) set({ busy: false }) }
  },
  setPreferences(patch) {
    const device = { ...get().device, preferences: { ...get().device.preferences, ...patch } }
    persist(device); set({ device }); schedule(100)
  },
  async transfer() {
    if (running || get().busy || DEMO || MOBILE || !useStore.getState().ready || document.visibilityState === 'hidden') return running
    const c = get().device.connection
    if (!c || owner() === null || c.owner !== owner() || get().phase === 'expired') return
    const epoch = generation
    const current = () => epoch === generation && owner() === c.owner && get().device.connection?.token === c.token
    controller = new AbortController(); const signal = controller.signal
    set({ busy: true })
    const exchange = async () => {
      if (!current()) return
      if (!get().device.connection.claimed) {
        const claim = await garminRequest(c.id + '/claim', { token: c.token }, undefined, signal)
        if (!current()) return
        const device = { ...get().device, connection: { ...get().device.connection, challenge: claim.challenge, claimed: true } }
        persist(device); set({ device, phase: 'confirm' })
      }
      if (useStore.getState().S.active && !useStore.getState().S.active._watchLayout) useStore.getState().commitWatch(s => bindWatchLayout(s))
      for (let round = 0; round < 3 && current(); round++) {
        const st = useStore.getState(), S = st.S
        const snapshot = watchSnapshot(S, get().device.preferences, useUI.getState())
        const sent = S._watch?.receipts.filter(r => pending.has(r.id)).slice(-60) || []
        const revision = Math.max(get().device.connection.revision || 0, Math.floor(S._ts || 0)) + 1
        const device = { ...get().device, connection: { ...get().device.connection, revision } }
        persist(device); set({ device })
        const reply = await garminRequest(c.id + '/phone', { revision, snapshot, receipts: sent }, c.token, signal)
        if (!current()) return
        if (!['confirm', 'paired', 'waiting'].includes(reply.phase)) throw new Error('Unexpected watch data.')
        if (reply.challenge && get().device.connection.challenge !== reply.challenge) {
          const device = { ...get().device, connection: { ...get().device.connection, challenge: reply.challenge } }
          persist(device); set({ device })
        }
        set({ phase: reply.phase === 'paired' ? 'paired' : 'confirm', seen: reply.watchSeen || 0, now: Date.now(),
          handoff: { snapshot: JSON.stringify(snapshot), revision: reply.revision, watchRevision: reply.watchRevision,
            pending: (reply.events?.length || 0) + (reply.commands?.length || 0) } })
        const events = reply.events || [], commands = reply.commands || []
        // Domain validates every operation before any draft can enter persistence.
        const operations = [...events, ...commands]
        pending.clear(); operations.forEach(o => pending.add(o.id))
        if (!operations.length) break
        if (operations.some(o => !useStore.getState().S._watch?.receipts.some(r => r.id === o.id))) {
          let effects = []
          st.commitWatch(draft => {
            if (!current()) throw new Error('Watch transfer cancelled.')
            const applied = applyWatchOperations(draft, events, commands, useUI.getState())
            applied.state._watch.owner = c.owner
            Object.assign(draft, applied.state); effects = applied.effects
          })
          if (!current()) return
          effectsAfterSave(effects)
        }
        if (!useStore.getState().S._watch?.receipts.some(r => pending.has(r.id) && !sent.some(x => x.id === r.id))) break
      }
      if (current()) set({ error: '' })
    }
    const pending = new Set(get().handoff?.pendingIds || [])
    running = (async () => {
      try {
        if (!navigator.locks) throw new Error('Use a browser with Web Locks to transfer watch entries safely.')
        await navigator.locks.request('opengym-garmin-transfer', { ifAvailable: true }, async lock => { if (lock) await exchange() })
      } catch (e) {
        if (current()) set({ error: e.message, ...([401, 410].includes(e.status) ? { phase: 'expired' } : {}) })
      } finally {
        running = null
        if (current()) { set({ busy: false, handoff: get().handoff && { ...get().handoff, pendingIds: [...pending] } }); schedule(get().handoff?.pending ? 2000 : 5000) }
      }
    })()
    return running
  },
}))
function schedule(delay = 5000) {
  clearTimeout(timer)
  if (useGarminSync.getState().device.connection) timer = setTimeout(() => { void useGarminSync.getState().transfer() }, delay)
}
export function startGarminSync() {
  if (started || DEMO || MOBILE) return
  started = true
  useStore.subscribe((state, prev) => {
    const c = useGarminSync.getState().device.connection
    if (c && (owner() === null || c.owner !== owner())) { stop(); useGarminSync.setState({ busy: false, handoff: null }) }
    else if (state.ready && (!prev.ready || state.S !== prev.S)) schedule(400)
  })
  useUI.subscribe((state, prev) => {
    if (!applyingEffects && useGarminSync.getState().device.connection && useStore.getState().S.active?._watchLayout &&
      (state.timer?.endsAt !== prev.timer?.endsAt || !!state.timer !== !!prev.timer)) {
      useStore.getState().update(s => {
        if (!s.active) return
        s.active._watchRests ||= {}
        if (prev.timer?.forIdx != null) s.active._watchRests[prev.timer.forIdx] = 0
        if (state.timer?.forIdx != null) s.active._watchRests[state.timer.forIdx] = state.timer.ready ? 0 : state.timer.endsAt
      })
    }
    if (state.timer?.endsAt !== prev.timer?.endsAt || state.timer?.paused !== prev.timer?.paused ||
      state.focusPrepared !== prev.focusPrepared || state.focusSkippedWarmups !== prev.focusSkippedWarmups || !!state.work !== !!prev.work) schedule(400)
  })
  window.addEventListener('storage', e => {
    if (e.key === KEY) { stop(); useGarminSync.setState({ device: load() || { preferences: { ...defaultWatchPreferences } }, busy: false, handoff: null }); schedule() }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { clearTimeout(timer); timer = null }
    else schedule(100)
  })
  window.addEventListener('online', () => schedule(100))
  schedule()
}
