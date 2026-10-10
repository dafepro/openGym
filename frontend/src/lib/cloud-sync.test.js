import { describe, it, expect, vi } from 'vitest'
import { cloudState, cloudContent, syncSnapshots } from './cloud-sync.js'
import { mergeStates, stampChange } from './sync-merge.js'

const state = (ids = [], extra = {}) => ({ unit: 'kg', workouts: ids.map(id => ({ id, d: '2026-01-01', entries: [] })), routines: [], _ts: 1, ...extra })
function harness(initial, provider, extra = {}) {
  let local = initial
  const run = () => syncSnapshots(provider, { getState: () => local, apply: remote => { local = { ...mergeStates(local, remote, { deterministic: true }), active: local.active } }, current: () => true, ...extra })
  return { run, get: () => local, set: s => { local = s } }
}
describe('snapshot replication contract', () => {
  it('merges offline history and writes before compacting the exact source IDs', async () => {
    const read = [{ id: 'remote', state: state(['phone']) }]
    const p = { read: vi.fn(async () => read), append: vi.fn(async s => { expect(s.active).toBeUndefined() }), compact: vi.fn(async ids => expect(ids).toEqual(['remote'])) }
    const h = harness(state(['desktop'], { active: { id: 'running' } }), p)
    await h.run()
    expect(h.get().workouts.map(w => w.id).sort()).toEqual(['desktop', 'phone'])
    expect(h.get().active.id).toBe('running')
    expect(p.append.mock.invocationCallOrder[0]).toBeLessThan(p.compact.mock.invocationCallOrder[0])
  })
  it('keeps simultaneous writes as heads, then converges without overwriting either', async () => {
    const files = new Map([['base', state()]])
    let arrivals = 0, release
    const barrier = new Promise(r => { release = r })
    let next = 0
    const p = {
      read: async () => { const out = [...files].map(([id, s]) => ({ id, state: s })); if (++arrivals <= 2) { if (arrivals === 2) release(); await barrier }; return out },
      append: async s => { files.set('new' + ++next, structuredClone(s)) },
      compact: async ids => { for (const id of ids) files.delete(id) },
    }
    const a = harness(state(['a']), p), b = harness(state(['b']), p)
    await Promise.all([a.run(), b.run()])
    expect(files.size).toBe(2)
    await a.run()
    expect(files.size).toBe(1)
    await b.run()
    expect(a.get().workouts.map(w => w.id).sort()).toEqual(['a', 'b'])
    expect(b.get().workouts.map(w => w.id).sort()).toEqual(['a', 'b'])
  })
  it('never compacts after a failed upload and never applies a failed read', async () => {
    const p = { read: vi.fn(async () => [{ id: 'a', state: state(['a']) }]), append: vi.fn(async () => { throw new Error('offline') }), compact: vi.fn() }
    await expect(harness(state(['b']), p).run()).rejects.toThrow('offline')
    expect(p.compact).not.toHaveBeenCalled()
    p.read.mockRejectedValueOnce(new Error('broken'))
    const h = harness(state(['b']), p)
    await expect(h.run()).rejects.toThrow('broken')
    expect(h.get().workouts[0].id).toBe('b')
  })
  it('includes edits during a download and leaves edits during upload pending', async () => {
    let release, uploading
    const gate = new Promise(r => { release = r })
    const begun = new Promise(r => { uploading = r })
    const p = { read: async () => { h.set(state(['during-read'])); return [] }, append: async s => { expect(s.workouts[0].id).toBe('during-read'); uploading(); await gate } }
    const h = harness(state(), p)
    const running = h.run(); await begun
    h.set(state(['during-read', 'during-write']))
    release()
    expect((await running).pending).toBe(true)
  })
  it('keeps deletion and reset stamps and does not resurrect removed workouts', async () => {
    const old = state(['removed', 'kept'])
    const local = state(['kept']); local._ts = stampChange(old, local, 100)
    const p = { read: async () => [{ id: 'old', state: old }], append: vi.fn(), compact: vi.fn() }
    const h = harness(local, p); await h.run()
    expect(h.get().workouts.map(w => w.id)).toEqual(['kept'])
    expect(p.append.mock.calls[0][0].deleted).toEqual(local.deleted)
  })
  it('fails closed when the owner changes while fetching', async () => {
    let current = true
    const p = { read: async () => { current = false; return [{ id: 'old-owner', state: state(['private']) }] }, append: vi.fn() }
    const h = harness(state(), p, { current: () => current })
    await expect(h.run()).rejects.toMatchObject({ code: 'cancelled' })
    expect(h.get().workouts).toEqual([]); expect(p.append).not.toHaveBeenCalled()
  })
  it('ignores active sessions and transport markers, but retains synchronization stamps', () => {
    const a = state([], { active: {}, _wid: 'server', _rev: 2, deleted: { workouts: { gone: 2 } } })
    expect(cloudContent(a)).toBe(cloudContent({ ...a, active: { sets: [] }, _ts: 200, _wid: 'other' }))
    expect(cloudState(a).deleted).toEqual(a.deleted)
    expect(cloudContent(a)).not.toBe(cloudContent({ ...a, deleted: {} }))
  })
})
