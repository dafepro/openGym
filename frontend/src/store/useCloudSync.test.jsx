// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('../lib/google-drive.js', () => ({ authorizeDrive: vi.fn(), googleDriveProvider: vi.fn(), validClientId: id => !!id }))
import { authorizeDrive, googleDriveProvider } from '../lib/google-drive.js'
import { DEF, useStore } from './useStore.js'
import { useCloudSync, startCloudSync } from './useCloudSync.js'

const clone = x => JSON.parse(JSON.stringify(x))
const workout = id => ({ id, d: '2026-01-01', entries: [{ exId: 'bench', sets: [{ r: 0, w: 20, done: true }] }] })
let p
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear()
  useCloudSync.getState().disconnect()
  useStore.setState({ S: clone(DEF), user: null, ready: true })
  useCloudSync.setState({ clientId: '123-test.apps.googleusercontent.com', connection: null, status: 'off', error: null })
  p = { account: vi.fn(async () => ({ id: 'drive-user', label: 'Test account' })), read: vi.fn(async () => []), append: vi.fn(async () => 'new'), compact: vi.fn(async () => {}) }
  authorizeDrive.mockResolvedValue({ token: 'private-token', expiresAt: Date.now() + 3600000 })
  googleDriveProvider.mockReturnValue(p)
  startCloudSync()
})
afterEach(() => { useCloudSync.getState().disconnect(); localStorage.clear(); vi.clearAllMocks(); vi.useRealTimers() })

describe('device-specific Drive connection lifecycle', () => {
  it('connects a guest after consent and never saves tokens/settings into workout data', async () => {
    const confirm = vi.fn(async () => true)
    useStore.getState().update(s => { s.workouts.push(workout('local')) })
    await useCloudSync.getState().connect(confirm)
    expect(useCloudSync.getState().status).toBe('ok')
    expect(confirm).toHaveBeenCalledWith({ id: 'drive-user', label: 'Test account' })
    expect(JSON.parse(localStorage.getItem('gym_cloud_sync_v1')).connection.owner).toBe('')
    expect(JSON.stringify(useStore.getState().S)).not.toContain('drive-user')
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('private-token')
    expect(p.append.mock.calls[0][0].workouts[0].entries[0].sets[0].r).toBe(0)
  })
  it('does not sync when initial consent is declined', async () => {
    await useCloudSync.getState().connect(async () => false)
    expect(p.read).not.toHaveBeenCalled(); expect(p.append).not.toHaveBeenCalled()
    expect(useCloudSync.getState().connection).toBeNull()
  })
  it('merges remote completed workouts and preserves/reconverts the active session', async () => {
    useStore.getState().update(s => { s.active = { id: 'running', entries: [{ exId: 'bench', sets: [{ w: 20, r: 10 }] }] } })
    p.read.mockResolvedValue([{ id: 'remote', state: { ...clone(DEF), unit: 'lb', unitSet: { at: 9999999999999, convert: true }, workouts: [workout('remote')], _ts: 9999999999999 } }])
    await useCloudSync.getState().connect(async () => true)
    const s = useStore.getState().S
    expect(s.workouts[0].id).toBe('remote'); expect(s.active.id).toBe('running')
    expect(s.unit).toBe('lb'); expect(s.active.entries[0].sets[0].w).toBe(44)
    expect(p.append).not.toHaveBeenCalled() // only remote moved
  })
  it('keeps local edits after network failure and retries on request', async () => {
    p.read.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'google-network' }))
    await useCloudSync.getState().connect(async () => true)
    expect(useCloudSync.getState().status).toBe('offline')
    useStore.getState().update(s => { s.workouts.push(workout('offline')) })
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts[0].id).toBe('offline')
    await useCloudSync.getState().syncNow()
    expect(useCloudSync.getState().status).toBe('ok')
    expect(p.append.mock.calls[0][0].workouts[0].id).toBe('offline')
  })
  it('requires a reconnect for expired permission without prompting in the background', async () => {
    p.read.mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'google-auth' }))
    await useCloudSync.getState().connect(async () => true)
    expect(useCloudSync.getState().status).toBe('auth')
    await useCloudSync.getState().syncNow()
    expect(authorizeDrive).toHaveBeenCalledTimes(1)
    expect(p.append).not.toHaveBeenCalled()
  })
  it('refuses an unexpected Google account on reconnect', async () => {
    await useCloudSync.getState().connect(async () => true)
    p.account.mockResolvedValue({ id: 'other', label: 'Other account' })
    await expect(useCloudSync.getState().connect(async () => true)).rejects.toMatchObject({ code: 'google-account' })
    expect(p.read).toHaveBeenCalledTimes(1)
    expect(useCloudSync.getState().connection.account.id).toBe('drive-user')
  })
  it('pauses on a profile change and never sends the new profile to the old Drive account', async () => {
    await useCloudSync.getState().connect(async () => true)
    localStorage.setItem('gym_owner', 'different-profile')
    useStore.setState({ S: { ...clone(DEF), workouts: [workout('private-other')] }, user: { id: 'different-profile' } })
    expect(useCloudSync.getState().status).toBe('paused')
    await useCloudSync.getState().syncNow()
    expect(p.append).toHaveBeenCalledTimes(1)
  })
  it('cancels stale authorization when disconnected or switched during the popup', async () => {
    let release
    authorizeDrive.mockReturnValue(new Promise(r => { release = r }))
    const connecting = useCloudSync.getState().connect(async () => true)
    useCloudSync.getState().disconnect()
    release({ token: 'late-token', expiresAt: Date.now() + 3600000 })
    await expect(connecting).rejects.toMatchObject({ code: 'cancelled' })
    expect(p.account).not.toHaveBeenCalled(); expect(useCloudSync.getState().status).toBe('off')
  })
  it('cancels a stale pull after disconnect and keeps both local and remote data', async () => {
    await useCloudSync.getState().connect(async () => true)
    let release
    p.read.mockReturnValueOnce(new Promise(r => { release = r }))
    const syncing = useCloudSync.getState().syncNow()
    useCloudSync.getState().disconnect()
    release([{ id: 'old', state: { ...clone(DEF), workouts: [workout('late')] } }])
    await syncing
    expect(useStore.getState().S.workouts).toEqual([])
    expect(useCloudSync.getState().status).toBe('off'); expect(p.compact).toHaveBeenCalledTimes(1)
  })
  it('does not schedule uploads for active-only updates', async () => {
    await useCloudSync.getState().connect(async () => true)
    useStore.getState().update(s => { s.active = { id: 'running' } })
    await vi.advanceTimersByTimeAsync(2100)
    expect(p.append).toHaveBeenCalledTimes(1)
  })
})
