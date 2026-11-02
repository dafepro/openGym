import { describe, expect, it, vi } from 'vitest'
import { cameraError, createCameraSession } from './camera-session.js'
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function fakeStream() { const track = { stop: vi.fn(), addEventListener: vi.fn() }; return { track, getTracks: () => [track], getVideoTracks: () => [track] } }
function fixture(request) { const onStream = vi.fn(), onError = vi.fn(), onStopped = vi.fn(); return { session: createCameraSession({ request, onStream, onError, onStopped }), onStream, onError, onStopped } }
describe('camera ownership and permission races', () => {
  it('releases permission arriving after disable or unmount', async () => {
    const pending = deferred(), next = fakeStream(), { session, onStream } = fixture(() => pending.promise)
    const loading = session.start('environment'); session.stop(); pending.resolve(next); await loading
    expect(next.track.stop).toHaveBeenCalledOnce(); expect(onStream).not.toHaveBeenCalled()
  })
  it('prevents an earlier camera request from winning and requests no microphone', async () => {
    const first = deferred(), second = deferred(), older = fakeStream(), newer = fakeStream()
    const request = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { session, onStream } = fixture(request)
    const a = session.start('environment'), b = session.start('user')
    second.resolve(newer); await b; first.resolve(older); await a
    expect(older.track.stop).toHaveBeenCalledOnce(); expect(newer.track.stop).not.toHaveBeenCalled(); expect(onStream).toHaveBeenCalledExactlyOnceWith(newer)
    expect(request.mock.calls[0][0].audio).toBe(false); session.stop(); expect(newer.track.stop).toHaveBeenCalledOnce()
  })
  it('stops old streams before switching and handles externally ended tracks', async () => {
    const older = fakeStream(), newer = fakeStream(), request = vi.fn().mockResolvedValueOnce(older).mockResolvedValueOnce(newer)
    const { session, onError } = fixture(request)
    await session.start('environment'); const switching = session.start('user')
    expect(older.track.stop).toHaveBeenCalledOnce(); await switching
    newer.track.addEventListener.mock.calls[0][1]()
    expect(newer.track.stop).toHaveBeenCalledOnce(); expect(onError).toHaveBeenCalledOnce()
  })
  it('ignores stale denial and reports current denial', async () => {
    const first = deferred(), second = deferred(), request = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { session, onError } = fixture(request)
    const a = session.start('user'), b = session.start('environment')
    first.reject({ name: 'NotAllowedError' }); await a; expect(onError).not.toHaveBeenCalled()
    second.reject({ name: 'NotAllowedError' }); await b; expect(cameraError(onError.mock.calls[0][0])).toContain('Timed practice still works')
  })
})

describe('interrupted track', () => {
  it('stops and reports a muted feed so frozen images cannot remain active', async () => {
    const stream = fakeStream(), { session, onError } = fixture(async () => stream)
    await session.start('environment')
    const mute = stream.track.addEventListener.mock.calls.find(([name]) => name === 'mute')[1]
    mute()
    expect(stream.track.stop).toHaveBeenCalledOnce()
    expect(cameraError(onError.mock.calls[0][0])).toContain('interrupted')
  })
})
